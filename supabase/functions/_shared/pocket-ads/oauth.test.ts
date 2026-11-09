import test from 'node:test';
import assert from 'node:assert/strict';
import { motivoDoRetorno, processarRetorno, urlAutorizacao, urlRetornoPocket, validarDadosProprios } from './oauth.ts';
import type { DepsRetorno } from './oauth.ts';

test('urlAutorizacao leva escopos, prompt=consent, offline e estado', () => {
    const u = new URL(urlAutorizacao('cid.apps', 'https://x.supabase.co/functions/v1/google-ads-oauth/retorno', 'est123'));
    assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/adwords openid email');
    assert.equal(u.searchParams.get('prompt'), 'consent');
    assert.equal(u.searchParams.get('access_type'), 'offline');
    assert.equal(u.searchParams.get('response_type'), 'code');
    assert.equal(u.searchParams.get('state'), 'est123');
    assert.equal(u.searchParams.get('client_id'), 'cid.apps');
    assert.equal(u.searchParams.get('redirect_uri'), 'https://x.supabase.co/functions/v1/google-ads-oauth/retorno');
});

test('urlRetornoPocket: ok e erro com motivo codificado', () => {
    assert.equal(urlRetornoPocket('https://app.com/', { ok: true }), 'https://app.com/?view=conectar-claude&google_ads=ok');
    assert.equal(urlRetornoPocket('https://app.com', { ok: false, motivo: 'a b&c' }),
        'https://app.com/?view=conectar-claude&google_ads=erro&motivo=a%20b%26c');
});

test('validarDadosProprios', () => {
    const base = { developer_token: 'd', client_id: 'c', client_secret: 's', refresh_token: 'r' };
    assert.equal(validarDadosProprios({ ...base, login_customer_id: '123-456-7890' }), null);
    assert.equal(validarDadosProprios(base), null);
    assert.equal(validarDadosProprios({ ...base, login_customer_id: '' }), null);
    assert.match(validarDadosProprios({ ...base, login_customer_id: '12345' }) ?? '', /10 dígitos/);
    assert.match(validarDadosProprios({ ...base, refresh_token: ' ' }) ?? '', /refresh_token/);
    assert.ok(validarDadosProprios(null));
    assert.ok(validarDadosProprios({ ...base, developer_token: 5 }));
});

test('motivoDoRetorno', () => {
    assert.equal(motivoDoRetorno(new URLSearchParams('error=access_denied')), 'recusado');
    assert.equal(motivoDoRetorno(new URLSearchParams('error=server_error')), 'erro_google');
    assert.equal(motivoDoRetorno(new URLSearchParams('code=x&state=y')), null);
});

const futuro = () => new Date(Date.now() + 60_000).toISOString();
function deps(o: Partial<DepsRetorno> = {}): DepsRetorno & { apagados: string[]; gravados: unknown[] } {
    const apagados: string[] = [];
    const gravados: unknown[] = [];
    return {
        apagados, gravados,
        buscarEstado: async () => ({ profile_id: 'p1', expira_em: futuro() }),
        apagarEstado: async (e) => { apagados.push(e); },
        trocarCodigo: async () => ({ refresh_token: 'rt', access_token: 'at' }),
        emailDe: async () => 'a@b.com',
        gravarConexao: async (p, email, rt) => { gravados.push({ p, email, rt }); },
        ...o,
    };
}
const q = (s: string) => new URLSearchParams(s);

test('retorno: recusa e erro do Google', async () => {
    assert.deepEqual(await processarRetorno(q('error=access_denied'), deps()), { ok: false, motivo: 'recusado' });
    assert.deepEqual(await processarRetorno(q('error=x'), deps()), { ok: false, motivo: 'erro_google' });
});

test('retorno: estado ausente, desconhecido ou expirado', async () => {
    assert.deepEqual(await processarRetorno(q('code=c'), deps()), { ok: false, motivo: 'expirou' });
    const d1 = deps({ buscarEstado: async () => null });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d1), { ok: false, motivo: 'expirou' });
    const d2 = deps({ buscarEstado: async () => ({ profile_id: 'p', expira_em: new Date(Date.now() - 1000).toISOString() }) });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d2), { ok: false, motivo: 'expirou' });
    assert.deepEqual(d2.apagados, ['e']);
});

test('retorno: sem refresh_token e sem code', async () => {
    const d = deps({ trocarCodigo: async () => ({ access_token: 'at' }) });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d), { ok: false, motivo: 'sem_refresh' });
    assert.equal(d.gravados.length, 0);
    assert.deepEqual(await processarRetorno(q('state=e'), deps()), { ok: false, motivo: 'erro_google' });
});

test('retorno: sucesso grava, apaga o estado; e-mail ausente não é fatal', async () => {
    const d = deps();
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d), { ok: true });
    assert.deepEqual(d.gravados, [{ p: 'p1', email: 'a@b.com', rt: 'rt' }]);
    assert.deepEqual(d.apagados, ['e']);
    const d2 = deps({ emailDe: async () => { throw new Error('x'); } });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d2), { ok: true });
    assert.deepEqual(d2.gravados, [{ p: 'p1', email: null, rt: 'rt' }]);
});

test('retorno: falha ao trocar o código ou gravar vira erro_interno', async () => {
    const d = deps({ trocarCodigo: async () => { throw new Error('boom'); } });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d), { ok: false, motivo: 'erro_interno' });
});
