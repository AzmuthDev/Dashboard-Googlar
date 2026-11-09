import test from 'node:test';
import assert from 'node:assert/strict';
import { ErroUsuario, erroParse, responderMcp } from './mcp.ts';
import type { Ferramenta } from './mcp.ts';

const info = { name: 'pocket', version: '1.0.0' };
const ferr = (name: string, executar: Ferramenta['executar']): Ferramenta =>
    ({ name, description: `d ${name}`, inputSchema: { type: 'object' }, executar });
const eco = ferr('eco', async (a) => ({ recebido: a }));
const req = (method: string, params?: unknown, id: number | null = 1) => ({ jsonrpc: '2.0', id, method, params });

type Corpo = { jsonrpc: string; id: unknown; result?: any; error?: { code: number; message: string } };
const chamar = async (corpo: unknown, f: Ferramenta[] = [eco]) => {
    const r = await responderMcp(corpo, f, info);
    return { status: r.status, corpo: r.corpo as Corpo };
};

test('initialize devolve a versão pedida se suportada', async () => {
    const r = await chamar(req('initialize', { protocolVersion: '2025-06-18' }));
    assert.equal(r.status, 200);
    assert.equal(r.corpo.result.protocolVersion, '2025-06-18');
    assert.deepEqual(r.corpo.result.capabilities, { tools: {} });
    assert.deepEqual(r.corpo.result.serverInfo, info);
    assert.equal(r.corpo.jsonrpc, '2.0');
    assert.equal(r.corpo.id, 1);
});

test('initialize aceita 2025-11-25 e cai para 2025-06-18 se desconhecida', async () => {
    assert.equal((await chamar(req('initialize', { protocolVersion: '2025-11-25' }))).corpo.result.protocolVersion, '2025-11-25');
    assert.equal((await chamar(req('initialize', { protocolVersion: '1999-01-01' }))).corpo.result.protocolVersion, '2025-06-18');
    assert.equal((await chamar(req('initialize'))).corpo.result.protocolVersion, '2025-06-18');
});

test('notificação devolve 202 sem corpo', async () => {
    const r = await responderMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, [eco], info);
    assert.deepEqual(r, { status: 202 });
});

test('ping devolve objeto vazio', async () => {
    assert.deepEqual((await chamar(req('ping'))).corpo.result, {});
});

test('tools/list lista os nomes', async () => {
    const r = await chamar(req('tools/list'), [eco, ferr('outra', async () => 1)]);
    assert.deepEqual(r.corpo.result.tools.map((t: { name: string }) => t.name), ['eco', 'outra']);
    assert.deepEqual(Object.keys(r.corpo.result.tools[0]).sort(), ['description', 'inputSchema', 'name']);
});

test('tools/call devolve o resultado em JSON e usa {} sem arguments', async () => {
    const r = await chamar(req('tools/call', { name: 'eco' }));
    assert.equal(r.corpo.result.content[0].type, 'text');
    assert.deepEqual(JSON.parse(r.corpo.result.content[0].text), { recebido: {} });
    assert.equal(r.corpo.result.isError, undefined);
    const r2 = await chamar(req('tools/call', { name: 'eco', arguments: { a: 1 } }));
    assert.deepEqual(JSON.parse(r2.corpo.result.content[0].text), { recebido: { a: 1 } });
});

test('ErroUsuario vira isError com a mensagem', async () => {
    const f = ferr('x', async () => { throw new ErroUsuario('x'); });
    const r = await chamar(req('tools/call', { name: 'x' }), [f]);
    assert.equal(r.corpo.result.isError, true);
    assert.equal(r.corpo.result.content[0].text, 'x');
});

test('subclasse de ErroUsuario também é exposta', async () => {
    class Filho extends ErroUsuario {}
    const f = ferr('x', async () => { throw new Filho('filho'); });
    const r = await chamar(req('tools/call', { name: 'x' }), [f]);
    assert.equal(r.corpo.result.content[0].text, 'filho');
    assert.equal(new ErroUsuario('a').name, 'ErroUsuario');
});

test('erro inesperado não vaza a mensagem', async (t) => {
    const log = t.mock.method(console, 'error', () => {});
    const f = ferr('x', async () => { throw new Error('segredo'); });
    const r = await chamar(req('tools/call', { name: 'x' }), [f]);
    assert.equal(r.corpo.result.isError, true);
    assert.ok(!r.corpo.result.content[0].text.includes('segredo'));
    assert.match(r.corpo.result.content[0].text, /Erro interno no Pocket/);
    assert.equal(log.mock.callCount(), 1);
});

test('ferramenta desconhecida dá -32602', async () => {
    const r = await chamar(req('tools/call', { name: 'nada' }));
    assert.equal(r.corpo.error?.code, -32602);
    assert.match(r.corpo.error!.message, /nada/);
});

test('método desconhecido dá -32601', async () => {
    assert.equal((await chamar(req('foo/bar'))).corpo.error?.code, -32601);
});

test('corpo inválido dá -32600 e erroParse dá -32700', async () => {
    assert.equal((await chamar('texto')).corpo.error?.code, -32600);
    assert.equal((await chamar({ jsonrpc: '1.0', method: 'ping', id: 1 })).corpo.error?.code, -32600);
    assert.equal((await chamar({ jsonrpc: '2.0', id: 1 })).corpo.error?.code, -32600);
    const e = erroParse();
    assert.equal(e.error.code, -32700);
    assert.equal(e.id, null);
});

test('lote devolve só as respostas de requisições', async () => {
    const r = await responderMcp([req('ping', undefined, 1), { jsonrpc: '2.0', method: 'notifications/initialized' }, req('ping', undefined, 2)], [eco], info);
    assert.equal(r.status, 200);
    assert.deepEqual((r.corpo as Corpo[]).map((x) => x.id), [1, 2]);
    const so = await responderMcp([{ jsonrpc: '2.0', method: 'notifications/initialized' }], [eco], info);
    assert.deepEqual(so, { status: 202 });
});
