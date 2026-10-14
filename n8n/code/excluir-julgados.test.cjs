const test = require('node:test');
const assert = require('node:assert/strict');
const { chaveJulgado, excluirJulgados } = require('./excluir-julgados.cjs');

const linha = (termo, campanha, grupo) => ({ 'Termo de pesquisa': termo, 'Campanha': campanha, 'Grupo de anúncios': grupo });
const julgado = (termo, campanha, grupo) => ({ termo_de_pesquisa: termo, campanha, grupo_de_anuncios: grupo });

test('chave ignora caixa, acento e espaços', () => {
  assert.equal(chaveJulgado(' Pé de  Cabra ', 'CAMP', 'g1'), chaveJulgado('pe de cabra', 'camp', 'G1'));
});

test('chave aceita campos indefinidos', () => {
  assert.equal(chaveJulgado(undefined, null, undefined), '||');
});

test('pula só a combinação idêntica de termo+campanha+grupo', () => {
  const planilha = [linha('t1', 'c1', 'g1'), linha('t1', 'c2', 'g1')];
  const r = excluirJulgados(planilha, [julgado('t1', 'c1', 'g1')]);
  assert.equal(r.pulados, 1);
  assert.equal(r.restantes.length, 1);
  assert.equal(r.restantes[0]['Campanha'], 'c2');
  assert.equal(r.filtroIndisponivel, false);
});

test('casa por chave normalizada (caixa e acento diferentes)', () => {
  const r = excluirJulgados([linha('Pé de Cabra', 'Camp', 'G')], [julgado('pe de cabra', 'camp', 'g')]);
  assert.equal(r.restantes.length, 0);
  assert.equal(r.pulados, 1);
});

test('mantém linha da planilha sem termo', () => {
  const r = excluirJulgados([linha('', 'c', 'g'), { 'Campanha': 'c' }], [julgado('', 'c', 'g')]);
  assert.equal(r.restantes.length, 2);
  assert.equal(r.pulados, 0);
});

test('tabela vazia (item vazio do Supabase) mantém tudo', () => {
  const planilha = [linha('a', 'c', 'g'), linha('b', 'c', 'g')];
  const r = excluirJulgados(planilha, [{}]);
  assert.equal(r.restantes.length, 2);
  assert.equal(r.pulados, 0);
  assert.equal(r.filtroIndisponivel, false);
});

test('falha do Supabase segue sem filtro e sinaliza', () => {
  const planilha = [linha('a', 'c', 'g'), linha('b', 'c', 'g')];
  const r = excluirJulgados(planilha, [{ error: { message: 'x' } }]);
  assert.equal(r.filtroIndisponivel, true);
  assert.equal(r.restantes.length, 2);
  assert.equal(r.pulados, 0);
});

test('todos já julgados => nada resta', () => {
  const planilha = [linha('a', 'c', 'g'), linha('b', 'c', 'g')];
  const r = excluirJulgados(planilha, [julgado('a', 'c', 'g'), julgado('b', 'c', 'g')]);
  assert.equal(r.restantes.length, 0);
  assert.equal(r.pulados, 2);
});

test('aceita chaves alternativas da planilha (Termo, Grupo_Anuncio)', () => {
  const r = excluirJulgados([{ 'Termo': 'a', 'Campanha': 'c', 'Grupo_Anuncio': 'g' }], [julgado('a', 'c', 'g')]);
  assert.equal(r.pulados, 1);
});

test('aceita cabeçalhos do Google Ads em inglês (Search term, Campaign Name, Ad Group Name)', () => {
  const planilha = [
    { 'Search term': 'reportei mcp', 'Campaign Name': 'RPT_01', 'Ad Group Name': '01_inst' },
    { 'Search term': 'reportei mcp', 'Campaign Name': 'RPT_02', 'Ad Group Name': '01_inst' },
  ];
  const r = excluirJulgados(planilha, [julgado('reportei mcp', 'RPT_01', '01_inst')]);
  assert.equal(r.pulados, 1);
  assert.equal(r.restantes.length, 1);
  assert.equal(r.restantes[0]['Campaign Name'], 'RPT_02');
});
