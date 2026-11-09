# Conectar o Claude ao Pocket

São três coisas, uma vez só: o **link pessoal** (no Pocket), o **conector** (no Claude) e a **skill**
(no Claude). O Google Ads se conecta à parte, na mesma tela do Pocket (ver TUTORIAL_GOOGLE_ADS.md).

## 1. Gerar o link no Pocket

1. No Pocket, menu **Conta › Conectar ao Claude**.
2. No cartão **Conectar o Claude**, escreva um rótulo se quiser (ex.: "Notebook do trabalho") e clique
   em **Gerar link**.
3. Clique em **Copiar**. O link aparece **uma vez só**.

O link funciona como uma senha: é ele que diz ao Pocket quem você é. Não compartilhe. Perdeu ou vazou?
Clique em **Revogar** na lista **Seus links ativos** e gere outro.

## 2. Adicionar o conector

### claude.ai e app do Claude (planos individuais Free, Pro, Max)
1. Abra **Personalizar › Conectores** (em inglês: *Customize › Connectors*).
2. Clique em **+ Adicionar** e depois em **Adicionar conector personalizado** (*+ Add › Add custom connector*).
3. Nome: `pocket`. URL: cole o link do Pocket. Clique em **Continuar** (*Continue*).
4. Em **Autenticação**, escolha **Sem login** (*No sign in*): o link já identifica você. Clique em
   **Continuar** e depois em **Adicionar** (*Add*).
5. Numa conversa, clique no **+** (canto inferior esquerdo) › **Conectores** e confira que o `pocket`
   está ligado.

No plano Free só é possível ter um conector personalizado.

### Planos Team e Enterprise
Só o Owner (ou Primary Owner, ou um papel com essa permissão) adiciona conectores personalizados, em
**Configurações da organização › Conectores** (*Organization settings › Connectors*), e o mesmo endereço vale
para todos os membros. Como o link do Pocket é **pessoal**, não peça ao Owner para cadastrar o seu link
para a organização (todos entrariam como você). Nesses planos, prefira o Claude Code (abaixo) ou combine
com o Owner antes.

### Claude Code
```
claude mcp add --transport http pocket <link>
```
Sem opção extra, o conector vale só para a pasta atual. Para valer em todos os projetos, use
`claude mcp add --transport http --scope user pocket <link>`. Confira com `/mcp` dentro do Claude Code.

## 3. Enviar a skill

No Pocket, clique em **Baixar skill (.zip)** (arquivo `pocket-google-ads.zip`). Não descompacte.

### claude.ai e app do Claude
1. Skills dependem de **Execução de código e criação de arquivos** (*Code execution and file creation*,
   também chamado *Create and edit files*): ative em **Configurações › Recursos** (*Settings › Capabilities*).
   Em Team/Enterprise quem libera é o Owner, em **Configurações da organização › Plugins e skills**.
2. Abra **Personalizar › Skills** (*Customize › Skills*).
3. Clique em **+**, depois em **+ Criar skill** (*+ Create skill*) e **Enviar uma skill** (*Upload a skill*).
4. Escolha o `pocket-google-ads.zip`. A skill aparece na lista; deixe-a ligada.

### Claude Code
As skills ligadas no claude.ai também carregam no Claude Code quando você entra com a mesma conta
(Claude Code 2.1.273 ou mais novo; confira com `/skills`). Sem isso, descompacte o .zip e copie a
pasta `pocket-google-ads` para `~/.claude/skills/` (fica `~/.claude/skills/pocket-google-ads/SKILL.md`).

## 4. Testar

Peça ao Claude, por exemplo: "Quais termos da Endomarcas estão prontos para subir?". Ele deve chamar
`status_conexao` e depois listar os termos. Para gravar no Google Ads, ele sempre mostra a prévia e
espera o seu **ok**.

## Sobre o conector "google-ads"

Alguns Claude já têm um conector chamado **google-ads**. Ele só **lê** a conta (consultas, rótulos,
recursos) e **não** é ele que sobe palavras-chave ou negativas. Quem grava é o **Pocket**, pelo conector
`pocket`, com a conta Google que **você** autorizou em **Conectar ao Claude › Conectar com Google**.

## Fontes (conferidas em 09/11/2026)

- Conectores personalizados: https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp
- Skills no Claude: https://support.claude.com/en/articles/12512180-using-skills-in-claude
- Criar e empacotar skills: https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
- MCP no Claude Code: https://code.claude.com/docs/en/mcp
- Skills no Claude Code: https://code.claude.com/docs/en/skills

As páginas de ajuda estão em inglês; os nomes em português do app podem variar um pouco. Se não achar o
menu, procure pelo nome em inglês entre parênteses (confira no painel; o nome do menu pode variar).
