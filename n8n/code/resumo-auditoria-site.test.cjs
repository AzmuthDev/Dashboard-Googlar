const test = require('node:test');
const assert = require('node:assert/strict');
const { resumoAuditoriaSite } = require('./resumo-auditoria-site.cjs');

test('resumo traz o cabeçalho anti-loop e os números da rodada', () => {
  const t = resumoAuditoriaSite('Endomarcas', { lidos: 40, pulados: 10, novos: 30, gravados: 28, duvidas: 3, semVeredito: 2 });
  assert.match(t, /AUDITORIA CONCLUÍDA \(SITE\): Endomarcas/);
  assert.match(t, /Gravados no Pocket: 28/);
  assert.match(t, /Sem veredito \(voltam na próxima rodada\): 2/);
  assert.doesNotMatch(t, /dois agentes falharam/);
});

test('falhas, reserva e filtro indisponível aparecem quando existem', () => {
  const t = resumoAuditoriaSite('Qualipix', { filtroIndisponivel: true, reserva: 2, lotesFalhos: 1, erros: ['quota excedida'] });
  assert.match(t, /Filtro de já julgados indisponível/);
  assert.match(t, /agente reserva: 2/);
  assert.match(t, /dois agentes falharam: 1/);
  assert.match(t, /• quota excedida/);
});

test('sem estatísticas não lança', () => {
  assert.match(resumoAuditoriaSite('X', null), /Termos na planilha: 0/);
});
