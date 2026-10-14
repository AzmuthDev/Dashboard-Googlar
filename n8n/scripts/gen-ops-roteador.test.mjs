import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarOperacoes } from './gen-ops.mjs';

const APIKEY = 'CHAVE-DE-TESTE';

function backupRoteador() {
  const n = (name, type, typeVersion, position, parameters = {}) => ({ name, type, typeVersion, position, parameters });
  return {
    nodes: [
      n('1. Extrair ID e Voto', 'n8n-nodes-base.code', 2, [-2000, 2000]),
      n('2. Buscar Criacao na Evolution', 'n8n-nodes-base.httpRequest', 4.4, [-1776, 2000]),
      n('3. Processar Votos e Consenso', 'n8n-nodes-base.code', 2, [-1328, 2000]),
      n('Bateu 2 Votos?', 'n8n-nodes-base.if', 2, [-1104, 2000]),
      n('Notificar Decisão Interna', 'n8n-nodes-base.httpRequest', 4.4, [-880, 2000], {
        method: 'POST', url: 'http://n8n_evolution-api:8080/message/sendText/Riku', sendHeaders: true,
        headerParameters: { parameters: [{ name: 'apikey', value: APIKEY }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ x }}', options: {},
      }),
    ],
    connections: {
      '1. Extrair ID e Voto': { main: [[{ node: '2. Buscar Criacao na Evolution', type: 'main', index: 0 }]] },
      '3. Processar Votos e Consenso': { main: [[{ node: 'Bateu 2 Votos?', type: 'main', index: 0 }]] },
    },
  };
}

const addNodes = (ops) => ops.filter(o => o.type === 'addNode').map(o => o.node);
const noDe = (ops, nome) => addNodes(ops).find(n => n.name === nome);
const temConexao = (ops, tipo, source, target, sourceIndex = 0) =>
  ops.some(o => o.type === tipo && o.source === source && o.target === target && (o.sourceIndex ?? 0) === sourceIndex);

function rodarCode(jsCode, { input = [], first = null, staticData = {} } = {}) {
  const $ = () => ({ first: () => ({ json: first }), all: () => [{ json: first }] });
  const $input = { all: () => input.map(json => ({ json })), first: () => ({ json: input[0] }) };
  return new Function('$', '$input', '$getWorkflowStaticData', jsCode)($, $input, () => staticData);
}

test('roteador: 6 nós novos com os nomes do plano e no máximo 100 operações', () => {
  const { operations } = gerarOperacoes(backupRoteador(), 'roteador');
  assert.ok(operations.length <= 100);
  assert.deepEqual(addNodes(operations).map(n => n.name).sort(), [
    'Classificar Origem do Voto', 'Gravar Decisão (RPC)', 'Notificar Resposta Site', 'Preparar Registro de Decisão',
    'Registrar Resposta Site (RPC)', 'É Enquete do Site?',
  ].sort());
});

test('roteador: a conexão antiga é trocada; "falso" volta ao caminho antigo; "verdadeiro" notifica', () => {
  const { operations: ops } = gerarOperacoes(backupRoteador(), 'roteador');
  assert.ok(temConexao(ops, 'removeConnection', '1. Extrair ID e Voto', '2. Buscar Criacao na Evolution'));
  assert.ok(temConexao(ops, 'addConnection', '1. Extrair ID e Voto', 'Registrar Resposta Site (RPC)'));
  assert.ok(temConexao(ops, 'addConnection', 'Registrar Resposta Site (RPC)', 'Classificar Origem do Voto'));
  assert.ok(temConexao(ops, 'addConnection', 'Classificar Origem do Voto', 'É Enquete do Site?'));
  assert.ok(temConexao(ops, 'addConnection', 'É Enquete do Site?', 'Notificar Resposta Site', 0));
  assert.ok(temConexao(ops, 'addConnection', 'É Enquete do Site?', '2. Buscar Criacao na Evolution', 1));
  assert.ok(temConexao(ops, 'addConnection', '3. Processar Votos e Consenso', 'Preparar Registro de Decisão'));
  assert.ok(temConexao(ops, 'addConnection', 'Preparar Registro de Decisão', 'Gravar Decisão (RPC)'));
  // o caminho para "Bateu 2 Votos?" não é tocado
  assert.ok(!ops.some(o => o.type === 'removeConnection' && o.source === '3. Processar Votos e Consenso'));
});

