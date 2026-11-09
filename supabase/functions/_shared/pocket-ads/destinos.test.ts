import test from 'node:test';
import assert from 'node:assert/strict';
import { chaveExistente, emLotes, matchDe, resolverItens } from './destinos.ts';
import type { Catalogo, LinhaTermo } from './destinos.ts';

const catalogo = (over: Partial<Catalogo> = {}): Catalogo => ({
    campanhas: [
        { id: '1', nome: 'Campanha Institucional', tipoCanal: 'SEARCH' },
        { id: '2', nome: 'Máxima', tipoCanal: 'PERFORMANCE_MAX' },
    ],
    grupos: [{ id: '10', nome: 'Pé de Cabra', campanhaId: '1' }],
    existentes: new Set<string>(),
    ...over,
});
const linha = (id: string, termo: string, campanha = 'Campanha Institucional', grupo = 'Pé de Cabra'): LinhaTermo => ({ id, termo, campanha, grupo });

test('campanha casa por nome normalizado', () => {
    const r = resolverItens([linha('a', 'x', 'Campanha  Institucional')], catalogo({ campanhas: [{ id: '1', nome: 'campanha institucional', tipoCanal: 'SEARCH' }] }), { tipo: 'segmentar' });
    assert.equal(r[0].situacao, 'ok');
    assert.deepEqual(r[0].destino, { campanhaId: '1', grupoId: '10' });
});

test('linhas iguais viram um item com os dois ids', () => {
    const r = resolverItens([linha('a', 'pe de cabra'), linha('b', 'Pe  de Cabra')], catalogo(), { tipo: 'segmentar' });
    assert.equal(r.length, 1);
    assert.deepEqual(r[0].idsLinhas, ['a', 'b']);
    assert.equal(r[0].texto, 'pe de cabra');
});

test('texto com 81 caracteres: erro e sem destino', () => {
    const r = resolverItens([linha('a', 'a'.repeat(81))], catalogo(), { tipo: 'segmentar' });
    assert.equal(r[0].situacao, 'erro');
    assert.equal(r[0].destino, undefined);
    assert.match(r[0].erro!, /80 caracteres/);
});

test('campanha ambígua e não encontrada', () => {
    const amb = catalogo({ campanhas: [
        { id: '1', nome: 'Camp A', tipoCanal: 'SEARCH' },
        { id: '3', nome: 'camp  a', tipoCanal: 'SEARCH' },
    ] });
    const r = resolverItens([linha('a', 'x', 'CAMP A')], amb, { tipo: 'segmentar' });
    assert.equal(r[0].erro, 'nome de campanha ambíguo');
    const n = resolverItens([linha('a', 'x', 'Inexistente')], catalogo(), { tipo: 'segmentar' });
    assert.equal(n[0].erro, 'campanha não encontrada no Google Ads');
});

test('grupo ambíguo e não encontrado, só dentro da campanha', () => {
    const amb = catalogo({ grupos: [
        { id: '10', nome: 'G', campanhaId: '1' },
        { id: '11', nome: 'g', campanhaId: '1' },
        { id: '12', nome: 'G', campanhaId: '2' },
    ] });
    assert.equal(resolverItens([linha('a', 'x', undefined, 'G')], amb, { tipo: 'teste_ab' })[0].erro, 'nome de grupo ambíguo');
    assert.equal(resolverItens([linha('a', 'x', undefined, 'Outro')], catalogo(), { tipo: 'segmentar' })[0].erro, 'grupo não encontrado no Google Ads');
});

