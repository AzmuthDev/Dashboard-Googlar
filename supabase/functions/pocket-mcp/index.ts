// Edge Function pocket-mcp: conector MCP remoto do Pocket para o Claude do usuário.
// URL: /functions/v1/pocket-mcp/<segredo> (verify_jwt = false; o segredo do link pessoal identifica o usuário).
// Adaptador fino: autentica o link, liga o Repositorio ao Supabase (service_role) e delega a
// _shared/pocket-ads/ferramentas.ts. NUNCA registrar em log a URL, o caminho ou o segredo.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { erroParse, responderMcp } from '../_shared/pocket-ads/mcp.ts';
import { hashToken } from '../_shared/pocket-ads/cifra.ts';
import { criarClienteAds } from '../_shared/pocket-ads/googleAds.ts';
import { criarFerramentas, ErroMesaIncompativel, MESA_VALIDA, montarCredenciais } from '../_shared/pocket-ads/ferramentas.ts';
import type {
    ConexaoGoogle, Empresa, LinhaConexaoGoogle, LinhaMesa, Perfil, RegistroEnvio, Repositorio,
} from '../_shared/pocket-ads/ferramentas.ts';

const INFO = { name: 'pocket', version: '1.0.0' };
const JSON_H = { 'content-type': 'application/json' };
const PAGINA = 1000;
const LOTE_IDS = 100;
const COLUNAS_MESA = 'id, termo_de_pesquisa, campanha, grupo_de_anuncios, palavra_chave, acao, segmentar, negativar, teste_ab, respondido_cliente, data_resposta, observacao';

const env = (k: string) => Deno.env.get(k) ?? '';
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
});

type Resultado<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>;

async function dados<T>(r: Resultado<T>, mesa = false): Promise<T[]> {
    const { data, error } = await r;
    // 42703 = undefined_column: a mesa não tem as colunas de resposta do cliente (ex.: mesa_supress).
    if (error && mesa && error.code === '42703') throw new ErroMesaIncompativel();
    if (error) throw new Error(error.message);
    return data ?? [];
}

/** Lê todas as páginas (PostgREST corta em 1000 linhas). A consulta deve ter ordem estável. */
async function todasAsPaginas<T>(consulta: (de: number, ate: number) => Resultado<T>, mesa = false): Promise<T[]> {
    const saida: T[] = [];
    for (let de = 0; ; de += PAGINA) {
        const pagina = await dados(consulta(de, de + PAGINA - 1), mesa);
        saida.push(...pagina);
        if (pagina.length < PAGINA) return saida;
    }
}

function mesaSegura(mesa: string): string {
    if (!MESA_VALIDA.test(mesa)) throw new Error('Nome de mesa inválido.');
    return mesa;
}

const repositorio: Repositorio = {
    async empresasDoPerfil(p: Perfil): Promise<Empresa[]> {
        if (!p.isAdmin && !p.empresas.length) return [];
        let q = db.from('companies')
            .select('id, name, tableName, google_ads_customer_id, google_ads_login_customer_id')
            .order('name');
        if (!p.isAdmin) q = q.in('id', p.empresas);
        const linhas = await dados<Record<string, string | null>>(q);
        return linhas.map((e) => ({
            id: String(e.id),
            nome: e.name ?? '',
            mesa: e.tableName ?? null,
            customerId: e.google_ads_customer_id ?? null,
            loginCustomerId: e.google_ads_login_customer_id ?? null,
        }));
    },

    linhasRespondidas: (mesa) => todasAsPaginas<LinhaMesa>((de, ate) =>
        db.from(mesaSegura(mesa)).select(COLUNAS_MESA).eq('respondido_cliente', true).order('id').range(de, ate), true),

    async linhasPorIds(mesa, ids) {
        const saida: LinhaMesa[] = [];
        for (let i = 0; i < ids.length; i += LOTE_IDS) {
            saida.push(...await dados<LinhaMesa>(db.from(mesaSegura(mesa)).select(COLUNAS_MESA).in('id', ids.slice(i, i + LOTE_IDS)), true));
        }
        return saida;
    },

    async jaSubidos(mesa, tipo) {
        const linhas = await todasAsPaginas<{ linha_id: string }>((de, ate) =>
            db.from('envios_google_ads').select('linha_id')
                .eq('mesa', mesa).eq('tipo', tipo).in('status', ['ok', 'ja_existia'])
                .order('id').range(de, ate));
        return new Set(linhas.map((l) => l.linha_id));
    },

    async registrarEnvios(registros: RegistroEnvio[]) {
        for (let i = 0; i < registros.length; i += 500) {
            const { error } = await db.from('envios_google_ads').insert(registros.slice(i, i + 500));
            if (error) throw new Error(error.message);
        }
    },
};

