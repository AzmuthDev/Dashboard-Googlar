import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarPorBusca } from './termSearch.ts';
import type { CampaignTerm } from '../types';

const termo = (o: Record<string, unknown>): CampaignTerm => ({
    id: String(o.termo_de_pesquisa), campanha: 'Endomarcas BR', grupo_de_anuncios: '#01 Endoscopia',
    palavra_chave: 'endoscópio', termo_de_pesquisa: 'x', ...o,
} as unknown as CampaignTerm);

const base = [
    termo({ termo_de_pesquisa: 'aparelho de endoscopia veterinária valor' }),
    termo({ termo_de_pesquisa: 'ziontech', campanha: 'Fujinon - 06 18 24', grupo_de_anuncios: '#Fujinon', palavra_chave: 'fujinon' }),
    termo({ termo_de_pesquisa: 'colonoscópio usado' }),
];

test('busca vazia ou só espaços devolve a lista inteira', () => {
    assert.equal(filtrarPorBusca(base, '').length, 3);
    assert.equal(filtrarPorBusca(base, '   ').length, 3);
});

test('busca ignora maiúsculas e acentos', () => {
    assert.deepEqual(filtrarPorBusca(base, 'VETERINARIA').map(t => t.id), ['aparelho de endoscopia veterinária valor']);
    assert.deepEqual(filtrarPorBusca(base, 'colonoscopio').map(t => t.id), ['colonoscópio usado']);
});

test('busca encontra por campanha, grupo e palavra-chave', () => {
    assert.deepEqual(filtrarPorBusca(base, 'fujinon').map(t => t.id), ['ziontech']);
    assert.equal(filtrarPorBusca(base, '#01').length, 2);
    assert.equal(filtrarPorBusca(base, 'endoscópio').length, 2);
});

test('várias palavras precisam aparecer todas (em qualquer campo)', () => {
    assert.deepEqual(filtrarPorBusca(base, 'aparelho valor').map(t => t.id), ['aparelho de endoscopia veterinária valor']);
    assert.equal(filtrarPorBusca(base, 'aparelho fujinon').length, 0);
});

test('tolera campos vazios', () => {
    const semCampos = [{ id: 'z' } as unknown as CampaignTerm];
    assert.equal(filtrarPorBusca(semCampos, 'algo').length, 0);
});
