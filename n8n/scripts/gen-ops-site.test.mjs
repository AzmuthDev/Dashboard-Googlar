import test from 'node:test';
import assert from 'node:assert/strict';
import { SITE, NOMES, opsSite, opsInternoVinculo, codigos } from './gen-ops-site.mjs';

const APIKEY = 'CHAVE-DE-TESTE';
const ALVOS = Object.keys(SITE);

// Executa o código de um nó Code com um ambiente n8n mínimo (o código usa return no topo, como no n8n).
function rodarCode(jsCode, { input = [], nos = {}, staticData = {} } = {}) {
  const $input = { all: () => input, first: () => input[0] };
  const $ = (nome) => {
    const itens = nos[nome] || [];
    return { all: () => itens, first: () => itens[0], item: itens[0] };
  };
  const fn = new Function('$input', '$', '$getWorkflowStaticData', jsCode);
  return fn($input, $, () => staticData);
}

test('cada alvo gera no máximo 100 operações e liga o modelo principal e o reserva', () => {
  for (const alvo of ALVOS) {
    const r = opsSite(alvo, APIKEY);
    assert.equal(r.workflowId, SITE[alvo].workflowId);
    assert.ok(r.operations.length <= 100, `${alvo}: ${r.operations.length}`);
    const conexoes = r.operations.filter(o => o.type === 'addConnection');
    assert.ok(conexoes.some(o => o.source === NOMES.modelo && o.target === NOMES.agente && o.connectionType === 'ai_languageModel'));
    assert.ok(conexoes.some(o => o.source === NOMES.agente && o.target === NOMES.reserva && o.sourceIndex === 1));
    assert.ok(conexoes.some(o => o.source === NOMES.reserva && o.target === NOMES.falha && o.sourceIndex === 1));
  }
});

test('só um caminho volta para o loop (sem execução dupla do lote)', () => {
  for (const alvo of ALVOS) {
    const voltas = opsSite(alvo, APIKEY).operations.filter(o => o.type === 'addConnection' && o.target === NOMES.lote);
    assert.deepEqual(voltas.map(o => o.source).sort(), [NOMES.novos, NOMES.pausa].sort(), alvo);
  }
});

test('os nós removidos incluem os nós mortos com credencial quebrada ou tabela errada', () => {
  const endo = opsSite('endomarcas', APIKEY).operations.filter(o => o.type === 'removeNode').map(o => o.nodeName);
  assert.ok(endo.includes('Create a row'), 'nó com credencial apagada');
  assert.ok(endo.includes('Create a row2'), 'nó que gravava em mesa_qualipix');
  const quali = opsSite('qualipix', APIKEY).operations.filter(o => o.type === 'removeNode').map(o => o.nodeName);
  assert.ok(quali.includes('Webhook Evolution API') && quali.includes('1. Card para o Cliente'), 'ramo de votos morto');
});

test('agentes usam o prompt do arquivo, com no máximo 3000 caracteres e o lote do Preparar Texto IA', () => {
  for (const alvo of ALVOS) {
    const agentes = opsSite(alvo, APIKEY).operations.filter(o => o.type === 'addNode' && o.node.type === '@n8n/n8n-nodes-langchain.agent');
    assert.equal(agentes.length, 2);
    for (const a of agentes) {
      assert.ok(a.node.parameters.text.length <= 3100);
      assert.match(a.node.parameters.text, /\$\('Preparar Texto IA'\)\.first\(\)\.json\.meu_texto_pronto/);
      assert.doesNotMatch(a.node.parameters.text, /STATUS_GRANULARIDADE|Sugestao_Grupo|Cliques|CPC/);
    }
  }
});

test('apikey só entra nos nós da Evolution criados pelo gerador', () => {
  const r = opsSite('estremoz', APIKEY);
  const comChave = r.operations.filter(o => JSON.stringify(o).includes(APIKEY)).map(o => o.node && o.node.name);
  assert.deepEqual(comChave.sort(), [NOMES.notificar, NOMES.notificarErro].sort());
  assert.throws(() => opsSite('estremoz', ''), /apikey/);
});

