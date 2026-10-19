// Gera a expressão do nó "Enviar Enquete WhatsApp (X)" a partir de n8n/code/enquete-duvida.expr.txt.
// O modelo guarda a expressão com quebras de linha reais e "\n" simples dentro dos template literals;
// uma versão anterior tinha tudo escapado duas vezes ("={{\n ..."), o que dava "invalid syntax" no n8n.
// Uso: node n8n/scripts/gen-enquete.mjs <workflow.json> -> grava n8n/out/enquete-ops.json (operações de update_workflow).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

export const CLIENTES = ['Magic Hands', 'Endomarcas', 'Qualipix', 'Estremoz', 'Run Service', 'Reportei'];

export function modelo() {
  return readFileSync(join(raiz, 'code', 'enquete-duvida.expr.txt'), 'utf8').replace(/\r?\n$/, '').replace(/\r\n/g, '\n');
}

export function gerarExpressao(cliente, jid) {
  return modelo().replaceAll('__CLIENTE__', cliente).replaceAll('__JID__', jid);
}

// Destino atual da enquete de cada cliente, lido do nó existente (não é igual para todos: o Reportei tem grupo próprio).
export function jidDoNo(jsonBody) {
  const m = /number:\s*'(\d+@g\.us)'/.exec(jsonBody || '');
  if (!m) throw new Error('JID de destino não encontrado na expressão atual');
  return m[1];
}

export function gerarOperacoes(workflow) {
  const operations = CLIENTES.map((cliente) => {
    const nome = `Enviar Enquete WhatsApp (${cliente})`;
    const no = workflow.nodes.find((n) => n.name === nome);
    if (!no) throw new Error(`Nó ausente: ${nome}`);
    return { type: 'updateNodeParameters', nodeName: nome, parameters: { jsonBody: gerarExpressao(cliente, jidDoNo(no.parameters.jsonBody)) } };
  });
  return {
    operations,
    versionName: 'Enquete de duvida: corrige expressao (invalid syntax)',
    versionDescription: 'Os 6 nos "Enviar Enquete WhatsApp" tinham a expressao escapada duas vezes e falhavam com "invalid syntax": nenhuma enquete era enviada ao grupo dos especialistas. Gerado por n8n/scripts/gen-enquete.mjs.',
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('Uso: node n8n/scripts/gen-enquete.mjs <workflow.json>');
    process.exit(2);
  }
  const bruto = JSON.parse(readFileSync(arquivo, 'utf8'));
  const r = gerarOperacoes(bruto.workflow || bruto);
  mkdirSync(join(raiz, 'out'), { recursive: true });
  const saida = join(raiz, 'out', 'enquete-ops.json');
  writeFileSync(saida, JSON.stringify(r, null, 2));
  console.log(`${saida}: ${r.operations.length} operações`);
}
