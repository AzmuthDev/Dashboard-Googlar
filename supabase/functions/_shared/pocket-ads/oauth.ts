// Regras puras da conexão do Google Ads (Edge Function google-ads-oauth). Sem acesso a rede nem a banco:
// tudo que toca o mundo externo entra por `DepsRetorno`, para testar os ramos do retorno do Google.
import { hashToken, novoSegredo } from './cifra.ts';

const ESCOPOS = 'https://www.googleapis.com/auth/adwords openid email';

export const urlAutorizacao = (clientId: string, redirectUri: string, estado: string): string => {
    const p = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: ESCOPOS,
        access_type: 'offline',
        prompt: 'consent',
        state: estado,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
};

export type ResultadoConexao =
    | { ok: true }
    | { ok: 'confirmar'; confirmacao: string }
    | { ok: false; motivo: string };

export const urlRetornoPocket = (appUrl: string, r: ResultadoConexao): string => {
    const base = `${appUrl.replace(/\/+$/, '')}/?view=conectar-claude`;
    if (r.ok === true) return `${base}&google_ads=ok`;
    if (r.ok === 'confirmar') return `${base}&google_ads=confirmar&confirmacao=${encodeURIComponent(r.confirmacao)}`;
    return `${base}&google_ads=erro&motivo=${encodeURIComponent(r.motivo)}`;
};

export const normalizarIdConta = (v: string): string => v.replace(/-/g, '').trim();

const CAMPOS_PROPRIOS: Array<[string, string]> = [
    ['developer_token', 'Developer token'],
    ['client_id', 'Client ID'],
    ['client_secret', 'Client secret'],
    ['refresh_token', 'Refresh token'],
];

/** Mensagem de erro (pt-BR) se os dados do modo avançado forem inválidos; `null` se estiverem ok. */
export const validarDadosProprios = (d: unknown): string | null => {
    if (!d || typeof d !== 'object') return 'Envie os dados da conexão.';
    const o = d as Record<string, unknown>;
    for (const [chave, rotulo] of CAMPOS_PROPRIOS) {
        const v = o[chave];
        if (typeof v !== 'string' || !v.trim()) return `Falta o campo ${chave} (${rotulo}).`;
    }
    const login = o.login_customer_id;
    if (login !== undefined && login !== null && login !== '') {
        if (typeof login !== 'string' || !/^\d{10}$/.test(normalizarIdConta(login))) {
            return 'O ID da conta gerenciadora (login_customer_id) deve ter 10 dígitos.';
        }
    }
    return null;
};

/** Motivo de falha informado pelo próprio Google no retorno (`error=…`), ou `null` se não houve. */
export const motivoDoRetorno = (p: URLSearchParams): string | null => {
    const e = p.get('error');
    if (!e) return null;
    return e === 'access_denied' ? 'recusado' : 'erro_google';
};


export interface LinhaEstado {
    profile_id: string;
    expira_em: string;
    confirmacao_hash?: string | null;
    refresh_token_cifrado?: string | null;
    google_email?: string | null;
}

export interface DepsRetorno {
    buscarEstado(estado: string): Promise<LinhaEstado | null>;
    apagarEstado(estado: string): Promise<void>;
    trocarCodigo(codigo: string): Promise<{ refresh_token?: string; access_token?: string }>;
    emailDe(accessToken: string): Promise<string | null>;
    /** Cifra e guarda o refresh token no estado (mantendo expira_em), junto do hash do código de confirmação. */
    guardarConfirmacao(estado: string, email: string | null, refreshToken: string, confirmacaoHash: string): Promise<void>;
}

/**
 * Processa o GET /retorno. Não grava a conexão: guarda o token no estado e devolve um código de
 * confirmação, que só o navegador logado que iniciou o fluxo conhece (POST /confirmar).
 * Nunca lança: qualquer falha inesperada vira `erro_interno`.
 */
export async function processarRetorno(p: URLSearchParams, deps: DepsRetorno): Promise<ResultadoConexao> {
    const doGoogle = motivoDoRetorno(p);
    if (doGoogle) return { ok: false, motivo: doGoogle };
    try {
        const estado = p.get('state');
        if (!estado) return { ok: false, motivo: 'expirou' };
        const linha = await deps.buscarEstado(estado);
        if (!linha) return { ok: false, motivo: 'expirou' };
        if (linha.confirmacao_hash) return { ok: false, motivo: 'expirou' }; // já usado
        if (new Date(linha.expira_em).getTime() <= Date.now()) {
            await deps.apagarEstado(estado);
            return { ok: false, motivo: 'expirou' };
        }
        const codigo = p.get('code');
        if (!codigo) return { ok: false, motivo: 'erro_google' };
        const tokens = await deps.trocarCodigo(codigo);
        if (!tokens.refresh_token) return { ok: false, motivo: 'sem_refresh' };
        let email: string | null = null;
        if (tokens.access_token) {
            try { email = await deps.emailDe(tokens.access_token); } catch { email = null; }
        }
        const confirmacao = novoSegredo();
        await deps.guardarConfirmacao(estado, email, tokens.refresh_token, await hashToken(confirmacao));
        return { ok: 'confirmar', confirmacao };
    } catch {
        return { ok: false, motivo: 'erro_interno' };
    }
}

/** Valida a linha de estado retirada pelo /confirmar. `true` só se tudo bater com o usuário do JWT. */
export function validarConfirmacao(
    linha: LinhaEstado | null | undefined,
    jwtUserId: string,
    hashDoCodigo: string,
    agora: number,
): boolean {
    if (!linha) return false;
    if (linha.profile_id !== jwtUserId) return false;
    if (new Date(linha.expira_em).getTime() <= agora) return false;
    if (!linha.confirmacao_hash || linha.confirmacao_hash !== hashDoCodigo) return false;
    return !!linha.refresh_token_cifrado;
}
