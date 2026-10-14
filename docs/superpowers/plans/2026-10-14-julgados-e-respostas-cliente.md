# Filtro "já julgado" e Respostas do Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que termos já julgados cheguem à IA no workflow interno e gravar no Supabase toda resposta de cliente (interno e site) com origem e ação, exportável por tipo na tela "Respostas Cliente".

**Architecture:** Funções SQL (`SECURITY DEFINER`) concentram a escrita nas `mesa_*`. O n8n chama essas funções por HTTP (`/rest/v1/rpc/...`) e usa um nó Supabase `getAll` para o filtro. A lógica em JS dos nós Code vive em módulos testáveis (`n8n/code/*.cjs`); um gerador produz as operações de `update_workflow`. O front ganha um módulo puro de exportação testado com `node --test`.

**Tech Stack:** Supabase (Postgres 17, projeto `jmptroahcezmpjdplxwy`), n8n (workflow `ee8wTgiHKx1HUvek`, MCP `update_workflow`), Node 24 (`node --test`, TS direto), React 19 + antd + Vite.

**Spec:** `docs/superpowers/specs/2026-10-14-julgados-e-respostas-cliente-design.md`

## Global Constraints

- Prompts dos agentes de IA: **não alterar** nenhum nó `agent`/`lmChatGoogleGemini` (AGENTS.md). Verificar por diff de parâmetros (Task 4, Task 5).
- Chave de julgado: `termo + campanha + grupo`, comparados em minúsculas, sem acento, espaços colapsados.
- "Já julgado" = linha com `segmentar` OU `negativar` OU `teste_ab` verdadeiro, OU `respondido_cliente` verdadeiro, OU `enviado_para_grupo` verdadeiro (dúvida aguardando).
- `acao` válidas: `segmentar`, `negativar`, `teste_ab` (`manter` só na leitura, legado). `origem`: `interno` | `site`.
- Mapeamento de opção (por palavra-chave, não por emoji): `relevante`/`segmentar`/✅ -> `segmentar`; `negativar`/`concorrente`/❌ -> `negativar`; `teste`/`a/b`/⚠ -> `teste_ab`; qualquer outra (inclui Dúvida) -> sem ação.
- Tabelas: Magic Hands `mesa_magic_hands`, Endomarcas `mesa_endomarcas`, Qualipix `mesa_qualipix`, Estremoz `mesa_estremoz`, Run Service `mesa_run_service`, Reportei `mesa_reportei` (novas: as duas últimas). Também no conjunto de busca por `id_enquete`: `mesa_style_brokers`, `mesa_comparar_seguro_viagem`.
- Funções de escrita: `EXECUTE` apenas para `service_role`. **Nunca** conceder a `anon`/`authenticated`.
- Mensagens novas do bot não podem conter `/ups`. Chaves de API não entram em arquivos versionados: backups e saídas do gerador ficam em `n8n/backups/` e `n8n/out/` (gitignored).
- Editor do Ads: colunas `Campaign`, `Ad group`, `Keyword`, `Criterion Type`; negativas `Negative Exact` | `Negative Phrase` | `Negative Broad` (padrão `Negative Exact`); segmentar `Exact`; Teste A/B só em lista (`Campanha`, `Grupo`, `Termo`).

## Review Focus

1. Planilha com termo em caixa/acento diferente do banco, ou linha sem termo: casa por chave normalizada; linha sem termo é mantida. (Task 2)
2. Tabela `mesa_*` vazia ou Supabase fora do ar: o fluxo segue com todos os termos e avisa no grupo; nunca para a auditoria. (Task 2, 4)
3. Todos os termos da planilha já julgados: nenhum item chega à IA, e a equipe recebe aviso de "nenhum termo novo". (Task 2, 4)
4. Mesmo termo em duas campanhas, uma julgada: só a combinação idêntica é pulada. (Task 2)
5. Voto sem opção reconhecida, repetido ou com `id_enquete` inexistente: a função não altera linhas e o roteador segue o fluxo antigo. (Task 1, 5)
6. Exportação com seleção vazia, linhas sem campanha/grupo (`N/A`), termos com tab/aspas, duplicatas: omite o que não dá para apontar no Editor e informa a contagem. (Task 6)

---

### Task 1: Migração Supabase (tabelas, colunas e funções)

**Files:**
- Create: `supabase/migrations/20261014120000_julgados_respostas.sql`
- Create: `supabase/tests/julgados_respostas.test.sql`

