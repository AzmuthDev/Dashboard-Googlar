const test = require('node:test');
const assert = require('node:assert/strict');
const { canonizarLinha, limparPlanilha, prepararLote } = require('./planilha-site.cjs');

test('cabeçalho em inglês do Google Ads vira chave canônica em português', () => {
  const l = canonizarLinha({
    'Search term': 'tela galvanizada', 'Keyword': 'tela', 'Campaign Name': 'Camp', 'Ad Group Name': '#Tela',
    'Conversions': '2', 'Impressions': '150', 'Clicks': '10', 'Cost': '12,50', 'CTR': '6%', 'Avg. CPC': '1,25', 'Match type': 'Frase',
  });
  assert.deepEqual(l, {
    'Termo de pesquisa': 'tela galvanizada', 'Palavra-chave': 'tela', 'Campanha': 'Camp', 'Grupo de anúncios': '#Tela',
    'Conversões': '2', 'Impr.': '150', 'Cliques': '10', 'Custo': '12,50', 'CTR': '6%', 'CPC méd.': '1,25', 'Tipo de corresp.': 'Frase',
  });
});

test('cabeçalho em português é mantido e coluna ausente vira texto vazio', () => {
  const l = canonizarLinha({ 'Termo de pesquisa': ' gradil ', 'Campanha': 'C', 'Grupo de anúncios': 'G' });
  assert.equal(l['Termo de pesquisa'], 'gradil');
  assert.equal(l['Palavra-chave'], '');
  assert.equal(l['Impr.'], '');
});

test('limparPlanilha descarta linhas sem termo, linhas de total e repetidas (sem acento/caixa)', () => {
  const r = limparPlanilha([
    { 'Search term': 'Pé de cabra', 'Campaign Name': 'C', 'Ad Group Name': 'G' },
    { 'Search term': 'pe de  CABRA', 'Campaign Name': 'c', 'Ad Group Name': 'g' },
    { 'Search term': '', 'Campaign Name': 'C' },
    { 'Search term': 'Total: Search terms', 'Campaign Name': '' },
    { 'Search term': 'x', 'Campaign Name': 'Total: account' },
    { 'Search term': 'pé de cabra', 'Campaign Name': 'Outra', 'Ad Group Name': 'G' },
  ]);
  assert.deepEqual(r.map(l => [l['Termo de pesquisa'], l['Campanha']]), [['Pé de cabra', 'C'], ['pé de cabra', 'Outra']]);
});

test('prepararLote envia só as 6 chaves da IA e guarda as linhas completas', () => {
  const linhas = limparPlanilha([{ 'Search term': 't', 'Keyword': 'k', 'Campaign Name': 'c', 'Ad Group Name': 'g', 'Clicks': '3', 'Cost': '9' }]);
  const r = prepararLote(linhas);
  assert.equal(r.total, 1);
  assert.deepEqual(JSON.parse(r.meu_texto_pronto), [{
    'Termo de pesquisa': 't', 'Palavra-chave': 'k', 'Campanha': 'c', 'Grupo de anúncios': 'g', 'Conversões': '0', 'Impr.': '0',
  }]);
  assert.equal(r.linhas[0]['Cliques'], '3');
  assert.equal(r.linhas[0]['Custo'], '9');
});

test('entrada vazia ou nula não lança', () => {
  assert.deepEqual(limparPlanilha(null), []);
  assert.equal(prepararLote(null).total, 0);
});
