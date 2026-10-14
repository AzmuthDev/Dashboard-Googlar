// Filtro "já julgado": descarta linhas da planilha cuja chave termo+campanha+grupo
// já tem veredito no Supabase. Colado como está num nó Code do n8n (sem require).

function normChave(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function chaveJulgado(termo, campanha, grupo) {
  return [normChave(termo), normChave(campanha), normChave(grupo)].join('|');
}

function excluirJulgados(planilha, julgados) {
  const lista = julgados || [];
  if (lista.some(j => j && j.error)) {
    return { restantes: planilha, pulados: 0, filtroIndisponivel: true };
  }

  const conhecidos = new Set(
    lista
      .filter(j => j && j.termo_de_pesquisa)
      .map(j => chaveJulgado(j.termo_de_pesquisa, j.campanha, j.grupo_de_anuncios))
  );

  const restantes = [];
  let pulados = 0;
  for (const linha of planilha) {
    const termo = linha['Termo de pesquisa'] || linha['Termo'];
    if (!normChave(termo)) { restantes.push(linha); continue; }
    const chave = chaveJulgado(termo, linha['Campanha'], linha['Grupo de anúncios'] || linha['Grupo_Anuncio']);
    if (conhecidos.has(chave)) pulados++; else restantes.push(linha);
  }
  return { restantes, pulados, filtroIndisponivel: false };
}

if (typeof module !== 'undefined') module.exports = { chaveJulgado, excluirJulgados };