**Interfaces:**
- Produces (SQL, schema `public`):
  - `_mesas_cliente() returns text[]` — as 8 tabelas listadas nas Global Constraints.
  - `_chave_norm(text) returns text` — minúsculas, sem acento (`unaccent`), `btrim`, espaços colapsados; `null` -> `''`.
  - `_acao_de_opcao(text) returns text` — mapeamento da Global Constraint; `null` se desconhecida.
  - `registrar_resposta_cliente(p_id_enquete text, p_opcao text, p_voter text default null) returns jsonb` — `{encontrado, ignorado, tabela, origem, acao, termo, campanha, grupo, palavra_chave}`. Procura `id_enquete` nas 8 tabelas; se achar e a opção mapear: `respondido_cliente=true`, `enviado_para_grupo=true`, `acao`, `data_resposta=now()`, flags de veredito conforme `acao` e `duvida=false`; última opção vence. Opção desconhecida: `{encontrado:true, ignorado:true}` sem alterar. Não achou: `{encontrado:false}`. `origem` devolvida = `coalesce(origem,'site')`.
  - `registrar_decisao_interna(p_tabela text, p_termo text, p_campanha text, p_grupo text, p_palavra_chave text, p_opcao text, p_estado text) returns jsonb` — `p_estado` em `aguardando_cliente` | `decidido_equipe` | `respondido_cliente` (outro valor ou tabela fora de `_mesas_cliente()` levanta exceção). Acha/insere por chave normalizada (linha nova: `origem='interno'`, `usuario='Pocket Interno'`). `aguardando_cliente`: `duvida=true`, demais flags `false`, `enviado_para_grupo=true`, `respondido_cliente=false`. `decidido_equipe`: flags pela ação, `duvida=false`. `respondido_cliente`: como em `registrar_resposta_cliente`. Opção sem ação nos dois últimos estados: `{ignorado:true}`.
  - `upsert_veredito(p_tabela text, p_linhas jsonb) returns integer` — cada elemento com `termo, campanha, grupo, palavra_chave, segmentar, negativar, teste_ab, duvida, observacao, impressoes, conversoes`. Atualiza por chave normalizada **sem tocar** linhas com `respondido_cliente=true`; insere com `origem='interno'`, `usuario='Pocket Interno'`, `pode_enviar=false`. Retorna linhas inseridas+atualizadas.
- Colunas novas em **todas** as 8 tabelas: `origem text`, `data_resposta timestamptz`; linhas existentes recebem `origem='site'`.