test('PMax: segmentar erra; nível lista fica ok; nível campanha erra', () => {
    const l = [linha('a', 'x', 'Máxima', '-')];
    assert.equal(resolverItens(l, catalogo(), { tipo: 'segmentar' })[0].erro, 'campanha Performance Max não tem grupo de anúncios');
    assert.equal(resolverItens(l, catalogo(), { tipo: 'negativar', nivel: 'grupo', correspondencia: 'exata' })[0].erro, 'campanha Performance Max não tem grupo de anúncios');
    assert.equal(resolverItens(l, catalogo(), { tipo: 'negativar', nivel: 'campanha', correspondencia: 'exata' })[0].erro, 'em Performance Max use lista ou conta');
    assert.equal(resolverItens(l, catalogo(), { tipo: 'negativar', nivel: 'lista', correspondencia: 'exata', listaId: '99' })[0].situacao, 'ok');
});

test('existentes: segmentar no grupo 10 vira ja_existe', () => {
    const existentes = new Set([chaveExistente('g:10', 'pe de cabra', 'EXACT')]);
    const r = resolverItens([linha('a', 'Pé de Cabra')], catalogo({ existentes }), { tipo: 'segmentar' });
    assert.equal(r[0].situacao, 'ja_existe');
});

test('chaveExistente normaliza o texto', () => {
    assert.equal(chaveExistente('c:1', 'Pé  de CABRA', 'PHRASE'), chaveExistente('c:1', 'pe de cabra', 'PHRASE'));
    assert.notEqual(chaveExistente('c:1', 'x', 'PHRASE'), chaveExistente('c:1', 'x', 'BROAD'));
});

test('negativa: ja_existe usa escopo e match da correspondência', () => {
    const existentes = new Set([chaveExistente('c:1', 'x', 'PHRASE'), chaveExistente('conta', 'x', 'BROAD')]);
    const cat = catalogo({ existentes });
    const l = [linha('a', 'x', 'Campanha Institucional', '-')];
    assert.equal(resolverItens(l, cat, { tipo: 'negativar', nivel: 'campanha', correspondencia: 'frase' })[0].situacao, 'ja_existe');
    assert.equal(resolverItens(l, cat, { tipo: 'negativar', nivel: 'campanha', correspondencia: 'exata' })[0].situacao, 'ok');
    assert.equal(resolverItens(l, cat, { tipo: 'negativar', nivel: 'conta', correspondencia: 'ampla' })[0].situacao, 'ja_existe');
});

test('negativar nível campanha não exige grupo', () => {
    const r = resolverItens([linha('a', 'x', 'Campanha Institucional', '-')], catalogo(), { tipo: 'negativar', nivel: 'campanha', correspondencia: 'exata' });
    assert.equal(r[0].situacao, 'ok');
    assert.deepEqual(r[0].destino, { campanhaId: '1' });
});

test('nível lista/conta: campanha ausente não gera erro', () => {
    const l = [linha('a', 'x', 'Não existe', '-')];
    const lista = resolverItens(l, catalogo(), { tipo: 'negativar', nivel: 'lista', correspondencia: 'exata', listaId: '5' });
    assert.equal(lista[0].situacao, 'ok');
    assert.equal(lista[0].destino, undefined);
    const conta = resolverItens(l, catalogo(), { tipo: 'negativar', nivel: 'conta', correspondencia: 'exata' });
    assert.equal(conta[0].situacao, 'ok');
    assert.equal(conta[0].destino, undefined);
});

test('nível lista sem listaId: erro em todos', () => {
    const r = resolverItens([linha('a', 'x'), linha('b', 'y')], catalogo(), { tipo: 'negativar', nivel: 'lista', correspondencia: 'exata' });
    assert.deepEqual(r.map((i) => i.erro), ['escolha a lista de negativas', 'escolha a lista de negativas']);
});

test('matchDe', () => {
    assert.equal(matchDe('exata'), 'EXACT');
    assert.equal(matchDe('frase'), 'PHRASE');
    assert.equal(matchDe('ampla'), 'BROAD');
});

test('emLotes de 1001 itens', () => {
    const lotes = emLotes(Array.from({ length: 1001 }, (_, i) => i));
    assert.deepEqual(lotes.map((l) => l.length), [500, 500, 1]);
});
