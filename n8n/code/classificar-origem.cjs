// Decide se um voto de enquete pertence a uma dúvida do Pocket do site (id_enquete achado no banco)
// ou ao Pocket interno. Colado como está num nó Code do n8n (sem require).

function classificarOrigem(voto, resposta) {
  const resp = resposta && typeof resposta === 'object' && !resposta.error ? resposta : {};
  const site = !(voto && voto.ignorado) && resp.encontrado === true;
  return { ...voto, site, resposta_site: resp };
}

if (typeof module !== 'undefined') module.exports = { classificarOrigem };