- [ ] **Step 1: Escrever `supabase/tests/julgados_respostas.test.sql`** — um script único `begin; ... rollback;` com blocos `do $$ ... assert ... $$` que cobrem: (a) as 8 tabelas têm `origem` e `data_resposta`, e `mesa_run_service`/`mesa_reportei` existem; (b) `_chave_norm('  Pé  de CABRA ')='pe de cabra'`; (c) `_acao_de_opcao` devolve `segmentar` para `'✅ Relevante'`, `negativar` para `'🏢 Concorrente'`, `teste_ab` para `'⚠️ Teste A/B'` e `null` para `'❓ Dúvida (Enviar ao Cliente)'` e `null`; (d) `registrar_resposta_cliente` com linha semeada em `mesa_qualipix` (`id_enquete='T-1'`, `duvida=true`, `enviado_para_grupo=true`): voto `'❌ Negativar'` => `acao='negativar'`, `respondido_cliente=true`, `duvida=false`, `data_resposta` não nulo; voto seguinte `'✅ Relevante'` => `acao='segmentar'` (última vence); voto `'??'` não altera; `id_enquete` inexistente => `{encontrado:false}`; (e) `registrar_decisao_interna` nos três estados, incluindo inserção de linha nova com `origem='interno'` e a exceção para `p_estado='x'`; (f) `upsert_veredito` insere 2 linhas, na 2ª chamada com termo em caixa diferente atualiza (não duplica) e **não** altera linha com `respondido_cliente=true`; (g) `has_function_privilege('anon','public.upsert_veredito(text,jsonb)','execute')` é `false` e para `service_role` é `true`.
- [ ] **Step 2: Rodar o teste e ver falhar** — executar o arquivo com `mcp__932cb40a-aefd-4c78-b026-8925af5a527d__execute_sql` (project_id `jmptroahcezmpjdplxwy`). Esperado: erro (colunas/funções inexistentes).
- [ ] **Step 3: Escrever a migração** em `supabase/migrations/20261014120000_julgados_respostas.sql`: `create extension if not exists unaccent with schema extensions`; `create table mesa_run_service/mesa_reportei (like public.mesa_qualipix including all)`; `alter table ... enable row level security` e réplica das políticas de `mesa_qualipix` (ler `pg_policies` dela e recriar com o nome da nova tabela); `add column if not exists origem/data_resposta` + `update ... set origem='site' where origem is null` nas 8; as 6 funções acima com `security definer set search_path = public, extensions`, `revoke all on function ... from public, anon, authenticated`, `grant execute ... to service_role`. SQL dinâmico com `format('%I', tabela)` e a tabela sempre validada contra `_mesas_cliente()`.
- [ ] **Step 4: Aplicar** com `mcp__932cb40a-aefd-4c78-b026-8925af5a527d__apply_migration` (name `julgados_respostas`).
- [ ] **Step 5: Rodar o teste e ver passar** — mesmo `execute_sql` do Step 2. Esperado: sem erros de `assert`; o `rollback` final deixa o banco limpo (conferir `select count(*) from mesa_qualipix where id_enquete='T-1'` = 0).
- [ ] **Step 6: Rodar `get_advisors` (security)** e corrigir qualquer alerta novo causado pelas funções ou tabelas (RLS ausente, search_path).
- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261014120000_julgados_respostas.sql supabase/tests/julgados_respostas.test.sql
git commit -m "feat(db): mesas run_service/reportei, origem/data_resposta e funcoes de resposta"
```

---

### Task 2: Módulos de lógica dos nós Code (testáveis)

**Files:**
- Create: `n8n/code/excluir-julgados.cjs`, `n8n/code/normalizar-vereditos.cjs`, `n8n/code/preparar-registro.cjs`
- Test: `n8n/code/excluir-julgados.test.cjs`, `n8n/code/normalizar-vereditos.test.cjs`, `n8n/code/preparar-registro.test.cjs`
- Modify: `package.json` (script `"test": "node --test \"src/utils/*.test.ts\" \"n8n/code/*.test.cjs\""`), `.gitignore` (`n8n/backups/`, `n8n/out/`)

Cada módulo é CommonJS sem dependências, com funções puras e o final `if (typeof module !== 'undefined') module.exports = {...}` (o mesmo texto é colado no nó Code do n8n pelo gerador).

**Interfaces:**
- `excluir-julgados.cjs` exporta:
  - `chaveJulgado(termo, campanha, grupo): string` — `_chave_norm` de cada parte unidas por `|`; aceita `undefined`.
  - `excluirJulgados(planilha: object[], julgados: object[]): { restantes: object[], pulados: number, filtroIndisponivel: boolean }` — `planilha` com chaves `Termo de pesquisa`, `Campanha`, `Grupo de anúncios` (fallbacks `Termo`, `Grupo_Anuncio`); `julgados` com `termo_de_pesquisa`, `campanha`, `grupo_de_anuncios`. Linha da planilha sem termo é mantida. Se `julgados` contém item com `error` (falha do Supabase), devolve `restantes = planilha` e `filtroIndisponivel=true`. Item vazio `{}` (tabela vazia com `alwaysOutputData`) é ignorado.
- `normalizar-vereditos.cjs` exporta `normalizarVereditos(rawText: string, tabela: string): { p_tabela: string, p_linhas: object[] }` — extrai o array JSON da saída da IA (mesma tolerância de `Avaliar Lote`: remove cercas ```` ``` ````, aceita objeto único); cada linha vira `{termo, campanha, grupo, palavra_chave, segmentar, negativar, teste_ab, duvida, observacao, impressoes, conversoes}` lendo as 11 chaves do JSON ultraleve (`✅`/`❌`/`⚠️`/`❓` nas colunas de decisão). Linha sem exatamente um símbolo marcado ou sem termo é descartada. JSON inválido devolve `p_linhas: []` (nunca lança).
- `preparar-registro.cjs` exporta:
  - `TABELA_POR_CLIENTE: Record<string,string>` com os 6 mapeamentos das Global Constraints.
  - `prepararRegistro(saidaConsenso: object): object | null` — recebe a saída do nó `3. Processar Votos e Consenso`; retorna `null` se `ignorado`, `consenso_atingido` falso, cliente sem tabela, ou `acao='DECISAO_INTERNA'` com opção de dúvida. Caso contrário o corpo do RPC `{p_tabela, p_termo, p_campanha, p_grupo, p_palavra_chave, p_opcao, p_estado}` com `p_estado`: `RESPOSTA_CLIENTE` -> `respondido_cliente`; `DECISAO_INTERNA` -> `decidido_equipe`; `ENVIAR_CLIENTE` -> `aguardando_cliente` (com `p_opcao: null`).

