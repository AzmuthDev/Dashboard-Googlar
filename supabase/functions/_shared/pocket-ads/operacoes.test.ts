import test from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_ADS_API_VERSION, lerResultado, matchDe, montarMutacoes } from './operacoes.ts';
import type { ItemResolvido } from './destinos.ts';

const item = (texto: string, destino: ItemResolvido['destino'], over: Partial<ItemResolvido> = {}): ItemResolvido =>
    ({ texto, idsLinhas: ['l1'], destino, situacao: 'ok', ...over });

test('versão da API definida', () => {
    assert.match(GOOGLE_ADS_API_VERSION, /^v\d+$/);
});

test('segmentar vira adGroupCriteria ENABLED exata', () => {
    const [m] = montarMutacoes('123', [item('pé de cabra', { campanhaId: '1', grupoId: '10' })], { tipo: 'segmentar' });
    assert.equal(m.servico, 'adGroupCriteria');
    assert.deepEqual(m.indices, [0]);
    assert.deepEqual(m.operations, [
        { create: { adGroup: 'customers/123/adGroups/10', status: 'ENABLED', keyword: { text: 'pé de cabra', matchType: 'EXACT' } } },
    ]);
});

test('teste A/B vira PAUSED', () => {
    const [m] = montarMutacoes('123', [item('x', { campanhaId: '1', grupoId: '10' })], { tipo: 'teste_ab' });
    assert.deepEqual(m.operations, [
        { create: { adGroup: 'customers/123/adGroups/10', status: 'PAUSED', keyword: { text: 'x', matchType: 'EXACT' } } },
    ]);
});

test('negativa de grupo', () => {
    const [m] = montarMutacoes('123', [item('x', { campanhaId: '1', grupoId: '10' })],
        { tipo: 'negativar', nivel: 'grupo', correspondencia: 'frase' });
    assert.equal(m.servico, 'adGroupCriteria');
    assert.deepEqual(m.operations, [
        { create: { adGroup: 'customers/123/adGroups/10', negative: true, keyword: { text: 'x', matchType: 'PHRASE' } } },
    ]);
});

test('negativa de campanha', () => {
    const [m] = montarMutacoes('123', [item('x', { campanhaId: '1' })],
        { tipo: 'negativar', nivel: 'campanha', correspondencia: 'ampla' });
    assert.equal(m.servico, 'campaignCriteria');
    assert.deepEqual(m.operations, [
        { create: { campaign: 'customers/123/campaigns/1', negative: true, keyword: { text: 'x', matchType: 'BROAD' } } },
    ]);
});

test('negativa de lista', () => {
    const [m] = montarMutacoes('123', [item('x', { campanhaId: '1' })],
        { tipo: 'negativar', nivel: 'lista', correspondencia: 'exata', listaId: '55' });
    assert.equal(m.servico, 'sharedCriteria');
    assert.deepEqual(m.operations, [
        { create: { sharedSet: 'customers/123/sharedSets/55', keyword: { text: 'x', matchType: 'EXACT' } } },
    ]);
});

test('negativa de conta entra no shared set de conta (listaId), sem campanha', () => {
    const [m] = montarMutacoes('123', [item('x', undefined)],
        { tipo: 'negativar', nivel: 'conta', correspondencia: 'exata', listaId: '77' });
    assert.equal(m.servico, 'sharedCriteria');
    assert.deepEqual(m.operations, [
        { create: { sharedSet: 'customers/123/sharedSets/77', keyword: { text: 'x', matchType: 'EXACT' } } },
    ]);
});

test('conta sem listaId lança erro; lista sem listaId também', () => {
    assert.throws(() => montarMutacoes('123', [item('x', undefined)],
        { tipo: 'negativar', nivel: 'conta', correspondencia: 'exata' }), /lista/);
    assert.throws(() => montarMutacoes('123', [item('x', { campanhaId: '1' })],
        { tipo: 'negativar', nivel: 'lista', correspondencia: 'exata' }), /lista/);
});

test('só itens ok viram operação; indices apontam para o item original', () => {
    const itens = [
        item('a', { campanhaId: '1', grupoId: '10' }, { situacao: 'ja_existe' }),
        item('b', { campanhaId: '1', grupoId: '10' }),
        item('c', { campanhaId: '1', grupoId: '10' }, { situacao: 'erro', erro: 'x' }),
        item('d', { campanhaId: '1', grupoId: '10' }),
    ];
    const ms = montarMutacoes('123', itens, { tipo: 'segmentar' });
    assert.equal(ms.length, 1);
    assert.deepEqual(ms[0].indices, [1, 3]);
    assert.equal(ms[0].operations.length, 2);
});

test('sem itens ok devolve lista vazia', () => {
    assert.deepEqual(montarMutacoes('123', [item('a', { campanhaId: '1', grupoId: '10' }, { situacao: 'ja_existe' })], { tipo: 'segmentar' }), []);
});

test('lerResultado: falha parcial no índice 1', () => {
    const m = { servico: 'adGroupCriteria' as const, operations: [{}, {}, {}], indices: [4, 5, 6] };
    const r = lerResultado(m, {
        results: [{ resourceName: 'a' }, {}, { resourceName: 'c' }],
        partialFailureError: {
            code: 3, message: 'Request contains an invalid argument.',
            details: [{ errors: [{ message: 'Duplicada.', location: { fieldPathElements: [{ fieldName: 'operations', index: 1 }, { fieldName: 'create' }] } }] }],
        },
    });
    assert.deepEqual(r, [
        { indice: 4, ok: true, resourceName: 'a' },
        { indice: 5, ok: false, erro: 'Duplicada.' },
        { indice: 6, ok: true, resourceName: 'c' },
    ]);
});

test('lerResultado: sem partialFailureError tudo ok', () => {
    const m = { servico: 'sharedCriteria' as const, operations: [{}, {}], indices: [0, 1] };
    const r = lerResultado(m, { results: [{ resourceName: 'a' }, { resourceName: 'b' }] });
    assert.deepEqual(r.map((x) => x.ok), [true, true]);
});

test('lerResultado: erro sem localização marca operações sem resourceName', () => {
    const m = { servico: 'sharedCriteria' as const, operations: [{}, {}], indices: [0, 1] };
    const r = lerResultado(m, { results: [{ resourceName: 'a' }, {}], partialFailureError: { message: 'falhou geral' } });
    assert.equal(r[0].ok, true);
    assert.equal(r[1].ok, false);
    assert.equal(r[1].erro, 'falhou geral');
});

test('matchDe', () => {
    assert.equal(matchDe('frase'), 'PHRASE');
});
