const test = require('node:test');
const assert = require('node:assert/strict');
const { vereditosSite, bateComPalavraChave } = require('./vereditos-site.cjs');

const linha = (o) => ({
  'Termo de pesquisa': 't', 'Palavra-chave': 'kw', 'Campanha': 'C', 'Grupo de anúncios': 'G',
  'Conversões': '1', 'Impr.': '100', 'Cliques': '5', 'Custo': '7,5', 'CTR': '5%', 'CPC méd.': '1,5', 'Tipo de corresp.': 'Frase', ...o,
});
const ia = (o) => ({
  'Termo de pesquisa': 't', 'Palavra-chave': 'kw', 'Campanha': 'C', 'Grupo de anúncios': 'G',
  'SEGMENTAR': '', 'NEGATIVAR': '', 'TESTE_AB': '', 'DUVIDA': '', 'Observacao': 'obs', 'Conversões': '9', 'Impr.': '999', ...o,
});

test('métricas vêm da planilha e não da IA; origem é site', () => {
  const r = vereditosSite(JSON.stringify([ia({ NEGATIVAR: '❌' })]), [linha()], 'mesa_estremoz');
  assert.equal(r.p_tabela, 'mesa_estremoz');
  assert.equal(r.p_origem, 'site');
  assert.deepEqual(r.p_linhas[0], {
    termo: 't', campanha: 'C', grupo: 'G', palavra_chave: 'kw',
    segmentar: false, negativar: true, teste_ab: false, duvida: false, observacao: 'obs',
    impressoes: '100', conversoes: '1', cliques: '5', custo: '7,5', ctr: '5%', cpc_medio: '1,5', tipo_corresp: 'Frase',
  });
});

test('termo inventado pela IA é ignorado e termo omitido vai para sem_veredito', () => {
  const raw = '```json\n' + JSON.stringify([ia({ 'Termo de pesquisa': 'a', SEGMENTAR: '✅' }), ia({ 'Termo de pesquisa': 'inventado', SEGMENTAR: '✅' })]) + '\n```';
  const r = vereditosSite(raw, [linha({ 'Termo de pesquisa': 'a' }), linha({ 'Termo de pesquisa': 'b' })], 'mesa_qualipix');
  assert.deepEqual(r.p_linhas.map(l => l.termo), ['a']);
  assert.deepEqual(r.sem_veredito, ['b']);
});

test('linha com dois símbolos ou nenhum não é gravada', () => {
  const r = vereditosSite(JSON.stringify([
    ia({ 'Termo de pesquisa': 'a', SEGMENTAR: '✅', NEGATIVAR: '❌' }),
    ia({ 'Termo de pesquisa': 'b' }),
  ]), [linha({ 'Termo de pesquisa': 'a' }), linha({ 'Termo de pesquisa': 'b' })], 'mesa_qualipix');
  assert.equal(r.p_linhas.length, 0);
  assert.deepEqual(r.sem_veredito, ['a', 'b']);
});

test('casa pelo termo quando a IA altera campanha/grupo, ignorando acento e caixa', () => {
  const r = vereditosSite(JSON.stringify([ia({ 'Termo de pesquisa': 'PE DE CABRA', 'Campanha': 'x', TESTE_AB: '⚠️' })]),
    [linha({ 'Termo de pesquisa': 'pé de cabra' })], 'mesa_endomarcas');
  assert.equal(r.p_linhas[0].termo, 'pé de cabra');
  assert.equal(r.p_linhas[0].teste_ab, true);
});

test('dúvida que bate com a palavra-chave vira segmentar', () => {
  const r = vereditosSite(JSON.stringify([ia({ 'Termo de pesquisa': 'gradil pvc preço', DUVIDA: '❓' })]),
    [linha({ 'Termo de pesquisa': 'gradil pvc preço', 'Palavra-chave': 'gradil pvc' })], 'mesa_estremoz');
  assert.equal(r.corrigidos, 1);
  assert.equal(r.p_linhas[0].segmentar, true);
  assert.equal(r.p_linhas[0].duvida, false);
});

test('dúvida com termo não comercial continua dúvida mesmo batendo com a palavra-chave', () => {
  assert.equal(bateComPalavraChave('vaga gradil pvc', 'gradil pvc'), false);
  assert.equal(bateComPalavraChave('gradil', 'N/A'), false);
  const r = vereditosSite(JSON.stringify([ia({ 'Termo de pesquisa': 'curso gradil', DUVIDA: '❓' })]),
    [linha({ 'Termo de pesquisa': 'curso gradil', 'Palavra-chave': 'gradil' })], 'mesa_estremoz');
  assert.equal(r.p_linhas[0].duvida, true);
  assert.equal(r.corrigidos, 0);
});

test('resposta que não é JSON devolve todo o lote em sem_veredito sem lançar', () => {
  const r = vereditosSite('desculpe, não consigo', [linha()], 'mesa_qualipix');
  assert.deepEqual(r.p_linhas, []);
  assert.deepEqual(r.sem_veredito, ['t']);
  assert.deepEqual(vereditosSite(null, null, 'mesa_qualipix').p_linhas, []);
});
