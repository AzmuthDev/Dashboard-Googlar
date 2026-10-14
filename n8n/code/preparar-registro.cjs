// Converte a saída do nó "3. Processar Votos e Consenso" no corpo do RPC registrar_decisao_interna.
// Colado como está num nó Code do n8n (sem require). Devolve null quando não há nada a registrar.

const TABELA_POR_CLIENTE = {
  'Magic Hands': 'mesa_magic_hands',
  'Endomarcas': 'mesa_endomarcas',
  'Qualipix': 'mesa_qualipix',
  'Estremoz': 'mesa_estremoz',
  'Run Service': 'mesa_run_service',
  'Reportei': 'mesa_reportei',
};

function prepararRegistro(saida) {
  if (!saida || saida.ignorado || saida.consenso_atingido !== true) return null;

  const tabela = TABELA_POR_CLIENTE[String(saida.cliente || '').trim()];
  if (!tabela) return null;

  const opcao = saida.opcao_vencedora == null ? null : String(saida.opcao_vencedora);
  const ehDuvida = opcao !== null && /d[uú]vida|❓/i.test(opcao);

  let estado;
  let p_opcao = opcao;
  if (saida.acao === 'RESPOSTA_CLIENTE') {
    estado = 'respondido_cliente';
  } else if (saida.acao === 'ENVIAR_CLIENTE') {
    estado = 'aguardando_cliente';
    p_opcao = null;
  } else if (saida.acao === 'DECISAO_INTERNA') {
    if (opcao === null || ehDuvida) return null;
    estado = 'decidido_equipe';
  } else {
    return null;
  }

  return {
    p_tabela: tabela,
    p_termo: saida.termo,
    p_campanha: saida.campanha,
    p_grupo: saida.grupo,
    p_palavra_chave: saida.palavra_chave,
    p_opcao,
    p_estado: estado,
  };
}

if (typeof module !== 'undefined') module.exports = { TABELA_POR_CLIENTE, prepararRegistro };