/** Último segmento não vazio do caminho (…/pocket-mcp/<segredo>). */
function segredoDe(req: Request): string | null {
    const partes = new URL(req.url).pathname.split('/').filter(Boolean);
    const ultimo = partes[partes.length - 1];
    return ultimo && ultimo !== 'pocket-mcp' ? ultimo : null;
}

const naoAutorizado = () => new Response(null, { status: 401 });

/** Não atrasa a resposta; no Edge Runtime mantém a tarefa viva depois do retorno. */
function emSegundoPlano(p: Promise<unknown>) {
    const tarefa = p.catch(() => {});
    (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(tarefa);
}

Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });

    const segredo = segredoDe(req);
    if (!segredo) return naoAutorizado();
    const { data: link, error: erroLink } = await db.from('claude_conexoes')
        .select('id, profile_id')
        .eq('token_hash', await hashToken(segredo))
        .is('revogado_em', null)
        .maybeSingle();
    if (erroLink) return new Response(null, { status: 500 });
    if (!link) return naoAutorizado();

    emSegundoPlano(Promise.resolve(
        db.from('claude_conexoes').update({ ultimo_uso: new Date().toISOString() }).eq('id', link.id),
    ));

    const { data: p } = await db.from('profiles')
        .select('id, name, email, is_admin, assigned_company_ids')
        .eq('id', link.profile_id)
        .maybeSingle();
    if (!p) return naoAutorizado();
    const perfil: Perfil = {
        id: String(p.id),
        isAdmin: p.is_admin === true,
        empresas: Array.isArray(p.assigned_company_ids) ? p.assigned_company_ids.map(String) : [],
        nome: p.name ?? null,
        email: p.email ?? null,
    };

    let corpo: unknown;
    try {
        corpo = await req.json();
    } catch {
        return new Response(JSON.stringify(erroParse()), { status: 200, headers: JSON_H });
    }

    // Conexão Google Ads lida uma vez por requisição, só quando alguma ferramenta precisa.
    let conexaoLida: Promise<(LinhaConexaoGoogle & { google_email: string | null }) | null> | null = null;
    const linhaConexao = () => {
        conexaoLida ??= Promise.resolve(db.from('google_ads_conexoes')
            .select('modo, google_email, refresh_token_cifrado, developer_token_cifrado, client_id, client_secret_cifrado, login_customer_id')
            .eq('profile_id', perfil.id)
            .is('revogado_em', null)
            .maybeSingle())
            .then(({ data, error }) => {
                if (error) throw new Error(error.message);
                return data;
            });
        return conexaoLida;
    };

    const ferramentas = criarFerramentas({
        perfil,
        db: repositorio,
        ads: (cred) => criarClienteAds(cred),
        conexao: async (): Promise<ConexaoGoogle | null> => {
            const c = await linhaConexao();
            return c ? { modo: c.modo, googleEmail: c.google_email } : null;
        },
        credenciais: async (cliente) => montarCredenciais(await linhaConexao(), cliente, {
            developerToken: env('GOOGLE_ADS_DEVELOPER_TOKEN'),
            clientId: env('GOOGLE_OAUTH_CLIENT_ID'),
            clientSecret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
            chave: env('POCKET_CRYPTO_KEY'),
        }),
    });

    const r = await responderMcp(corpo, ferramentas, INFO);
    return r.corpo === undefined
        ? new Response(null, { status: r.status })
        : new Response(JSON.stringify(r.corpo), { status: r.status, headers: JSON_H });
});
