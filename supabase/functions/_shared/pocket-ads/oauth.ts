// Regras puras da conexão do Google Ads (Edge Function google-ads-oauth). Sem acesso a rede nem a banco:
// tudo que toca o mundo externo entra por `DepsRetorno`, para testar os ramos do retorno do Google.
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

export type ResultadoConexao = { ok: true } | { ok: false; motivo: string };

export const urlRetornoPocket = (appUrl: string, r: ResultadoConexao): string => {
    const base = `${appUrl.replace(/\/+$/, '')}/?view=conectar-claude`;
    return r.ok ? `${base}&google_ads=ok` : `${base}&google_ads=erro&motivo=${encodeURIComponent(r.motivo)}`;
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

export interface DepsRetorno {
    buscarEstado(estado: string): Promise<{ profile_id: string; expira_em: string } | null>;
    apagarEstado(estado: string): Promise<void>;
    trocarCodigo(codigo: string): Promise<{ refresh_token?: string; access_token?: string }>;
    emailDe(accessToken: string): Promise<string | null>;
    gravarConexao(profileId: string, email: string | null, refreshToken: string): Promise<void>;
}

/** Processa o GET /retorno. Nunca lança: qualquer falha inesperada vira `erro_interno`. */
export async function processarRetorno(p: URLSearchParams, deps: DepsRetorno): Promise<ResultadoConexao> {
    const doGoogle = motivoDoRetorno(p);
    if (doGoogle) return { ok: false, motivo: doGoogle };
    try {
        const estado = p.get('state');
        if (!estado) return { ok: false, motivo: 'expirou' };
        const linha = await deps.buscarEstado(estado);
        if (!linha) return { ok: false, motivo: 'expirou' };
        await deps.apagarEstado(estado); // uso único
        if (new Date(linha.expira_em).getTime() <= Date.now()) return { ok: false, motivo: 'expirou' };
        const codigo = p.get('code');
        if (!codigo) return { ok: false, motivo: 'erro_google' };
        const tokens = await deps.trocarCodigo(codigo);
        if (!tokens.refresh_token) return { ok: false, motivo: 'sem_refresh' };
        let email: string | null = null;
        if (tokens.access_token) {
            try { email = await deps.emailDe(tokens.access_token); } catch { email = null; }
        }
        await deps.gravarConexao(linha.profile_id, email, tokens.refresh_token);
        return { ok: true };
    } catch {
        return { ok: false, motivo: 'erro_interno' };
    }
}
