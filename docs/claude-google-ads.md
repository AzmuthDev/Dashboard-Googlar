# Claude do usuário → Pocket → Google Ads

Cada usuário conecta o próprio Claude (claude.ai, app ou Claude Code) ao Pocket por um conector MCP.
O Claude lê os termos que o cliente já respondeu e, a pedido do usuário, sobe esses termos na conta de
Google Ads do cliente. Quem grava no Google Ads é o Pocket (Edge Function), não um conector do Claude.

Spec: `docs/superpowers/specs/2026-11-09-claude-google-ads-design.md` (a spec e o plano ainda listam o
token de desenvolvedor como obrigatório; vale o que está neste documento).

## 1. Visão geral

```
Claude ──MCP (link pessoal)──► pocket-mcp ──► Supabase (mesa_*, companies, envios_google_ads)
                                   └────────► Google Ads API (credenciais do próprio usuário)
Pocket (navegador) ──► tela "Conectar ao Claude" ──► google-ads-oauth ──► Google OAuth
```

Conexão do Google Ads com o botão "Conectar com Google" (confirmação em dois passos):

1. `POST /iniciar` (JWT do Pocket) cria o estado e devolve a URL do Google; o navegador guarda o estado em
   `sessionStorage` (`pocket_google_ads_estado`).
2. O Google chama `GET /retorno`: o Pocket troca o código por tokens e guarda, na linha do estado, o refresh
   token cifrado, o e-mail e o SHA-256 de um código de confirmação. Redireciona para
   `<POCKET_APP_URL>/?view=conectar-claude&google_ads=confirmar&confirmacao=<código>`.
3. O navegador chama `POST /confirmar {estado, confirmacao}` (JWT). Só conclui se o usuário do JWT é o dono
   do estado, o hash confere e o estado não expirou; aí grava em `google_ads_conexoes` (`modo = 'pocket'`)
   e apaga o estado. Isso impede que alguém capture a autorização de um colega (o atacante sabe o estado,
   mas nunca vê o código).

## 2. Banco

Migrações (aplicar nesta ordem, antes de publicar as funções):
`supabase/migrations/20261109120000_claude_google_ads.sql` e `20261109130000_oauth_confirmacao.sql`.

| Tabela | Colunas principais | Acesso |
|---|---|---|
| `companies` (colunas novas) | `google_ads_customer_id`, `google_ads_login_customer_id` (10 dígitos, check `^\d{10}$`) | como já era; só admin edita na tela de empresas (restrição só na UI, ver §9) |
| `claude_conexoes` | `id`, `profile_id`, `token_hash` (unique), `rotulo`, `criado_em`, `ultimo_uso`, `revogado_em` | RLS `profile_id = auth.uid()`; `authenticated` tem só `select, insert, update` (sem delete/truncate); `anon` nada |
| `google_ads_conexoes` | `profile_id` (PK), `modo` (`pocket`/`proprio`), `google_email`, `refresh_token_cifrado`, e no modo próprio `developer_token_cifrado` (opcional), `client_id`, `client_secret_cifrado`, `login_customer_id`; `criado_em`, `atualizado_em`, `revogado_em` | `authenticated` lê só as colunas `profile_id, modo, google_email, criado_em, revogado_em` da própria linha; não lê colunas cifradas nem escreve; escrita só `service_role` |
| `google_ads_oauth_estados` | `estado` (PK), `profile_id`, `expira_em` (10 min), `refresh_token_cifrado`, `google_email`, `confirmacao_hash` | só `service_role` (RLS ligado, sem política) |
| `envios_google_ads` | `profile_id`, `mesa`, `linha_id`, `customer_id`, `tipo`, `nivel`, `correspondencia`, `lista_negativa`, `status` (`ok`/`ja_existia`/`erro`), `erro`, `resource_name`, `criado_em` | só `service_role` |

View `minha_conexao_google_ads` (`security_invoker`): `modo, google_email, criado_em, revogado_em` da
conexão do usuário logado. É o que o front lê. `authenticated` tem `select` nela.

