// Gera as operações de update_workflow (MCP do n8n) que reconstroem a esteira dos workflows do Pocket do site
// no molde do Pocket interno: filtro de já julgados, agente principal + agente reserva, vereditos via RPC,
// resumo no grupo da equipe e envio de enquetes sem JSON quebrado. Também gera o ajuste do interno que grava
// o id da enquete despachada ao cliente (alvo "interno-vinculo").
// Uso: node n8n/scripts/gen-ops-site.mjs <backup-do-interno.json> <alvo>
// Alvos: endomarcas | comparar-seguro-viagem | estremoz | magic-hands | qualipix | interno-vinculo
// A apikey da Evolution é lida do backup do interno. Saída em n8n/out/ (não versionar).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const SUPABASE_RPC = 'https://jmptroahcezmpjdplxwy.supabase.co/rest/v1/rpc';
const CRED_SUPABASE = { id: 'FUabs49WcVpHY9ez', name: 'Supabase account 5' };
const CRED_GEMINI_PRINCIPAL = { id: 'YKaM0MbeUjc1DPp5', name: 'Google Gemini(PaLM) Api account 3' };
const CRED_GEMINI_RESERVA = { id: 'CJ590DJ4YzYgkyyf', name: 'Google Gemini(PaLM) Api account 2' };
const MODELO_PRINCIPAL = 'models/gemini-2.5-flash-lite';
const MODELO_RESERVA = 'models/gemini-2.5-flash';
const EVOLUTION_TEXTO = 'http://n8n_evolution-api:8080/message/sendText/Riku';
const GRUPO_EQUIPE = '120363424743503833@g.us';
const TAMANHO_LOTE = 15;

const MANUAL = 'When clicking ‘Execute workflow’';

