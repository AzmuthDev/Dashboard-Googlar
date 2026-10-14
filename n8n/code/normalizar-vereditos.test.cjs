const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarVereditos } = require('./normalizar-vereditos.cjs');

const base = (o) => ({
  'Termo de pesquisa': 't', 'Palavra-chave': 'kw', 'Campanha': 'c', 'Grupo de anúncios': 'g',
  'SEGMENTAR': '', 'NEGATIVAR': '', 'TESTE_AB': '', 'DUVIDA': '', 'Observacao': 'obs', 'Conversões': '2', 'Impr.': '150', ...o,
});

test('extrai linhas de saída com cercas markdown e descarta linha com dois símbolos', () => {
  const raw = '```json\n' + JSON.stringify([
    base({ 'Termo de pesquisa': 'a', SEGMENTAR: '✅' }),
    base({ 'Termo de pesquisa': 'b', NEGATIVAR: '❌' }),
    base({ 'Termo de pesquisa': 'c', SEGMENTAR: '✅', NEGATIVAR: '❌' }),
  ]) + '\n```';
  const r = normalizarVereditos(raw, 'mesa_qualipix');
  assert.equal(r.p_tabela, 'mesa_qualipix');
  assert.equal(r.p_linhas.length, 2);
  assert.deepEqual(
    { termo: r.p_linhas[0].termo, segmentar: r.p_linhas[0].segmentar, negativar: r.p_linhas[0].negativar },
    { termo: 'a', segmentar: true, negativar: false });
  assert.equal(r.p_linhas[1].negativar, true);
});

test('mapeia as 11 chaves para o corpo do RPC', () => {
  const r = normalizarVereditos(JSON.stringify([base({ TESTE_AB: '⚠️' })]), 'mesa_estremoz');
  assert.deepEqual(r.p_linhas[0], {
    termo: 't', campanha: 'c', grupo: 'g', palavra_chave: 'kw',
    segmentar: false, negativar: false, teste_ab: true, duvida: false,
    observacao: 'obs', impressoes: '150', conversoes: '2',
  });
});

test('dúvida (❓) é reconhecida', () => {
  const r = normalizarVereditos(JSON.stringify([base({ DUVIDA: '❓' })]), 'mesa_reportei');
  assert.equal(r.p_linhas[0].duvida, true);
});

test('texto que não é JSON devolve lista vazia sem lançar', () => {
  assert.deepEqual(normalizarVereditos('não é json', 'mesa_qualipix').p_linhas, []);
  assert.deepEqual(normalizarVereditos('', 'mesa_qualipix').p_linhas, []);
  assert.deepEqual(normalizarVereditos(undefined, 'mesa_qualipix').p_linhas, []);
});

test('objeto único é aceito; linha sem termo é descartada', () => {
  const um = normalizarVereditos(JSON.stringify(base({ SEGMENTAR: '✅' })), 'mesa_qualipix');
  assert.equal(um.p_linhas.length, 1);
  const semTermo = normalizarVereditos(JSON.stringify([base({ 'Termo de pesquisa': '', SEGMENTAR: '✅' })]), 'mesa_qualipix');
  assert.equal(semTermo.p_linhas.length, 0);
});

test('linha sem nenhum símbolo é descartada', () => {
  assert.equal(normalizarVereditos(JSON.stringify([base({})]), 'mesa_qualipix').p_linhas.length, 0);
});
