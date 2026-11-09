# Claude do usuário → Pocket → Google Ads — design aprovado (09/11/2026)

## Objetivo
Cada usuário do Pocket conecta o próprio Claude (claude.ai, app ou Claude Code) ao Pocket.
O Claude passa a ler os termos que os clientes já responderam e, a pedido do usuário,
sobe esses termos na conta de Google Ads do cliente:

- **Segmentadas**: mostra termo + campanha + grupo, pede "ok", adiciona como palavra-chave.
- **Negativadas**: mostra termo + campanha, pergunta nível e correspondência, pede "ok", negativa.
- **Teste A/B**: mesmo fluxo das segmentadas; a palavra entra pausada.

Funciona para qualquer usuário, inclusive quem não tem tokens da API do Google Ads.

## Decisões do usuário
- Quem grava no Google Ads é o **Pocket** (Edge Function), não um conector do Claude. O conector
  `google-ads` desta máquina só lê (search/labels/assets) e não serve para gravar.
- Claude alvo: **claude.ai e app** (vale também para o Claude Code). O Pocket vira um **conector MCP remoto**.
- Identificação do usuário no conector: **link pessoal** gerado no Pocket, revogável.
- Teste A/B no Google Ads: **palavra-chave exata pausada** no grupo de origem.
- Níveis de negativa oferecidos: **grupo, campanha, lista compartilhada e conta**.
- Conexão do Google Ads de cada usuário: **os dois modos**
  - *Botão Google* (padrão): o usuário autoriza com a conta Google; o Pocket usa o token de
    desenvolvedor do dono do Pocket para todos.
  - *Modo avançado*: o usuário cola os próprios tokens (developer token, OAuth client, refresh token, MCC).
- O dono do Pocket já tem token de desenvolvedor aprovado e MCC.

## Visão geral

```
Claude do usuário ──MCP (link pessoal)──► Edge Function pocket-mcp ──► Supabase (mesa_*, companies, logs)
                                                   │
                                                   └──► Google Ads API (credenciais do próprio usuário)
Pocket (navegador) ──► tela "Conectar ao Claude" ──► Edge Function google-ads-oauth ──► Google OAuth
```

## 1. Banco (uma migração nova)

### `companies`
- `google_ads_customer_id text` — 10 dígitos, sem traços. Só admin edita (tela de empresas).
- `google_ads_login_customer_id text` — MCC pelo qual a conta é acessada (opcional).

### `claude_conexoes` — links pessoais do conector
`id uuid`, `profile_id uuid → profiles`, `token_hash text unique` (SHA-256 do segredo),
`rotulo text` (ex.: "Notebook"), `criado_em`, `ultimo_uso`, `revogado_em`.
O segredo (32 bytes aleatórios, base64url) aparece uma única vez ao gerar. Um usuário pode ter
vários links ativos. RLS: o usuário vê e revoga só os próprios; nenhuma política para `anon`.

### `google_ads_conexoes` — conexão Google Ads de cada usuário
`profile_id uuid primary key → profiles`, `modo text check in ('pocket','proprio')`,
`google_email text`, `refresh_token_cifrado text`, e só no modo próprio:
`developer_token_cifrado text`, `client_id text`, `client_secret_cifrado text`, `login_customer_id text`.
Mais `criado_em`, `atualizado_em`, `revogado_em`.
Campos `*_cifrado` usam AES-256-GCM com a chave `POCKET_CRYPTO_KEY` (segredo do Supabase),
cifrados e decifrados só dentro das Edge Functions. RLS: o usuário lê apenas
`modo, google_email, criado_em, revogado_em` da própria linha (via view); escrita só por `service_role`.

### `google_ads_oauth_estados` — estado temporário do botão Google
`estado text primary key`, `profile_id`, `expira_em` (10 min). Apagado ao usar.