// Nós antigos sem uso (agentes "filtro"/"blindagem", Baserow, formatadores, ramo de votos morto do Qualipix etc.).
export const SITE = {
  endomarcas: {
    workflowId: 'izqF7glcXxReCXY2', cliente: 'Endomarcas', tabela: 'mesa_endomarcas', jid: '120363407305667257@g.us',
    prompt: 'endomarcas.txt', planilha: 'planilha1', gatilhos: [MANUAL, 'Schedule Trigger', 'Webhook'],
    planilhaSaida: 'Append row in sheet1', agendaEnquete: 'Schedule Trigger2',
    poller: { buscar: 'Buscar 5 Pendentes1', enviar: 'Enviar Enquete Evolution1', marcar: 'Marcar como Enviado' },
    remover: ['Formatador1', 'Code in JavaScript', 'Google Gemini Chat Model2', 'Agente Filtro', 'Agente de blindagem',
      'Agente juiz', 'Sticky Note', 'Sticky Note1', 'Sticky Note2', 'Sticky Note3', 'Sticky Note4', 'Get many rows',
      'Google Gemini Chat Model3', 'Loop Over Items', 'grudador1', 'Google Gemini Chat Model4', 'Formatador2',
      'Code in JavaScript3', 'Create a row', 'Create a row2', 'Formatador4', 'Code in JavaScript2', 'Create a row4',
      'Wait 10s2', 'Limpar Dados'],
    desligar: [['Buscar 5 Pendentes1', 'Enviar Enquete Evolution1']],
  },
  'comparar-seguro-viagem': {
    workflowId: 'yEITJcoPpuJB9sRI', cliente: 'Comparar Seguro Viagem', tabela: 'mesa_comparar_seguro_viagem', jid: '120363411772521802@g.us',
    prompt: 'comparar-seguro-viagem.txt', planilha: 'planilha', gatilhos: [MANUAL, 'Schedule Trigger'],
    planilhaSaida: null, agendaEnquete: 'Schedule Trigger3',
    poller: { buscar: 'Buscar 5 Pendentes', enviar: 'Enviar Enquete Evolution', marcar: 'Marcar como Enviado2' },
    remover: ['AI Agent1', 'Google Gemini Chat Model1', 'Loop Over Items1', 'Wait1', 'Append row in sheet', 'grudador',
      'Google Gemini Chat Model', 'Get row(s) in sheet in Google Sheets', 'Google Gemini Chat Model2', 'Agente Filtro',
      'Sticky Note', 'Sticky Note1', 'Sticky Note4', 'Formatador2', 'Formatador', 'Create a row1', 'Code in JavaScript',
      'Create a row2', 'Limpar Dados', 'Wait 10s3'],
    desligar: [],
  },
  estremoz: {
    workflowId: 'YzrPAnuQVoC2vyOhfRyb1', cliente: 'Estremoz', tabela: 'mesa_estremoz', jid: '120363406729550086@g.us',
    prompt: 'estremoz.txt', planilha: 'planilha', gatilhos: [MANUAL, 'Schedule Trigger'],
    planilhaSaida: 'Append row in sheet', agendaEnquete: 'Schedule Trigger3',
    poller: { buscar: 'Buscar 5 Pendentes', enviar: 'Enviar Enquete Evolution', marcar: 'Marcar como Enviado2' },
    remover: ['AI Agent1', 'Google Gemini Chat Model1', 'Loop Over Items1', 'Wait1', 'Formatador1', 'Filtro', 'grudador',
      'AI Agent', 'Google Gemini Chat Model', 'Get row(s) in sheet in Google Sheets', 'Get many campaigns',
      'Google Gemini Chat Model2', 'Agente Filtro', 'Sticky Note', 'Sticky Note1', 'Sticky Note3', 'Sticky Note4',
      'Get many rows', 'Formatador2', 'Formatador', 'Create a row1', 'Code in JavaScript', 'Create a row2', 'Limpar Dados',
      'Wait 10s3'],
    desligar: [['Buscar 5 Pendentes', 'Enviar Enquete Evolution']],
  },
  'magic-hands': {
    workflowId: 'pUdnw0fcaEM33izI', cliente: 'Magic Hands', tabela: 'mesa_magic_hands', jid: '120363427648562835@g.us',
    prompt: 'magic-hands.txt', planilha: 'planilha', gatilhos: [MANUAL, 'Schedule Trigger'],
    planilhaSaida: null, agendaEnquete: 'Schedule Trigger3',
    poller: { buscar: 'Buscar 5 Pendentes', enviar: 'Enviar Enquete Evolution', marcar: 'Marcar como Enviado2' },
    remover: ['AI Agent1', 'Google Gemini Chat Model1', 'Loop Over Items1', 'Wait1', 'Append row in sheet', 'grudador',
      'Google Gemini Chat Model2', 'Agente Filtro', 'Sticky Note', 'Sticky Note1', 'Sticky Note4', 'Formatador2',
      'Formatador', 'Create a row1', 'Code in JavaScript', 'Create a row2', 'Limpar Dados', 'Wait 10s3'],
    desligar: [['Buscar 5 Pendentes', 'Enviar Enquete Evolution']],
  },
  qualipix: {
    workflowId: 'wtNTrZrjPaXRpiiM', cliente: 'Qualipix', tabela: 'mesa_qualipix', jid: '120363402801713988@g.us',
    prompt: 'qualipix.txt', planilha: 'Get row(s) in sheet', gatilhos: [MANUAL, 'Schedule Trigger'],
    planilhaSaida: 'Append row in sheet1', agendaEnquete: 'Schedule Trigger3',
    poller: { buscar: 'Buscar 5 Pendentes', enviar: 'Enviar Enquete Evolution', marcar: 'Marcar como Enviado1' },
    remover: ['AI Agent', 'Google Gemini Chat Model', 'AI Agent2', 'Google Gemini Chat Model3', 'Loop Over Items',
      'Consultar Histórico no Supabase', 'Combinar com Histórico', 'Wait', 'grudador1', 'Create a row2',
      'Code in JavaScript1', 'Formatador4', 'Wait 10s', 'Webhook Evolution API', 'Tradutor de Decisão',
      'Update Dashboard DB', 'Trigger Refresh Dashboard', 'Processar Votos (Regra 2)', 'Bateu 2 Votos?',
      'É Dúvida para o Cliente?', '1. Card para o Cliente', '2. Enquete para o Cliente', 'Notificar Equipe (Despachado)',
      'Notificar Decisão Interna'],
    desligar: [['Buscar 5 Pendentes', 'Enviar Enquete Evolution']],
  },
};

