import test from 'node:test';
import assert from 'node:assert/strict';
import { limparIdConta, lerRetornoGoogle, urlConector } from './conexaoClaude.ts';

test('limparIdConta remove traços e espaços e exige 10 dígitos', () => {
    assert.equal(limparIdConta('123-456-7890'), '1234567890');
    assert.equal(limparIdConta(' 123 456 7890 '), '1234567890');
    assert.equal(limparIdConta('123'), null);
    assert.equal(limparIdConta('12345678901'), null);
    assert.equal(limparIdConta('abc-456-7890'), null);
});

test('lerRetornoGoogle lê view, resultado e motivo', () => {
    assert.deepEqual(
        lerRetornoGoogle('?view=conectar-claude&google_ads=erro&motivo=recusado'),
        { view: 'conectar-claude', googleAds: 'erro', motivo: 'recusado' },
    );
    assert.equal(lerRetornoGoogle('?view=conectar-claude&google_ads=ok').googleAds, 'ok');
    assert.equal(lerRetornoGoogle('?view=conectar-claude&google_ads=confirmar&confirmacao=abc').googleAds, 'confirmar');
});

test('lerRetornoGoogle ignora view inexistente e valores inesperados', () => {
    assert.equal(lerRetornoGoogle('?view=xyz').view, undefined);
    assert.equal(lerRetornoGoogle('?google_ads=qualquer').googleAds, undefined);
    assert.deepEqual(lerRetornoGoogle(''), {});
});

test('urlConector monta a URL do conector', () => {
    assert.equal(urlConector('https://x.supabase.co', 'abc'), 'https://x.supabase.co/functions/v1/pocket-mcp/abc');
    assert.equal(urlConector('https://x.supabase.co/', 'abc'), 'https://x.supabase.co/functions/v1/pocket-mcp/abc');
});
