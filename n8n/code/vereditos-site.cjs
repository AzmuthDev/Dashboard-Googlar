// Cruza a saída JSON da IA com as linhas do lote enviado e monta o corpo do RPC upsert_veredito
// para os workflows do Pocket do site. Métricas vêm da planilha, nunca da IA; termos que a IA
// inventou são ignorados e termos que ela omitiu voltam em sem_veredito (a próxima rodada tenta de novo).
// Colado como está num nó Code do n8n (sem require). Nunca lança.

// Palavras que indicam busca não comercial: com elas, uma dúvida não vira segmentar automaticamente.
const TERMOS_NAO_COMERCIAIS = ['vaga', 'emprego', 'salario', 'curso', 'gratis', 'pdf', 'como fazer', 'o que e',
  'job', 'jobs', 'hiring', 'salary', 'free', 'diy', 'how to', 'tutorial'];

function normVeredito(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extrairLinhasIA(rawText) {
  const texto = String(rawText == null ? '' : rawText)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    const ini = texto.indexOf('[');
    const fim = texto.lastIndexOf(']');
    if (ini !== -1 && fim > ini) {
      const dados = JSON.parse(texto.substring(ini, fim + 1));
      return Array.isArray(dados) ? dados : [dados];
    }
    const iniObj = texto.indexOf('{');
    const fimObj = texto.lastIndexOf('}');
    if (iniObj !== -1 && fimObj > iniObj) return [JSON.parse(texto.substring(iniObj, fimObj + 1))];
  } catch (e) {
    return [];
  }
  return [];
}

// Regra do padrão de prompts: termo que bate com a palavra-chave é SEGMENTAR, nunca DÚVIDA.
function bateComPalavraChave(termo, kw) {
  const t = normVeredito(termo);
  const k = normVeredito(kw);
  if (t.length < 3 || k.length < 3 || k === 'n a') return false;
  const padded = ' ' + t + ' ';
  if (TERMOS_NAO_COMERCIAIS.some(p => padded.includes(' ' + p + ' '))) return false;
  return t === k || t.includes(k) || k.includes(t);
}

function vereditosSite(rawText, linhasLote, tabela) {
  const porChave = new Map();
  const porTermo = new Map();
  for (const v of extrairLinhasIA(rawText)) {
    if (!v || typeof v !== 'object') continue;
    const termo = normVeredito(v['Termo de pesquisa'] || v['Termo']);
    if (!termo) continue;
    const chave = [termo, normVeredito(v['Campanha']), normVeredito(v['Grupo de anúncios'] || v['Grupo_Anuncio'])].join('|');
    if (!porChave.has(chave)) porChave.set(chave, v);
    if (!porTermo.has(termo)) porTermo.set(termo, v);
  }

  const p_linhas = [];
  const sem_veredito = [];
  let corrigidos = 0;
  for (const l of linhasLote || []) {
    const termoOriginal = String(l['Termo de pesquisa'] || '').trim();
    const termo = normVeredito(termoOriginal);
    if (!termo) continue;
    const chave = [termo, normVeredito(l['Campanha']), normVeredito(l['Grupo de anúncios'])].join('|');
    const v = porChave.get(chave) || porTermo.get(termo);

    let segmentar = !!v && String(v['SEGMENTAR'] || '').includes('✅');
    const negativar = !!v && String(v['NEGATIVAR'] || '').includes('❌');
    const teste_ab = !!v && String(v['TESTE_AB'] || '').includes('⚠');
    let duvida = !!v && String(v['DUVIDA'] || '').includes('❓');
    if ([segmentar, negativar, teste_ab, duvida].filter(Boolean).length !== 1) {
      sem_veredito.push(termoOriginal);
      continue;
    }

    let observacao = String(v['Observacao'] || '').trim();
    if (duvida && bateComPalavraChave(termoOriginal, l['Palavra-chave'])) {
      duvida = false;
      segmentar = true;
      corrigidos++;
      observacao = 'Termo alinhado à palavra-chave (dúvida da IA corrigida para segmentar).';
    }

    p_linhas.push({
      termo: termoOriginal,
      campanha: String(l['Campanha'] || ''),
      grupo: String(l['Grupo de anúncios'] || ''),
      palavra_chave: String(l['Palavra-chave'] || ''),
      segmentar, negativar, teste_ab, duvida,
      observacao,
      impressoes: String(l['Impr.'] || '0'),
      conversoes: String(l['Conversões'] || '0'),
      cliques: String(l['Cliques'] || '0'),
      custo: String(l['Custo'] || ''),
      ctr: String(l['CTR'] || ''),
      cpc_medio: String(l['CPC méd.'] || ''),
      tipo_corresp: String(l['Tipo de corresp.'] || ''),
    });
  }
  return { p_tabela: tabela, p_origem: 'site', p_linhas, sem_veredito, corrigidos };
}

if (typeof module !== 'undefined') module.exports = { vereditosSite, bateComPalavraChave };