`envios_google_ads` é o controle de "já subido": uma linha com `status in ('ok','ja_existia')` para
(`mesa`, `linha_id`, `tipo`) esconde o termo de `listar_termos_respondidos` (a menos que
`incluir_ja_subidos`). Isso substitui a pendência "sem controle de resposta exportada" de
`docs/julgados-e-respostas-cliente.md` (aquele arquivo não foi alterado).

Colunas `*_cifrado`: AES-256-GCM (`_shared/pocket-ads/cifra.ts`, formato `<iv b64>:<dados b64>`), cifradas e
decifradas só dentro das Edge Functions.

## 3. Edge Functions

Base: `https://jmptroahcezmpjdplxwy.supabase.co/functions/v1/`. As duas têm `verify_jwt = false`
(`supabase/config.toml`).

### `pocket-mcp/<segredo>`

Só `POST` (outros métodos: 405). Link inexistente ou revogado: 401 sem detalhes. Protocolo MCP Streamable
HTTP sem estado, implementado em `_shared/pocket-ads/mcp.ts` (sem SDK). Acesso a dados com `service_role`,
sempre filtrado pelos clientes do perfil (`assigned_company_ids`, ou todos se admin).

| Ferramenta | Parâmetros | O que faz |
|---|---|---|
| `status_conexao` | nenhum | Usuário, estado do Google Ads (`conectado`, `nao_conectado`, `reconectar`) e clientes com conta configurada |
| `listar_clientes` | nenhum | Clientes, mesa, conta e pendentes por tipo (segmentar, negativar, teste_ab) |
| `listar_termos_respondidos` | `cliente`, `tipo`, `incluir_ja_subidos=false` | Linhas respondidas do tipo; omite (e conta) as sem campanha ou, em segmentar/teste A/B, sem grupo |
| `listar_listas_negativas` | `cliente` | Listas compartilhadas de negativas da conta (nome, id, nº de termos) |
| `subir_segmentadas` | `cliente`, `ids`, `modo` | Palavra-chave exata, ativa, no grupo de origem |
| `subir_teste_ab` | `cliente`, `ids`, `modo` | Palavra-chave exata, pausada, no grupo de origem |
| `subir_negativas` | `cliente`, `ids`, `nivel` (grupo/campanha/lista/conta), `correspondencia=exata`, `lista{id,nome,criar}`, `modo` | Negativa no nível escolhido |

`modo`:
- `previa`: resolve nomes e chama a API com `validateOnly`. Nada é gravado e nada vai para `envios_google_ads`.
  Devolve, por termo, `ok`, `ja_existe` ou `erro` legível.
- `gravar`: mesma resolução, chamada real com `partialFailure`; grava uma linha em `envios_google_ads` por
  termo (inclusive erros) e devolve o resumo.

Regras de gravação:
- Cliente precisa estar entre os do usuário; conta vem de `companies.google_ads_customer_id`; a mesa precisa
  casar `^mesa_[a-z0-9_]+$`.
- Destino resolvido por nome (minúsculas, sem acento, espaços colapsados), ignorando itens `REMOVED`; mais de
  um resultado = "nome ambíguo". Palavra/negativa que já existe vira `ja_existe`.
- Nível `conta`: usa (ou cria ao gravar) a lista "Negativas da conta (Pocket)" do tipo
  `ACCOUNT_LEVEL_NEGATIVE_KEYWORDS` e a vincula à conta (`customerNegativeCriteria`).
- Nível `lista` com `lista.criar = true` e nome novo: ao gravar cria a lista e a vincula às campanhas dos
  termos (falha de vínculo vira aviso). A prévia de lista que ainda não existe não valida na API; devolve aviso.
- Performance Max (sem grupo): segmentar e teste A/B dão erro "PMax não tem grupo"; negativas só nos níveis
  lista ou conta.
- Limite: 500 termos por chamada (e por lote de operações). A skill divide pedidos maiores.
- Versão da Google Ads API: constante `GOOGLE_ADS_API_VERSION` em
  `supabase/functions/_shared/pocket-ads/operacoes.ts` (hoje `v26`). Para subir de versão, troque só ela e
  republique as duas funções.
