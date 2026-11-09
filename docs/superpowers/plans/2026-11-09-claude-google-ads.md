# Claude do usuário → Pocket → Google Ads — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada usuário do Pocket conecta o próprio Claude ao Pocket por um conector MCP e sobe no Google Ads os termos respondidos pelos clientes (segmentar, negativar, teste A/B), com prévia e confirmação.

**Architecture:** Regras puras em TypeScript sem dependências (`supabase/functions/_shared/pocket-ads/`), testadas com `node --test` e importadas pelas Edge Functions (Deno) e pelo front. Duas Edge Functions: `pocket-mcp` (conector MCP autenticado por link pessoal) e `google-ads-oauth` (conexão Google Ads de cada usuário). O front ganha a view `conectar-claude` e campos de conta no editor de empresas. A skill vive em `claude/skills/pocket-google-ads/` e é empacotada em `.zip`.

**Tech Stack:** React 19 + Vite + TypeScript, Supabase (Postgres, RLS, Edge Functions em Deno), Google Ads API REST, `node --test` (Node 24, type stripping), `fflate` para o `.zip`.

**Spec:** `docs/superpowers/specs/2026-11-09-claude-google-ads-design.md`

## Global Constraints

- Projeto Supabase: `jmptroahcezmpjdplxwy`. Migrações em `supabase/migrations/`, testes SQL em `supabase/tests/` (transação com `rollback`, `assert`).
- Módulos de `_shared/pocket-ads/` não importam nada de Deno, npm ou `src/`; imports relativos com extensão `.ts`; nada de `enum`/`namespace` (`erasableSyntaxOnly`).
- Textos para o usuário em português do Brasil.
- Segredos só em variáveis do Supabase: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `POCKET_CRYPTO_KEY` (32 bytes base64), `POCKET_APP_URL`. Nunca em código, logs, respostas ao Claude ou ao navegador.
- Segmentar = palavra **EXACT, ENABLED**; Teste A/B = **EXACT, PAUSED**; negativas: correspondência `exata|frase|ampla` → `EXACT|PHRASE|BROAD`, padrão `exata`.
- Níveis de negativa: `grupo | campanha | lista | conta`.
- Máximo de 500 termos por chamada de ferramenta.
- Termo enviado com `status in ('ok','ja_existia')` em `envios_google_ads` não volta na listagem (salvo `incluir_ja_subidos`).
- Limites do Google para texto de palavra-chave: até 80 caracteres e até 10 palavras.
- Commits no padrão do repositório (`feat(...)`, `fix(...)`), em pt-BR, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Trabalhar num branch `feat/claude-google-ads`, não na `main`.

## Review Focus

1. Nome no banco com acento, maiúsculas ou espaços diferentes do nome no Google Ads ("Campanha  Institucional" × "campanha institucional") — deve achar o destino. Teste na Task 3.
2. Mesmo termo respondido em duas linhas da mesa (mesmo termo, campanha e grupo) — sobe uma vez só e as duas linhas ficam registradas. Teste na Task 3.
3. `ids` de outro cliente ou inexistentes num `subir_*` — recusado com "termo não pertence a este cliente", nada enviado. Teste na Task 7.
4. Termo com mais de 80 caracteres ou mais de 10 palavras — erro legível já na prévia, sem chamar a API. Teste na Task 3.
5. Refresh token revogado ou expirado (`invalid_grant`) — `status_conexao` diz "reconecte o Google Ads" e o envio devolve o mesmo aviso, sem erro 500. Teste na Task 6.

---

### Task 1: Migração do banco

**Files:**
- Create: `supabase/migrations/20261109120000_claude_google_ads.sql`
- Test: `supabase/tests/claude_google_ads.test.sql`

**Interfaces:**
- Produces (tabelas e colunas usadas pelas Tasks 7–9):
  - `companies.google_ads_customer_id text check (~ '^\d{10}$')`, `companies.google_ads_login_customer_id text check (~ '^\d{10}$')`, ambas nulas por padrão.
  - `claude_conexoes(id uuid pk default gen_random_uuid(), profile_id uuid not null references profiles(id) on delete cascade, token_hash text unique not null, rotulo text, criado_em timestamptz default now(), ultimo_uso timestamptz, revogado_em timestamptz)`.
  - `google_ads_conexoes(profile_id uuid pk references profiles(id) on delete cascade, modo text not null check (modo in ('pocket','proprio')), google_email text, refresh_token_cifrado text not null, developer_token_cifrado text, client_id text, client_secret_cifrado text, login_customer_id text, criado_em, atualizado_em, revogado_em)`.
  - view `minha_conexao_google_ads` (`security_invoker = true`) com `modo, google_email, criado_em, revogado_em` filtrada por `profile_id = auth.uid()`.
  - `google_ads_oauth_estados(estado text pk, profile_id uuid not null, expira_em timestamptz not null)`.
  - `envios_google_ads(id uuid pk, profile_id uuid not null, mesa text not null, linha_id uuid not null, customer_id text not null, tipo text check in ('segmentar','negativar','teste_ab'), nivel text check in ('grupo','campanha','lista','conta'), correspondencia text check in ('exata','frase','ampla'), lista_negativa text, status text check in ('ok','ja_existia','erro'), erro text, resource_name text, criado_em timestamptz default now())` + índice `(mesa, linha_id, tipo)`.

