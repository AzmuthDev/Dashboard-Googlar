import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarOperacoes, CLIENTES } from './gen-ops.mjs';

const JID = '120363424743503833@g.us';
const APIKEY = 'CHAVE-DE-TESTE';

function backupSintetico(clientes = CLIENTES) {
  const nodes = [];
  const connections = {};
  for (const x of clientes) {
    nodes.push(
      { name: `Ler Termos da Planilha (${x})`, type: 'n8n-nodes-base.googleSheets', typeVersion: 4.7, position: [-4640, 1000], parameters: {} },
      { name: `Inicializar Estatísticas (${x})`, type: 'n8n-nodes-base.code', typeVersion: 2, position: [-4416, 1000], parameters: {} },
      { name: `Teve Dúvidas no Processo? (${x})`, type: 'n8n-nodes-base.if', typeVersion: 2, position: [-3000, 1000], parameters: {} },
      {
        name: `Notificar Sem Dúvidas (${x})`, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.4, position: [-3328, 1100],
        parameters: {
          method: 'POST', url: 'http://n8n_evolution-api:8080/message/sendText/Riku', sendHeaders: true,
          headerParameters: { parameters: [{ name: 'apikey', value: APIKEY }] }, sendBody: true, specifyBody: 'json',
          jsonBody: `={{ JSON.stringify({\n  number: '${JID}',\n  text: 'x'\n}) }}`, options: {},
        },
      },
      { name: `IA Auditor Semântico (${x})`, type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 2, position: [-2000, 1000], parameters: {} },
      { name: `IA Auditor Semântico (${x})1`, type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 2, position: [-2000, 1200], parameters: {} },
    );
    connections[`Ler Termos da Planilha (${x})`] = { main: [[{ node: `Inicializar Estatísticas (${x})`, type: 'main', index: 0 }]] };
  }
  return { nodes, connections };
}

const addNodes = (ops) => ops.filter(o => o.type === 'addNode').map(o => o.node);
const noDe = (ops, nome) => addNodes(ops).find(n => n.name === nome);
const temConexao = (ops, tipo, source, target, sourceIndex = 0) =>
  ops.some(o => o.type === tipo && o.source === source && o.target === target && (o.sourceIndex ?? 0) === sourceIndex);

// Executa o corpo de um nó Code com stubs do n8n.
function rodarCode(jsCode, { sheet = [], input = [], agente = null, staticData = {}, sheetNode = null } = {}) {
  const $ = (nome) => ({ all: () => (nome === sheetNode ? sheet.map(json => ({ json })) : []), first: () => ({ json: agente }) });
  const $input = { all: () => input.map(json => ({ json })), first: () => ({ json: input[0] }) };
  const fn = new Function('$', '$input', '$getWorkflowStaticData', jsCode);
  return fn($, $input, () => staticData);
}

test('cada esteira recebe 7 nós com os nomes do plano', () => {
  const backup = backupSintetico();
  for (const x of CLIENTES) {
    const { operations } = gerarOperacoes(backup, x);
    assert.ok(operations.length <= 100, `${x}: ${operations.length} operações`);
    const nomes = addNodes(operations).map(n => n.name).sort();
    assert.deepEqual(nomes, [
      `Buscar Julgados (${x})`, `Excluir Já Julgados (${x})`, `Gravar Vereditos (${x})`, `Há Termos Novos? (${x})`,
      `Montar Aviso do Filtro (${x})`, `Normalizar Vereditos (${x})`, `Notificar Filtro (${x})`,
    ].sort());
  }
});

