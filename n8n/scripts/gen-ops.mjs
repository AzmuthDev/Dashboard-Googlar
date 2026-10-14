// Gera as operações de update_workflow (MCP do n8n) para o workflow interno.
// Uso: node n8n/scripts/gen-ops.mjs <backup.json> <cliente|roteador>
// Grava n8n/out/<alvo>.json. A saída contém a apikey copiada do backup: não versionar (n8n/out/ é ignorado).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const { TABELA_POR_CLIENTE } = require(join(raiz, 'code', 'preparar-registro.cjs'));

export const CLIENTES = Object.keys(TABELA_POR_CLIENTE);

const SUPABASE_RPC = 'https://jmptroahcezmpjdplxwy.supabase.co/rest/v1/rpc';
const CRED_SUPABASE = { id: 'FUabs49WcVpHY9ez', name: 'Supabase account 5' };

// Corpo do módulo sem a linha de export (o nó Code do n8n não precisa dela).
function fonteModulo(arquivo) {
  return readFileSync(join(raiz, 'code', arquivo), 'utf8')
    .split(/\r?\n/)
    .filter(l => !/^if \(typeof module/.test(l))
    .join('\n');
}

function codeExcluir(cliente, nomeSheet) {
  return `const SHEET_NODE = ${JSON.stringify(nomeSheet)};
const CLIENTE = ${JSON.stringify(cliente)};

${fonteModulo('excluir-julgados.cjs')}

const planilha = $(SHEET_NODE).all().map(i => i.json);
const julgados = $input.all().map(i => i.json);
const r = excluirJulgados(planilha, julgados);

const sd = $getWorkflowStaticData('global');
sd.filtro = sd.filtro || {};
sd.filtro[CLIENTE] = { pulados: r.pulados, filtroIndisponivel: r.filtroIndisponivel, total: planilha.length, restantes: r.restantes.length };

if (r.restantes.length === 0) return [{ json: { __nenhum_novo: true } }];
return r.restantes.map(json => ({ json }));
`;
}

function codeAviso(cliente) {
  return `const CLIENTE = ${JSON.stringify(cliente)};
const f = (($getWorkflowStaticData('global').filtro) || {})[CLIENTE];
if (!f) return [];
if (!f.filtroIndisponivel && f.pulados === 0) return [];

const cab = 'ℹ️ *FILTRO DE TERMOS JÁ JULGADOS: ' + CLIENTE + '*\\n\\n';
let corpo;
if (f.filtroIndisponivel) corpo = '⚠️ Filtro indisponível (falha ao consultar o banco). Todos os ' + f.total + ' termos seguem para a IA.';
else if (f.restantes === 0) corpo = '✅ Nenhum termo novo: os ' + f.total + ' termos da planilha já foram julgados. Nada foi enviado à IA.';
else corpo = '⏭️ ' + f.pulados + ' de ' + f.total + ' termos já estavam julgados e foram pulados. ' + f.restantes + ' seguem para a IA.';
return [{ json: { text: cab + corpo } }];
`;
}

function codeNormalizar(tabela) {
  return `const TABELA = ${JSON.stringify(tabela)};

${fonteModulo('normalizar-vereditos.cjs')}

const entrada = $input.first().json;
const raw = entrada.output || entrada.text || entrada.response || '';
const r = normalizarVereditos(raw, TABELA);
if (r.p_linhas.length === 0) return [];
return [{ json: r }];
`;
}

function alvoEsteira(backup, cliente) {
  const nos = new Map(backup.nodes.map(n => [n.name, n]));
  const obter = (nome) => {
    if (!nos.has(nome)) throw new Error(`Nó ausente no backup: ${nome}`);
    return nos.get(nome);
  };

  const tabela = TABELA_POR_CLIENTE[cliente];
  const nomes = {
    ler: `Ler Termos da Planilha (${cliente})`,
    init: `Inicializar Estatísticas (${cliente})`,
    ifRef: `Teve Dúvidas no Processo? (${cliente})`,
    notifRef: `Notificar Sem Dúvidas (${cliente})`,
    agente: `IA Auditor Semântico (${cliente})`,
    agente1: `IA Auditor Semântico (${cliente})1`,
    buscar: `Buscar Julgados (${cliente})`,
    excluir: `Excluir Já Julgados (${cliente})`,
    novos: `Há Termos Novos? (${cliente})`,
    aviso: `Montar Aviso do Filtro (${cliente})`,
    notif: `Notificar Filtro (${cliente})`,
    norm: `Normalizar Vereditos (${cliente})`,
    gravar: `Gravar Vereditos (${cliente})`,
  };

  const ler = obter(nomes.ler);
  const ifRef = obter(nomes.ifRef);
  const notifRef = obter(nomes.notifRef);
  obter(nomes.init);

  const jid = /number:\s*'([^']+)'/.exec(notifRef.parameters?.jsonBody || '')?.[1];
  if (!jid) throw new Error(`Destino (number) não encontrado em ${nomes.notifRef}`);

  const [x, y] = ler.position;
  const pos = (col, linha) => [x + col * 224, y + 420 + linha * 200];

  const node = (name, type, typeVersion, position, parameters, extra = {}) =>
    ({ type: 'addNode', node: { name, type, typeVersion, position, parameters, ...extra } });

  const ops = [
    { type: 'removeConnection', source: nomes.ler, target: nomes.init },

    node(nomes.buscar, 'n8n-nodes-base.supabase', 1, pos(0, 0), {
      operation: 'getAll', tableId: tabela, returnAll: true, matchType: 'anyFilter',
      filters: { conditions: ['segmentar', 'negativar', 'teste_ab', 'respondido_cliente', 'enviado_para_grupo']
        .map(keyName => ({ keyName, condition: 'eq', keyValue: '={{ true }}' })) },
    }, { credentials: { supabaseApi: CRED_SUPABASE } }),

    node(nomes.excluir, 'n8n-nodes-base.code', 2, pos(1, 0), { jsCode: codeExcluir(cliente, nomes.ler) }),

    node(nomes.novos, 'n8n-nodes-base.if', ifRef.typeVersion, pos(2, 0), {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
        conditions: [{ id: 'tem_novos', leftValue: '={{ $json.__nenhum_novo !== true }}', rightValue: '',
          operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    }),

    node(nomes.aviso, 'n8n-nodes-base.code', 2, pos(2, 1), { jsCode: codeAviso(cliente) }),

    node(nomes.notif, 'n8n-nodes-base.httpRequest', 4.4, pos(3, 1), {
      method: 'POST', url: notifRef.parameters.url, sendHeaders: true, headerParameters: notifRef.parameters.headerParameters,
      sendBody: true, specifyBody: 'json',
      jsonBody: `={{ JSON.stringify({\n  number: '${jid}',\n  text: $json.text\n}) }}`, options: {},
    }),

    node(nomes.norm, 'n8n-nodes-base.code', 2, pos(0, 2), { jsCode: codeNormalizar(tabela) }),

    node(nomes.gravar, 'n8n-nodes-base.httpRequest', 4.4, pos(1, 2), {
      method: 'POST', url: `${SUPABASE_RPC}/upsert_veredito`, authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json) }}', options: {},
    }, { credentials: { supabaseApi: CRED_SUPABASE } }),

    { type: 'setNodeSettings', nodeName: nomes.buscar, settings: { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' } },
    { type: 'setNodeSettings', nodeName: nomes.notif, settings: { onError: 'continueRegularOutput' } },
    { type: 'setNodeSettings', nodeName: nomes.gravar, settings: { onError: 'continueRegularOutput' } },

    { type: 'addConnection', source: nomes.ler, target: nomes.buscar },
    { type: 'addConnection', source: nomes.buscar, target: nomes.excluir },
    { type: 'addConnection', source: nomes.excluir, target: nomes.novos },
    { type: 'addConnection', source: nomes.excluir, target: nomes.aviso },
    { type: 'addConnection', source: nomes.novos, target: nomes.init, sourceIndex: 0 },
    { type: 'addConnection', source: nomes.aviso, target: nomes.notif },
    { type: 'addConnection', source: nomes.agente, target: nomes.norm, sourceIndex: 0 },
    { type: 'addConnection', source: nomes.agente1, target: nomes.norm, sourceIndex: 0 },
    { type: 'addConnection', source: nomes.norm, target: nomes.gravar },
  ];

  validar(backup, ops);
  return {
    operations: ops,
    versionName: `Filtro julgados + vereditos (${cliente})`,
    versionDescription: `Insere Buscar Julgados/Excluir Já Julgados antes da IA e grava os vereditos da IA em ${tabela}. Gerado por n8n/scripts/gen-ops.mjs.`,
  };
}

