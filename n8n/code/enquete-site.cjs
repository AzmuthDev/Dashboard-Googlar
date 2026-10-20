// Monta o corpo do sendPoll (Evolution API) de uma dúvida liberada no Pocket do site.
// O texto segue o formato do Pocket interno (Cliente/Termo/KW/Obs) para o roteador de votos reconhecer.
// Colado como está num nó Code do n8n (sem require).

const LIMITE_NOME_ENQUETE = 250;
const OPCOES_ENQUETE_SITE = ['✅ Relevante', '❌ Negativar', '⚠️ Teste A/B'];

function cortarTexto(s, max) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.substring(0, Math.max(0, max - 3)) + '...' : t;
}

function montarEnquete(linha, cliente, jid) {
  const termo = cortarTexto(linha.termo_de_pesquisa || 'N/A', 60);
  const kw = cortarTexto(linha.palavra_chave || 'N/A', 40);
  const topo = `🏢 *Cliente:* ${cliente}\n🔍 *Termo:* "${termo}"\n🔑 *KW:* ${kw}\n💬 *Obs:* `;
  const obs = cortarTexto(linha.observacao || linha.comentario || 'Avaliar pertinência para a conta', LIMITE_NOME_ENQUETE - topo.length);
  return {
    number: jid,
    name: topo + obs,
    selectableCount: 1,
    values: OPCOES_ENQUETE_SITE.slice(),
  };
}

if (typeof module !== 'undefined') module.exports = { montarEnquete, LIMITE_NOME_ENQUETE };
