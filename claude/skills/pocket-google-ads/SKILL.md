---
name: pocket-google-ads
description: Sobe ao Google Ads, pelo conector Pocket, os termos respondidos pelos clientes (segmentadas, negativadas, teste A/B). Use quando o usuário pedir para ver, subir ou enviar termos do Pocket.
---

# Pocket → Google Ads

Leva ao Google Ads os termos de pesquisa que os clientes já responderam no Pocket, usando o conector
MCP **pocket** (link pessoal do usuário). Quem grava é o Pocket, com a conta Google que o próprio
usuário autorizou. Esta skill só conduz a conversa: mostra, pergunta, faz a prévia, espera o "ok" e grava.

- Como instalar o conector e esta skill: [CONECTAR.md](CONECTAR.md)
- Como conectar o Google Ads (botão Google, modo avançado, configuração do dono): [TUTORIAL_GOOGLE_ADS.md](TUTORIAL_GOOGLE_ADS.md)

## Ferramentas do conector

| Ferramenta | Uso |
|---|---|
| `status_conexao` | Sempre primeiro. Devolve `usuario`, `google_ads` (`conectado` \| `nao_conectado` \| `reconectar`), `modo`, `google_email`, `detalhe` e `clientes` (`nome`, `conta` ou `null`). |
| `listar_clientes` | `clientes`: `id`, `nome`, `mesa`, `conta` (ou "não configurado"), `pendentes` `{segmentar, negativar, teste_ab}`. |
| `listar_termos_respondidos` | `{cliente, tipo, incluir_ja_subidos?}`; `tipo` = `segmentar` \| `negativar` \| `teste_ab`. Devolve `termos` (`id`, `termo`, `palavra_chave`, `campanha`, `grupo`, `data_resposta`, `observacao`), `total`, `omitidos`, `ja_subidos_ocultos`. |
| `listar_listas_negativas` | `{cliente}` → `listas` (`id`, `nome`, `termos`). |
| `subir_segmentadas` | `{cliente, ids, modo}` → palavra-chave **exata, ativa** no grupo de origem. |
| `subir_teste_ab` | `{cliente, ids, modo}` → palavra-chave **exata, pausada** no grupo de origem. |
| `subir_negativas` | `{cliente, ids, nivel, correspondencia, lista?, modo}`; `nivel` = `grupo` \| `campanha` \| `lista` \| `conta`; `correspondencia` = `exata` (padrão) \| `frase` \| `ampla`; `lista` = `{id}` ou `{nome}` ou `{nome, criar: true}` (só no nível `lista`). |

`modo` é `"previa"` (valida no Google Ads sem gravar) ou `"gravar"`. As três `subir_*` devolvem
`resumo` `{ok, ja_existe, erro}`, `itens` (`termo`, `ids`, `campanha`, `grupo` quando há, `situacao`
= `ok` \| `ja_existe` \| `erro`, `erro` com o motivo) e, às vezes, `avisos` (lista de textos).
Quando uma ferramenta devolve erro (texto), mostre a mensagem ao usuário como veio e não tente contornar.

## Regras

1. **Nunca invente** termo, campanha, grupo, lista ou conta. Mostre e envie só o que as ferramentas devolveram.
2. **Nunca grave sem prévia e sem "ok"**: `modo: "gravar"` só depois de `modo: "previa"` com os mesmos
   `ids` e parâmetros, e de uma confirmação explícita do usuário **neste mesmo pedido** ("ok", "pode subir",
   "confirma", "sim, sobe"). Pergunta, dúvida ou "acho que sim" não é confirmação. Se o usuário mudar a
   lista, o nível, a correspondência ou a lista compartilhada depois da prévia, refaça a prévia.
3. **No máximo 500 `ids` por chamada.** Acima disso, divida em partes de até 500 (prévia de todas as
   partes, um "ok" para o conjunto, depois gravar parte por parte).
4. Use os `ids` exatamente como vieram de `listar_termos_respondidos`. Não mostre os ids na tabela
   (use a coluna `#`), mas guarde a correspondência número → id.
5. Termos `DUVIDA` não sobem ao Google Ads. Segmentadas e Teste A/B são sempre de correspondência
   exata (outras correspondências não são suportadas).
6. Mostre `avisos` **antes** de pedir o "ok".

## Fluxo

### 1. Conferir a conexão
Chame `status_conexao`.
- `google_ads: "nao_conectado"` → explique e **pare**: "No Pocket, abra **Conectar ao Claude** (menu
  Conta) e clique em **Conectar com Google**. Depois, peça de novo." Quem usa tokens próprios usa a
  seção **Modo avançado** da mesma tela (ver TUTORIAL_GOOGLE_ADS.md, parte B).
- `google_ads: "reconectar"` → mostre o `detalhe`, peça para clicar em **Desconectar** e depois em
  **Conectar com Google** na tela **Conectar ao Claude**, e **pare**.