export const NOMES = {
  buscar: 'Buscar Julgados',
  excluir: 'Excluir Já Julgados',
  novos: 'Há Termos Novos?',
  lote: 'Lote de Itens',
  preparar: 'Preparar Texto IA',
  agente: 'IA Auditor Semântico',
  modelo: 'Gemini Principal',
  reserva: 'IA Auditor Semântico (Reserva)',
  modeloReserva: 'Gemini Reserva',
  contarReserva: 'Contar Uso da Reserva',
  normalizar: 'Normalizar Vereditos',
  gravar: 'Gravar Vereditos (RPC)',
  conferir: 'Conferir Gravação',
  falha: 'Registrar Falha do Lote',
  pausa: 'Pausa Entre Lotes',
  concluir: 'Concluir Auditoria',
  notificar: 'Notificar Equipe',
  linhasPlanilha: 'Linhas para Planilha',
  montar: 'Montar Enquete',
  criada: 'Enquete Criada?',
  erroTrigger: 'Error Trigger',
  notificarErro: 'Notificar Erro',
};

// Corpo do módulo sem a linha de export (o nó Code do n8n não precisa dela).
function fonteModulo(arquivo) {
  return readFileSync(join(raiz, 'code', arquivo), 'utf8')
    .split(/\r?\n/)
    .filter(l => !/^if \(typeof module/.test(l))
    .join('\n');
}

function textoPrompt(arquivo) {
  const p = readFileSync(join(raiz, 'prompts', arquivo), 'utf8').trim();
  if (!p.includes('{{DADOS}}')) throw new Error(`Prompt sem {{DADOS}}: ${arquivo}`);
  if (p.length > 3000) throw new Error(`Prompt acima de 3000 caracteres: ${arquivo}`);
  return '=' + p.replace('{{DADOS}}', `{{ $('${NOMES.preparar}').first().json.meu_texto_pronto }}`);
}

const AUDITORIA_VAZIA = '{ inicio: new Date().toISOString(), lidos: 0, pulados: 0, filtroIndisponivel: false, novos: 0, gravados: 0, duvidas: 0, corrigidos: 0, reserva: 0, semVeredito: 0, falhaGravacao: 0, lotesFalhos: 0, erros: [] }';

export function codigos(cfg) {
  return {
    excluir: `const SHEET_NODE = ${JSON.stringify(cfg.planilha)};

${fonteModulo('planilha-site.cjs')}

${fonteModulo('excluir-julgados.cjs')}

const planilha = limparPlanilha($(SHEET_NODE).all().map(i => i.json));
const julgados = $input.all().map(i => i.json);
const r = excluirJulgados(planilha, julgados);

const sd = $getWorkflowStaticData('global');
sd.auditoria = Object.assign(${AUDITORIA_VAZIA}, { lidos: planilha.length, pulados: r.pulados, filtroIndisponivel: r.filtroIndisponivel, novos: r.restantes.length });

if (r.restantes.length === 0) return [{ json: { __nenhum_novo: true } }];
return r.restantes.map(json => ({ json }));
`,
    preparar: `${fonteModulo('planilha-site.cjs')}

return [{ json: prepararLote($input.all().map(i => i.json)) }];
`,
    normalizar: `const TABELA = ${JSON.stringify(cfg.tabela)};

${fonteModulo('vereditos-site.cjs')}

const entrada = $input.first().json || {};
const raw = entrada.output || entrada.text || entrada.response || '';
const lote = $('${NOMES.preparar}').first().json.linhas || [];
const r = vereditosSite(raw, lote, TABELA);

const a = $getWorkflowStaticData('global').auditoria;
if (a) {
  a.duvidas += r.p_linhas.filter(l => l.duvida).length;
  a.corrigidos += r.corrigidos;
  a.semVeredito += r.sem_veredito.length;
}
return [{ json: { p_tabela: r.p_tabela, p_origem: r.p_origem, p_linhas: r.p_linhas } }];
`,
    contarReserva: `const a = $getWorkflowStaticData('global').auditoria;
if (a) a.reserva += 1;
return $input.all();
`,
    falha: `const a = $getWorkflowStaticData('global').auditoria;
const lote = $('${NOMES.preparar}').first().json.linhas || [];
if (a) {
  const e = ($input.first().json || {}).error;
  a.lotesFalhos += 1;
  a.semVeredito += lote.length;
  a.erros.push('IA: ' + String((e && e.message) || e || 'os dois agentes falharam').substring(0, 200));
}
return [{ json: { falha: true, termos: lote.length } }];
`,
    conferir: `const a = $getWorkflowStaticData('global').auditoria;
const enviados = ($('${NOMES.normalizar}').first().json.p_linhas || []).length;
const resp = $input.first().json;
const erro = resp && typeof resp === 'object' ? resp.error : null;
if (a) {
  if (erro) {
    a.falhaGravacao += enviados;
    a.erros.push('Gravação: ' + String(erro.message || erro).substring(0, 200));
  } else {
    a.gravados += enviados;
  }
}
return [{ json: { gravados: erro ? 0 : enviados } }];
`,
    concluir: `const CLIENTE = ${JSON.stringify(cfg.cliente)};

${fonteModulo('resumo-auditoria-site.cjs')}

const a = $getWorkflowStaticData('global').auditoria || {};
return [{ json: { text: resumoAuditoriaSite(CLIENTE, a) } }];
`,
    linhasPlanilha: `const linhas = $input.first().json.p_linhas || [];
return linhas.map(l => ({ json: {
  'Campanha': l.campanha, 'Grupo de anúncios': l.grupo, 'Palavra-chave': l.palavra_chave, 'Termo de pesquisa': l.termo,
  'SEGMENTAR': l.segmentar ? '✅' : '', 'NEGATIVAR': l.negativar ? '❌' : '', 'TESTE_AB': l.teste_ab ? '⚠️' : '', 'DUVIDA': l.duvida ? '❓' : '',
  'Observacao': l.observacao, 'Cliques': l.cliques, 'Impr.': l.impressoes, 'CTR': l.ctr, 'CPC méd.': l.cpc_medio,
  'Custo': l.custo, 'Conversões': l.conversoes, 'Tipo de corresp.': l.tipo_corresp,
} }));
`,
    montar: `const CLIENTE = ${JSON.stringify(cfg.cliente)};
const JID = ${JSON.stringify(cfg.jid)};

${fonteModulo('enquete-site.cjs')}

return $input.all().map((item, i) => ({ json: { id: item.json.id, body: montarEnquete(item.json, CLIENTE, JID) }, pairedItem: { item: i } }));
`,
  };
}

function seBooleano(id, expressao) {
  return {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
      conditions: [{ id, leftValue: expressao, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    },
    options: {},
  };
}

function headerEvolution(apikey) {
  return { parameters: [{ name: 'apikey', value: apikey }] };
}

export function opsSite(alvo, apikey) {
  const cfg = SITE[alvo];
  if (!cfg) throw new Error(`Alvo desconhecido: ${alvo}`);
  if (!apikey) throw new Error('apikey da Evolution ausente');
  const c = codigos(cfg);
  const prompt = textoPrompt(cfg.prompt);
  const N = NOMES;

  const pos = (col, linha) => [col * 240, linha * 220];
  const add = (name, type, typeVersion, position, parameters, extra = {}) =>
    ({ type: 'addNode', node: { name, type, typeVersion, position, parameters, ...extra } });
  const code = (name, position, jsCode) => add(name, 'n8n-nodes-base.code', 2, position, { jsCode });
  const liga = (source, target, sourceIndex = 0, connectionType) =>
    ({ type: 'addConnection', source, target, sourceIndex, ...(connectionType ? { connectionType } : {}) });
  const ajustes = (nodeName, settings) => ({ type: 'setNodeSettings', nodeName, settings });
  const rpc = (name, position, funcao) => add(name, 'n8n-nodes-base.httpRequest', 4.4, position, {
    method: 'POST', url: `${SUPABASE_RPC}/${funcao}`, authentication: 'predefinedCredentialType',
    nodeCredentialType: 'supabaseApi', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json) }}', options: {},
  }, { credentials: { supabaseApi: CRED_SUPABASE } });
  const texto = (name, position, jsonBody) => add(name, 'n8n-nodes-base.httpRequest', 4.4, position, {
    method: 'POST', url: EVOLUTION_TEXTO, sendHeaders: true, headerParameters: headerEvolution(apikey),
    sendBody: true, specifyBody: 'json', jsonBody, options: {},
  });
  const agente = (name, position) => add(name, '@n8n/n8n-nodes-langchain.agent', 2.1, position,
    { promptType: 'define', text: prompt, options: {} });
  const gemini = (name, position, modelName, cred, options) => add(name, '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', 1, position,
    { modelName, options }, { credentials: { googlePalmApi: cred } });
  const nota = (name, position, width, height, color, content) =>
    add(name, 'n8n-nodes-base.stickyNote', 1, position, { content, width, height, color });

  const ops = [];
  for (const nome of cfg.remover) ops.push({ type: 'removeNode', nodeName: nome });
  for (const [source, target] of cfg.desligar) ops.push({ type: 'removeConnection', source, target });

  // Reposiciona o que fica: gatilhos e planilha à esquerda da esteira, envio de enquetes abaixo.
  cfg.gatilhos.forEach((g, i) => ops.push({ type: 'setNodePosition', nodeName: g, position: pos(0, i) }));
  ops.push({ type: 'setNodePosition', nodeName: cfg.planilha, position: pos(1, 0) });
  ops.push({ type: 'setNodePosition', nodeName: cfg.agendaEnquete, position: pos(0, 5) });
  ops.push({ type: 'setNodePosition', nodeName: cfg.poller.buscar, position: pos(1, 5) });
  ops.push({ type: 'setNodePosition', nodeName: cfg.poller.enviar, position: pos(3, 5) });
  ops.push({ type: 'setNodePosition', nodeName: cfg.poller.marcar, position: pos(5, 5) });
  if (cfg.planilhaSaida) ops.push({ type: 'setNodePosition', nodeName: cfg.planilhaSaida, position: pos(10, -1) });

  ops.push(
    nota('Nota Esteira', [-60, -420], 3500, 300, 5,
      `## Auditoria semanal (${cfg.cliente})\nPlanilha → **Buscar Julgados / Excluir Já Julgados** (termos já gravados em \`${cfg.tabela}\` não voltam para a IA) → lotes de ${TAMANHO_LOTE} → **IA principal** (Gemini 2.5 Flash-Lite, conta 3). Se falhar após 3 tentativas, o lote vai para a **IA reserva** (Gemini 2.5 Flash, conta 2). Se as duas falharem, o lote é registrado e a esteira segue.\n**Normalizar Vereditos** cruza a resposta com a planilha (métricas vêm da planilha, termo inventado é ignorado, dúvida que bate com a palavra-chave vira segmentar) e grava via RPC \`upsert_veredito\` (origem = site). No fim, resumo no grupo da equipe.\nCódigo: \`n8n/code/*-site.cjs\` · prompt: \`n8n/prompts/${cfg.prompt}\` · gerador: \`n8n/scripts/gen-ops-site.mjs\`.`),
    nota('Nota Enquetes', [-60, 980], 1600, 260, 4,
      `## Envio das dúvidas liberadas no site\nA cada minuto busca até 5 dúvidas com triagem 1 e 2 e "pode enviar" marcados no Pocket. **Montar Enquete** gera o corpo com JSON.stringify (aspas e quebras de linha não quebram mais o envio). Só marca como enviado quando a Evolution devolve o id; o voto do cliente é registrado pelo roteador do Pocket interno (RPC \`registrar_resposta_cliente\`) e aparece em Respostas Cliente.`),

    add(N.buscar, 'n8n-nodes-base.supabase', 1, pos(2, 0), { operation: 'getAll', tableId: cfg.tabela, returnAll: true },
      { credentials: { supabaseApi: CRED_SUPABASE } }),
    code(N.excluir, pos(3, 0), c.excluir),
    add(N.novos, 'n8n-nodes-base.if', 2, pos(4, 0), seBooleano('tem_novos', '={{ $json.__nenhum_novo !== true }}')),
    add(N.lote, 'n8n-nodes-base.splitInBatches', 3, pos(5, 0), { batchSize: TAMANHO_LOTE, options: {} }),
    code(N.preparar, pos(6, 1), c.preparar),
    agente(N.agente, pos(7, 1)),
    gemini(N.modelo, pos(7, 2), MODELO_PRINCIPAL, CRED_GEMINI_PRINCIPAL, { temperature: 0, maxOutputTokens: 8192 }),
    agente(N.reserva, pos(8, 2.5)),
    gemini(N.modeloReserva, pos(8, 3.5), MODELO_RESERVA, CRED_GEMINI_RESERVA, { temperature: 0 }),
    code(N.contarReserva, pos(9, 2), c.contarReserva),
    code(N.falha, pos(10, 3), c.falha),
    code(N.normalizar, pos(10, 1), c.normalizar),
    rpc(N.gravar, pos(11, 1), 'upsert_veredito'),
    code(N.conferir, pos(12, 1), c.conferir),
    add(N.pausa, 'n8n-nodes-base.wait', 1.1, pos(13, 2), { amount: 3 }),
    code(N.concluir, pos(6, -1), c.concluir),
    texto(N.notificar, pos(7, -1), `={{ JSON.stringify({ number: '${GRUPO_EQUIPE}', text: $json.text }) }}`),

    code(N.montar, pos(2, 5), c.montar),
    add(N.criada, 'n8n-nodes-base.if', 2, pos(4, 5), seBooleano('enquete_criada', '={{ !!($json.key && $json.key.id) }}')),

    add(N.erroTrigger, 'n8n-nodes-base.errorTrigger', 1, pos(0, 7), {}),
    texto(N.notificarErro, pos(1, 7), `={{ JSON.stringify({ number: '${GRUPO_EQUIPE}', text: '🚨 *ERRO NO WORKFLOW (SITE): ${cfg.cliente}*\\n\\n⚠️ Nó: ' + (($json.execution && $json.execution.lastNodeExecuted) || 'desconhecido') + '\\n💬 ' + (($json.execution && $json.execution.error && $json.execution.error.message) || 'Falha inesperada') + '\\n🆔 Execução: ' + (($json.execution && $json.execution.id) || 'N/A') }) }}`),
  );
  if (cfg.planilhaSaida) ops.push(code(N.linhasPlanilha, pos(9, -1), c.linhasPlanilha));

  // Envio de enquetes: corpo pronto, 1 enquete a cada 3 s, sem nó Set vazio nem Wait solto.
  ops.push(
    { type: 'setNodeParameter', nodeName: cfg.poller.enviar, path: '/jsonBody', value: '={{ JSON.stringify($json.body) }}' },
    { type: 'setNodeParameter', nodeName: cfg.poller.enviar, path: '/options', value: { batching: { batch: { batchSize: 1, batchInterval: 3000 } } } },
    { type: 'setNodeParameter', nodeName: cfg.poller.marcar, path: '/filters/conditions/0/keyValue', value: `={{ $('${N.montar}').item.json.id }}` },
    { type: 'setNodeParameter', nodeName: cfg.poller.marcar, path: '/fieldsUi/fieldValues/1/fieldValue', value: '={{ $json.key.id }}' },
  );

  ops.push(
    ajustes(N.buscar, { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }),
    ajustes(N.agente, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, onError: 'continueErrorOutput' }),
    ajustes(N.reserva, { retryOnFail: true, maxTries: 2, waitBetweenTries: 5000, onError: 'continueErrorOutput' }),
    ajustes(N.gravar, { retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, onError: 'continueRegularOutput' }),
    ajustes(N.notificar, { onError: 'continueRegularOutput' }),
    ajustes(N.notificarErro, { onError: 'continueRegularOutput' }),
    ajustes(cfg.poller.enviar, { retryOnFail: true, maxTries: 2, waitBetweenTries: 3000, onError: 'continueRegularOutput' }),
  );
  if (cfg.planilhaSaida) ops.push(ajustes(cfg.planilhaSaida, { onError: 'continueRegularOutput' }));

  ops.push(
    liga(cfg.planilha, N.buscar),
    liga(N.buscar, N.excluir),
    liga(N.excluir, N.novos),
    liga(N.novos, N.lote, 0),
    liga(N.novos, N.concluir, 1),
    liga(N.lote, N.concluir, 0),
    liga(N.lote, N.preparar, 1),
    liga(N.preparar, N.agente),
    liga(N.modelo, N.agente, 0, 'ai_languageModel'),
    liga(N.agente, N.normalizar, 0),
    liga(N.agente, N.reserva, 1),
    liga(N.modeloReserva, N.reserva, 0, 'ai_languageModel'),
    liga(N.reserva, N.contarReserva, 0),
    liga(N.reserva, N.falha, 1),
    liga(N.contarReserva, N.normalizar),
  );
  // A cópia para a planilha vem antes da gravação e não volta para o loop (um único caminho de retorno).
  if (cfg.planilhaSaida) ops.push(liga(N.normalizar, N.linhasPlanilha), liga(N.linhasPlanilha, cfg.planilhaSaida));
  ops.push(
    liga(N.normalizar, N.gravar),
    liga(N.gravar, N.conferir),
    liga(N.conferir, N.pausa),
    liga(N.falha, N.pausa),
    liga(N.pausa, N.lote),
    liga(N.concluir, N.notificar),
    liga(cfg.poller.buscar, N.montar),
    liga(N.montar, cfg.poller.enviar),
    liga(cfg.poller.enviar, N.criada),
    liga(N.criada, cfg.poller.marcar, 0),
    liga(N.erroTrigger, N.notificarErro),
    // Execuções de sucesso do envio a cada minuto não ocupam mais o histórico; erros continuam salvos.
    { type: 'setWorkflowSettings', settings: { saveDataSuccessExecution: 'none', saveDataErrorExecution: 'all', executionOrder: 'v1' } },
  );

  validarOps(ops, cfg);
  return {
    workflowId: cfg.workflowId,
    operations: ops,
    versionName: `Esteira no molde do interno (${cfg.cliente})`.substring(0, 80),
    versionDescription: `Filtro de já julgados, agente principal + reserva, vereditos via upsert_veredito (origem site), resumo e alerta de erro no grupo da equipe, envio de enquetes com JSON seguro. Remove nós mortos. Gerado por n8n/scripts/gen-ops-site.mjs.`,
  };
}

