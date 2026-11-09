// Protocolo MCP (JSON-RPC 2.0) mínimo e sem estado, para a Edge Function do conector.

export interface Ferramenta {
    name: string;
    description: string;
    inputSchema: object;
    executar(args: Record<string, unknown>): Promise<unknown>;
}

/** Erro cuja mensagem pode ser mostrada ao Claude. Seguro para herdar. */
export class ErroUsuario extends Error {
    constructor(mensagem: string) {
        super(mensagem);
        this.name = 'ErroUsuario';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

interface RespostaErro {
    jsonrpc: '2.0';
    id: unknown;
    error: { code: number; message: string };
}
interface RespostaOk {
    jsonrpc: '2.0';
    id: unknown;
    result: unknown;
}
type Resposta = RespostaOk | RespostaErro;

const VERSOES = ['2025-11-25', '2025-06-18', '2025-03-26'];
const VERSAO_PADRAO = '2025-06-18';

const erro = (id: unknown, code: number, message: string): RespostaErro => ({ jsonrpc: '2.0', id, error: { code, message } });
const ok = (id: unknown, result: unknown): RespostaOk => ({ jsonrpc: '2.0', id, result });

/** Resposta para JSON que não pôde ser lido (-32700); o chamador usa quando `JSON.parse` falha. */
export const erroParse = (): RespostaErro => erro(null, -32700, 'JSON inválido.');

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const texto = (text: string, isError?: boolean) => ({ content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) });

const chamarFerramenta = async (params: unknown, ferramentas: Ferramenta[], id: unknown): Promise<Resposta> => {
    const p = ehObjeto(params) ? params : {};
    const nome = typeof p.name === 'string' ? p.name : '';
    const ferramenta = ferramentas.find((f) => f.name === nome);
    if (!ferramenta) return erro(id, -32602, `Ferramenta desconhecida: ${nome}`);
    const args = ehObjeto(p.arguments) ? p.arguments : {};
    try {
        const resultado = await ferramenta.executar(args);
        return ok(id, texto(JSON.stringify(resultado, null, 2) ?? 'null'));
    } catch (e) {
        if (e instanceof ErroUsuario) return ok(id, texto(e.message, true));
        console.error(`Erro na ferramenta ${nome}:`, e);
        return ok(id, texto('Erro interno no Pocket', true));
    }
};

const tratar = async (
    msg: unknown,
    ferramentas: Ferramenta[],
    info: { name: string; version: string },
): Promise<Resposta | null> => {
    if (!ehObjeto(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
        return erro(ehObjeto(msg) && 'id' in msg ? msg.id : null, -32600, 'Requisição inválida.');
    }
    if (!('id' in msg) || msg.id === undefined) return null; // notificação
    const id = msg.id;
    switch (msg.method) {
        case 'initialize': {
            const pedida = ehObjeto(msg.params) ? msg.params.protocolVersion : undefined;
            const protocolVersion = typeof pedida === 'string' && VERSOES.includes(pedida) ? pedida : VERSAO_PADRAO;
            return ok(id, { protocolVersion, capabilities: { tools: {} }, serverInfo: info });
        }
        case 'ping':
            return ok(id, {});
        case 'tools/list':
            return ok(id, { tools: ferramentas.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
        case 'tools/call':
            return await chamarFerramenta(msg.params, ferramentas, id);
        default:
            return erro(id, -32601, `Método não suportado: ${msg.method}`);
    }
};

export const responderMcp = async (
    corpo: unknown,
    ferramentas: Ferramenta[],
    info: { name: string; version: string },
): Promise<{ status: number; corpo?: unknown }> => {
    if (Array.isArray(corpo)) {
        if (corpo.length === 0) return { status: 200, corpo: erro(null, -32600, 'Requisição inválida.') };
        const respostas = (await Promise.all(corpo.map((m) => tratar(m, ferramentas, info)))).filter((r): r is Resposta => r !== null);
        return respostas.length ? { status: 200, corpo: respostas } : { status: 202 };
    }
    const resposta = await tratar(corpo, ferramentas, info);
    return resposta ? { status: 200, corpo: resposta } : { status: 202 };
};