- [ ] **Step 1: Confirmar que `profiles.id = auth.users.id`**

Run (execute_sql): `select count(*) filter (where p.id = u.id) iguais, count(*) total from profiles p join auth.users u on u.email = p.email;`
Expected: `iguais = total`. Se não, parar e avisar: as políticas abaixo dependem disso.

- [ ] **Step 2: Escrever o teste SQL** no molde de `supabase/tests/julgados_respostas.test.sql`, com `assert`s para:
  - as 5 estruturas e as 2 colunas existem;
  - `insert` em `companies.google_ads_customer_id` com `'123-456-7890'` falha (check) e com `'1234567890'` passa;
  - RLS ligada nas 4 tabelas novas; `claude_conexoes` tem política `for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid())`; `google_ads_conexoes`, `google_ads_oauth_estados` e `envios_google_ads` **não** têm política para `anon`/`authenticated` (só `service_role`, que ignora RLS);
  - `has_table_privilege('anon', 'public.claude_conexoes', 'select')` é falso.

- [ ] **Step 3: Rodar o teste e ver falhar** — execute_sql com o arquivo inteiro. Expected: `assert` falha em "tabela claude_conexoes ausente".

- [ ] **Step 4: Escrever a migração** com as estruturas do bloco Interfaces, `revoke all ... from anon` nas tabelas novas, `grant select, insert, update on claude_conexoes to authenticated`, `grant select on minha_conexao_google_ads to authenticated`.

- [ ] **Step 5: Aplicar** com `apply_migration` (nome `claude_google_ads`) — pedir confirmação ao usuário antes, é o banco de produção.

- [ ] **Step 6: Rodar o teste de novo.** Expected: termina no `rollback` sem `assert` falhando. Rodar também `get_advisors` (security) e conferir que nenhum alerta novo cita as tabelas criadas.

- [ ] **Step 7: Commit** `feat(db): tabelas de conexão do Claude e do Google Ads`.

---

### Task 2: Ação do termo e normalização compartilhadas

**Files:**
- Create: `supabase/functions/_shared/pocket-ads/termos.ts`
- Test: `supabase/functions/_shared/pocket-ads/termos.test.ts`
- Modify: `src/utils/adsExport.ts` (passa a reexportar `acaoDoTermo` daqui), `package.json` (`test` inclui `"supabase/functions/_shared/pocket-ads/*.test.ts"`; script `skill:zip` fica para a Task 10)

**Interfaces:**
- Produces:
  - `type TipoAcao = 'segmentar' | 'negativar' | 'teste_ab'`
  - `acaoDoTermo(t: { acao?: string | null; segmentar?: boolean | null; negativar?: boolean | null; teste_ab?: boolean | null }): TipoAcao | null` — mesmas regras de hoje (`manter` → `segmentar`; `acao` desconhecida → `null`; sem `acao`, flags na ordem negativar, teste_ab, segmentar).
  - `normalizarNome(s: string | null | undefined): string` — igual à `_chave_norm` do banco: NFD sem diacríticos, minúsculas, espaços colapsados, `trim`.
  - `semDestino(s: string): boolean` — vazio, `n/a` ou `-`.
  - `validarTextoPalavra(texto: string): string | null` — mensagem de erro em pt-BR se > 80 caracteres ou > 10 palavras; senão `null`.

- [ ] **Step 1: Escrever os testes**: os casos atuais de `acaoDoTermo` de `src/utils/adsExport.test.ts` copiados para cá; `normalizarNome('  Pé  de CABRA ') === 'pe de cabra'`; `normalizarNome(null) === ''`; `validarTextoPalavra('a'.repeat(81))` contém `"80 caracteres"`; `validarTextoPalavra('um dois tres quatro cinco seis sete oito nove dez onze')` contém `"10 palavras"`; `validarTextoPalavra('pe de cabra') === null`.
- [ ] **Step 2: Rodar** `node --test supabase/functions/_shared/pocket-ads/termos.test.ts`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implementar `termos.ts`** e trocar a definição em `adsExport.ts` por `export { acaoDoTermo } from '../../supabase/functions/_shared/pocket-ads/termos.ts'` (o `import` interno de `montarExportacao` usa o mesmo).
- [ ] **Step 4: Rodar** `npm test` e `npx tsc -b`. Expected: tudo PASS, sem erro de tipo.
- [ ] **Step 5: Commit** `refactor(ads): regra da ação do termo num módulo compartilhado`.