test('conexões: Ler->Buscar->Excluir->(Há Novos? e Aviso), Há Novos?->Inicializar, IA->Normalizar->Gravar', () => {
  const x = 'Qualipix';
  const { operations: ops } = gerarOperacoes(backupSintetico(), x);
  assert.ok(temConexao(ops, 'removeConnection', `Ler Termos da Planilha (${x})`, `Inicializar Estatísticas (${x})`));
  assert.ok(temConexao(ops, 'addConnection', `Ler Termos da Planilha (${x})`, `Buscar Julgados (${x})`));
  assert.ok(temConexao(ops, 'addConnection', `Buscar Julgados (${x})`, `Excluir Já Julgados (${x})`));
  assert.ok(temConexao(ops, 'addConnection', `Excluir Já Julgados (${x})`, `Há Termos Novos? (${x})`));
  assert.ok(temConexao(ops, 'addConnection', `Excluir Já Julgados (${x})`, `Montar Aviso do Filtro (${x})`));
  assert.ok(temConexao(ops, 'addConnection', `Há Termos Novos? (${x})`, `Inicializar Estatísticas (${x})`, 0));
  assert.ok(temConexao(ops, 'addConnection', `Montar Aviso do Filtro (${x})`, `Notificar Filtro (${x})`));
  assert.ok(temConexao(ops, 'addConnection', `IA Auditor Semântico (${x})`, `Normalizar Vereditos (${x})`, 0));
  assert.ok(temConexao(ops, 'addConnection', `IA Auditor Semântico (${x})1`, `Normalizar Vereditos (${x})`, 0));
  assert.ok(temConexao(ops, 'addConnection', `Normalizar Vereditos (${x})`, `Gravar Vereditos (${x})`));
  // a saída "falso" do If não tem destino
  assert.ok(!ops.some(o => o.type === 'addConnection' && o.source === `Há Termos Novos? (${x})` && (o.sourceIndex ?? 0) === 1));
});

