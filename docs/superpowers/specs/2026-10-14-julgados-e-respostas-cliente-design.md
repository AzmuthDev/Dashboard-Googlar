# Pocket: filtro "já julgado" e resposta do cliente — Design

Data: 2026-10-14 · Status: aguardando revisão

## 1. Objetivo

1. No workflow interno (`ee8wTgiHKx1HUvek`), nenhum termo que já tem veredito no Supabase chega ao agente de IA.
2. Toda resposta de cliente a uma dúvida (enquete do Pocket interno **ou** do Pocket do site) é gravada no Supabase no formato que a tela "Respostas Cliente" entende, com a **origem** identificada, e pode ser exportada para o Google Ads Editor filtrando por tipo (Segmentar, Negativar, Teste A/B).

Sucesso: (a) rodar `/ups <cliente>` duas vezes seguidas não reclassifica termos já julgados; (b) um voto de cliente muda o card de "Aguardando Resposta" para respondido, com origem e ação corretas; (c) a exportação gera só os tipos marcados.

## 2. Estado atual (verificado em 2026-10-14)

- Workflow interno: 146 nós, ativo, **sem nenhum nó Supabase**. Lê Google Sheets, classifica com Gemini (lotes de 30), envia enquete de 5 opções, consenso de 2 votos, voto soberano do cliente. Não grava nada no banco.
- Pocket do site (5 workflows: Qualipix `wtNTrZrjPaXRpiiM`, Estremoz `YzrPAnuQVoC2vyOhfRyb1`, Magic Hands `pUdnw0fcaEM33izI`, Seguro Viagem `yEITJcoPpuJB9sRI`, Endomarcas `izqF7glcXxReCXY2`): semanalmente IA -> linhas em `mesa_<cliente>`; a cada 1 min busca 5 linhas com `pode_enviar`, `duvida`, `triagem1`, `triagem2` = true e `enviado_para_grupo` = false, envia enquete de 3 opções (✅ Relevante, ❌ Negativar, ⚠️ Teste A/B) e grava `id_enquete` e `enviado_para_grupo=true`.
- Só o Qualipix do site recebe voto (webhook `whatsapp-survey-response` -> `Tradutor de Decisão` -> `Update Dashboard DB`). Ele atualiza `segmentar/negativar/teste_ab/duvida` por `id_enquete`, mas **não** define `respondido_cliente`, `acao` nem `data_resposta`; a tela fica em "Aguardando Resposta" para sempre. O aviso final usa URL de exemplo (`seu-dashboard.vercel.app`).
- Tabelas `mesa_*` existentes: magic_hands, endomarcas, qualipix, estremoz, style_brokers, comparar_seguro_viagem. **Faltam** run_service e reportei.
- Tela `src/components/SemanticAudit.tsx`: usa `enviado_para_grupo`, `respondido_cliente`, `acao` (`negativar` / `manter`), `data_resposta`; exportação atual é um bloco de texto.

## 3. Banco (Supabase "Dashboard Googlar", `jmptroahcezmpjdplxwy`)

Uma migração:

- Criar `mesa_run_service` e `mesa_reportei` com `LIKE mesa_qualipix INCLUDING ALL` e RLS habilitado com as mesmas políticas das demais mesas.
- Em todas as `mesa_*` de cliente: adicionar `origem text` (`'interno'` | `'site'`) e `data_resposta timestamptz`. Linhas antigas ficam com `origem = 'site'` por terem sido criadas pelos workflows do site.
- `acao` passa a aceitar `segmentar`, `negativar`, `teste_ab`; `manter` segue aceito na leitura (legado).
- Função `registrar_resposta_cliente(p_id_enquete text, p_opcao text, p_voter text)` (`SECURITY DEFINER`): localiza `id_enquete` em todas as `mesa_*`, grava `respondido_cliente=true`, `acao`, `data_resposta=now()`, e as flags `segmentar/negativar/teste_ab` (zerando `duvida`). Retorna `{encontrado, tabela, origem}`. Opção desconhecida ou vazia não altera nada.
- Função `upsert_veredito(p_tabela, linhas jsonb)` para o interno gravar vereditos da IA (chave: termo + campanha + grupo), com `origem='interno'`.

## 4. Workflow interno (`ee8w`)

### 4.1 Filtro "já julgado" (6 esteiras)

Entre `Ler Termos da Planilha (X)` e `Inicializar Estatísticas (X)`:

- `Buscar Julgados (X)`: nó Supabase `getAll` em `mesa_<cliente>`, `returnAll`, **Execute Once** (uma consulta por execução, não por linha), `alwaysOutputData`.
- `Excluir Já Julgados (X)`: Code. Monta um `Set` de `termo|campanha|grupo` normalizado (minúsculas, trim) das linhas com `segmentar`, `negativar` ou `teste_ab` verdadeiros, ou `duvida` verdadeira com `enviado_para_grupo`/`respondido_cliente`. Descarta as linhas da planilha que casam. Registra no log do WhatsApp quantos foram pulados.
- Se o Supabase falhar: o fluxo **continua sem filtro** e avisa no grupo ("filtro indisponível"), para não parar a auditoria.
- Prompts dos agentes: **inalterados** (AGENTS.md).