---

### Task 3: Resolução de destinos

**Files:**
- Create: `supabase/functions/_shared/pocket-ads/destinos.ts`
- Test: `supabase/functions/_shared/pocket-ads/destinos.test.ts`

**Interfaces:**
- Consumes: `normalizarNome`, `semDestino`, `validarTextoPalavra` (Task 2).
- Produces:
  ```ts
  type Correspondencia = 'exata' | 'frase' | 'ampla';
  type Nivel = 'grupo' | 'campanha' | 'lista' | 'conta';
  interface LinhaTermo { id: string; termo: string; campanha: string; grupo: string }
  interface Catalogo {
    campanhas: { id: string; nome: string; tipoCanal: string }[];          // tipoCanal = advertising_channel_type
    grupos: { id: string; nome: string; campanhaId: string }[];
    existentes: Set<string>;   // chaves de chaveExistente()
  }
  interface Destino { campanhaId: string; grupoId?: string }
  interface ItemResolvido {
    texto: string; idsLinhas: string[]; destino?: Destino;
    situacao: 'ok' | 'ja_existe' | 'erro'; erro?: string;
  }
  type Alvo =
    | { tipo: 'segmentar' | 'teste_ab' }
    | { tipo: 'negativar'; nivel: Nivel; correspondencia: Correspondencia; listaId?: string };
  chaveExistente(escopo: string, texto: string, match: 'EXACT'|'PHRASE'|'BROAD'): string  // escopo = 'g:<id>' | 'c:<id>' | 'l:<id>' | 'conta'
  resolverItens(linhas: LinhaTermo[], catalogo: Catalogo, alvo: Alvo): ItemResolvido[]
  emLotes<T>(itens: T[], tamanho = 500): T[][]
  ```
  Regras de `resolverItens`: campanha por `normalizarNome`; mais de uma → erro "nome de campanha ambíguo"; nenhuma → "campanha não encontrada no Google Ads". Grupo procurado só dentro da campanha (mesmas mensagens com "grupo"). Grupo só é exigido para segmentar, teste A/B e negativa nível `grupo`. Campanha `PERFORMANCE_MAX` com segmentar/teste A/B/nível grupo → erro "campanha Performance Max não tem grupo de anúncios"; nível campanha em PMax → erro "em Performance Max use lista ou conta". Texto inválido → erro de `validarTextoPalavra`. Itens com mesmo texto normalizado e mesmo escopo viram um só, juntando `idsLinhas`. Escopo já presente em `existentes` → `ja_existe`.

- [ ] **Step 1: Escrever os testes** (um `test` por regra), incluindo os itens 1, 2 e 4 da Review Focus:
  - `'Campanha  Institucional'` casa com campanha `'campanha institucional'`;
  - duas linhas iguais → um item com `idsLinhas` `['a','b']`;
  - termo de 81 caracteres → `situacao 'erro'` e nada de destino;
  - duas campanhas com o mesmo nome normalizado → erro ambíguo;
  - PMax + segmentar → erro PMax; PMax + negativar nível `lista` → `ok`;
  - `existentes` com `chaveExistente('g:10','pe de cabra','EXACT')` → `ja_existe` para segmentar no grupo 10;
  - negativar nível `campanha` não exige grupo (linha com grupo `'-'` passa);
  - `emLotes` de 1001 itens → tamanhos `[500, 500, 1]`.
- [ ] **Step 2: Rodar** `node --test supabase/functions/_shared/pocket-ads/destinos.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar `destinos.ts`.**
- [ ] **Step 4: Rodar** o mesmo comando. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ads): resolução de campanha e grupo para envio ao Google Ads`.

---

### Task 4: Operações e leitura de resultado da Google Ads API

**Files:**
- Create: `supabase/functions/_shared/pocket-ads/operacoes.ts`
- Test: `supabase/functions/_shared/pocket-ads/operacoes.test.ts`

