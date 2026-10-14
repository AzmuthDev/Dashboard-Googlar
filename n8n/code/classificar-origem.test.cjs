const test = require('node:test');
const assert = require('node:assert/strict');
const { classificarOrigem } = require('./classificar-origem.cjs');

const voto = { ignorado: false, poll_id: 'P1', opcao_votada: '✅ Segmentar', voter: 'x@s.whatsapp.net', voter_name: 'Ana' };

test('enquete encontrada no banco é do site e preserva os campos do voto', () => {
  const resposta = { encontrado: true, ignorado: false, tabela: 'mesa_qualipix', acao: 'segmentar', termo: 't' };
  const r = classificarOrigem(voto, resposta);
  assert.equal(r.site, true);
  assert.equal(r.poll_id, 'P1');
  assert.equal(r.voter_name, 'Ana');
  assert.deepEqual(r.resposta_site, resposta);
});

test('encontrada mas com opção sem ação continua sendo do site (não cai no consenso)', () => {
  const r = classificarOrigem(voto, { encontrado: true, ignorado: true, tabela: 'mesa_qualipix' });
  assert.equal(r.site, true);
});

test('não encontrada no banco segue o caminho do interno', () => {
  assert.equal(classificarOrigem(voto, { encontrado: false }).site, false);
});

test('falha do RPC (item de erro) ou resposta vazia seguem o caminho do interno', () => {
  assert.equal(classificarOrigem(voto, { error: { message: 'boom' } }).site, false);
  assert.equal(classificarOrigem(voto, {}).site, false);
  assert.equal(classificarOrigem(voto, null).site, false);
  assert.equal(classificarOrigem(voto, undefined).site, false);
});

test('voto ignorado pelo extrator nunca é do site', () => {
  const r = classificarOrigem({ ignorado: true, motivo: 'x' }, { encontrado: true, tabela: 'mesa_qualipix' });
  assert.equal(r.site, false);
  assert.equal(r.ignorado, true);
});
