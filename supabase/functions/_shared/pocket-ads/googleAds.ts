// Cliente REST da Google Ads API, usado pelas Edge Functions. `fetch` injetável para testes.
// Segurança: mensagens de erro vêm só do `message`/`errorCode` devolvido pelo Google, nunca de corpos ou
// cabeçalhos da requisição, para não vazar refresh token, client secret, developer token ou access token.
import { chaveExistente } from './destinos.ts';
import type { Catalogo, Match } from './destinos.ts';
import { GOOGLE_ADS_API_VERSION } from './operacoes.ts';
import type { Mutacao } from './operacoes.ts';
import { ErroUsuario } from './mcp.ts';

export interface Credenciais {
    developerToken: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    loginCustomerId?: string;
}

export class ErroConexaoGoogle extends ErroUsuario {
    constructor(mensagem = 'Reconecte o Google Ads em Pocket › Conectar ao Claude.') {
        super(mensagem);
        this.name = 'ErroConexaoGoogle';
    }
}

export type ClienteAds = ReturnType<typeof criarClienteAds>;

const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/`;
const MARGEM_MS = 60_000;

/** Mesma regra de operacoes.ts: tira `customers/` e traços. */
const normalizarId = (id: string): string => id.replace(/^customers\//, '').replace(/-/g, '');

interface ErroGoogle {
    error?: {
        code?: number;
        message?: string;
        status?: string;
        details?: { errors?: { errorCode?: Record<string, string>; message?: string }[] }[];
    };
}

async function lerJson(r: Response): Promise<any> {
    const texto = await r.text();
    try {
        return texto ? JSON.parse(texto) : {};
    } catch {
        throw new ErroUsuario(`Resposta inesperada do Google Ads (HTTP ${r.status}).`);
    }
}

export function criarClienteAds(cred: Credenciais, f: typeof fetch = fetch) {
    const loginId = cred.loginCustomerId ? normalizarId(cred.loginCustomerId) : undefined;
    let token: { valor: string; expiraEm: number } | null = null;

    async function accessToken(): Promise<string> {
        if (token && Date.now() < token.expiraEm) return token.valor;
        let r: Response;
        try {
            r = await f(URL_TOKEN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: cred.refreshToken,
                    client_id: cred.clientId,
                    client_secret: cred.clientSecret,
                }).toString(),
            });
        } catch {
            throw new ErroUsuario('Não foi possível contatar o Google para renovar o acesso.');
        }
        const corpo = await lerJson(r);
        if (!r.ok || !corpo.access_token) {
            const codigo = typeof corpo.error === 'string' ? corpo.error : '';
            if (codigo === 'invalid_grant') throw new ErroConexaoGoogle();
            throw new ErroUsuario(`Falha ao renovar o acesso ao Google${codigo ? ` (${codigo})` : ''}.`);
        }
        const segundos = Number(corpo.expires_in) || 3600;
        token = { valor: String(corpo.access_token), expiraEm: Date.now() + segundos * 1000 - MARGEM_MS };
        return token.valor;
    }

    async function chamar(caminho: string, metodo: 'GET' | 'POST', corpo: unknown, customerId?: string): Promise<any> {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${await accessToken()}`,
            'developer-token': cred.developerToken,
        };
        if (loginId) headers['login-customer-id'] = loginId;
        const init: RequestInit = { method: metodo, headers };
        if (metodo === 'POST') {
            headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(corpo);
        }
        let r: Response;
        try {
            r = await f(BASE + caminho, init);
        } catch {
            throw new ErroUsuario('Não foi possível contatar o Google Ads.');
        }
        const dados = await lerJson(r);
        if (r.ok) return dados;

        const e = (dados as ErroGoogle).error;
        const codigos = (e?.details ?? []).flatMap((d) => d.errors ?? []);
        if (r.status === 401 || e?.status === 'UNAUTHENTICATED') throw new ErroConexaoGoogle();
        if (r.status === 403 && codigos.some((x) => x.errorCode?.authorizationError === 'USER_PERMISSION_DENIED')) {
            throw new ErroUsuario(customerId
                ? `Sua conta Google não tem acesso à conta ${customerId} do Google Ads.`
                : 'Sua conta Google não tem acesso ao Google Ads.');
        }
        const msg = e?.message || codigos.find((x) => x.message)?.message;
        throw new ErroUsuario(msg ? `Google Ads: ${msg}` : `Erro do Google Ads (HTTP ${r.status}).`);
    }

    return {
        async pesquisar(customerId: string, gaql: string): Promise<Record<string, unknown>[]> {
            const c = normalizarId(customerId);
            const saida: Record<string, unknown>[] = [];
            let pageToken: string | undefined;
            do {
                const corpo: Record<string, unknown> = { query: gaql };
                if (pageToken) corpo.pageToken = pageToken;
                const d = await chamar(`customers/${c}/googleAds:search`, 'POST', corpo, c);
                saida.push(...((d.results as Record<string, unknown>[] | undefined) ?? []));
                pageToken = d.nextPageToken || undefined;
            } while (pageToken);
            return saida;
        },

        async mutar(customerId: string, m: Mutacao, validateOnly: boolean): Promise<unknown> {
            const c = normalizarId(customerId);
            return chamar(`customers/${c}/${m.servico}:mutate`, 'POST',
                { operations: m.operations, partialFailure: true, validateOnly }, c);
        },

        async contasAcessiveis(): Promise<string[]> {
            const d = await chamar('customers:listAccessibleCustomers', 'GET', undefined);
            return ((d.resourceNames as string[] | undefined) ?? []).map(normalizarId);
        },
    };
}