**Interfaces:**
- Consumes: `ItemResolvido`, `Alvo`, `Correspondencia` (Task 3).
- Produces:
  ```ts
  const GOOGLE_ADS_API_VERSION: string   // ver Step 1
  interface Mutacao { servico: 'adGroupCriteria' | 'campaignCriteria' | 'sharedCriteria' | 'customerNegativeCriteria';
                      operations: unknown[]; indices: number[] }   // indices: posição do ItemResolvido de cada operação
  montarMutacoes(customerId: string, itens: ItemResolvido[], alvo: Alvo): Mutacao[]
  lerResultado(m: Mutacao, resposta: unknown): { indice: number; ok: boolean; resourceName?: string; erro?: string }[]
  matchDe(c: Correspondencia): 'EXACT' | 'PHRASE' | 'BROAD'
  ```
  Formatos (REST, camelCase): segmentar/teste A/B → `adGroupCriteria` `{create:{adGroup:'customers/C/adGroups/G', status:'ENABLED'|'PAUSED', keyword:{text, matchType:'EXACT'}}}`; negativa grupo → `adGroupCriteria` `{create:{adGroup, negative:true, keyword}}`; campanha → `campaignCriteria` `{create:{campaign:'customers/C/campaigns/X', negative:true, keyword}}`; lista → `sharedCriteria` `{create:{sharedSet:'customers/C/sharedSets/S', keyword}}`; conta → conforme Step 1. Só itens `situacao 'ok'` viram operação. `lerResultado` usa `partialFailureError.details[].errors[].location.fieldPathElements[0].index` para marcar a operação que falhou e devolve a `message` do erro; as demais são `ok` com o `resourceName` de `results[i]`.

- [ ] **Step 1: Confirmar na documentação oficial** (WebFetch em developers.google.com/google-ads/api) a versão estável mais recente da API e como criar negativa no nível da conta (lista de negativas de conta e o recurso que a vincula ao cliente). Registrar a versão em `GOOGLE_ADS_API_VERSION` e o formato no topo do arquivo, com o link. Se a API não suportar, `montarMutacoes` lança `Error('nivel conta indisponível')` para nível `conta`.
- [ ] **Step 2: Escrever os testes**: um por formato acima (comparando o objeto exato da operação); teste A/B tem `status:'PAUSED'`; item `ja_existe` não gera operação; `lerResultado` com resposta de 3 resultados e `partialFailureError` no índice 1 → `[ok, erro com a mensagem, ok]`; `matchDe('frase') === 'PHRASE'`.
- [ ] **Step 3: Rodar** `node --test supabase/functions/_shared/pocket-ads/operacoes.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implementar `operacoes.ts`.**
- [ ] **Step 5: Rodar** o mesmo comando. Expected: PASS.
- [ ] **Step 6: Commit** `feat(ads): montagem das operações da Google Ads API`.

---

### Task 5: Protocolo MCP e cifra

**Files:**
- Create: `supabase/functions/_shared/pocket-ads/mcp.ts`, `supabase/functions/_shared/pocket-ads/cifra.ts`
- Test: `supabase/functions/_shared/pocket-ads/mcp.test.ts`, `supabase/functions/_shared/pocket-ads/cifra.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // mcp.ts
  interface Ferramenta { name: string; description: string; inputSchema: object;
                         executar(args: Record<string, unknown>): Promise<unknown> }
  class ErroUsuario extends Error {}   // mensagem pode ir ao Claude
  responderMcp(corpo: unknown, ferramentas: Ferramenta[], info: { name: string; version: string }):
    Promise<{ status: number; corpo?: unknown }>
  // cifra.ts (WebCrypto, roda em Node 24 e Deno)
  hashToken(segredo: string): Promise<string>            // SHA-256 hex
  novoSegredo(): string                                  // 32 bytes aleatórios, base64url
  cifrar(texto: string, chaveB64: string): Promise<string>    // AES-256-GCM, "iv.base64:dados.base64"
  decifrar(cifrado: string, chaveB64: string): Promise<string>
  ```
  `responderMcp`: aceita objeto ou lote (array). `initialize` → `{protocolVersion, capabilities:{tools:{}}, serverInfo:info}`, onde `protocolVersion` é a pedida pelo cliente se estiver em `['2025-11-25','2025-06-18','2025-03-26']`, senão `'2025-06-18'`. Notificações (sem `id`) → `{status:202}` sem corpo. `ping` → `{}`. `tools/list` → `{tools:[{name, description, inputSchema}]}`. `tools/call` → `{content:[{type:'text', text: JSON.stringify(resultado, null, 2)}]}`; `ErroUsuario` → mesmo formato com `isError:true` e a mensagem; outro erro → `isError:true` e "Erro interno no Pocket" (detalhe só no `console.error`). Método desconhecido → erro JSON-RPC `-32601`; JSON inválido → `-32700`.

- [ ] **Step 1: Escrever os testes**: `initialize` com `'2025-06-18'` devolve a mesma versão e com `'1999-01-01'` devolve `'2025-06-18'`; notificação → 202; `tools/list` lista nomes; `tools/call` de ferramenta que lança `ErroUsuario('x')` → `isError:true` e texto `'x'`; que lança `Error('segredo')` → texto não contém `'segredo'`; método desconhecido → `-32601`. Cifra: `decifrar(cifrar(t,k),k) === t`; duas cifragens do mesmo texto diferem; chave errada rejeita; `hashToken('a')` tem 64 hex; `novoSegredo()` tem 43 caracteres sem `+/=`.
- [ ] **Step 2: Rodar** `node --test supabase/functions/_shared/pocket-ads/mcp.test.ts supabase/functions/_shared/pocket-ads/cifra.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar os dois módulos.**
- [ ] **Step 4: Rodar** o mesmo comando. Expected: PASS.
- [ ] **Step 5: Commit** `feat(mcp): protocolo MCP mínimo e cifra de tokens`.