- Credenciais: modo `pocket` usa os segredos do Pocket + refresh token do usuário; modo `proprio` usa tudo
  da linha. `login-customer-id`: o da conexão própria, senão o do cliente, senão nenhum.

### `google-ads-oauth/<rota>`

| Rota | Auth | Função |
|---|---|---|
| `POST /iniciar` | JWT | Cria o estado e devolve `{url, estado}` (escopo `adwords openid email`, `access_type=offline`, `prompt=consent`) |
| `GET /retorno` | nenhuma (Google) | Redirect URI. Guarda o token pendente e redireciona ao Pocket; motivos de erro: `recusado`, `erro_google`, `expirou`, `sem_refresh`, `erro_interno`, `configuracao` |
| `POST /confirmar` | JWT | Conclui a conexão (ver seção 1) |
| `POST /proprio` | JWT | Modo avançado: testa com `listAccessibleCustomers`, só grava se passar; developer token é opcional |
| `POST /desconectar` | JWT | Revoga o refresh token no Google (melhor esforço) e marca `revogado_em`. No modo próprio revoga o token do próprio usuário |

## 4. Segredos (Supabase › Edge Functions › Secrets)

| Segredo | Uso |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Cliente OAuth do Pocket (botão Google) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Idem |
| `POCKET_CRYPTO_KEY` | Chave AES-256 (32 bytes) dos tokens guardados. **Não rotacione nem perca**: todos os tokens cifrados ficam ilegíveis e cada usuário teria de reconectar o Google Ads |
| `POCKET_APP_URL` | URL do Pocket, destino dos redirects (sem ela o `/retorno` não consegue voltar) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Opcional. O Google encerrou os tokens de desenvolvedor em 09/09/2026 (https://developers.google.com/google-ads/api/docs/api-policy/developer-token); se vazio o cabeçalho não é enviado |

No Google Cloud, o redirect URI autorizado é
`https://jmptroahcezmpjdplxwy.supabase.co/functions/v1/google-ads-oauth/retorno`. Enquanto a tela de
consentimento não for publicada e verificada para o escopo `adwords`, só usuários de teste conseguem
autorizar e a autorização expira em 7 dias. O passo a passo está em
`claude/skills/pocket-google-ads/TUTORIAL_GOOGLE_ADS.md` (parte C).

## 5. Segurança

- O link pessoal é uma senha. Só o SHA-256 fica no banco; o segredo aparece uma única vez, ao gerar.
- **Atenção**: o segredo vai no caminho da URL e os logs de borda do Supabase (`function_edge_logs`)
  registram a URL completa, segredo incluído. Só quem administra o projeto Supabase vê esses logs (quem já
  tem a service role). Foi aceito; a saída definitiva é OAuth no conector (seção 6).
- Revogar um link: tela "Conectar ao Claude" › Revogar (marca `claude_conexoes.revogado_em`); o 401 vale na
  próxima chamada. Via SQL: `update claude_conexoes set revogado_em = now() where id = '<id>'`.
- Revogar uma conexão Google: tela › Desconectar (revoga no Google e marca `revogado_em`). Para o usuário
  também dá em https://myaccount.google.com/permissions.
- Tokens Google nunca voltam ao navegador nem ao Claude. A gravação re-checa o acesso ao cliente no servidor.

## 6. Planos Team e Enterprise do Claude

Nesses planos só o Owner adiciona conectores personalizados e cada conector tem uma URL única para a
organização. Isso conflita com o link pessoal (cada usuário precisa do seu). Alternativa hoje: usar o Claude
Code (`claude mcp add --transport http pocket <link>`), onde cada pessoa registra o próprio link. OAuth no
conector (um único URL, identificação pelo login) fica como evolução futura.

## 7. Skill

Pasta `claude/skills/pocket-google-ads/` (`SKILL.md`, `CONECTAR.md`, `TUTORIAL_GOOGLE_ADS.md`).
`npm run skill:zip` (`scripts/zip-skill.mjs`) gera `public/downloads/pocket-google-ads.zip` e copia o
tutorial para `public/downloads/TUTORIAL_GOOGLE_ADS.md`; a tela baixa os dois. O zip é determinístico
(data fixa). `.gitattributes` força `claude/skills/** text eol=lf` para o zip não mudar com CRLF no Windows.
Depois de editar a skill, rode o comando e comite os arquivos gerados.

## 8. Deploy

1. Aplicar as duas migrações (ferramenta `apply_migration` do Supabase ou `supabase db push`).
2. Cadastrar os segredos (seção 4).
3. Publicar as funções com `deploy_edge_function`, `verify_jwt = false` em ambas. Layout: o arquivo
   `<função>/index.ts` mais os módulos `_shared/pocket-ads/*.ts` (sem os `*.test.ts`), com os imports
   relativos `../_shared/pocket-ads/...`.
4. Smoke: `POST` no `pocket-mcp/<link>` com `initialize` e `tools/list`; `OPTIONS` no `google-ads-oauth`.

Testes: `npm test` cobre o módulo puro (`_shared/pocket-ads`). O `index.ts` roda em Deno e só é exercitado
no deploy.

Versões no ar (09/11/2026): `pocket-mcp` v3 (commit 9ba8277) e `google-ads-oauth` v2 (commit 50ea4bb), ambas ACTIVE e com
`verify_jwt = false`. Migrações aplicadas: `claude_google_ads` e `oauth_confirmacao`.

## 9. Pendências conhecidas

- Teste ponta a ponta ainda não feito: segredos, login Google, `gravar` numa conta de teste do Google Ads
  (em especial o nível `conta` e o vínculo da lista em PMax, só validados estruturalmente).
- Estados OAuth expirados só são apagados por perfil (em `/iniciar`); não há limpeza geral nem
  `pg_cron`. Estados abandonados mantêm um refresh token cifrado até lá (e não são revogados no Google).
- Se o registro em `envios_google_ads` falhar depois de a gravação no Google ter dado certo, os itens não
  ficam marcados como subidos; repetir o pedido os devolve como `ja_existe` e fecha o controle.
- `listar_clientes` lê cada mesa 3 vezes (uma por tipo); pode ficar lento com muitas linhas.
- Falta de segredo do Pocket no modo `pocket` aparece ao usuário como "reconectar".
- Um usuário pode reescrever o próprio `token_hash`/`revogado_em` em `claude_conexoes` (reativar um link
  revogado); sem impacto fora da própria conta, mas dá para restringir por colunas.
- O escopo concedido no OAuth não é conferido (`sem_escopo`); a falha aparece no primeiro uso.
- Sem timeout nas chamadas HTTP ao Google nem limite de páginas nas consultas da API.
- A conexão Google (modo `pocket`) usa a conta Google de quem autorizou: a permissão real é a dessa pessoa
  no Google Ads.
- Edição das colunas de conta em `companies` só é restrita na UI. Em produção `companies` e `profiles` têm
  políticas RLS `ALL true/true` para `authenticated` (anteriores a esta funcionalidade): qualquer usuário
  logado pode trocar `google_ads_customer_id` (ou se tornar admin), e os próximos envios dos colegas iriam
  para essa conta com o login Google de cada um. Mitigação atual: a prévia mostra a `conta` e a skill cita a
  conta antes do OK. Correção: trigger BEFORE UPDATE em `companies` que rejeite mudança nas duas colunas do
  Ads, salvo `service_role` ou admin real; só vale depois que `profiles.is_admin`/`assigned_company_ids`
  deixarem de ser graváveis por qualquer autenticado (RPC só para admin na tela de Acessos).
- Segmentar sobre uma palavra-chave que já existe pausada devolve `ja_existia`, mas ela continua pausada.
- Uma lista compartilhada nova pode ficar sem vínculo se a vinculação falhar e o usuário repetir o pedido.
- `jaSubidos` ignora `customer_id`: trocar a conta de um cliente mantém ocultos os envios antigos.
- A detecção de duplicadas ignora acentos (termos que só diferem por acento contam como o mesmo).
