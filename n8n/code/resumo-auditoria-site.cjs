// Texto do aviso de fim da auditoria semanal do Pocket do site (grupo da equipe).
// O cabeçalho contém "AUDITORIA CONCLUÍDA" para o roteador do interno ignorar a mensagem (anti-loop).
// Colado como está num nó Code do n8n (sem require).

function resumoAuditoriaSite(cliente, a) {
  const s = a || {};
  const linhas = [`📊 *AUDITORIA CONCLUÍDA (SITE): ${cliente}*`, ''];
  if (s.filtroIndisponivel) linhas.push('⚠️ Filtro de já julgados indisponível: todos os termos foram para a IA.');
  linhas.push(`📄 Termos na planilha: ${s.lidos || 0}`);
  linhas.push(`⏭️ Já julgados (pulados): ${s.pulados || 0}`);
  linhas.push(`🆕 Novos enviados à IA: ${s.novos || 0}`);
  linhas.push(`💾 Gravados no Pocket: ${s.gravados || 0}`);
  linhas.push(`❓ Dúvidas aguardando triagem no site: ${s.duvidas || 0}`);
  if (s.corrigidos) linhas.push(`🛡️ Dúvidas corrigidas para segmentar (bate com a palavra-chave): ${s.corrigidos}`);
  if (s.reserva) linhas.push(`🔁 Lotes resolvidos pelo agente reserva: ${s.reserva}`);
  const pendentes = (s.semVeredito || 0) + (s.falhaGravacao || 0);
  if (pendentes) linhas.push(`🔄 Sem veredito (voltam na próxima rodada): ${pendentes}`);
  if (s.lotesFalhos) linhas.push(`🚨 Lotes em que os dois agentes falharam: ${s.lotesFalhos}`);
  const erros = (s.erros || []).slice(0, 3);
  if (erros.length) linhas.push('', '*Erros:*', ...erros.map(e => '• ' + String(e).substring(0, 150)));
  return linhas.join('\n');
}

if (typeof module !== 'undefined') module.exports = { resumoAuditoriaSite };
