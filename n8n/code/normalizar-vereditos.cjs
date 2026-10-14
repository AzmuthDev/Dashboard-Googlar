// Converte a saída JSON ultraleve da IA (11 chaves) no corpo do RPC upsert_veredito.
// Colado como está num nó Code do n8n (sem require). Nunca lança.

function extrairLinhas(rawText) {
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

function normalizarVereditos(rawText, tabela) {
  const p_linhas = [];
  for (const l of extrairLinhas(rawText)) {
    if (!l || typeof l !== 'object') continue;
    const termo = String(l['Termo de pesquisa'] || l['Termo'] || '').trim();
    if (!termo) continue;

    const segmentar = String(l['SEGMENTAR'] || '').includes('✅');
    const negativar = String(l['NEGATIVAR'] || '').includes('❌');
    const teste_ab = String(l['TESTE_AB'] || '').includes('⚠');
    const duvida = String(l['DUVIDA'] || '').includes('❓');
    if ([segmentar, negativar, teste_ab, duvida].filter(Boolean).length !== 1) continue;

    p_linhas.push({
      termo,
      campanha: String(l['Campanha'] || ''),
      grupo: String(l['Grupo de anúncios'] || l['Grupo_Anuncio'] || ''),
      palavra_chave: String(l['Palavra-chave'] || l['Palavra_Chave'] || ''),
      segmentar, negativar, teste_ab, duvida,
      observacao: String(l['Observacao'] || ''),
      impressoes: String(l['Impr.'] || l['Impressoes'] || '0'),
      conversoes: String(l['Conversões'] || l['Conversoes'] || '0'),
    });
  }
  return { p_tabela: tabela, p_linhas };
}

if (typeof module !== 'undefined') module.exports = { normalizarVereditos };