- [ ] **Step 1: Escrever os testes** (`node:test` + `node:assert/strict`), com estes nomes e asserts:
  - `chave ignora caixa, acento e espaços`: `chaveJulgado(' Pé de  Cabra ','CAMP','g1') === chaveJulgado('pe de cabra','camp','G1')`.
  - `pula só a combinação idêntica` (Review Focus 4): julgado `(t1,c1,g1)`; planilha `(t1,c1,g1)`, `(t1,c2,g1)` => `restantes.length===1`, `pulados===1`, restante é `c2`.
  - `mantém linha sem termo`, `tabela vazia mantém tudo` (julgados `[{}]`), `falha do Supabase segue sem filtro` (julgados `[{error:{message:'x'}}]` => `filtroIndisponivel===true`, `restantes.length===planilha.length`), `todos julgados => restantes vazio` (Review Focus 3).
  - `normalizarVereditos`: entrada com cercas e 3 linhas (uma `✅`, uma `❌`, uma com dois símbolos) => 2 linhas, flags corretas; texto `"não é json"` => `p_linhas` vazio; objeto único aceito.
  - `prepararRegistro`: `{acao:'RESPOSTA_CLIENTE', consenso_atingido:true, cliente:'Qualipix', opcao_vencedora:'❌ Negativar', termo:'x', campanha:'c', grupo:'g', palavra_chave:'k'}` => `p_tabela:'mesa_qualipix'`, `p_estado:'respondido_cliente'`; `ENVIAR_CLIENTE` => `p_estado:'aguardando_cliente'`, `p_opcao:null`; `DECISAO_INTERNA` com `'❓ Dúvida (Enviar ao Cliente)'` => `null`; cliente `'Desconhecido'` => `null`; `consenso_atingido:false` => `null`.
- [ ] **Step 2: Rodar e ver falhar** — `node --test "n8n/code/*.test.cjs"`. Esperado: FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar os três módulos** conforme as Interfaces (reaproveitar a ideia de `extrairJSON`/`normalizar` do nó `Avaliar Lote (Dúvidas? - Magic Hands)`).
- [ ] **Step 4: Rodar e ver passar** — mesmo comando. Esperado: todos os testes PASS.
- [ ] **Step 5: Adicionar o script `test` e as linhas do `.gitignore`**; rodar `npm test` (os testes de `src/utils` entram na Task 6; por ora o glob sem arquivos não deve falhar — se falhar, usar só o glob de `n8n/code` até a Task 6).
- [ ] **Step 6: Commit**

```bash
git add n8n/code package.json .gitignore
git commit -m "feat(n8n): modulos testados de filtro, vereditos e registro de decisao"
```

---

### Task 3: Backup e gerador das operações do n8n

**Files:**
- Create: `n8n/scripts/gen-ops.mjs`, `n8n/scripts/gen-ops.test.mjs`
- Output (não versionado): `n8n/backups/ee8w-<versionId>.json`, `n8n/out/esteira-<cliente>.json`, `n8n/out/roteador.json`

