import test from 'node:test';
import assert from 'node:assert/strict';
import { motivoDoRetorno, processarRetorno, urlAutorizacao, urlRetornoPocket, validarConfirmacao, validarDadosProprios } from './oauth.ts';
import { hashToken } from './cifra.ts';
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
    const { developer_token: _omitido, ...semDev } = base;
    assert.equal(validarDadosProprios(semDev), null);
    assert.equal(validarDadosProprios({ ...semDev, developer_token: '' }), null);
    assert.equal(validarDadosProprios({ ...semDev, developer_token: null }), null);
});

test('motivoDoRetorno', () => {
    assert.equal(motivoDoRetorno(new URLSearchParams('error=access_denied')), 'recusado');
    assert.equal(motivoDoRetorno(new URLSearchParams('error=server_error')), 'erro_google');
    assert.equal(motivoDoRetorno(new URLSearchParams('code=x&state=y')), null);
});

const futuro = () => new Date(Date.now() + 60_000).toISOString();
type Guardado = { estado: string; email: string | null; rt: string; hash: string };
function deps(o: Partial<DepsRetorno> = {}): DepsRetorno & { apagados: string[]; guardados: Guardado[] } {
    const apagados: string[] = [];
    const guardados: Guardado[] = [];
    return {
        apagados, guardados,
        buscarEstado: async () => ({ profile_id: 'p1', expira_em: futuro() }),
        apagarEstado: async (e) => { apagados.push(e); },
        trocarCodigo: async () => ({ refresh_token: 'rt', access_token: 'at' }),
        emailDe: async () => 'a@b.com',
        guardarConfirmacao: async (estado, email, rt, hash) => { guardados.push({ estado, email, rt, hash }); },
        ...o,
    };
}
const q = (s: string) => new URLSearchParams(s);

test('retorno: recusa e erro do Google', async () => {
    assert.deepEqual(await processarRetorno(q('error=access_denied'), deps()), { ok: false, motivo: 'recusado' });
    assert.deepEqual(await processarRetorno(q('error=x'), deps()), { ok: false, motivo: 'erro_google' });
});

test('retorno: estado ausente, desconhecido, expirado ou já usado', async () => {
    assert.deepEqual(await processarRetorno(q('code=c'), deps()), { ok: false, motivo: 'expirou' });
    const d1 = deps({ buscarEstado: async () => null });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d1), { ok: false, motivo: 'expirou' });
    const d2 = deps({ buscarEstado: async () => ({ profile_id: 'p', expira_em: new Date(Date.now() - 1000).toISOString() }) });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d2), { ok: false, motivo: 'expirou' });
    assert.deepEqual(d2.apagados, ['e']);
    const d3 = deps({ buscarEstado: async () => ({ profile_id: 'p', expira_em: futuro(), confirmacao_hash: 'h' }) });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d3), { ok: false, motivo: 'expirou' });
    assert.equal(d3.guardados.length, 0);
});

test('retorno: sem refresh_token e sem code', async () => {
    const d = deps({ trocarCodigo: async () => ({ access_token: 'at' }) });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d), { ok: false, motivo: 'sem_refresh' });
    assert.equal(d.guardados.length, 0);
    assert.deepEqual(await processarRetorno(q('state=e'), deps()), { ok: false, motivo: 'erro_google' });
});

test('retorno: sucesso guarda o hash (não o código) e pede confirmação; estado não é apagado', async () => {
    const d = deps();
    const r = await processarRetorno(q('code=c&state=e'), d);
    assert.equal(r.ok, 'confirmar');
    const codigo = (r as { confirmacao: string }).confirmacao;
    assert.equal(d.guardados.length, 1);
    assert.equal(d.guardados[0].hash, await hashToken(codigo));
    assert.notEqual(d.guardados[0].hash, codigo);
    assert.deepEqual({ ...d.guardados[0], hash: '' }, { estado: 'e', email: 'a@b.com', rt: 'rt', hash: '' });
    assert.deepEqual(d.apagados, []);
    assert.equal(urlRetornoPocket('https://app.com', r),
        `https://app.com/?view=conectar-claude&google_ads=confirmar&confirmacao=${encodeURIComponent(codigo)}`);
    const d2 = deps({ emailDe: async () => { throw new Error('x'); } });
    assert.equal((await processarRetorno(q('code=c&state=e'), d2)).ok, 'confirmar');
    assert.equal(d2.guardados[0].email, null);
});

test('retorno: falha ao trocar o código ou guardar vira erro_interno', async () => {
    const d = deps({ trocarCodigo: async () => { throw new Error('boom'); } });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d), { ok: false, motivo: 'erro_interno' });
    const d2 = deps({ guardarConfirmacao: async () => { throw new Error('boom'); } });
    assert.deepEqual(await processarRetorno(q('code=c&state=e'), d2), { ok: false, motivo: 'erro_interno' });
});

test('validarConfirmacao', () => {
    const agora = Date.now();
    const linha = { profile_id: 'p1', expira_em: new Date(agora + 5000).toISOString(), confirmacao_hash: 'h1', refresh_token_cifrado: 'x:y' };
    assert.equal(validarConfirmacao(linha, 'p1', 'h1', agora), true);
    assert.equal(validarConfirmacao(linha, 'p2', 'h1', agora), false); // outro perfil
    assert.equal(validarConfirmacao(linha, 'p1', 'h2', agora), false); // hash errado
    assert.equal(validarConfirmacao({ ...linha, expira_em: new Date(agora - 1).toISOString() }, 'p1', 'h1', agora), false);
    assert.equal(validarConfirmacao({ ...linha, confirmacao_hash: null }, 'p1', '', agora), false);
    assert.equal(validarConfirmacao({ ...linha, refresh_token_cifrado: null }, 'p1', 'h1', agora), false);
    assert.equal(validarConfirmacao(null, 'p1', 'h1', agora), false);
});
