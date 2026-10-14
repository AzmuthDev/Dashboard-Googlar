import test from 'node:test';
import assert from 'node:assert/strict';
import { acaoDoTermo, montarExportacao } from './adsExport.ts';

type Termo = Parameters<typeof montarExportacao>[0][number];

const termo = (o: Record<string, unknown>): Termo => ({
    id: 'x', campanha: 'Camp A', grupo_de_anuncios: 'Grupo A', termo_de_pesquisa: 'pe de cabra',
    respondido_cliente: true, acao: 'negativar', ...o,
} as unknown as Termo);

const linhas = (texto: string) => texto.split('\n').filter(Boolean);

test('negativar usa Negative Exact por padrão e Negative Phrase quando pedido', () => {
    const t = [termo({})];
    const exato = montarExportacao(t, { tipos: ['negativar'], matchNegativa: 'exact' });
    assert.deepEqual(linhas(exato.editor), ['Campaign\tAd group\tKeyword\tCriterion Type', 'Camp A\tGrupo A\tpe de cabra\tNegative Exact']);
    const frase = montarExportacao(t, { tipos: ['negativar'], matchNegativa: 'phrase' });
    assert.ok(frase.editor.includes('Negative Phrase'));
    const ampla = montarExportacao(t, { tipos: ['negativar'], matchNegativa: 'broad' });
    assert.ok(ampla.editor.includes('Negative Broad'));
});

test('segmentar vira Exact e não depende da correspondência da negativa', () => {
    const r = montarExportacao([termo({ acao: 'segmentar' })], { tipos: ['segmentar'], matchNegativa: 'broad' });
    assert.deepEqual(linhas(r.editor)[1], 'Camp A\tGrupo A\tpe de cabra\tExact');
    assert.equal(r.total, 1);
});

test('teste_ab só aparece em testeAb e não em editor', () => {
    const r = montarExportacao([termo({ acao: 'teste_ab' })], { tipos: ['teste_ab'], matchNegativa: 'exact' });
    assert.deepEqual(linhas(r.editor), ['Campaign\tAd group\tKeyword\tCriterion Type']);
    assert.deepEqual(linhas(r.testeAb), ['Campanha\tGrupo\tTermo', 'Camp A\tGrupo A\tpe de cabra']);
    assert.equal(r.total, 1);
});

test('só exporta os tipos selecionados', () => {
    const todos = [termo({ id: '1', acao: 'negativar', termo_de_pesquisa: 'a' }), termo({ id: '2', acao: 'segmentar', termo_de_pesquisa: 'b' }), termo({ id: '3', acao: 'teste_ab', termo_de_pesquisa: 'c' })];
    const r = montarExportacao(todos, { tipos: ['segmentar'], matchNegativa: 'exact' });
    assert.equal(r.total, 1);
    assert.ok(r.editor.includes('\tb\t'));
    assert.ok(!r.editor.includes('\ta\t'));
    assert.ok(!r.testeAb.includes('\tc'));
});

test('tipos vazios => total 0 e editor só com cabeçalho', () => {
    const r = montarExportacao([termo({})], { tipos: [], matchNegativa: 'exact' });
    assert.equal(r.total, 0);
    assert.equal(r.omitidos, 0);
    assert.deepEqual(linhas(r.editor), ['Campaign\tAd group\tKeyword\tCriterion Type']);
    assert.deepEqual(linhas(r.testeAb), ['Campanha\tGrupo\tTermo']);
});

test('omite campanha ou grupo N/A/vazio e conta os omitidos', () => {
    const r = montarExportacao([
        termo({ id: '1', campanha: 'N/A' }),
        termo({ id: '2', grupo_de_anuncios: '' }),
        termo({ id: '3', grupo_de_anuncios: ' - ' }),
        termo({ id: '4', termo_de_pesquisa: 'ok' }),
    ], { tipos: ['negativar'], matchNegativa: 'exact' });
    assert.equal(r.total, 1);
    assert.equal(r.omitidos, 3);
});

test('remove duplicatas idênticas', () => {
    const r = montarExportacao([termo({ id: '1' }), termo({ id: '2' })], { tipos: ['negativar'], matchNegativa: 'exact' });
    assert.equal(r.total, 1);
});

test('termo com tab ou quebra de linha não quebra a linha', () => {
    const r = montarExportacao([termo({ termo_de_pesquisa: 'pe\tde\ncabra' })], { tipos: ['negativar'], matchNegativa: 'exact' });
    const l = linhas(r.editor);
    assert.equal(l.length, 2);
    assert.equal(l[1].split('\t').length, 4);
    assert.ok(l[1].includes('pe de cabra'));
});

test('ignora termos não respondidos pelo cliente', () => {
    const r = montarExportacao([termo({ respondido_cliente: false }), termo({ respondido_cliente: undefined })], { tipos: ['negativar'], matchNegativa: 'exact' });
    assert.equal(r.total, 0);
});

test('seleção vazia de termos devolve só cabeçalhos', () => {
    const r = montarExportacao([], { tipos: ['negativar', 'segmentar', 'teste_ab'], matchNegativa: 'exact' });
    assert.equal(r.total, 0);
    assert.equal(r.omitidos, 0);
});

test('acaoDoTermo: manter vale segmentar; sem acao cai nas flags', () => {
    assert.equal(acaoDoTermo({ acao: 'manter' } as never), 'segmentar');
    assert.equal(acaoDoTermo({ acao: 'teste_ab' } as never), 'teste_ab');
    assert.equal(acaoDoTermo({ negativar: true } as never), 'negativar');
    assert.equal(acaoDoTermo({ teste_ab: true } as never), 'teste_ab');
    assert.equal(acaoDoTermo({ segmentar: true } as never), 'segmentar');
    assert.equal(acaoDoTermo({} as never), null);
    assert.equal(acaoDoTermo({ acao: 'qualquer-coisa' } as never), null);
});