export interface OpcoesCatalogo {
    /** Negativas (true) ou positivas (false, padrão) para escopos `g:`. */
    negativas?: boolean;
    /** Id do shared set de negativas da conta (escopo `conta`). */
    contaListaId?: string;
}

function ids(valores: string[]): string[] {
    for (const v of valores) {
        if (!/^\d+$/.test(v)) throw new ErroUsuario(`Identificador inválido: "${v.slice(0, 30)}".`);
    }
    return [...new Set(valores)];
}

export async function carregarCatalogo(
    ads: ClienteAds, customerId: string, escopos: string[], opcoes: OpcoesCatalogo = {},
): Promise<Catalogo> {
    const grupos = ids(escopos.filter((e) => e.startsWith('g:')).map((e) => e.slice(2)));
    const campanhas = ids(escopos.filter((e) => e.startsWith('c:')).map((e) => e.slice(2)));
    const listas = ids(escopos.filter((e) => e.startsWith('l:')).map((e) => e.slice(2)));
    const contaId = escopos.includes('conta') && opcoes.contaListaId ? ids([opcoes.contaListaId])[0] : undefined;

    const [rc, rg] = await Promise.all([
        ads.pesquisar(customerId,
            "SELECT campaign.id, campaign.name, campaign.advertising_channel_type FROM campaign WHERE campaign.status != 'REMOVED'"),
        ads.pesquisar(customerId,
            "SELECT ad_group.id, ad_group.name, campaign.id FROM ad_group WHERE ad_group.status != 'REMOVED'"),
    ]);
    const s = (v: unknown) => (v === undefined || v === null ? '' : String(v));
    const cat: Catalogo = {
        campanhas: rc.map((l: any) => ({ id: s(l.campaign?.id), nome: s(l.campaign?.name), tipoCanal: s(l.campaign?.advertisingChannelType) })),
        grupos: rg.map((l: any) => ({ id: s(l.adGroup?.id), nome: s(l.adGroup?.name), campanhaId: s(l.campaign?.id) })),
        existentes: new Set<string>(),
    };

    const addKeyword = (escopo: string, kw: any) => {
        if (!kw?.text || !kw.matchType) return;
        cat.existentes.add(chaveExistente(escopo, String(kw.text), kw.matchType as Match));
    };

    const tarefas: Promise<void>[] = [];
    if (grupos.length) {
        const neg = opcoes.negativas ?? false;
        tarefas.push(ads.pesquisar(customerId,
            'SELECT ad_group.id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion ' +
            `WHERE ad_group.id IN (${grupos.join(', ')}) AND ad_group_criterion.type = KEYWORD ` +
            `AND ad_group_criterion.status != 'REMOVED' AND ad_group_criterion.negative = ${neg}`,
        ).then((rs) => rs.forEach((l: any) => addKeyword(`g:${s(l.adGroup?.id)}`, l.adGroupCriterion?.keyword))));
    }
    if (campanhas.length) {
        tarefas.push(ads.pesquisar(customerId,
            'SELECT campaign.id, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion ' +
            `WHERE campaign.id IN (${campanhas.join(', ')}) AND campaign_criterion.type = KEYWORD ` +
            'AND campaign_criterion.negative = true',
        ).then((rs) => rs.forEach((l: any) => addKeyword(`c:${s(l.campaign?.id)}`, l.campaignCriterion?.keyword))));
    }
    const consultaCompartilhada = (lista: string[], escopoDe: (id: string) => string) =>
        ads.pesquisar(customerId,
            'SELECT shared_set.id, shared_criterion.keyword.text, shared_criterion.keyword.match_type FROM shared_criterion ' +
            `WHERE shared_set.id IN (${lista.join(', ')}) AND shared_criterion.type = KEYWORD`,
        ).then((rs) => rs.forEach((l: any) => addKeyword(escopoDe(s(l.sharedSet?.id)), l.sharedCriterion?.keyword)));
    if (listas.length) tarefas.push(consultaCompartilhada(listas, (id) => `l:${id}`));
    if (contaId) tarefas.push(consultaCompartilhada([contaId], () => 'conta'));
    await Promise.all(tarefas);
    return cat;
}
