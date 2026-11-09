import test from 'node:test';
import assert from 'node:assert/strict';
import { acaoDoTermo, normalizarNome, semDestino, validarTextoPalavra } from './termos.ts';

test('acaoDoTermo: manter vale segmentar; sem acao cai nas flags', () => {
    assert.equal(acaoDoTermo({ acao: 'manter' }), 'segmentar');
    assert.equal(acaoDoTermo({ acao: 'teste_ab' }), 'teste_ab');
    assert.equal(acaoDoTermo({ negativar: true }), 'negativar');
    assert.equal(acaoDoTermo({ teste_ab: true }), 'teste_ab');
    assert.equal(acaoDoTermo({ segmentar: true }), 'segmentar');
    assert.equal(acaoDoTermo({}), null);
    assert.equal(acaoDoTermo({ acao: 'qualquer-coisa' }), null);
});

test('normalizarNome: minúsculas, sem acento, espaços colapsados', () => {
    assert.equal(normalizarNome('  Pé  de CABRA '), 'pe de cabra');
    assert.equal(normalizarNome(null), '');
    assert.equal(normalizarNome(undefined), '');
});

test('semDestino: vazio, n/a ou hífen', () => {
    assert.equal(semDestino(''), true);
    assert.equal(semDestino('N/A'), true);
    assert.equal(semDestino('-'), true);
    assert.equal(semDestino('Camp A'), false);
});

test('validarTextoPalavra: limites de caracteres e palavras', () => {
    assert.match(validarTextoPalavra('a'.repeat(81)) ?? '', /80 caracteres/);
    assert.match(validarTextoPalavra('um dois tres quatro cinco seis sete oito nove dez onze') ?? '', /10 palavras/);
    assert.equal(validarTextoPalavra('pe de cabra'), null);
});
