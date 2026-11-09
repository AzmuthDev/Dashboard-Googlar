// Edge Function google-ads-oauth: cada usuário conecta o próprio Google Ads ao Pocket.
// Rotas (último segmento do caminho): POST /iniciar, GET /retorno, POST /proprio, POST /desconectar.
// verify_jwt = false: /retorno é chamado pelo Google (sem JWT); as demais rotas validam o JWT aqui.
// NUNCA registrar em log tokens, segredos, códigos ou corpos de requisição/resposta.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cifrar, decifrar, novoSegredo } from '../_shared/pocket-ads/cifra.ts';
import { criarClienteAds, ErroConexaoGoogle } from '../_shared/pocket-ads/googleAds.ts';
import { ErroUsuario } from '../_shared/pocket-ads/mcp.ts';
import {
    normalizarIdConta, processarRetorno, urlAutorizacao, urlRetornoPocket, validarDadosProprios,
} from '../_shared/pocket-ads/oauth.ts';
import type { DepsRetorno } from '../_shared/pocket-ads/oauth.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_REVOGAR = 'https://oauth2.googleapis.com/revoke';
const URL_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';
const VALIDADE_ESTADO_MS = 10 * 60_000;
const SEM_CONFIG = 'Pocket sem configuração do Google Ads. Avise o administrador.';

const env = (k: string) => Deno.env.get(k) ?? '';
const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const redirecionar = (url: string) => new Response(null, { status: 302, headers: { Location: url } });

const ENV_OBRIGATORIAS = [
    'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'POCKET_CRYPTO_KEY',
    'POCKET_APP_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
];
const configurado = () => ENV_OBRIGATORIAS.every((k) => env(k));

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
});

const redirectUri = () => `${env('SUPABASE_URL').replace(/\/+$/, '')}/functions/v1/google-ads-oauth/retorno`;

function falhou(contexto: string, e: unknown) {
    // Só o nome do erro local; nada vindo de corpos HTTP que possam conter segredos.
    console.error(`google-ads-oauth: ${contexto}`, e instanceof Error ? e.name : 'erro');
}

async function usuarioDoJwt(req: Request): Promise<string | null> {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
    if (!m) return null;
    const { data, error } = await db.auth.getUser(m[1]);
    return error || !data.user ? null : data.user.id;
}

const depsRetorno: DepsRetorno = {
    async buscarEstado(estado) {
        const { data, error } = await db.from('google_ads_oauth_estados')
            .select('profile_id, expira_em').eq('estado', estado).maybeSingle();
        if (error) throw new Error(error.message);
        return data ? { profile_id: String(data.profile_id), expira_em: String(data.expira_em) } : null;
    },
    async apagarEstado(estado) {
        await db.from('google_ads_oauth_estados').delete().eq('estado', estado);
    },
    async trocarCodigo(codigo) {
        const r = await fetch(URL_TOKEN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: codigo,
                client_id: env('GOOGLE_OAUTH_CLIENT_ID'),
                client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
                redirect_uri: redirectUri(),
                grant_type: 'authorization_code',
            }),
        });
        if (!r.ok) throw new Error(`token HTTP ${r.status}`);
        const d = await r.json();
        return { refresh_token: d.refresh_token, access_token: d.access_token };
    },
    async emailDe(accessToken) {
        const r = await fetch(URL_USERINFO, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!r.ok) return null;
        const d = await r.json();
        return typeof d.email === 'string' ? d.email : null;
    },
    async gravarConexao(profileId, email, refreshToken) {
        const { error } = await db.from('google_ads_conexoes').upsert({
            profile_id: profileId,
            modo: 'pocket',
            google_email: email,
            refresh_token_cifrado: await cifrar(refreshToken, env('POCKET_CRYPTO_KEY')),
            developer_token_cifrado: null,
            client_id: null,
            client_secret_cifrado: null,
            login_customer_id: null,
            atualizado_em: new Date().toISOString(),
            revogado_em: null,
        }, { onConflict: 'profile_id' });
        if (error) throw new Error(error.message);
    },
};

async function retorno(req: Request): Promise<Response> {
    const app = env('POCKET_APP_URL');
    if (!configurado()) {
        return app ? redirecionar(urlRetornoPocket(app, { ok: false, motivo: 'configuracao' })) : json({ erro: SEM_CONFIG }, 500);
    }
    const logando: DepsRetorno = {
        ...depsRetorno,
        trocarCodigo: (c) => depsRetorno.trocarCodigo(c).catch((e) => { falhou('troca do código', e); throw e; }),
        gravarConexao: (p, m, t) => depsRetorno.gravarConexao(p, m, t).catch((e) => { falhou('gravação', e); throw e; }),
    };
    const r = await processarRetorno(new URL(req.url).searchParams, logando);
    return redirecionar(urlRetornoPocket(app, r));
}

