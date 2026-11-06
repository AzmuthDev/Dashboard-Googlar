// Leitura da planilha do Google Ads nos workflows do Pocket do site.
// Converte cabeçalhos em português ou inglês para as chaves canônicas, descarta linhas vazias,
// linhas de total e repetidas, e monta o lote enxuto que vai para a IA.
// Colado como está num nó Code do n8n (sem require).

const COLUNAS_PLANILHA = {
  'Termo de pesquisa': ['Termo de pesquisa', 'Termo', 'Search term', 'Search Term'],
  'Palavra-chave': ['Palavra-chave', 'Palavra_Chave', 'Keyword'],
  'Campanha': ['Campanha', 'Campaign Name', 'Campaign'],
  'Grupo de anúncios': ['Grupo de anúncios', 'Grupo_Anuncio', 'Ad Group Name', 'Ad group', 'Ad Group'],
  'Conversões': ['Conversões', 'Conversoes', 'Conversions'],
  'Impr.': ['Impr.', 'Impressoes', 'Impressões', 'Impressions', 'Impr'],
  'Cliques': ['Cliques', 'Clicks'],
  'Custo': ['Custo', 'Cost'],
  'CTR': ['CTR'],
  'CPC méd.': ['CPC méd.', 'CPC med.', 'Avg. CPC', 'Avg. CPC (BRL)'],
  'Tipo de corresp.': ['Tipo de corresp.', 'Match type', 'Match Type'],
};

// Só estas chaves vão para a IA (padrão de prompt: nada de métricas além de Conversões e Impr.).
const CHAVES_IA = ['Termo de pesquisa', 'Palavra-chave', 'Campanha', 'Grupo de anúncios', 'Conversões', 'Impr.'];

function textoPlanilha(v) {
  return String(v == null ? '' : v).trim();
}

function chaveLinhaPlanilha(l) {
  return [l['Termo de pesquisa'], l['Campanha'], l['Grupo de anúncios']]
    .map(s => textoPlanilha(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' '))
    .join('|');
}

function canonizarLinha(bruta) {
  const linha = {};
  for (const [canonica, nomes] of Object.entries(COLUNAS_PLANILHA)) {
    const achado = nomes.find(n => bruta && bruta[n] != null && textoPlanilha(bruta[n]) !== '');
    linha[canonica] = achado ? textoPlanilha(bruta[achado]) : '';
  }
  return linha;
}

function limparPlanilha(brutas) {
  const vistos = new Set();
  const linhas = [];
  for (const bruta of brutas || []) {
    const l = canonizarLinha(bruta);
    const termo = l['Termo de pesquisa'];
    if (!termo || /^total\b/i.test(termo) || /^total\b/i.test(l['Campanha'])) continue;
    const chave = chaveLinhaPlanilha(l);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    linhas.push(l);
  }
  return linhas;
}

function prepararLote(linhas) {
  const enxutas = (linhas || []).map(l => {
    const e = {};
    for (const k of CHAVES_IA) e[k] = textoPlanilha(l[k]) || (k === 'Conversões' || k === 'Impr.' ? '0' : 'N/A');
    return e;
  });
  return { meu_texto_pronto: JSON.stringify(enxutas), total: enxutas.length, linhas: linhas || [] };
}

if (typeof module !== 'undefined') module.exports = { canonizarLinha, limparPlanilha, prepararLote, CHAVES_IA };