---

### Task 6: Cliente da Google Ads API

**Files:**
- Create: `supabase/functions/_shared/pocket-ads/googleAds.ts`
- Test: `supabase/functions/_shared/pocket-ads/googleAds.test.ts`

**Interfaces:**
- Consumes: `GOOGLE_ADS_API_VERSION`, `Mutacao` (Task 4); `Catalogo`, `chaveExistente` (Task 3).
- Produces:
  ```ts
  interface Credenciais { developerToken: string; clientId: string; clientSecret: string;
                          refreshToken: string; loginCustomerId?: string }
  class ErroConexaoGoogle extends ErroUsuario {}   // "Reconecte o Google Ads em Pocket › Conectar ao Claude."
  criarClienteAds(cred: Credenciais, f: typeof fetch = fetch): {
    pesquisar(customerId: string, gaql: string): Promise<Record<string, unknown>[]>;   // googleAds:search, segue nextPageToken
    mutar(customerId: string, m: Mutacao, validateOnly: boolean): Promise<unknown>;     // POST customers/C/<servico>:mutate, partialFailure:true
    contasAcessiveis(): Promise<string[]>;                                               // customers:listAccessibleCustomers
  }
  carregarCatalogo(ads: ReturnType<typeof criarClienteAds>, customerId: string, escopos: string[]): Promise<Catalogo>
  ```
  Access token via `POST https://oauth2.googleapis.com/token` (`grant_type=refresh_token`), guardado na instância até expirar. Cabeçalhos: `Authorization`, `developer-token`, `login-customer-id` (quando houver). `invalid_grant` → `ErroConexaoGoogle`; 403 `USER_PERMISSION_DENIED` → `ErroUsuario('Sua conta Google não tem acesso à conta <id> do Google Ads.')`; outros erros → `ErroUsuario` com a primeira `message` do Google. `carregarCatalogo` faz as consultas GAQL de campanhas (`campaign.status != 'REMOVED'`, com `advertising_channel_type`), grupos e palavras/negativas existentes nos escopos pedidos (ad_group_criterion, campaign_criterion, shared_criterion) e monta `existentes` com `chaveExistente`.

- [ ] **Step 1: Escrever os testes** com `fetch` falso: troca de token chamada uma vez para duas consultas; `login-customer-id` enviado quando informado e ausente quando não; paginação junta duas páginas; resposta `{"error":"invalid_grant"}` no token → `ErroConexaoGoogle` (item 5 da Review Focus); 403 `USER_PERMISSION_DENIED` → mensagem com o ID da conta; `mutar` envia `validateOnly:true` e `partialFailure:true`.
- [ ] **Step 2: Rodar** `node --test supabase/functions/_shared/pocket-ads/googleAds.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar `googleAds.ts`.**
- [ ] **Step 4: Rodar** o mesmo comando. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ads): cliente da Google Ads API com renovação de token`.

---

### Task 7: Edge Function `pocket-mcp`

**Files:**
- Create: `supabase/functions/pocket-mcp/index.ts`, `supabase/functions/pocket-mcp/ferramentas.ts`
- Test: `supabase/functions/_shared/pocket-ads/ferramentas.test.ts` (as ferramentas recebem as dependências por parâmetro, então o teste roda no Node)
- Modify: `supabase/config.toml` (criar se não existir) com `[functions.pocket-mcp] verify_jwt = false`

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces: `criarFerramentas(dep: { perfil: { id: string; isAdmin: boolean; empresas: string[] }; db: Repositorio; ads: (cred) => ReturnType<typeof criarClienteAds>; credenciais: () => Promise<Credenciais | null> }): Ferramenta[]` em `supabase/functions/_shared/pocket-ads/ferramentas.ts`, com `Repositorio` = interface de leitura/escrita (`empresasDoPerfil`, `linhasRespondidas(mesa)`, `linhasPorIds(mesa, ids)`, `jaSubidos(mesa, tipo)`, `registrarEnvios(registros)`) implementada em `pocket-mcp/index.ts` com `npm:@supabase/supabase-js@2` e `service_role`.
  - Ferramentas e parâmetros exatamente como na seção 2 da spec: `status_conexao`, `listar_clientes`, `listar_termos_respondidos(cliente, tipo, incluir_ja_subidos?)`, `listar_listas_negativas(cliente)`, `subir_segmentadas(cliente, ids, modo)`, `subir_teste_ab(cliente, ids, modo)`, `subir_negativas(cliente, ids, nivel, correspondencia?, lista?: { id?: string; nome?: string; criar?: boolean }, modo)`. `cliente` aceita nome (comparado com `normalizarNome`) ou `id`. As descrições das ferramentas dizem que `modo:"gravar"` só pode ser usado depois da prévia e do "ok" do usuário.
  - Lista nova (`lista.criar`): cria `sharedSets` `{name, type:'NEGATIVE_KEYWORDS'}` e vincula às campanhas dos termos (`campaignSharedSets`), só no modo `gravar`.
  - Retorno de `subir_*`: `{ modo, cliente, conta, resumo: {ok, ja_existe, erro}, itens: [{ termo, campanha, grupo?, situacao, erro? }] }`.
  - `status_conexao` testa a conexão com `contasAcessiveis()`; `ErroConexaoGoogle` vira `google_ads: "reconectar"` na resposta, sem erro.