export function opsInternoVinculo(backup) {
  const nos = new Map(backup.nodes.map(n => [n.name, n]));
  for (const nome of ['2. Enquete para o Cliente', '3. Processar Votos e Consenso', 'Notificar Resposta Site', 'Gravar Decisão (RPC)']) {
    if (!nos.has(nome)) throw new Error(`Nó ausente no backup: ${nome}`);
  }
  const ref = nos.get('2. Enquete para o Cliente').position;
  const preparar = 'Preparar Vínculo da Enquete';
  const vincular = 'Vincular Enquete do Cliente (RPC)';
  const textoSite = [
    "={{ JSON.stringify({",
    `  number: '${GRUPO_EQUIPE}',`,
    "  text: '✅ *RESPOSTA DO CLIENTE RECEBIDA (' + ($json.resposta_site.origem === 'interno' ? 'POCKET INTERNO' : 'SITE') + ': ' + String($json.resposta_site.tabela || '').replace('mesa_', '') + ')!*\\n\\n🔎 *\"' + ($json.resposta_site.termo || 'termo não identificado') + '\"*\\n📌 Ação: *' + ($json.resposta_site.acao || 'voto sem ação reconhecida') + '*\\n\\nA resposta foi registrada no Pocket e já aparece no site.'",
    "}) }}",
  ].join('\n');

  const ops = [
    { type: 'addNode', node: { name: preparar, type: 'n8n-nodes-base.code', typeVersion: 2, position: [ref[0], ref[1] - 200], parameters: {
      jsCode: `${fonteModulo('preparar-registro.cjs')}

${fonteModulo('preparar-vinculo.cjs')}

const dados = $('3. Processar Votos e Consenso').first().json;
const r = prepararVinculo(dados, $input.first().json, TABELA_POR_CLIENTE[String(dados.cliente || '').trim()]);
if (!r) return [];
return [{ json: r }];
`,
    } } },
    { type: 'addNode', node: { name: vincular, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.4, position: [ref[0] + 224, ref[1] - 200], parameters: {
      method: 'POST', url: `${SUPABASE_RPC}/vincular_enquete_cliente`, authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json) }}', options: {},
    }, credentials: { supabaseApi: CRED_SUPABASE } } },
    { type: 'setNodeSettings', nodeName: vincular, settings: { retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, onError: 'continueRegularOutput' } },
    { type: 'addConnection', source: '2. Enquete para o Cliente', target: preparar },
    { type: 'addConnection', source: preparar, target: vincular },
    { type: 'setNodeParameter', nodeName: 'Notificar Resposta Site', path: '/jsonBody', value: textoSite },
  ];
  return {
    workflowId: 'ee8wTgiHKx1HUvek',
    operations: ops,
    versionName: 'Vincula enquete enviada ao cliente (resposta cai no site)',
    versionDescription: 'Depois de despachar a enquete de dúvida no grupo do cliente, grava o id dela na linha do termo (RPC vincular_enquete_cliente). O voto do cliente passa a ser achado por registrar_resposta_cliente e aparece em Respostas Cliente. Gerado por n8n/scripts/gen-ops-site.mjs.',
  };
}