test('Buscar Julgados roda uma vez, sempre emite saída e não derruba o fluxo', () => {
  const x = 'Magic Hands';
  const { operations: ops } = gerarOperacoes(backupSintetico(), x);
  const no = noDe(ops, `Buscar Julgados (${x})`);
  assert.equal(no.type, 'n8n-nodes-base.supabase');
  assert.equal(no.parameters.tableId, 'mesa_magic_hands');
  assert.equal(no.parameters.returnAll, true);
  assert.equal(no.parameters.matchType, 'anyFilter');
  assert.deepEqual(no.parameters.filters.conditions.map(c => c.keyName).sort(),
    ['enviado_para_grupo', 'negativar', 'respondido_cliente', 'segmentar', 'teste_ab']);
  assert.equal(no.credentials.supabaseApi.id, 'FUabs49WcVpHY9ez');
  const cfg = ops.find(o => o.type === 'setNodeSettings' && o.nodeName === `Buscar Julgados (${x})`);
  assert.deepEqual(cfg.settings, { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' });
});

test('Gravar Vereditos chama o RPC upsert_veredito com a credencial do Supabase', () => {
  const x = 'Estremoz';
  const { operations: ops } = gerarOperacoes(backupSintetico(), x);
  const no = noDe(ops, `Gravar Vereditos (${x})`);
  assert.equal(no.parameters.url, 'https://jmptroahcezmpjdplxwy.supabase.co/rest/v1/rpc/upsert_veredito');
  assert.equal(no.parameters.method, 'POST');
  assert.equal(no.parameters.authentication, 'predefinedCredentialType');
  assert.equal(no.parameters.nodeCredentialType, 'supabaseApi');
  assert.equal(no.credentials.supabaseApi.id, 'FUabs49WcVpHY9ez');
  const cfg = ops.find(o => o.type === 'setNodeSettings' && o.nodeName === `Gravar Vereditos (${x})`);
  assert.equal(cfg.settings.onError, 'continueRegularOutput');
});

test('Notificar Filtro copia url, apikey e destino do nó "Notificar Sem Dúvidas"', () => {
  const x = 'Run Service';
  const { operations: ops } = gerarOperacoes(backupSintetico(), x);
  const no = noDe(ops, `Notificar Filtro (${x})`);
  assert.equal(no.parameters.url, 'http://n8n_evolution-api:8080/message/sendText/Riku');
  assert.equal(no.parameters.headerParameters.parameters[0].value, APIKEY);
  assert.ok(no.parameters.jsonBody.includes(`number: '${JID}'`));
  assert.ok(no.parameters.jsonBody.includes('$json.text'));
});

test('Normalizar Vereditos e Excluir não carregam module.exports', () => {
  const { operations: ops } = gerarOperacoes(backupSintetico(), 'Qualipix');
  for (const nome of ['Excluir Já Julgados (Qualipix)', 'Normalizar Vereditos (Qualipix)']) {
    assert.ok(!noDe(ops, nome).parameters.jsCode.includes('module.exports'), nome);
  }
});

test('código do nó Excluir: filtra, devolve sentinela quando tudo foi julgado e registra stats', () => {
  const x = 'Qualipix';
  const { operations: ops } = gerarOperacoes(backupSintetico(), x);
  const code = noDe(ops, `Excluir Já Julgados (${x})`).parameters.jsCode;
  const sheet = [
    { 'Termo de pesquisa': 'a', 'Campanha': 'c', 'Grupo de anúncios': 'g' },
    { 'Termo de pesquisa': 'b', 'Campanha': 'c', 'Grupo de anúncios': 'g' },
  ];
  const sd = {};
  const sheetNode = `Ler Termos da Planilha (${x})`;

  const parcial = rodarCode(code, { sheet, sheetNode, staticData: sd, input: [{ termo_de_pesquisa: 'A', campanha: 'C', grupo_de_anuncios: 'G' }] });
  assert.equal(parcial.length, 1);
  assert.equal(parcial[0].json['Termo de pesquisa'], 'b');
  assert.deepEqual(sd.filtro[x], { pulados: 1, filtroIndisponivel: false, total: 2, restantes: 1 });

  const tudo = rodarCode(code, { sheet, sheetNode, staticData: sd, input: [
    { termo_de_pesquisa: 'a', campanha: 'c', grupo_de_anuncios: 'g' }, { termo_de_pesquisa: 'b', campanha: 'c', grupo_de_anuncios: 'g' }] });
  assert.deepEqual(tudo, [{ json: { __nenhum_novo: true } }]);
});

test('código do nó Montar Aviso: silencioso sem pulados; avisa quando pula, esvazia ou o filtro cai', () => {
  const x = 'Qualipix';
  const { operations: ops } = gerarOperacoes(backupSintetico(), x);
  const code = noDe(ops, `Montar Aviso do Filtro (${x})`).parameters.jsCode;
  const com = (filtro) => rodarCode(code, { staticData: { filtro: { [x]: filtro } } });

  assert.deepEqual(com({ pulados: 0, filtroIndisponivel: false, total: 5, restantes: 5 }), []);
  const pulou = com({ pulados: 3, filtroIndisponivel: false, total: 5, restantes: 2 });
  assert.ok(pulou[0].json.text.includes('FILTRO DE TERMOS JÁ JULGADOS: Qualipix') && pulou[0].json.text.includes('3'));
  const vazio = com({ pulados: 5, filtroIndisponivel: false, total: 5, restantes: 0 });
  assert.ok(vazio[0].json.text.toLowerCase().includes('nenhum termo novo'));
  const caiu = com({ pulados: 0, filtroIndisponivel: true, total: 5, restantes: 5 });
  assert.ok(caiu[0].json.text.toLowerCase().includes('indisponível'));
  for (const r of [pulou, vazio, caiu]) assert.ok(!r[0].json.text.includes('/ups'));
});

test('código do nó Normalizar Vereditos: usa a tabela da esteira e não emite nada sem linhas válidas', () => {
  const x = 'Reportei';
  const { operations: ops } = gerarOperacoes(backupSintetico(), x);
  const code = noDe(ops, `Normalizar Vereditos (${x})`).parameters.jsCode;
  const linha = { 'Termo de pesquisa': 't', 'Palavra-chave': 'k', 'Campanha': 'c', 'Grupo de anúncios': 'g', 'SEGMENTAR': '✅', 'NEGATIVAR': '', 'TESTE_AB': '', 'DUVIDA': '', 'Observacao': 'o', 'Conversões': '0', 'Impr.': '9' };
  const ok = rodarCode(code, { input: [{ output: JSON.stringify([linha]) }] });
  assert.equal(ok[0].json.p_tabela, 'mesa_reportei');
  assert.equal(ok[0].json.p_linhas.length, 1);
  assert.deepEqual(rodarCode(code, { input: [{ output: 'lixo' }] }), []);
});

test('falha citando o nome quando um nó referenciado não existe no backup', () => {
  const backup = backupSintetico();
  backup.nodes = backup.nodes.filter(n => n.name !== 'Notificar Sem Dúvidas (Qualipix)');
  assert.throws(() => gerarOperacoes(backup, 'Qualipix'), /Notificar Sem Dúvidas \(Qualipix\)/);

  const semAgente1 = backupSintetico();
  semAgente1.nodes = semAgente1.nodes.filter(n => n.name !== 'IA Auditor Semântico (Qualipix)1');
  assert.throws(() => gerarOperacoes(semAgente1, 'Qualipix'), /IA Auditor Semântico \(Qualipix\)1/);
});

test('alvo desconhecido falha com mensagem clara', () => {
  assert.throws(() => gerarOperacoes(backupSintetico(), 'Cliente X'), /alvo desconhecido/i);
});