### `envios_google_ads` — registro de cada termo enviado
`id`, `profile_id`, `mesa text`, `linha_id uuid`, `customer_id`, `tipo` (`segmentar|negativar|teste_ab`),
`nivel` (`grupo|campanha|lista|conta`, só negativas), `correspondencia` (`exata|frase|ampla`),
`lista_negativa text`, `status` (`ok|ja_existia|erro`), `erro text`, `resource_name text`, `criado_em`.
Uma linha com `status in ('ok','ja_existia')` marca o termo como "já subido" para aquele tipo.
Resolve a pendência "sem controle de resposta exportada" de `docs/julgados-e-respostas-cliente.md`.

## 2. Conector MCP — Edge Function `pocket-mcp`

- URL: `https://jmptroahcezmpjdplxwy.supabase.co/functions/v1/pocket-mcp/<segredo>`; `verify_jwt = false`.
- Cada requisição: calcula o hash do segredo, acha o link ativo, atualiza `ultimo_uso`, carrega o perfil.
  Link inválido ou revogado → 401 sem detalhes.
- Transporte MCP Streamable HTTP, sem estado, respostas `application/json`. O protocolo (JSON-RPC:
  `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`) é implementado num módulo
  próprio sem dependências, testável no `npm test`, em vez do SDK (evita incompatibilidade com o Deno).
- Acesso a dados com `service_role`, sempre filtrado pelos clientes do perfil:
  `assigned_company_ids` ou todos se `is_admin`.

### Ferramentas
| Ferramenta | O que faz |
|---|---|
| `status_conexao` | Diz quem é o usuário, se o Google Ads está conectado (modo, e-mail) e quais clientes têm conta configurada. |
| `listar_clientes` | Clientes do usuário: nome, mesa, `customer_id` (ou "não configurado"), contagem de termos respondidos ainda não subidos por tipo. |
| `listar_termos_respondidos(cliente, tipo, incluir_ja_subidos=false)` | Linhas com `respondido_cliente = true` cuja ação (regra de `acaoDoTermo`, `manter` = segmentar) é `tipo`. Devolve `id`, termo, palavra-chave, campanha, grupo, data da resposta, observação. Omite as que não têm campanha ou grupo e informa quantas. |
| `listar_listas_negativas(cliente)` | Listas de negativas compartilhadas da conta (nome, id, nº de termos). |
| `subir_segmentadas(cliente, ids, modo)` | Palavra-chave **exata, ativa** no grupo de origem. |
| `subir_teste_ab(cliente, ids, modo)` | Palavra-chave **exata, pausada** no grupo de origem. |
| `subir_negativas(cliente, ids, nivel, correspondencia, lista?, modo)` | Negativa no grupo, na campanha, numa lista compartilhada (existente pelo nome, ou criada se `lista.criar = true`) ou na conta. |

`modo`:
- `previa` — resolve nomes e chama a API com `validateOnly: true`. Nada é gravado. Devolve, por termo:
  destino encontrado (ids), `ok`, `ja_existe` ou erro legível (campanha não encontrada, nome ambíguo,
  sem permissão na conta, campanha PMax sem grupo…).
- `gravar` — mesma resolução, chamada real com `partialFailure: true`; grava um registro em
  `envios_google_ads` por termo e devolve o resumo (`ok`, `ja_existia`, `erro`).

### Regras de gravação
- Permissão: o cliente precisa estar entre os do usuário; senão erro "cliente fora do seu acesso".
- Conta: `companies.google_ads_customer_id`; se vazio, erro pedindo ao admin que configure.
- Credenciais: as da `google_ads_conexoes` do usuário que chamou. Sem conexão → erro com o caminho
  "Pocket › Conectar ao Claude › Conectar Google Ads".
  - modo `pocket`: developer token e OAuth client do Pocket (segredos) + refresh token do usuário.
  - modo `proprio`: tudo do usuário.
  - `login-customer-id`: o da conexão própria, senão o `google_ads_login_customer_id` do cliente, senão nenhum.