async function iniciar(profileId: string): Promise<Response> {
    const agora = Date.now();
    await db.from('google_ads_oauth_estados').delete()
        .eq('profile_id', profileId).lt('expira_em', new Date(agora).toISOString());
    const estado = novoSegredo();
    const { error } = await db.from('google_ads_oauth_estados').insert({
        estado, profile_id: profileId, expira_em: new Date(agora + VALIDADE_ESTADO_MS).toISOString(),
    });
    if (error) throw new Error(error.message);
    return json({ url: urlAutorizacao(env('GOOGLE_OAUTH_CLIENT_ID'), redirectUri(), estado) });
}

async function proprio(profileId: string, req: Request): Promise<Response> {
    let corpo: unknown;
    try { corpo = await req.json(); } catch { return json({ erro: 'Envie os dados em JSON.' }, 400); }
    const invalido = validarDadosProprios(corpo);
    if (invalido) return json({ erro: invalido }, 400);
    const c = corpo as Record<string, string | undefined>;
    const login = c.login_customer_id ? normalizarIdConta(c.login_customer_id) : undefined;
    const cred = {
        developerToken: c.developer_token!.trim(),
        clientId: c.client_id!.trim(),
        clientSecret: c.client_secret!.trim(),
        refreshToken: c.refresh_token!.trim(),
        loginCustomerId: login,
    };
    let contas: string[];
    try {
        contas = await criarClienteAds(cred).contasAcessiveis();
    } catch (e) {
        if (e instanceof ErroUsuario || e instanceof ErroConexaoGoogle) return json({ erro: e.message }, 400);
        throw e;
    }
    const chave = env('POCKET_CRYPTO_KEY');
    const { error } = await db.from('google_ads_conexoes').upsert({
        profile_id: profileId,
        modo: 'proprio',
        google_email: null,
        refresh_token_cifrado: await cifrar(cred.refreshToken, chave),
        developer_token_cifrado: await cifrar(cred.developerToken, chave),
        client_id: cred.clientId,
        client_secret_cifrado: await cifrar(cred.clientSecret, chave),
        login_customer_id: login ?? null,
        atualizado_em: new Date().toISOString(),
        revogado_em: null,
    }, { onConflict: 'profile_id' });
    if (error) throw new Error(error.message);
    return json({ ok: true, contas });
}

async function desconectar(profileId: string): Promise<Response> {
    const { data, error } = await db.from('google_ads_conexoes')
        .select('refresh_token_cifrado, revogado_em').eq('profile_id', profileId).maybeSingle();
    if (error) throw new Error(error.message);
    if (data && !data.revogado_em) {
        try {
            const token = await decifrar(String(data.refresh_token_cifrado), env('POCKET_CRYPTO_KEY'));
            await fetch(URL_REVOGAR, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ token }),
            });
        } catch { /* melhor esforço: a revogação no Google pode falhar sem impedir a desconexão */ }
        const agora = new Date().toISOString();
        const { error: e2 } = await db.from('google_ads_conexoes')
            .update({ revogado_em: agora, atualizado_em: agora }).eq('profile_id', profileId);
        if (e2) throw new Error(e2.message);
    }
    return json({ ok: true });
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const rota = new URL(req.url).pathname.split('/').filter(Boolean).pop();
    try {
        if (rota === 'retorno' && req.method === 'GET') return await retorno(req);
        if (!['iniciar', 'proprio', 'desconectar'].includes(rota ?? '') || req.method !== 'POST') {
            return json({ erro: 'Rota não encontrada.' }, 404);
        }
        if (!configurado()) return json({ erro: SEM_CONFIG }, 500);
        const profileId = await usuarioDoJwt(req);
        if (!profileId) return json({ erro: 'Sessão inválida. Entre de novo no Pocket.' }, 401);
        if (rota === 'iniciar') return await iniciar(profileId);
        if (rota === 'proprio') return await proprio(profileId, req);
        return await desconectar(profileId);
    } catch (e) {
        falhou(`rota ${rota}`, e);
        if (rota === 'retorno') return redirecionar(urlRetornoPocket(env('POCKET_APP_URL'), { ok: false, motivo: 'erro_interno' }));
        return json({ erro: 'Erro inesperado. Tente de novo.' }, 500);
    }
});
