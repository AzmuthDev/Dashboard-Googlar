const test = require('node:test');
const assert = require('node:assert/strict');
const { prepararVinculo } = require('./preparar-vinculo.cjs');

const dados = { termo: 'métricas x', campanha: 'Geral', grupo: 'Geral', cliente: 'Reportei' };

test('monta o corpo do RPC com o id da enquete enviada ao cliente', () => {
  assert.deepEqual(prepararVinculo(dados, { key: { id: '3EB0ABC' } }, 'mesa_reportei'), {
    p_tabela: 'mesa_reportei', p_termo: 'métricas x', p_campanha: 'Geral', p_grupo: 'Geral', p_id_enquete: '3EB0ABC',
  });
});

test('falha no envio (sem key.id), sem tabela ou sem termo não vincula nada', () => {
  assert.equal(prepararVinculo(dados, { error: 'bot fora do grupo' }, 'mesa_reportei'), null);
  assert.equal(prepararVinculo(dados, { key: { id: 'x' } }, undefined), null);
  assert.equal(prepararVinculo({ cliente: 'Reportei' }, { key: { id: 'x' } }, 'mesa_reportei'), null);
  assert.equal(prepararVinculo(null, null, null), null);
});
