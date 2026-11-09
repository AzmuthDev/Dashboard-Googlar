# Tutorial: conectar o Google Ads ao Pocket

O Pocket grava no Google Ads com a conta Google de **cada usuário**. Há dois jeitos de conectar:

- **A. Botão Google** (recomendado): três cliques, sem tokens.
- **B. Modo avançado**: você usa as suas próprias credenciais da Google Ads API.

A parte **C** é só para o **dono do Pocket**, feita uma vez para que o botão Google funcione para todos.

---

## A. Usuário: botão Google

Antes: a conta Google que você vai usar precisa ter acesso às contas de Google Ads dos clientes
(direto ou por uma conta de administrador, o MCC). O Google exige **chave de acesso (passkey)** para
autorizar a Google Ads API; senha e código por SMS/app não bastam. Se ainda não tem, crie em
https://g.co/passkeys (uma chave nova pode levar até 7 dias para valer).

1. No Pocket, abra **Conta › Conectar ao Claude** e, no cartão **Conectar o Google Ads**, clique em
   **Conectar com Google**.
2. Escolha a conta Google que acessa o Google Ads dos clientes e confirme com a passkey.
3. Clique em **Permitir**. Você volta ao Pocket com "Conectado como <seu e-mail>".

Faça tudo no mesmo navegador em que clicou no botão. Se aparecer "o Google não verificou este app",
é porque a verificação do Pocket no Google ainda está em andamento (ver parte C); só continue se o
dono do Pocket avisou. Problemas comuns:

- "Você não permitiu o acesso": clique em **Conectar com Google** de novo e em **Permitir**.
- "O Google não liberou o acesso contínuo": remova o Pocket em https://myaccount.google.com/permissions
  e conecte de novo.
- O Claude diz "reconectar": no Pocket, clique em **Desconectar** e depois em **Conectar com Google**.

Os clientes também precisam ter a conta cadastrada: um admin preenche **ID da conta Google Ads** (e,
se for o caso, **MCC**) no cadastro do cliente, em **Empresas**.

---

## B. Usuário: modo avançado (suas credenciais)

Use só se você tem (ou quer ter) o seu próprio projeto da Google Ads API. Você vai precisar de: um
projeto no Google Cloud, um cliente OAuth, um refresh token e, se acessa as contas por um MCC, o ID dele.

> **Token de desenvolvedor.** O Google encerrou os tokens de desenvolvedor em **09/09/2026**: o acesso
> à API agora é do **projeto do Google Cloud** (o mesmo do cliente OAuth). Quem já tem um token continua
> colando o seu (o Google aceita e ignora). O Pocket **não exige** o token: o campo é opcional e pode
> ficar vazio.

### B1. Projeto e Google Ads API
1. Entre em https://console.cloud.google.com e crie um projeto (ou escolha um).
2. Abra a **Biblioteca de APIs** (*API Library*), procure **Google Ads API** e clique em **Ativar** (*Enable*).
3. Abra a página **Google Ads API Overview** do projeto no Cloud Console e veja o nível de acesso:
   - **Test**: só contas de teste (15 mil operações/dia). Expanda **Upgrade access level** e clique em
     **Apply for access** para pedir **Explorer** (na maioria dos casos a aprovação é automática).
   - **Explorer**: contas reais, até 2.880 operações/dia. Basta para uso pessoal.
   - **Basic** (15 mil/dia) e **Standard** (sem limite diário) exigem verificação da marca do projeto.

### B2. Tela de consentimento
1. No Cloud Console: **Menu › Google Auth Platform › Branding**. Se aparecer "Google Auth platform not
   configured yet", clique em **Get Started**.
2. Preencha **App name** e **User support email** › **Next**; em **Audience** escolha **External**
   (ou **Internal** se for uma conta Google Workspace e só gente da empresa vai usar) › **Next**;
   informe o e-mail de contato › **Next**; aceite a política de dados do Google › **Continue** › **Create**.
3. **Audience › Test users › Add users**: adicione o seu e-mail › **Save**.
4. **Data Access › Add or Remove Scopes**: adicione `https://www.googleapis.com/auth/adwords` e salve.

Enquanto o app estiver em **Testing**, a autorização (e o refresh token) **expira em 7 dias**. Para
não precisar refazer toda semana, em **Audience** clique em **Publish app** (fica **In production**);
como o app não é verificado, o Google mostra o aviso de app não verificado ao autorizar (para uso
próprio, clique em **Advanced** › **Go to <nome do projeto> (unsafe)**).

### B3. Cliente OAuth
1. **Menu › Google Auth Platform › Clients › Create Client**.
2. **Application type › Web application**; dê um nome.
3. Em **Authorized redirect URIs**, clique em **Add URI** e cole:
   `https://developers.google.com/oauthplayground`
4. **Create**. Copie o **Client ID** e o **Client secret**.

### B4. Refresh token no OAuth Playground
1. Abra https://developers.google.com/oauthplayground.
2. Clique na engrenagem (**OAuth 2.0 configuration**), marque **Use your own OAuth credentials** e cole
   o Client ID e o Client secret. Deixe **Access type: Offline**.
3. Em **Step 1 Select & authorize APIs**, no campo de escopos digite
   `https://www.googleapis.com/auth/adwords` e clique em **Authorize APIs**.
4. Entre com a conta Google que acessa o Google Ads (com a passkey) e permita.
5. Em **Step 2 Exchange authorization code for tokens**, clique em **Exchange authorization code for
   tokens** e copie o **Refresh token**.