- Cliente pedido com `conta: null` → explique e **pare** para esse cliente: "Um admin do Pocket precisa
  preencher **ID da conta Google Ads** (e, se for o caso, **MCC**) no cadastro do cliente, em **Empresas**."
- Se a ferramenta nem responde (conector ausente ou link revogado), oriente a gerar um link novo em
  **Conectar ao Claude › Gerar link** e a refazer o conector (CONECTAR.md).

### 2. Cliente e tipo
- Se o usuário não disse o cliente, ou o nome bate com mais de um, chame `listar_clientes` e pergunte
  (pode mostrar `pendentes` por tipo para ajudar). Depois use o `id` do cliente nas chamadas.
- Tipo: "segmentadas"/"segmentar" → `segmentar`; "negativadas"/"negativas" → `negativar`;
  "teste A/B" → `teste_ab`. Se não ficou claro, pergunte.

### 3. Mostrar os termos
Chame `listar_termos_respondidos` (use `incluir_ja_subidos: true` só se o usuário pedir os já enviados).

Segmentar e Teste A/B:

| # | Termo | Campanha | Grupo de anúncios |
|---|---|---|---|
| 1 | `termo` | `campanha` | `grupo` |

Negativar (o grupo aparece como origem):

| # | Termo | Campanha | Grupo de origem |
|---|---|---|---|

- Abaixo da tabela: total; se `omitidos > 0`, "N termos ficaram de fora por não terem campanha
  (ou grupo) na planilha"; se `ja_subidos_ocultos > 0`, "N já foram subidos antes e não aparecem".
- `observacao` do cliente, quando houver, pode ir numa coluna extra "Obs." (curta).
- Lista grande: mostre em partes (ex.: 50 linhas por vez, numeração contínua) e pergunte se quer ver o
  resto; a lista completa continua valendo.
- Pergunte se quer tirar algum termo ("tirar 3, 7 e 12" ou pelo texto). Lista vazia → diga que não há
  termos prontos desse tipo e pare.

### 4. Perguntas do tipo
- **Negativar**: pergunte o **nível** e a **correspondência**.
  - Nível: `grupo` (grupo de origem), `campanha`, `lista` (lista compartilhada) ou `conta`.
  - Se `lista`: chame `listar_listas_negativas` e mostre `| Lista | Termos |`. O usuário escolhe uma
    (envie `lista: {id}`) ou pede uma nova (envie `lista: {nome: "<nome dado pelo usuário>", criar: true}`).
  - Correspondência: `exata` (padrão, se o usuário não escolher), `frase` ou `ampla`.
- **Teste A/B**: avise que as palavras entram **pausadas** (exata), para ativar depois no Google Ads.
- **Segmentar**: entram como palavra-chave exata **ativa** no grupo de origem.

### 5. Prévia
Chame a `subir_*` do tipo com `modo: "previa"` e os `ids` que sobraram. Mostre:

| # | Termo | Campanha | Grupo | Resultado |
|---|---|---|---|---|
| 1 | … | … | … | ✅ vai subir |
| 2 | … | … | … | ↺ já existe (não muda nada) |
| 3 | … | … | … | ❌ não vai subir: <erro> |

- Resultado vem de `situacao`: `ok` → "vai subir"; `ja_existe` → "já existe"; `erro` → "não vai subir" + `erro`.
- Coluna Grupo só quando o item traz `grupo` (nível grupo, segmentar, teste A/B).
- Um item pode reunir termos repetidos (vários `ids`): mostre uma linha só.
- Linha de resumo: "Vão subir: `resumo.ok` · Já existem: `resumo.ja_existe` · Com erro: `resumo.erro`".
- Mostre cada texto de `avisos` (ex.: lista que será criada e vinculada).
- Se o Google recusar a negativa na conta, ofereça uma lista compartilhada (nível `lista`). Erro de PMax → em negativas, sugira
  `lista` ou `conta`; em segmentar/teste A/B não há como subir esses termos.

### 6. Confirmação
Se `resumo.ok` for 0, diga que não há nada para gravar e pare. Senão pergunte, por exemplo:
"Posso subir os **N** termos marcados como ✅ na conta **<cliente> (<conta>)**? Responda **ok** ou
**pode subir**." Espere a resposta. Se o usuário quiser tirar termos, volte à prévia sem eles.

### 7. Gravar e resumir
Chame a mesma ferramenta com os mesmos parâmetros e `modo: "gravar"`. Mostre:

- **Subidos**: `resumo.ok` · **Já existiam**: `resumo.ja_existe` · **Erros**: `resumo.erro`
- Tabela só dos erros: `| Termo | Motivo |` (texto de `erro`).
- `avisos`, se vierem (ex.: lista criada mas não vinculada a alguma campanha).
- Teste A/B: lembre que as palavras estão pausadas.

Termos gravados (`ok` e `ja_existe`) ficam registrados no Pocket e não aparecem mais em
`listar_termos_respondidos` para o mesmo tipo. Não há desfazer pelo Claude: correções são feitas no Google Ads.
