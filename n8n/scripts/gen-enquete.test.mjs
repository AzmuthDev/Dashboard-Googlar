import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIENTES, gerarExpressao, jidDoNo, gerarOperacoes } from './gen-enquete.mjs';

// Avalia a expressão como o n8n faz: o miolo de ={{ ... }} é JavaScript com $json disponível.
function avaliar(expressao, json) {
  assert.ok(expressao.startsWith('={{'), 'começa com ={{');
  assert.ok(expressao.endsWith('}}'), 'termina com }}');
  const miolo = expressao.slice(3, -2);
  return JSON.parse(new Function('$json', `return (${miolo});`)(json));
}

const linha = {
  'Termo de pesquisa': 'cmc displays',
  'Palavra-chave': 'mesa interativa touch screen',
  'Campanha': '[Todos Produtos] [Geral] [MG RJ] 10 30 20',
  'Observacao': 'Marca concorrente direta, necessita validação.',
};

test('a expressão tem quebras de linha reais e nenhum \\n escapado fora de string', () => {
  const e = gerarExpressao('Qualipix', '120363424743503833@g.us');
  assert.ok(!e.startsWith('={{\\n'), 'não pode começar com barra+n literal');
  assert.ok(e.startsWith('={{\n'), 'começa com quebra de linha real');
  assert.ok(!e.includes('\\\\n'), 'sem barra dupla antes do n');
  assert.ok(!e.includes('\\"'), 'sem aspas escapadas');
});

for (const cliente of CLIENTES) {
  test(`${cliente}: gera a enquete de 5 opções com o texto no formato esperado`, () => {
    const jid = '120363424743503833@g.us';
    const r = avaliar(gerarExpressao(cliente, jid), linha);
    assert.equal(r.number, jid);
    assert.equal(r.selectableCount, 1);
    assert.equal(r.values.length, 5);
    assert.ok(r.name.startsWith(`🏢 *Cliente:* ${cliente}\n🔍 *Termo:* "cmc displays"\n🔑 *KW:* mesa interativa touch screen\n💬 *Obs:* Marca`), r.name);
    assert.ok(r.name.length <= 255, `nome com ${r.name.length} caracteres`);
    assert.ok(!r.name.includes('\\n'), 'sem \\n literal no texto');
  });
}

test('o roteador de votos consegue ler cliente, termo, KW e obs do texto gerado', () => {
  const nome = avaliar(gerarExpressao('Run Service', '120363424743503833@g.us'), linha).name;
  assert.equal(/Cliente:\*?\s*([^\n\r]+)/i.exec(nome)[1].trim(), 'Run Service');
  assert.equal(/Termo:\*?\s*["“]?([^"”\n\r]+)["”]?/i.exec(nome)[1].trim(), 'cmc displays');
  assert.equal(/(?:Palavra-chave|KW):\*?\s*([^\n\r]+)/i.exec(nome)[1].trim(), 'mesa interativa touch screen');
  assert.match(/(?:Coment[áa]rio|Obs):\*?\s*([^\n\r]+)/i.exec(nome)[1], /^Marca concorrente/);
});

test('observação enorme e termo enorme continuam dentro do limite de 255 caracteres', () => {
  const r = avaliar(gerarExpressao('Qualipix', '1@g.us'), {
    'Termo de pesquisa': 't'.repeat(200), 'Palavra-chave': 'k'.repeat(200), 'Campanha': 'c'.repeat(200), 'Observacao': 'o'.repeat(600),
  });
  assert.ok(r.name.length <= 255, `nome com ${r.name.length} caracteres`);
});

test('campos ausentes usam os padrões', () => {
  const r = avaliar(gerarExpressao('Reportei', '1@g.us'), {});
  assert.ok(r.name.includes('"N/A"') && r.name.includes('KW:* N/A') && r.name.includes('Avaliar pertinência'));
});

test('jidDoNo lê o destino da expressão atual e falha sem ele', () => {
  assert.equal(jidDoNo("... number: '120363435040456024@g.us', ..."), '120363435040456024@g.us');
  assert.throws(() => jidDoNo('sem destino'));
});

test('gerarOperacoes preserva o grupo de destino de cada cliente e cobre os 6 nós', () => {
  const nos = CLIENTES.map((c, i) => ({
    name: `Enviar Enquete WhatsApp (${c})`,
    parameters: { jsonBody: `={{\\n number: '1203634${i}@g.us' }}` },
  }));
  const { operations } = gerarOperacoes({ nodes: nos });
  assert.equal(operations.length, 6);
  operations.forEach((op, i) => {
    assert.equal(op.type, 'updateNodeParameters');
    assert.ok(op.parameters.jsonBody.includes(`number: '1203634${i}@g.us'`));
  });
});