// Toda referência precisa ser um nó mantido (conhecido) ou um nó criado por operação anterior.
function validarOps(ops, cfg) {
  const mantidos = new Set([...cfg.gatilhos, cfg.planilha, cfg.agendaEnquete, cfg.poller.buscar, cfg.poller.enviar, cfg.poller.marcar,
    ...(cfg.planilhaSaida ? [cfg.planilhaSaida] : [])]);
  for (const m of cfg.remover) if (mantidos.has(m)) throw new Error(`Nó mantido também está na lista de remoção: ${m}`);
  const existentes = new Set(mantidos);
  for (const op of ops) {
    if (op.type === 'removeNode' || op.type === 'removeConnection') continue;
    if (op.type === 'addNode') {
      if (existentes.has(op.node.name)) throw new Error(`Nó duplicado: ${op.node.name}`);
      existentes.add(op.node.name);
      continue;
    }
    for (const ref of [op.source, op.target, op.nodeName]) {
      if (ref && !existentes.has(ref)) throw new Error(`Referência a nó desconhecido: ${ref}`);
    }
  }
  if (ops.length > 100) throw new Error(`Operações demais para um update_workflow: ${ops.length}`);
}

function apikeyDoBackup(backup) {
  for (const n of backup.nodes || []) {
    const h = n.parameters?.headerParameters?.parameters || [];
    const k = h.find(p => p.name === 'apikey');
    if (k && k.value) return k.value;
  }
  throw new Error('apikey da Evolution não encontrada no backup do interno');
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , arquivo, alvo] = process.argv;
  if (!arquivo || !alvo) {
    console.error(`Uso: node n8n/scripts/gen-ops-site.mjs <backup-do-interno.json> <${[...Object.keys(SITE), 'interno-vinculo'].join('|')}>`);
    process.exit(2);
  }
  const bruto = JSON.parse(readFileSync(arquivo, 'utf8'));
  const backup = bruto.workflow || bruto;
  const resultado = alvo === 'interno-vinculo' ? opsInternoVinculo(backup) : opsSite(alvo, apikeyDoBackup(backup));
  mkdirSync(join(raiz, 'out'), { recursive: true });
  const saida = join(raiz, 'out', `site-${alvo}.json`);
  writeFileSync(saida, JSON.stringify(resultado, null, 2));
  console.log(`${saida}: ${resultado.operations.length} operações (workflow ${resultado.workflowId})`);
}