**Interfaces:**
- Consumes: módulos da Task 2.
- Produces: `node n8n/scripts/gen-ops.mjs <backup.json> <cliente|roteador>` grava `n8n/out/<alvo>.json` com `{ operations: [...], versionName, versionDescription }` pronto para `update_workflow` (máx. 100 operações).
  - Por esteira `X` (nomes exatos): `Buscar Julgados (X)` (`n8n-nodes-base.supabase` v1, credencial `supabaseApi` "Supabase account 5" `FUabs49WcVpHY9ez`, `getAll`, `returnAll`, `matchType: anyFilter`, filtros `segmentar`/`negativar`/`teste_ab`/`respondido_cliente`/`enviado_para_grupo` `eq` `={{ true }}`), `Excluir Já Julgados (X)` (Code v2: constante `SHEET_NODE`, corpo de `excluir-julgados.cjs` + cola que lê `$(SHEET_NODE).all()` e `$input.all()`; devolve os `restantes`, ou um único item `{__nenhum_novo:true}` se vazio), `Há Termos Novos? (X)` (If v2: `$json.__nenhum_novo !== true`; saída 0 -> `Inicializar Estatísticas (X)`; saída 1 sem destino), `Montar Aviso do Filtro (X)` (Code: devolve `[]` se `pulados===0` e filtro ok; senão 1 item com o texto), `Notificar Filtro (X)` (HTTP v4.4; `url` e `headerParameters` copiados em tempo de execução do nó `Notificar Sem Dúvidas (X)` do backup; `number` extraído do `jsonBody` desse nó; texto começa com `ℹ️ *FILTRO DE TERMOS JÁ JULGADOS: X*`), `Normalizar Vereditos (X)` (Code: `normalizarVereditos` com a tabela da esteira), `Gravar Vereditos (X)` (HTTP v4.4, `POST https://jmptroahcezmpjdplxwy.supabase.co/rest/v1/rpc/upsert_veredito`, `authentication: predefinedCredentialType`, `nodeCredentialType: supabaseApi`, credencial "Supabase account 5", corpo JSON `p_tabela`/`p_linhas`). `setNodeSettings`: `Buscar Julgados` `executeOnce:true, alwaysOutputData:true, onError:continueRegularOutput`; `Gravar Vereditos` `onError:continueRegularOutput`.
  - Conexões por esteira: remove `Ler Termos da Planilha (X)` -> `Inicializar Estatísticas (X)`; adiciona `Ler...` -> `Buscar Julgados` -> `Excluir` -> (`Há Termos Novos?` e `Montar Aviso`); `Montar Aviso` -> `Notificar Filtro`; `IA Auditor Semântico (X)` (saída 0) e `IA Auditor Semântico (X)1` (saída 0) -> `Normalizar Vereditos` -> `Gravar Vereditos`.
  - `roteador`: ver Task 5 (nomes e conexões lá).
- O gerador **valida** que todo `source`/`target`/`nodeName` referenciado e já existente existe no backup, e falha com a lista dos ausentes.

- [ ] **Step 1: Salvar o backup** — `get_workflow_details` (workflowId `ee8wTgiHKx1HUvek`) já grava o resultado em arquivo; copiar o campo `workflow` para `n8n/backups/ee8w-<versionId>.json` e anotar o `versionId` (hoje `4e8b3a2a-6067-4527-8c47-efef24fea8af`) para reversão via `restore_workflow_version`.
- [ ] **Step 2: Escrever `gen-ops.test.mjs`** — roda o gerador contra o backup para as 6 esteiras e assere: 7 nós `addNode` por esteira com os nomes acima; nenhuma operação referencia nó inexistente; cada arquivo tem ≤100 operações; nenhum `jsonBody`/`headerParameters` do arquivo de **saída** aparece em arquivos versionados (o teste só lê `n8n/out/`); com um backup adulterado (sem `Notificar Sem Dúvidas (Qualipix)`) o gerador falha citando esse nome.
- [ ] **Step 3: Rodar e ver falhar** — `node --test n8n/scripts/gen-ops.test.mjs`. Esperado: FAIL.
- [ ] **Step 4: Implementar `gen-ops.mjs`** conforme as Interfaces (alvo `roteador` pode ficar como stub que falha com "Task 5" até lá).
- [ ] **Step 5: Rodar e ver passar** — esperado: PASS nos casos das esteiras.
- [ ] **Step 6: Commit** (apenas scripts)

```bash
git add n8n/scripts
git commit -m "feat(n8n): gerador de operacoes update_workflow para as esteiras"
```

---

### Task 4: Aplicar filtro + persistência nas 6 esteiras (ao vivo)

**Files:** nenhum no repositório; altera o workflow `ee8wTgiHKx1HUvek` e usa `n8n/out/`.

**Interfaces:** Consumes Tasks 1–3.

