const test = require('node:test');
const assert = require('node:assert/strict');
const { montarEnquete, LIMITE_NOME_ENQUETE } = require('./enquete-site.cjs');

test('monta a enquete no formato Cliente/Termo/KW/Obs com as opções do site', () => {
  const e = montarEnquete({ termo_de_pesquisa: 'tela 3/4', palavra_chave: 'tela', observacao: 'Malha atípica' }, 'Estremoz', '1@g.us');
  assert.equal(e.number, '1@g.us');
  assert.equal(e.name, '🏢 *Cliente:* Estremoz\n🔍 *Termo:* "tela 3/4"\n🔑 *KW:* tela\n💬 *Obs:* Malha atípica');
  assert.deepEqual(e.values, ['✅ Relevante', '❌ Negativar', '⚠️ Teste A/B']);
  assert.equal(e.selectableCount, 1);
});

test('aspas e quebras de linha não quebram o JSON e o nome respeita o limite', () => {
  const e = montarEnquete({ termo_de_pesquisa: 'termo "com aspas"', observacao: 'linha 1\nlinha 2 ' + 'x'.repeat(400) }, 'Qualipix', '2@g.us');
  assert.ok(e.name.length <= LIMITE_NOME_ENQUETE);
  assert.ok(!e.name.split('💬')[1].includes('\n'));
  assert.deepEqual(JSON.parse(JSON.stringify(e)), e);
});

test('sem observação usa o comentário e depois um texto padrão', () => {
  assert.match(montarEnquete({ termo_de_pesquisa: 't', comentario: 'coment' }, 'X', 'j').name, /Obs:\* coment$/);
  assert.match(montarEnquete({ termo_de_pesquisa: 't' }, 'X', 'j').name, /Avaliar pertinência/);
});
