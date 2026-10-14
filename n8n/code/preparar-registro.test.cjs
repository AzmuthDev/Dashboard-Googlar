const test = require('node:test');
const assert = require('node:assert/strict');
const { TABELA_POR_CLIENTE, prepararRegistro } = require('./preparar-registro.cjs');

const saida = (o) => ({
  consenso_atingido: true, acao: 'DECISAO_INTERNA', cliente: 'Qualipix', opcao_vencedora: '❌ Negativar',
  termo: 'x', campanha: 'c', grupo: 'g', palavra_chave: 'k', ...o,
});

test('mapa de clientes cobre as 6 esteiras', () => {
  assert.deepEqual(TABELA_POR_CLIENTE, {
    'Magic Hands': 'mesa_magic_hands', 'Endomarcas': 'mesa_endomarcas', 'Qualipix': 'mesa_qualipix',
    'Estremoz': 'mesa_estremoz', 'Run Service': 'mesa_run_service', 'Reportei': 'mesa_reportei',
  });
});

test('resposta do cliente vira respondido_cliente', () => {
  assert.deepEqual(prepararRegistro(saida({ acao: 'RESPOSTA_CLIENTE' })), {
    p_tabela: 'mesa_qualipix', p_termo: 'x', p_campanha: 'c', p_grupo: 'g', p_palavra_chave: 'k',
    p_opcao: '❌ Negativar', p_estado: 'respondido_cliente',
  });
});

test('consenso interno vira decidido_equipe', () => {
  assert.equal(prepararRegistro(saida({})).p_estado, 'decidido_equipe');
});

test('despacho ao cliente vira aguardando_cliente sem opção', () => {
  const r = prepararRegistro(saida({ acao: 'ENVIAR_CLIENTE', opcao_vencedora: '❓ Dúvida (Enviar ao Cliente)' }));
  assert.equal(r.p_estado, 'aguardando_cliente');
  assert.equal(r.p_opcao, null);
});

test('decisão interna "dúvida" sem despacho não registra', () => {
  assert.equal(prepararRegistro(saida({ opcao_vencedora: '❓ Dúvida (Enviar ao Cliente)' })), null);
});

test('cliente desconhecido, ignorado, sem consenso ou sem saída não registram', () => {
  assert.equal(prepararRegistro(saida({ cliente: 'Desconhecido' })), null);
  assert.equal(prepararRegistro(saida({ ignorado: true })), null);
  assert.equal(prepararRegistro(saida({ consenso_atingido: false })), null);
  assert.equal(prepararRegistro(null), null);
});

test('espaços no nome do cliente são tolerados', () => {
  assert.equal(prepararRegistro(saida({ cliente: ' Run Service ' })).p_tabela, 'mesa_run_service');
});
