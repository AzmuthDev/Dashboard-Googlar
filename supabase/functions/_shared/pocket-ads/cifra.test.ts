import test from 'node:test';
import assert from 'node:assert/strict';
import { cifrar, decifrar, hashToken, novoSegredo } from './cifra.ts';

const chave = (): string => btoa(String.fromCharCode(...globalThis.crypto.getRandomValues(new Uint8Array(32))));

test('decifrar(cifrar(t)) devolve o texto original', async () => {
    const k = chave();
    assert.equal(await decifrar(await cifrar('olá, token ya29', k), k), 'olá, token ya29');
});

test('duas cifragens do mesmo texto diferem', async () => {
    const k = chave();
    assert.notEqual(await cifrar('x', k), await cifrar('x', k));
});

test('formato iv:dados em base64 com IV de 12 bytes', async () => {
    const [iv, dados, resto] = (await cifrar('x', chave())).split(':');
    assert.equal(resto, undefined);
    assert.equal(atob(iv).length, 12);
    assert.ok(dados.length > 0);
});

test('chave errada rejeita', async () => {
    const c = await cifrar('x', chave());
    await assert.rejects(decifrar(c, chave()));
});

test('dado adulterado rejeita', async () => {
    const k = chave();
    const [iv, dados] = (await cifrar('texto longo o bastante', k)).split(':');
    const bytes = Uint8Array.from(atob(dados), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    await assert.rejects(decifrar(`${iv}:${btoa(String.fromCharCode(...bytes))}`, k));
});

test('formato malformado rejeita', async () => {
    await assert.rejects(decifrar('semdoispontos', chave()));
});

test('hashToken devolve 64 hex determinístico', async () => {
    const h = await hashToken('a');
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(h, await hashToken('a'));
    assert.equal(h, 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb');
});

test('novoSegredo tem 43 caracteres base64url', () => {
    const s = novoSegredo();
    assert.equal(s.length, 43);
    assert.doesNotMatch(s, /[+/=]/);
    assert.notEqual(s, novoSegredo());
});
