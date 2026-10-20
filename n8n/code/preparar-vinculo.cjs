// Depois que o Pocket interno despacha a enquete de dúvida no grupo do cliente, grava o id dessa
// enquete na linha do termo (RPC vincular_enquete_cliente). Assim o voto do cliente é achado por
// registrar_resposta_cliente e cai direto no site, sem depender da memória do workflow.
// Colado como está num nó Code do n8n (sem require). Devolve null quando não há o que vincular.

function prepararVinculo(dados, respostaEnquete, tabela) {
  const idEnquete = respostaEnquete && respostaEnquete.key && respostaEnquete.key.id;
  if (!idEnquete || !tabela || !dados || !dados.termo) return null;
  return {
    p_tabela: tabela,
    p_termo: String(dados.termo),
    p_campanha: String(dados.campanha || ''),
    p_grupo: String(dados.grupo || ''),
    p_id_enquete: String(idEnquete),
  };
}

if (typeof module !== 'undefined') module.exports = { prepararVinculo };