- `index.ts`: extrai o segredo do último segmento do caminho, `hashToken`, busca `claude_conexoes` ativa (sem achar → 401 com corpo vazio), atualiza `ultimo_uso`, carrega perfil e `google_ads_conexoes`, monta `Credenciais` (modo `pocket`: segredos do Pocket + refresh token decifrado; modo `proprio`: tudo decifrado da linha). `loginCustomerId` por cliente: o da conexão própria, senão `companies.google_ads_login_customer_id`, senão nenhum. Aceita só `POST` (GET → 405), chama `responderMcp`. Nunca registra o caminho da URL em log.

- [ ] **Step 1: Escrever os testes** de `ferramentas.ts` com repositório e Google Ads falsos: perfil sem a empresa → `ErroUsuario` "cliente fora do seu acesso"; `ids` de outra mesa ou inexistentes → `ErroUsuario` "termo não pertence a este cliente" e `mutar` não é chamado (item 3 da Review Focus); empresa sem `google_ads_customer_id` → mensagem para o admin; sem credenciais → caminho "Pocket › Conectar ao Claude › Conectar Google Ads"; `listar_termos_respondidos` esconde ids já subidos e mostra com `incluir_ja_subidos:true`; `previa` chama `mutar(..., true)` e não chama `registrarEnvios`; `gravar` chama `mutar(..., false)` e registra uma linha por `idsLinhas` com o status; 501 ids → `ErroUsuario` pedindo para dividir; `status_conexao` com Google Ads que lança `ErroConexaoGoogle` → `google_ads: "reconectar"` (item 5 da Review Focus).
- [ ] **Step 2: Rodar** `node --test supabase/functions/_shared/pocket-ads/ferramentas.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar `ferramentas.ts` e `pocket-mcp/index.ts`.**
- [ ] **Step 4: Rodar** `npm test`. Expected: PASS.
- [ ] **Step 5: Publicar** com `deploy_edge_function` (`pocket-mcp`, `verify_jwt: false`, enviando `index.ts` e os arquivos de `_shared/pocket-ads/` usados) — pedir confirmação antes.
- [ ] **Step 6: Testar no ar** com um link criado à mão (inserir `claude_conexoes` com o hash de um segredo de teste para o seu perfil):
  `curl -s -X POST <url>/<segredo> -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` → lista as 7 ferramentas; o mesmo com segredo errado → 401. Depois, `tools/call` de `listar_clientes` mostra só os clientes do perfil. Apagar o link de teste ao fim.
- [ ] **Step 7: Commit** `feat(mcp): conector do Pocket para o Claude`.

---

### Task 8: Edge Function `google-ads-oauth`

**Files:**
- Create: `supabase/functions/google-ads-oauth/index.ts`
- Test: `supabase/functions/_shared/pocket-ads/oauth.test.ts` + `supabase/functions/_shared/pocket-ads/oauth.ts` (regras puras)
- Modify: `supabase/config.toml` (`[functions.google-ads-oauth] verify_jwt = false`; a função valida o JWT ela mesma nas rotas que exigem)

**Interfaces:**
- Consumes: `cifrar`, `novoSegredo` (Task 5); `criarClienteAds().contasAcessiveis` (Task 6).
- Produces (`oauth.ts`): `urlAutorizacao(clientId: string, redirectUri: string, estado: string): string` (escopos `https://www.googleapis.com/auth/adwords openid email`, `access_type=offline`, `prompt=consent`, `response_type=code`); `urlRetornoPocket(appUrl: string, r: { ok: true } | { ok: false; motivo: string }): string` (`<appUrl>/?view=conectar-claude&google_ads=ok|erro&motivo=…`); `validarDadosProprios(d): string | null` (mensagem se faltar campo ou se IDs não tiverem 10 dígitos após remover traços).
- Rotas (`index.ts`): `POST /iniciar`, `GET /retorno`, `POST /proprio`, `POST /desconectar`, comportamento da seção 3 da spec. `redirectUri = <SUPABASE_URL>/functions/v1/google-ads-oauth/retorno`. CORS igual ao de `import-sheets-data`. Estado expirado/inexistente → retorno com `motivo=expirou`. Recusa no Google (`error=access_denied`) → `motivo=recusado`.