- [ ] **Step 1: Verificar a credencial e o RPC antes de mexer no fluxo** — chamar `upsert_veredito` por HTTP com a credencial "Supabase account 5" (nó temporário ou `execute_workflow` de teste): `p_tabela='mesa_magic_hands'`, `p_linhas='[]'`. Esperado: resposta `0`. Se der 401/403/`permission denied`, **parar e perguntar ao usuário** qual credencial usa a chave `service_role` (não conceder `EXECUTE` a `anon`).
- [ ] **Step 2: Canário — Magic Hands.** `node n8n/scripts/gen-ops.mjs n8n/backups/ee8w-*.json "Magic Hands"`, ler `n8n/out/esteira-Magic Hands.json` e chamar `update_workflow` (`workflowId` `ee8wTgiHKx1HUvek`, `versionName` "Filtro julgados + vereditos (Magic Hands)").
- [ ] **Step 3: Testar o canário** — `prepare_workflow_pin_data` e `test_workflow` com `triggerNodeName: "Executar Manualmente (Magic Hands)"`, planilha pinada com 3 linhas, `Buscar Julgados (Magic Hands)` pinado com 1 linha julgada. Esperado: `Excluir Já Julgados` entrega 2 itens; `Inicializar Estatísticas (Magic Hands)` mostra `totalLidos: 2`; `Montar Aviso` gera o texto com `1` pulado. Repetir com o pin de julgados cobrindo as 3 linhas: `Há Termos Novos?` sai pela saída 1 e nenhum item chega a `Lote de 30 Itens (Magic Hands)`.
- [ ] **Step 4: Aplicar nas outras 5 esteiras** (Endomarcas, Qualipix, Estremoz, Run Service, Reportei), uma chamada de `update_workflow` por esteira, e repetir o teste do Step 3 em cada uma com seu gatilho manual/`Trigger Semanal (X)`.
- [ ] **Step 5: Conferir que os agentes não mudaram** — `get_workflow_details` de novo e comparar, nó a nó, `parameters` de todos os `agent` e `lmChatGoogleGemini` com o backup. Esperado: idênticos (AGENTS.md).
- [ ] **Step 6: Salvar o `versionId` novo** no relatório final (para reverter se preciso). Sem commit (nada versionado muda).

---

### Task 5: Roteador de votos (enquetes do site + registro de decisões)

**Files:**
- Modify: `n8n/scripts/gen-ops.mjs` (alvo `roteador`), `n8n/scripts/gen-ops.test.mjs`
- Output: `n8n/out/roteador.json`

**Interfaces (nós novos, nomes exatos):**
- `Registrar Resposta Site (RPC)` — HTTP `POST .../rpc/registrar_resposta_cliente`, mesma autenticação da Task 3, corpo `{p_id_enquete: poll_id, p_opcao: opcao_votada, p_voter: voter_name}` lidos de `$('1. Extrair ID e Voto').first().json`; `onError: continueRegularOutput`.
- `Classificar Origem do Voto` — Code: devolve `{...$('1. Extrair ID e Voto').first().json, site: <bool>, resposta_site: <json do RPC>}`; `site` é verdadeiro só se o RPC retornou `encontrado:true` e o voto não é `ignorado`.
- `É Enquete do Site?` — If v2 em `$json.site === true`; saída 0 -> `Notificar Resposta Site`; saída 1 -> `2. Buscar Criacao na Evolution` (caminho antigo intacto).
- `Notificar Resposta Site` — HTTP de texto para o grupo da equipe `120363424743503833@g.us` (mesmo `url`/`apikey` de `Notificar Decisão Interna`), texto `✅ *RESPOSTA DO CLIENTE RECEBIDA (SITE: <cliente>)!*` com termo, ação e `data_resposta`; sem `/ups`.
- `Preparar Registro de Decisão` — Code com `prepararRegistro` (Task 2) sobre a saída de `3. Processar Votos e Consenso`; devolve `[]` quando `null`.
- `Gravar Decisão (RPC)` — HTTP `POST .../rpc/registrar_decisao_interna`, `onError: continueRegularOutput`.
- Conexões: remove `1. Extrair ID e Voto` -> `2. Buscar Criacao na Evolution`; adiciona `1. Extrair ID e Voto` -> `Registrar Resposta Site (RPC)` -> `Classificar Origem do Voto` -> `É Enquete do Site?`; adiciona `3. Processar Votos e Consenso` -> `Preparar Registro de Decisão` -> `Gravar Decisão (RPC)` (além de `Bateu 2 Votos?`, que permanece).