test('fluxo dos nós Code: planilha em inglês → lote → vereditos → resumo', () => {
  const c = codigos(SITE.estremoz);
  const sd = {};
  const planilha = [
    { json: { 'Search term': 'gradil pvc preço', 'Keyword': 'gradil pvc', 'Campaign Name': 'C', 'Ad Group Name': 'G', 'Impressions': '50', 'Clicks': '2' } },
    { json: { 'Search term': 'tela galvanizada', 'Keyword': 'tela', 'Campaign Name': 'C', 'Ad Group Name': 'G' } },
    { json: { 'Search term': 'Total: Search terms' } },
  ];
  const julgados = [{ json: { termo_de_pesquisa: 'Tela Galvanizada', campanha: 'c', grupo_de_anuncios: 'g' } }];
  const novos = rodarCode(c.excluir, { input: julgados, nos: { planilha }, staticData: sd });
  assert.equal(novos.length, 1);
  assert.equal(novos[0].json['Termo de pesquisa'], 'gradil pvc preço');
  assert.deepEqual([sd.auditoria.lidos, sd.auditoria.pulados, sd.auditoria.novos], [2, 1, 1]);

  const lote = rodarCode(c.preparar, { input: novos });
  assert.equal(lote[0].json.total, 1);

  const iaOutput = { output: JSON.stringify([{ 'Termo de pesquisa': 'gradil pvc preço', 'Campanha': 'C', 'Grupo de anúncios': 'G', DUVIDA: '❓', SEGMENTAR: '', NEGATIVAR: '', TESTE_AB: '' }]) };
  const norm = rodarCode(c.normalizar, { input: [{ json: iaOutput }], nos: { [NOMES.preparar]: lote }, staticData: sd });
  assert.equal(norm[0].json.p_origem, 'site');
  assert.equal(norm[0].json.p_linhas[0].segmentar, true, 'dúvida que bate com a palavra-chave vira segmentar');
  assert.equal(norm[0].json.p_linhas[0].impressoes, '50');

  rodarCode(c.conferir, { input: [{ json: 1 }], nos: { [NOMES.normalizar]: norm }, staticData: sd });
  assert.equal(sd.auditoria.gravados, 1);

  const resumo = rodarCode(c.concluir, { staticData: sd });
  assert.match(resumo[0].json.text, /AUDITORIA CONCLUÍDA \(SITE\): Estremoz/);
  assert.match(resumo[0].json.text, /corrigidas para segmentar.*: 1/);
});

test('falha dos dois agentes registra o lote e a esteira segue', () => {
  const c = codigos(SITE.qualipix);
  const sd = { auditoria: { lotesFalhos: 0, semVeredito: 0, erros: [] } };
  const lote = [{ json: { linhas: [{}, {}, {}] } }];
  const r = rodarCode(c.falha, { input: [{ json: { error: { message: 'quota' } } }], nos: { [NOMES.preparar]: lote }, staticData: sd });
  assert.equal(r[0].json.falha, true);
  assert.deepEqual([sd.auditoria.lotesFalhos, sd.auditoria.semVeredito], [1, 3]);
  assert.match(sd.auditoria.erros[0], /quota/);
});

test('Montar Enquete gera corpo válido e mantém o id da linha pareado', () => {
  const c = codigos(SITE['magic-hands']);
  const r = rodarCode(c.montar, { input: [{ json: { id: 'u1', termo_de_pesquisa: 'maid "service"', observacao: 'a\nb' } }] });
  assert.equal(r[0].json.id, 'u1');
  assert.equal(r[0].json.body.number, SITE['magic-hands'].jid);
  assert.deepEqual(r[0].pairedItem, { item: 0 });
});

test('ajuste do interno liga a enquete do cliente ao RPC de vínculo', () => {
  const backup = { nodes: ['2. Enquete para o Cliente', '3. Processar Votos e Consenso', 'Notificar Resposta Site', 'Gravar Decisão (RPC)']
    .map(name => ({ name, position: [0, 0], parameters: {} })) };
  const r = opsInternoVinculo(backup);
  const prep = r.operations.find(o => o.type === 'addNode' && o.node.name === 'Preparar Vínculo da Enquete');
  const saida = rodarCode(prep.node.parameters.jsCode, {
    input: [{ json: { key: { id: '3EB0X' } } }],
    nos: { '3. Processar Votos e Consenso': [{ json: { cliente: 'Reportei', termo: 't', campanha: 'Geral', grupo: 'Geral' } }] },
  });
  assert.deepEqual(saida[0].json, { p_tabela: 'mesa_reportei', p_termo: 't', p_campanha: 'Geral', p_grupo: 'Geral', p_id_enquete: '3EB0X' });
  assert.ok(r.operations.some(o => o.type === 'addConnection' && o.source === '2. Enquete para o Cliente' && o.target === 'Preparar Vínculo da Enquete'));
  assert.throws(() => opsInternoVinculo({ nodes: [] }), /Nó ausente/);
});