- Resolução de destino por nome, comparando com a mesma normalização da `_chave_norm`
  (minúsculas, sem acento, espaços colapsados), ignorando itens `REMOVED`. Mais de um resultado → "nome ambíguo".
- Duplicatas: palavra/negativa já existente com o mesmo texto e correspondência → `ja_existe`/`ja_existia`, sem erro.
- Termos repetidos no mesmo pedido (mesmo destino) são enviados uma vez só.
- Campanha Performance Max (sem grupo): segmentar e Teste A/B → erro "PMax não tem grupo";
  negativas só nos níveis lista ou conta.
- Nível **conta**: usa a lista de negativas no nível da conta suportada pela API
  (shared set do tipo de negativas de conta, vinculado ao cliente). Se a versão da API em uso não
  suportar, `previa` devolve "nível conta indisponível" e a skill sugere lista compartilhada.
- Versão da Google Ads API: a estável mais recente no momento da implementação, numa única constante.
- Limite: no máximo 500 termos por chamada; a skill divide pedidos maiores.

## 3. Conexão do Google Ads — Edge Function `google-ads-oauth`

- `POST /iniciar` (exige o JWT do Pocket): cria `google_ads_oauth_estados` e devolve a URL do Google
  (`scope = https://www.googleapis.com/auth/adwords openid email`, `access_type=offline`, `prompt=consent`).
- `GET /retorno` (redirect URI cadastrado no Google Cloud): valida e apaga o estado, troca o código por
  tokens, lê o e-mail, cifra e grava o refresh token (`modo = 'pocket'`), redireciona para
  `<POCKET_APP_URL>/?view=conectar-claude&google_ads=ok` (ou `google_ads=erro&motivo=…`).
  O Pocket troca de tela por estado (`AppView`), então o `App` lê `?view=` ao abrir.
- `POST /proprio` (exige JWT): recebe os tokens do modo avançado, testa com
  `customers:listAccessibleCustomers`; só grava se o teste passar e devolve as contas acessíveis.
- `POST /desconectar` (exige JWT): marca `revogado_em` e revoga o refresh token no Google.
- Segredos: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `POCKET_CRYPTO_KEY`, `POCKET_APP_URL`.

## 4. Pocket — tela "Conectar ao Claude" (view `conectar-claude`)

Item novo na sidebar, numa seção "Conta", visível para todo usuário logado (não só admin).
Dois cartões no visual da repaginação:

1. **Conectar o Claude** — "Gerar link" (rótulo opcional) mostra o link uma vez com botão copiar;
   lista de links com último uso e "Revogar"; botão "Baixar skill (.zip)"; passo a passo curto.
2. **Conectar o Google Ads** — estado atual (conectado como e-mail / modo); botão "Conectar com Google";
   "Desconectar"; seção recolhida "Modo avançado" com os campos dos tokens próprios e link para o tutorial.

Tela de empresas (admin): campos "ID da conta Google Ads" e "MCC (opcional)", com validação de 10 dígitos
(aceita colar com traços e remove).

## 5. Skill `pocket-google-ads`

Pasta `claude/skills/pocket-google-ads/` no repositório; `npm run skill:zip` gera
`public/downloads/pocket-google-ads.zip` (baixado pela tela). Conteúdo:

- `SKILL.md` (pt-BR) — quando usar: o usuário fala em subir/enviar termos respondidos, segmentadas,
  negativadas, teste A/B, Pocket. Fluxo:
  1. `status_conexao`; se faltar algo, explica o passo e para.
  2. Identifica o cliente (pergunta se houver mais de um possível) e o tipo.
  3. `listar_termos_respondidos` e mostra a tabela:
     - segmentar / teste A/B: Termo | Campanha | Grupo de anúncios;
     - negativar: Termo | Campanha (e grupo de origem).
     Permite o usuário tirar termos da lista.
  4. Negativas: pergunta o **nível** (grupo, campanha, lista compartilhada — mostra
     `listar_listas_negativas` e oferece criar —, conta) e a **correspondência** (exata padrão, frase, ampla).
     Teste A/B: avisa que entram pausadas.
  5. Roda `modo: "previa"` e mostra o que vai acontecer e o que falharia.
  6. Pede confirmação explícita ("ok", "pode subir"). Sem confirmação, não grava.
  7. Roda `modo: "gravar"` e mostra o resumo: subidos, já existiam, erros com o motivo.
  Regras: nunca inventar termo, campanha ou grupo; nunca gravar sem a prévia e o "ok" do mesmo pedido;
  pedidos acima de 500 termos em partes.