- [ ] **Step 1: Escrever os testes** de `oauth.ts`: URL contém os três escopos, `prompt=consent` e o estado; retorno de erro codifica o motivo; `validarDadosProprios` aceita `'123-456-7890'` e recusa `'12345'`.
- [ ] **Step 2: Rodar** `node --test supabase/functions/_shared/pocket-ads/oauth.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar `oauth.ts` e `google-ads-oauth/index.ts`.**
- [ ] **Step 4: Rodar** `npm test`. Expected: PASS.
- [ ] **Step 5: Pedir ao usuário** que cadastre os segredos (`GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `POCKET_CRYPTO_KEY`, `POCKET_APP_URL`) no painel do Supabase e o redirect URI no Google Cloud, seguindo a parte C do tutorial (Task 10). Não pedir valores no chat.
- [ ] **Step 6: Publicar** com `deploy_edge_function` — pedir confirmação antes.
- [ ] **Step 7: Commit** `feat(ads): conexão do Google Ads por usuário (botão Google e modo avançado)`.

---

### Task 9: Tela "Conectar ao Claude" e campos da empresa

**Files:**
- Create: `src/components/ConectarClaude.tsx`, `src/utils/conexaoClaude.ts`
- Test: `src/utils/conexaoClaude.test.ts`
- Modify: `src/components/shell/navigation.ts` (`AppView` ganha `'conectar-claude'`; seção nova `'Conta'` com `{ id: 'conectar-claude', name: 'Conectar ao Claude', icon: Bot, keywords: 'claude ia conector google ads mcp' }`, fora de `ADMIN_ONLY`), `src/App.tsx` (renderiza a view; ao montar lê `?view=` válido e limpa a query com `history.replaceState`), `src/components/CompanyManager.tsx` e `src/types.ts` (campos `googleAdsCustomerId`, `googleAdsLoginCustomerId`, só para admin)

**Interfaces:**
- Consumes: tabelas da Task 1; rotas da Task 8; `novoSegredo`, `hashToken` (Task 5).
- Produces (`conexaoClaude.ts`): `urlConector(supabaseUrl: string, segredo: string): string`; `limparIdConta(s: string): string | null` (remove traços e espaços; `null` se não ficar com 10 dígitos); `lerRetornoGoogle(search: string): { view?: AppView; googleAds?: 'ok' | 'erro'; motivo?: string }`.
- Tela: cartão 1 (gerar link com rótulo → `novoSegredo` no navegador, insere `token_hash` em `claude_conexoes`, mostra a URL uma vez com copiar; lista links ativos com rótulo, criação, último uso, "Revogar" = `revogado_em = now()`; botão "Baixar skill (.zip)" → `/downloads/pocket-google-ads.zip`; 4 passos do `CONECTAR.md`). Cartão 2 (lê `minha_conexao_google_ads`; "Conectar com Google" → `supabase.functions.invoke('google-ads-oauth/iniciar')` e `location.assign(url)`; "Desconectar"; "Modo avançado" recolhido com os 5 campos → `google-ads-oauth/proprio`, mostrando as contas acessíveis no sucesso; link para o tutorial). Toast com o resultado de `?google_ads=`. Visual com os componentes e tokens da repaginação (`docs/superpowers/specs/2026-11-06-repaginacao-pocket-design.md`).