### B5. Colar no Pocket
1. No Pocket: **Conectar ao Claude › Modo avançado**.
2. Preencha **Client ID**, **Client secret**, **Refresh token** (o **Token de desenvolvedor** é opcional; pode deixar vazio) e, se você
   acessa as contas por um MCC, **ID do MCC (opcional)** (10 dígitos; pode colar com traços).
3. Clique em **Conectar com meus tokens**. O Pocket testa na hora e mostra as **Contas acessíveis**.
   Só grava se o teste passar.

---

## C. Dono do Pocket: configuração única

Faça uma vez. No botão Google, o nível de acesso e o limite diário são os do **projeto do Google Cloud
dono do cliente OAuth do Pocket**, somados para todos os usuários.

### C1. Projeto e nível de acesso
1. No projeto do Pocket no Cloud Console, confirme que a **Google Ads API** está ativada.
2. Na página **Google Ads API Overview**, veja o nível. Tokens aprovados antes de 09/09/2026 tiveram o
   nível copiado para os projetos usados nos 90 dias anteriores; confira se é este projeto.
   - **Explorer**: 2.880 operações/dia em contas reais.
   - **Basic**: 15 mil operações/dia (exige verificação da marca).
   - **Standard**: sem limite diário. Peça (em **Upgrade access level**) quando o Pocket passar de
     15 mil operações/dia.

### C2. Tela de consentimento e cliente OAuth
1. **Google Auth Platform › Branding**: nome do app (ex.: "Pocket"), e-mail de suporte, logo, domínio e
   links de política de privacidade e termos (pedidos na verificação).
2. **Audience**: **External**.
3. **Data Access › Add or Remove Scopes**: `https://www.googleapis.com/auth/adwords`, `openid` e `email`.
4. **Clients › Create Client › Web application**. Em **Authorized redirect URIs** adicione exatamente:
   `https://jmptroahcezmpjdplxwy.supabase.co/functions/v1/google-ads-oauth/retorno`
   Copie o **Client ID** e o **Client secret**.

### C3. Produção e verificação
1. **Audience › Publish app** para ficar **In production**.
2. Peça a verificação do app para o escopo sensível `adwords` (confira no painel; o nome do menu pode
   variar: o pedido fica no Google Auth Platform, na área de verificação).
3. Até a verificação sair:
   - em **Testing**, só os **usuários de teste** cadastrados em **Audience › Test users** (até 100)
     conseguem conectar, e a autorização **expira em 7 dias** (o Claude passa a dizer "reconectar");
   - em **In production** sem verificação, todos veem o aviso de app não verificado e o projeto aceita
     no máximo **100 usuários novos** no total.

### C4. Segredos no Supabase
No painel do Supabase: **Edge Functions › Secrets**
(https://supabase.com/dashboard/project/jmptroahcezmpjdplxwy/functions/secrets; confira no painel, o
nome do menu pode variar), informe **Key** e **Value** e clique em **Save**. Ou pela CLI:
`supabase secrets set NOME=valor`. Precisa do papel Owner ou Administrator. As funções leem o segredo
novo na hora, sem novo deploy.

| Segredo | Valor |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Opcional: pode ficar sem definir. O Google ignora o token de desenvolvedor desde 09/09/2026 e o Pocket não o exige; se definido, é enviado junto das chamadas. |
| `GOOGLE_OAUTH_CLIENT_ID` | Client ID do cliente OAuth da etapa C2. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Client secret do mesmo cliente. |
| `POCKET_CRYPTO_KEY` | 32 bytes aleatórios em base64, gerados com: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `POCKET_APP_URL` | Endereço público do Pocket, sem barra no fim (ex.: `https://pocket.suaempresa.com.br`). |

> **Atenção:** `POCKET_CRYPTO_KEY` cifra os tokens de todos os usuários. Se ela mudar depois, **todas**
> as conexões guardadas deixam de funcionar e cada usuário precisa conectar o Google Ads de novo.
> Guarde-a num cofre de senhas e não a troque.

### C5. Contas dos clientes
Em **Empresas**, no cadastro de cada cliente, preencha **ID da conta Google Ads** (10 dígitos) e, se a
conta é acessada por um MCC, **MCC**. Sem o ID da conta, o Claude não sobe termos desse cliente.

### C6. Testar
Com um usuário de teste: **Conectar com Google** → no Claude, peça a prévia de alguns termos de uma
conta de teste do Google Ads → confirme com "ok" e veja o resumo.

---

## Fontes (conferidas em 09/11/2026)

- Níveis de acesso: https://developers.google.com/google-ads/api/docs/api-policy/access-levels
- Fim do token de desenvolvedor: https://developers.google.com/google-ads/api/docs/api-policy/developer-token
- Projeto do Google Cloud: https://developers.google.com/google-ads/api/docs/oauth/cloud-project
- Autenticação de um usuário (Playground): https://developers.google.com/google-ads/api/docs/oauth/single-user-authentication
- Autenticação de vários usuários: https://developers.google.com/google-ads/api/docs/oauth/multi-user-authentication
- Passkey obrigatória: https://developers.google.com/google-ads/api/docs/oauth/security-requirements
- Primeira chamada (Google Ads API Overview): https://developers.google.com/google-ads/api/docs/get-started/make-first-call
- Tela de consentimento: https://developers.google.com/workspace/guides/configure-oauth-consent
- Cliente OAuth: https://developers.google.com/workspace/guides/create-credentials
- Publicação, usuários de teste e 7 dias: https://support.google.com/cloud/answer/15549945
- Verificação do app: https://support.google.com/cloud/answer/13463073
- Expiração do refresh token: https://developers.google.com/identity/protocols/oauth2
- OAuth Playground: https://developers.google.com/oauthplayground
- Segredos do Supabase: https://supabase.com/docs/guides/functions/secrets