test('roteador: RPCs usam a credencial do Supabase e não derrubam o fluxo em erro', () => {
  const { operations: ops } = gerarOperacoes(backupRoteador(), 'roteador');
  const site = noDe(ops, 'Registrar Resposta Site (RPC)');
  assert.equal(site.parameters.url, 'https://jmptroahcezmpjdplxwy.supabase.co/rest/v1/rpc/registrar_resposta_cliente');
  assert.equal(site.parameters.nodeCredentialType, 'supabaseApi');
  assert.equal(site.credentials.supabaseApi.id, 'FUabs49WcVpHY9ez');
  assert.ok(site.parameters.jsonBody.includes('p_id_enquete') && site.parameters.jsonBody.includes('p_opcao'));
  const dec = noDe(ops, 'Gravar Decisão (RPC)');
  assert.equal(dec.parameters.url, 'https://jmptroahcezmpjdplxwy.supabase.co/rest/v1/rpc/registrar_decisao_interna');
  for (const nome of ['Registrar Resposta Site (RPC)', 'Gravar Decisão (RPC)', 'Notificar Resposta Site']) {
    const cfg = ops.find(o => o.type === 'setNodeSettings' && o.nodeName === nome);
    assert.equal(cfg.settings.onError, 'continueRegularOutput', nome);
  }
});

test('roteador: Notificar Resposta Site copia url/apikey, vai à equipe e não contém /ups', () => {
  const { operations: ops } = gerarOperacoes(backupRoteador(), 'roteador');
  const no = noDe(ops, 'Notificar Resposta Site');
  assert.equal(no.parameters.url, 'http://n8n_evolution-api:8080/message/sendText/Riku');
  assert.equal(no.parameters.headerParameters.parameters[0].value, APIKEY);
  assert.ok(no.parameters.jsonBody.includes("number: '120363424743503833@g.us'"));
  assert.ok(!no.parameters.jsonBody.includes('/ups'));
  assert.ok(no.parameters.jsonBody.includes('RESPOSTA DO CLIENTE RECEBIDA'));
});

test('roteador: o código de Classificar Origem roda com stubs do n8n', () => {
  const { operations: ops } = gerarOperacoes(backupRoteador(), 'roteador');
  const code = noDe(ops, 'Classificar Origem do Voto').parameters.jsCode;
  const voto = { ignorado: false, poll_id: 'P1', opcao_votada: '✅ Segmentar', voter_name: 'Ana' };
  const achou = rodarCode(code, { first: voto, input: [{ encontrado: true, tabela: 'mesa_qualipix', acao: 'segmentar' }] });
  assert.equal(achou[0].json.site, true);
  assert.equal(achou[0].json.poll_id, 'P1');
  const naoAchou = rodarCode(code, { first: voto, input: [{ encontrado: false }] });
  assert.equal(naoAchou[0].json.site, false);
});

test('roteador: o código de Preparar Registro de Decisão devolve [] sem decisão e o corpo do RPC com decisão', () => {
  const { operations: ops } = gerarOperacoes(backupRoteador(), 'roteador');
  const code = noDe(ops, 'Preparar Registro de Decisão').parameters.jsCode;
  assert.deepEqual(rodarCode(code, { input: [{ consenso_atingido: false, cliente: 'Qualipix' }] }), []);
  const r = rodarCode(code, { input: [{ consenso_atingido: true, acao: 'RESPOSTA_CLIENTE', cliente: 'Qualipix', opcao_vencedora: '❌ Negativar', termo: 'x', campanha: 'c', grupo: 'g', palavra_chave: 'k' }] });
  assert.equal(r[0].json.p_tabela, 'mesa_qualipix');
  assert.equal(r[0].json.p_estado, 'respondido_cliente');
});

test('roteador: falha citando o nó quando o workflow não tem o nó de referência', () => {
  const backup = backupRoteador();
  backup.nodes = backup.nodes.filter(n => n.name !== 'Notificar Decisão Interna');
  assert.throws(() => gerarOperacoes(backup, 'roteador'), /Notificar Decisão Interna/);
});