- [ ] **Step 1: Estender `gen-ops.test.mjs`** — para o alvo `roteador`: 6 `addNode` com os nomes acima; a conexão antiga é removida e as novas existem; `É Enquete do Site?` saída 1 aponta para `2. Buscar Criacao na Evolution`; o texto de `Notificar Resposta Site` não contém `/ups`.
- [ ] **Step 2: Rodar e ver falhar** — `node --test n8n/scripts/gen-ops.test.mjs`. Esperado: FAIL no alvo `roteador`.
- [ ] **Step 3: Implementar o alvo `roteador`** em `gen-ops.mjs`.
- [ ] **Step 4: Rodar e ver passar** — esperado: PASS.
- [ ] **Step 5: Aplicar ao vivo** — `update_workflow` com `n8n/out/roteador.json` (`versionName` "Roteador: respostas do site + registro de decisoes").
- [ ] **Step 6: Testar sem efeito externo** — `test_workflow` (HTTP e credenciais são pinados, nada é enviado nem gravado) com `Switch Roteamento de Eventos` alimentado por um evento `VOTO_ENQUETE`: (a) `Registrar Resposta Site (RPC)` pinado com `{encontrado:true, tabela:'mesa_qualipix', acao:'negativar'}` => caminho `Notificar Resposta Site`, sem `2. Buscar Criacao na Evolution`; (b) pinado com `{encontrado:false}` => segue para `2. Buscar Criacao na Evolution`; (c) saída pinada de `3. Processar Votos e Consenso` com `acao:'RESPOSTA_CLIENTE'` => `Gravar Decisão (RPC)` recebe `p_estado:'respondido_cliente'`.
- [ ] **Step 7: Verificação de ponta a ponta com banco real** — **pedir autorização ao usuário antes**, pois envia uma mensagem ao grupo da equipe: semear em `mesa_qualipix` (via `execute_sql`) uma linha com `id_enquete='E2E-<timestamp>'`, `duvida=true`, `enviado_para_grupo=true`, `origem='site'`; disparar o webhook do roteador com um payload de voto `✅ Relevante` nesse `id_enquete`; conferir por `execute_sql` `acao='segmentar'`, `respondido_cliente=true`, `data_resposta` não nulo; apagar a linha semeada.
- [ ] **Step 8: Commit**

```bash
git add n8n/scripts
git commit -m "feat(n8n): alvo roteador no gerador (votos do site e registro de decisoes)"
```

---

### Task 6: Módulo de exportação do front (testado)

**Files:**
- Create: `src/utils/adsExport.ts`, `src/utils/adsExport.test.ts`
- Modify: `src/types.ts` (interface `CampaignTerm`, em torno da linha 48)

**Interfaces:**
- Produces em `adsExport.ts`:
  - `export type TipoExport = 'segmentar' | 'negativar' | 'teste_ab'`
  - `export type MatchNegativa = 'exact' | 'phrase' | 'broad'`
  - `export function acaoDoTermo(t: Pick<CampaignTerm,'acao'|'segmentar'|'negativar'|'teste_ab'>): TipoExport | null` — usa `acao` (`manter` => `segmentar`); sem `acao`, cai nas flags.
  - `export function montarExportacao(termos: CampaignTerm[], opts: { tipos: TipoExport[]; matchNegativa: MatchNegativa }): { editor: string; testeAb: string; total: number; omitidos: number }` — `editor`: TSV com cabeçalho `Campaign\tAd group\tKeyword\tCriterion Type` para `negativar` (`Negative Exact|Phrase|Broad`) e `segmentar` (`Exact`); `testeAb`: TSV `Campanha\tGrupo\tTermo`. Só termos com `respondido_cliente===true`. Omite (e conta em `omitidos`) linhas cuja campanha ou grupo sejam vazios, `N/A` ou `-`; remove duplicatas idênticas; troca tab/quebra de linha dentro dos campos por espaço.
- `CampaignTerm` ganha `origem?: 'interno' | 'site' | null` e `data_resposta?: string | null`.