- `CONECTAR.md` — como adicionar o conector (claude.ai/app: Configurações › Conectores ›
  Adicionar conector personalizado › colar o link; Claude Code: `claude mcp add --transport http pocket <link>`)
  e como enviar a skill (Configurações › Skills › enviar o .zip; Claude Code: copiar a pasta para `~/.claude/skills/`).
- `TUTORIAL_GOOGLE_ADS.md` — também exibido na tela:
  - **A. Usuário, botão Google**: 3 passos (Conectar com Google → escolher a conta que acessa o Google Ads → Permitir).
  - **B. Usuário, modo avançado**: ter acesso a um MCC; pedir o token de desenvolvedor na Central da API do MCC;
    criar projeto no Google Cloud e ativar a Google Ads API; criar a tela de consentimento e um cliente OAuth
    (tipo Aplicativo da Web, redirect do OAuth Playground); gerar o refresh token no OAuth Playground com o
    escopo `adwords`; colar developer token, client ID/secret, refresh token e ID do MCC no Pocket.
  - **C. Dono do Pocket, uma vez**: cadastrar os segredos no Supabase; no Google Cloud, adicionar o redirect
    `…/functions/v1/google-ads-oauth/retorno`; publicar a tela de consentimento em Produção e pedir a
    verificação do escopo `adwords` (até sair: só usuários de teste e autorização expira em 7 dias);
    pedir acesso Padrão do token quando passar de 15 mil operações/dia.

## 6. Organização do código

- Regras puras em `supabase/functions/_shared/pocket-ads/` (TypeScript sem dependências de Deno):
  ação do termo (porta de `acaoDoTermo`), normalização de nomes, escolha de destino, montagem das
  operações da API por tipo/nível, leitura do resultado com `partialFailure`, divisão em lotes.
- `src/utils/adsExport.ts` passa a importar `acaoDoTermo` desse módulo (uma regra só).
- Cliente HTTP da Google Ads API e cifra em módulos próprios dentro de `_shared/`.
- Tela em `src/components/ConectarClaude.tsx`; campos novos no editor de empresas existente.

## 7. Erros e segurança

- Link do conector = senha: só o hash no banco, revogável, sem aparecer em logs.
- Tokens Google cifrados; nunca devolvidos ao navegador nem ao Claude.
- Toda ferramenta de gravação re-checa o acesso ao cliente no servidor; o Claude não decide permissão.
- Erros da API viram mensagens curtas em português com o termo afetado; o erro bruto vai para `envios_google_ads.erro`.
- Refresh token revogado/expirado → `status_conexao` mostra "reconectar o Google Ads".

## 8. Testes

- `node --test` (entra no `npm test`) para o módulo puro: ação do termo, normalização, ambiguidade,
  duplicatas no mesmo pedido, montagem de operações para cada tipo e nível, PMax, lotes de 500,
  leitura de falha parcial.
- Teste SQL da migração em `supabase/tests/` (RLS dos links e da view de conexão), no molde do existente.
- Ponta a ponta: conector no MCP Inspector e num Claude real; `previa` contra uma conta real;
  `gravar` numa conta de teste do Google Ads; botão Google com um usuário de teste.

## Fora do escopo
- Desfazer envios pelo Claude.
- Escolher correspondência diferente de exata para segmentadas.
- OAuth do Pocket no conector (fica o link pessoal).
- Dúvidas (`DUVIDA`) — não sobem para o Google Ads.
