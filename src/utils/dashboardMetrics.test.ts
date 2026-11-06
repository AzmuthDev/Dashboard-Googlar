import test from 'node:test';
import assert from 'node:assert/strict';
import { paraNumero, contarStatus, calcularMetricas, maioresCustosSemConversao, custoPorCampanha, isNeg, isDuv } from './dashboardMetrics.ts';
import type { CampaignTerm } from '../types';

const termo = (o: Record<string, unknown> = {}): CampaignTerm => ({
    id: Math.random().toString(36).slice(2), campanha: 'Camp A', grupo_de_anuncios: 'Grupo A',
    termo_de_pesquisa: 'termo', palavra_chave: 'kw', custo: 0, conversoes: 0, ...o,
} as unknown as CampaignTerm);

test('paraNumero entende número, decimal com vírgula e moeda pt-BR', () => {
    assert.equal(paraNumero(3.5), 3.5);
    assert.equal(paraNumero('8.24'), 8.24);
    assert.equal(paraNumero('1,5'), 1.5);
    assert.equal(paraNumero('R$ 1.234,56'), 1234.56);
    assert.equal(paraNumero(''), 0);
    assert.equal(paraNumero(undefined), 0);
    assert.equal(paraNumero('abc'), 0);
});

test('flags aceitam booleano, emoji e texto "true"', () => {
    assert.equal(isNeg(termo({ negativar: true })), true);
    assert.equal(isNeg(termo({ negativar: '❌' })), true);
    assert.equal(isNeg(termo({ negativar: 'TRUE' })), true);
    assert.equal(isNeg(termo({ negativar: '' })), false);
    assert.equal(isDuv(termo({ duvida: '❓' })), true);
});

test('contarStatus segue as abas da Triagem: enviados só contam em respostas', () => {
    const termos = [
        termo({ negativar: true }),
        termo({ duvida: true }),
        termo({ duvida: true, enviado_para_grupo: true }),
        termo({ segmentar: '✅' }),
        termo({ teste_ab: '⚠️' }),
        termo({}),
    ];
    assert.deepEqual(contarStatus(termos), {
        total: 6, negativas: 1, duvidas: 1, aprovadas: 1, ab_test: 1, respostas: 1, semCategoria: 1,
    });
});

test('calcularMetricas usa só dados reais da base', () => {
    const termos = [
        termo({ negativar: true, custo: '8,24', campanha: 'C1' }),
        termo({ negativar: '❌', custo: 1.76, campanha: 'C1' }),
        termo({ segmentar: true, custo: 30, conversoes: '2', campanha: 'C2' }),
        termo({ duvida: true, custo: 5, conversoes: 1, campanha: 'C3' }),
    ];
    const m = calcularMetricas(termos);
    assert.equal(m.totalTermos, 4);
    assert.equal(m.campanhas, 3);
    assert.equal(m.economia, 10);
    assert.equal(m.conversoes, 3);
    assert.equal(m.custoTotal, 45);
    assert.equal(m.duvidasPendentes, 1);
    assert.equal(m.decididos, 3);
    assert.equal(m.percentualDecidido, 75);
});

test('calcularMetricas com base vazia não divide por zero', () => {
    const m = calcularMetricas([]);
    assert.equal(m.totalTermos, 0);
    assert.equal(m.percentualDecidido, 0);
    assert.equal(m.economia, 0);
});

test('resposta do cliente conta como decidido mesmo vindo de dúvida', () => {
    const m = calcularMetricas([termo({ duvida: true, enviado_para_grupo: true, respondido_cliente: true })]);
    assert.equal(m.duvidasPendentes, 0);
    assert.equal(m.aguardandoCliente, 0);
    assert.equal(m.decididos, 1);
});

test('dúvida já enviada e sem resposta conta como aguardando cliente, igual à aba Dúvidas', () => {
    const termos = [
        termo({ duvida: true }),
        termo({ duvida: true, negativar: true }),
        termo({ duvida: true, enviado_para_grupo: true, respondido_cliente: false }),
    ];
    const m = calcularMetricas(termos);
    assert.equal(m.duvidasPendentes, contarStatus(termos).duvidas);
    assert.equal(m.duvidasPendentes, 2);
    assert.equal(m.aguardandoCliente, 1);
    assert.equal(m.decididos, 0);
});

test('custoPorCampanha agrupa custo, conversões, termos e negativados por campanha', () => {
    const termos = [
        termo({ campanha: 'C1', custo: 10, conversoes: 1 }),
        termo({ campanha: 'C1', custo: '5,5', negativar: true }),
        termo({ campanha: 'C2', custo: 30 }),
        termo({ campanha: '', custo: 2 }),
    ];
    const r = custoPorCampanha(termos, 5);
    assert.deepEqual(r.map(c => c.campanha), ['C2', 'C1', 'Sem campanha']);
    assert.deepEqual(r[1], { campanha: 'C1', custo: 15.5, conversoes: 1, termos: 2, negativados: 1 });
    assert.equal(custoPorCampanha(termos, 1).length, 1);
});

test('maioresCustosSemConversao ordena por custo e ignora quem converteu', () => {
    const termos = [
        termo({ termo_de_pesquisa: 'a', custo: 2 }),
        termo({ termo_de_pesquisa: 'b', custo: 9, conversoes: 1 }),
        termo({ termo_de_pesquisa: 'c', custo: '7,5' }),
        termo({ termo_de_pesquisa: 'd', custo: 0 }),
    ];
    assert.deepEqual(maioresCustosSemConversao(termos, 5).map(t => t.termo_de_pesquisa), ['c', 'a']);
    assert.deepEqual(maioresCustosSemConversao(termos, 1).map(t => t.termo_de_pesquisa), ['c']);
});