function alvoRoteador(backup) {
  const nos = new Map(backup.nodes.map(n => [n.name, n]));
  const obter = (nome) => {
    if (!nos.has(nome)) throw new Error(`Nó ausente no backup: ${nome}`);
    return nos.get(nome);
  };

  const extrair = obter('1. Extrair ID e Voto');
  obter('2. Buscar Criacao na Evolution');
  obter('3. Processar Votos e Consenso');
  const ifRef = obter('Bateu 2 Votos?');
  const notifRef = obter('Notificar Decisão Interna');

  const nomes = {
    site: 'Registrar Resposta Site (RPC)',
    classificar: 'Classificar Origem do Voto',
    ehSite: 'É Enquete do Site?',
    notifSite: 'Notificar Resposta Site',
    preparar: 'Preparar Registro de Decisão',
    decisao: 'Gravar Decisão (RPC)',
  };

  const [x, y] = extrair.position;
  const pos = (col, linha) => [x + col * 224, y + 300 + linha * 200];
  const node = (name, type, typeVersion, position, parameters, extra = {}) =>
    ({ type: 'addNode', node: { name, type, typeVersion, position, parameters, ...extra } });
  const rpc = (nome, funcao, jsonBody, position) => node(nome, 'n8n-nodes-base.httpRequest', 4.4, position, {
    method: 'POST', url: `${SUPABASE_RPC}/${funcao}`, authentication: 'predefinedCredentialType',
    nodeCredentialType: 'supabaseApi', sendBody: true, specifyBody: 'json', jsonBody, options: {},
  }, { credentials: { supabaseApi: CRED_SUPABASE } });

  const textoSite = [
    "={{ JSON.stringify({",
    "  number: '120363424743503833@g.us',",
    "  text: '✅ *RESPOSTA DO CLIENTE RECEBIDA (SITE: ' + String($json.resposta_site.tabela || '').replace('mesa_', '') + ')!*\\n\\n🔎 *\"' + ($json.resposta_site.termo || 'termo não identificado') + '\"*\\n📌 Ação: *' + ($json.resposta_site.acao || 'voto sem ação reconhecida') + '*\\n\\nA resposta foi registrada no Pocket.'",
    "}) }}",
  ].join('\n');

  const ops = [
    { type: 'removeConnection', source: '1. Extrair ID e Voto', target: '2. Buscar Criacao na Evolution' },

    rpc(nomes.site, 'registrar_resposta_cliente',
      '={{ JSON.stringify({ p_id_enquete: $json.poll_id ?? null, p_opcao: $json.opcao_votada ?? null, p_voter: $json.voter_name ?? null }) }}',
      pos(0, 0)),

    node(nomes.classificar, 'n8n-nodes-base.code', 2, pos(1, 0), {
      jsCode: `${fonteModulo('classificar-origem.cjs')}

const voto = $('1. Extrair ID e Voto').first().json;
const resposta = $input.first().json;
return [{ json: classificarOrigem(voto, resposta) }];
`,
    }),

    node(nomes.ehSite, 'n8n-nodes-base.if', ifRef.typeVersion, pos(2, 0), {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
        conditions: [{ id: 'eh_site', leftValue: '={{ $json.site === true }}', rightValue: '',
          operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    }),

    node(nomes.notifSite, 'n8n-nodes-base.httpRequest', 4.4, pos(3, 0), {
      method: 'POST', url: notifRef.parameters.url, sendHeaders: true, headerParameters: notifRef.parameters.headerParameters,
      sendBody: true, specifyBody: 'json', jsonBody: textoSite, options: {},
    }),

    node(nomes.preparar, 'n8n-nodes-base.code', 2, pos(4, 1), {
      jsCode: `${fonteModulo('preparar-registro.cjs')}

const r = prepararRegistro($input.first().json);
if (!r) return [];
return [{ json: r }];
`,
    }),

    rpc(nomes.decisao, 'registrar_decisao_interna', '={{ JSON.stringify($json) }}', pos(5, 1)),

    { type: 'setNodeSettings', nodeName: nomes.site, settings: { onError: 'continueRegularOutput' } },
    { type: 'setNodeSettings', nodeName: nomes.notifSite, settings: { onError: 'continueRegularOutput' } },
    { type: 'setNodeSettings', nodeName: nomes.decisao, settings: { onError: 'continueRegularOutput' } },

    { type: 'addConnection', source: '1. Extrair ID e Voto', target: nomes.site },
    { type: 'addConnection', source: nomes.site, target: nomes.classificar },
    { type: 'addConnection', source: nomes.classificar, target: nomes.ehSite },
    { type: 'addConnection', source: nomes.ehSite, target: nomes.notifSite, sourceIndex: 0 },
    { type: 'addConnection', source: nomes.ehSite, target: '2. Buscar Criacao na Evolution', sourceIndex: 1 },
    { type: 'addConnection', source: '3. Processar Votos e Consenso', target: nomes.preparar },
    { type: 'addConnection', source: nomes.preparar, target: nomes.decisao },
  ];

  validar(backup, ops);
  return {
    operations: ops,
    versionName: 'Roteador: respostas do site + registro de decisoes',
    versionDescription: 'Votos de enquetes do site (id_enquete achado em mesa_*) sao gravados via registrar_resposta_cliente e notificados; decisoes do interno via registrar_decisao_interna. Gerado por n8n/scripts/gen-ops.mjs.',
  };
}

// Toda referência a nó precisa existir no backup ou ter sido criada por uma operação anterior.
function validar(backup, ops) {
  const existentes = new Set(backup.nodes.map(n => n.name));
  const ausentes = new Set();
  for (const op of ops) {
    if (op.type === 'addNode') {
      if (existentes.has(op.node.name)) throw new Error(`Nó já existe no workflow: ${op.node.name}`);
      existentes.add(op.node.name);
      continue;
    }
    for (const ref of [op.source, op.target, op.nodeName]) {
      if (ref && !existentes.has(ref)) ausentes.add(ref);
    }
  }
  if (ausentes.size) throw new Error(`Nós ausentes no backup: ${[...ausentes].join(' | ')}`);

  for (const op of ops.filter(o => o.type === 'removeConnection')) {
    const saidas = (backup.connections?.[op.source]?.main || []).flat().map(c => c.node);
    if (!saidas.includes(op.target)) throw new Error(`Conexão ausente no backup: ${op.source} -> ${op.target}`);
  }
}

export function gerarOperacoes(backup, alvo) {
  if (TABELA_POR_CLIENTE[alvo]) return alvoEsteira(backup, alvo);
  if (alvo === 'roteador') return alvoRoteador(backup);
  throw new Error(`Alvo desconhecido: ${alvo}`);
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , arquivo, alvo] = process.argv;
  if (!arquivo || !alvo) {
    console.error('Uso: node n8n/scripts/gen-ops.mjs <backup.json> <cliente|roteador>');
    process.exit(2);
  }
  const bruto = JSON.parse(readFileSync(arquivo, 'utf8'));
  const resultado = gerarOperacoes(bruto.workflow || bruto, alvo);
  mkdirSync(join(raiz, 'out'), { recursive: true });
  const saida = join(raiz, 'out', `${alvo === 'roteador' ? 'roteador' : 'esteira-' + alvo}.json`);
  writeFileSync(saida, JSON.stringify(resultado, null, 2));
  console.log(`${saida}: ${resultado.operations.length} operações`);
}