- [ ] **Step 1: Escrever `adsExport.test.ts`** (`node:test`) com: `negativar usa Negative Exact por padrão e Negative Phrase quando pedido`; `segmentar vira Exact`; `teste_ab só aparece em testeAb e não em editor`; `tipos vazios => total 0 e editor só com cabeçalho` (Review Focus 6); `omite N/A e conta omitidos`; `remove duplicatas`; `termo com tab não quebra a linha`; `ignora termos não respondidos`; `manter é tratado como segmentar`.
- [ ] **Step 2: Rodar e ver falhar** — `node --test "src/utils/adsExport.test.ts"`. Esperado: FAIL.
- [ ] **Step 3: Implementar `adsExport.ts`** (imports de tipo com `import type`, sem alias `@/`, para rodar direto no Node) e atualizar `src/types.ts`.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando, e `npm test`. Esperado: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/utils/adsExport.ts src/utils/adsExport.test.ts src/types.ts package.json
git commit -m "feat(front): modulo de exportacao para Google Ads Editor por tipo"
```

---

### Task 7: Tela "Respostas Cliente" (`SemanticAudit.tsx`)

**Files:**
- Modify: `src/components/SemanticAudit.tsx` — status por `acao` (linhas ~866-895), filtro da aba `responses` (~203), colunas da tabela (a partir de ~779), botão e modal de exportação (~1195-1225 e ~1436-1470).

**Interfaces:** Consumes `acaoDoTermo`, `montarExportacao`, `TipoExport`, `MatchNegativa` (Task 6).

- [ ] **Step 1: Status por ação** — na coluna `Status`, quando `respondido_cliente===true`, mostrar `✅ SEGMENTAR` (verde), `❌ NEGATIVAR` (vermelho) ou `⚠️ TESTE A/B` (âmbar) usando `acaoDoTermo(record)`, mantendo a data de `data_resposta`; `manter` renderiza como segmentar.
- [ ] **Step 2: Coluna e filtro de Origem** — nova coluna `Origem` (Tag `Interno` / `Site`, `—` se nulo) visível na aba `responses`; `Select` "Origem: Todas | Interno | Site" ao lado do botão de exportar (estado `originFilter`, padrão `all`), aplicado em `filteredTerms` apenas quando `activeTab==='responses'`.
- [ ] **Step 3: Exportação por tipo na aba `responses`** — o botão "Exportar Termos" abre o modal com `Checkbox.Group` (Segmentar, Negativar, Teste A/B, todos marcados) e `Select` de correspondência da negativa (Exata, Frase, Ampla; padrão Exata); o texto vem de `montarExportacao(termosSelecionadosOuFiltrados, {tipos, matchNegativa})` recalculado a cada mudança; mostrar contagem `total` e `omitidos`; `testeAb` em uma segunda área de texto com botão de copiar próprio. As outras abas mantêm o comportamento atual de exportação.
- [ ] **Step 4: Checagens estáticas** — `npx tsc -p tsconfig.app.json --noEmit` e `npx eslint src/components/SemanticAudit.tsx src/utils/adsExport.ts`. Esperado: sem erros novos (comparar com o estado antes das mudanças se já houver avisos).
- [ ] **Step 5: Verificação visual** — iniciar `dashboard` (`.claude/launch.json`, porta 5173), pedir ao usuário para entrar (login é dele), abrir Triagem de Especialistas > Respostas Cliente e conferir: coluna Origem, filtro, status por ação, modal com as 3 caixas e o seletor de match, texto mudando ao desmarcar um tipo. Se não houver linha respondida, semear uma em `mesa_qualipix` com `execute_sql` e remover depois.
- [ ] **Step 6: Commit**

```bash
git add src/components/SemanticAudit.tsx
git commit -m "feat(front): origem, status por acao e exportacao por tipo em Respostas Cliente"
```

---

### Task 8: Documentação e fechamento

**Files:**
- Modify: `DOCUMENTACAO_TECNICA_SISTEMA_POCKET.md` (seções do banco e do n8n)

- [ ] **Step 1:** Documentar as novas colunas/funções, o filtro "já julgado", o receptor único de votos e a regra de origem (`id_enquete` achado numa `mesa_*` = site). Registrar os `versionId` do n8n antes e depois (para reverter com `restore_workflow_version`).
- [ ] **Step 2:** Registrar como pendências, sem alterar: chave da Evolution em texto puro nos nós; nó de Endomarcas do site gravando em `mesa_qualipix`; `Trigger Refresh Dashboard` do Qualipix com URL de exemplo; ausência de controle de "resposta exportada" (a última opção do voto vence).
- [ ] **Step 3:** `npm test` e `npx tsc -p tsconfig.app.json --noEmit` limpos.
- [ ] **Step 4: Commit**

```bash
git add DOCUMENTACAO_TECNICA_SISTEMA_POCKET.md
git commit -m "docs: filtro ja-julgado e respostas do cliente"
```