Mapeamento cliente -> tabela: Magic Hands `mesa_magic_hands`, Endomarcas `mesa_endomarcas`, Qualipix `mesa_qualipix`, Estremoz `mesa_estremoz`, Run Service `mesa_run_service`, Reportei `mesa_reportei`.

### 4.2 Gravação dos vereditos da IA

Após `Avaliar Lote (X)`, nó Supabase RPC `upsert_veredito` com o lote classificado (11 chaves do JSON ultraleve mapeadas para colunas), `origem='interno'`. É isto que faz o filtro 4.1 funcionar na execução seguinte.

### 4.3 Resposta do cliente

No roteador de votos (`3. Processar Votos e Consenso` e nós seguintes):

- Voto num grupo de cliente (1 voto soberano) ou consenso interno de 2 votos: chamar `registrar_resposta_cliente`. Se `encontrado=false` (enquete interna sem `id_enquete` no banco), fazer `upsert_veredito` por termo + campanha + grupo extraídos do texto da enquete e então marcar a resposta.
- Mapeamento de opções: `Segmentar`/`Relevante` -> `segmentar`; `Negativar` -> `negativar`; `Teste A/B` -> `teste_ab`; `Concorrente` -> `negativar` com observação "concorrente"; `Dúvida` -> não encerra.
- **Origem:** `site` se o `id_enquete` foi achado numa `mesa_*` com `origem='site'`; `interno` nos demais casos. A mensagem "RESPOSTA DO CLIENTE RECEBIDA" no grupo da equipe passa a citar a origem.
- Votos das enquetes do site passam a ser tratados aqui (o roteador já recebe todos os eventos da Evolution), cobrindo os 5 clientes do site sem copiar nós. O webhook do Qualipix do site fica como está (sem remover).
- Guarda anti-loop: continua valendo; as novas mensagens do bot não podem começar com os cabeçalhos já bloqueados nem criar loop.

## 5. Tela "Respostas Cliente" (`SemanticAudit.tsx`)

- Coluna e filtro **Origem** (Todas / Interno / Site).
- Status e cor por `acao`: segmentar (verde), negativar (vermelho), teste_ab (âmbar), com `data_resposta`.
- Exportação: seletor com caixas **Segmentar / Negativar / Teste A/B** e filtro de origem; botão baixa/copia só o selecionado.
  - Negativar -> Google Ads Editor: `Campaign`, `Ad group`, `Keyword`, `Criterion Type` (`Negative Exact`, `Negative Phrase` ou `Negative Broad`, escolhido num seletor, padrão Exata).
  - Segmentar -> mesmas colunas, `Criterion Type = Exact` (palavra-chave positiva no grupo).
  - Teste A/B -> lista simples (Campanha, Grupo, Termo) para o analista; sem linha de critério do Editor.
- Contagem das abas e exportação passam a usar `respondido_cliente = true` e `acao`.

## 6. Tratamento de erros

- Supabase indisponível no filtro: segue sem filtro + aviso.
- `registrar_resposta_cliente` com `id_enquete` inexistente ou voto vazio/cancelado: não altera linhas; registra no log; nunca derruba o fluxo.
- Voto repetido do mesmo cliente: função idempotente (última opção vence até a resposta ser exportada).
- Termos com acento/maiúsculas diferentes entre Sheets e banco: normalização na chave.

## 7. Testes

- Migração: aplicar em branch do Supabase ou verificar com `execute_sql` em transação; checar RLS das duas mesas novas.
- Função de resposta: chamadas com `id_enquete` existente, inexistente e opção vazia; conferir linhas afetadas.
- Workflow: `test_workflow`/execução manual por esteira com planilha pequena; segunda execução deve pular 100% dos termos julgados.
- Voto real: enquete de teste no grupo da equipe -> linha atualizada -> card muda na tela.
- Tela: abrir no navegador (`npm run dev`), conferir filtro de origem e exportação por tipo.
- Antes de mexer no workflow ao vivo: exportar/salvar cópia (versão atual `4e8b3a2a-6067-4527-8c47-efef24fea8af`) e usar o histórico de versões do n8n para reverter.

## 8. Fora de escopo (apontado, não alterado)

- Chave da Evolution API em texto puro nos nós dos workflows do site.
- Workflow de Endomarcas do site com um nó gravando em `mesa_qualipix`.
- Filtro "já julgado" nos workflows do site (decisão: só no interno).
- Estado de enquetes no `$getWorkflowStaticData` e worker de timeout.

## 9. Premissas a confirmar na revisão

1. `Teste A/B` não gera linha do Editor, só lista.
2. `Concorrente` conta como `negativar` com observação.
3. Qual credencial Supabase do n8n aponta para o projeto "Dashboard Googlar" (os workflows do site usam "Supabase account 2" e "Supabase account 5"); será verificado na implementação e usado o que já grava nas `mesa_*`.