- [ ] **Step 1: Escrever os testes** de `conexaoClaude.ts`: `limparIdConta('123-456-7890') === '1234567890'`, `limparIdConta('123') === null`; `lerRetornoGoogle('?view=conectar-claude&google_ads=erro&motivo=recusado')` devolve os três campos; `?view=xyz` (view inexistente) → `view` indefinido; `urlConector('https://x.supabase.co','abc') === 'https://x.supabase.co/functions/v1/pocket-mcp/abc'`.
- [ ] **Step 2: Rodar** `node --test src/utils/conexaoClaude.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar `conexaoClaude.ts`, a tela e as alterações de navegação, App e empresas.**
- [ ] **Step 4: Rodar** `npm test`, `npx tsc -b` e `npm run lint`. Expected: sem falhas.
- [ ] **Step 5: Verificar no navegador** (preview `dashboard`): o item "Conectar ao Claude" aparece para usuário comum; gerar link mostra a URL uma vez e o link aparece na lista; revogar some da lista ativa; abrir `/?view=conectar-claude&google_ads=ok` abre a tela com o aviso de sucesso; o editor de empresas aceita `123-456-7890` e grava `1234567890`. Screenshot do resultado.
- [ ] **Step 6: Commit** `feat(front): tela Conectar ao Claude e conta Google Ads da empresa`.

---

### Task 10: Skill, guias e pacote

**Files:**
- Create: `claude/skills/pocket-google-ads/SKILL.md`, `claude/skills/pocket-google-ads/CONECTAR.md`, `claude/skills/pocket-google-ads/TUTORIAL_GOOGLE_ADS.md`, `scripts/zip-skill.mjs`, `public/downloads/pocket-google-ads.zip` (gerado)
- Test: `scripts/zip-skill.test.mjs`
- Modify: `package.json` (`"skill:zip": "node scripts/zip-skill.mjs"`; `fflate` em `devDependencies`; `test` inclui `"scripts/*.test.mjs"`)

**Interfaces:**
- Consumes: nomes e parâmetros das ferramentas (Task 7); textos de caminho da tela (Task 9).
- Produces: `zipSkill(origem: string, destino: string): Promise<string[]>` (devolve os caminhos dentro do zip, todos sob `pocket-google-ads/`).
- `SKILL.md`: frontmatter `name: pocket-google-ads` e `description` em pt-BR com os gatilhos (subir/enviar termos respondidos, segmentadas, negativadas, teste A/B, Pocket, Google Ads). Corpo = o fluxo de 7 passos e as regras da seção 5 da spec, com os nomes exatos das ferramentas, o formato das tabelas a mostrar e a frase de confirmação esperada. Até ~300 linhas, sem repetir o tutorial (aponta para `CONECTAR.md` e `TUTORIAL_GOOGLE_ADS.md`).
- `CONECTAR.md` e `TUTORIAL_GOOGLE_ADS.md`: conteúdo das partes descritas na seção 5 da spec (A, B, C), com os nomes atuais dos menus do claude.ai, do Google Ads e do Google Cloud conferidos na documentação oficial no momento da escrita (WebFetch), e o comando do Claude Code `claude mcp add --transport http pocket <link>`.

- [ ] **Step 1: Escrever o teste** de `zipSkill`: zipa uma pasta temporária com `SKILL.md` e `a/b.md` e confere que `unzipSync` devolve `pocket-google-ads/SKILL.md` e `pocket-google-ads/a/b.md` com o mesmo conteúdo.
- [ ] **Step 2: Rodar** `node --test scripts/zip-skill.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementar `scripts/zip-skill.mjs`** com `fflate` e instalar a dependência (`npm i -D fflate`).
- [ ] **Step 4: Escrever `SKILL.md`, `CONECTAR.md` e `TUTORIAL_GOOGLE_ADS.md`.**
- [ ] **Step 5: Rodar** `npm test` e `npm run skill:zip`. Expected: PASS e `public/downloads/pocket-google-ads.zip` criado.
- [ ] **Step 6: Validar a skill** com a skill `skill-creator` (estrutura e frontmatter) e corrigir o que ela apontar.
- [ ] **Step 7: Commit** `feat(skill): skill pocket-google-ads, guias de conexão e pacote`.

---

### Task 11: Ponta a ponta e documentação

**Files:**
- Modify: `docs/julgados-e-respostas-cliente.md` (pendência "sem controle de resposta exportada" passa a apontar para `envios_google_ads`), `DOCUMENTACAO_TECNICA_SISTEMA_POCKET.md` (seção nova "Claude e Google Ads": tabelas, funções, segredos, como revogar)

- [ ] **Step 1: Conector num Claude real**: gerar um link na tela, adicionar no Claude Code com `claude mcp add --transport http pocket <link>` e copiar a skill para `~/.claude/skills/`. Pedir "quais clientes eu tenho no Pocket?" → lista igual à do banco.
- [ ] **Step 2: Prévia contra uma conta real** (com o Google Ads conectado pelo botão): "subir as negativadas da <cliente>" → o Claude mostra termo + campanha, pergunta nível e correspondência, roda a prévia e para pedindo "ok". Conferir que nada mudou na conta.
- [ ] **Step 3: Gravação numa conta de teste do Google Ads** (conta de teste sob um MCC de teste; o developer token funciona nela mesmo sem aprovação): segmentar 1 termo, teste A/B 1 termo (fica pausado), negativa nos 4 níveis. Conferir na interface do Google Ads e em `envios_google_ads`; pedir a lista de novo e ver que os termos sumiram.
- [ ] **Step 4: Atualizar os dois documentos.**
- [ ] **Step 5: Rodar** `npm test`, `npx tsc -b`, `npm run lint`. Expected: sem falhas.
- [ ] **Step 6: Commit** `docs: conexão do Claude e envio ao Google Ads`.
