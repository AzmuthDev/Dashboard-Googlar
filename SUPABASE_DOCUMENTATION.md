# Documentação de Arquitetura de Dados: Supabase & Integrações

Esta documentação detalha a estrutura de banco de dados e as integrações construídas no **Googlar Dashboard (Antygraviti OS)** utilizando o Supabase como Backend como Serviço (BaaS).

---

## 1. Tabelas do Banco de Dados (PostgreSQL)

Atualmente, o projeto possui 4 tabelas principais construídas para gerenciar Identidade, Dados de Anúncios e Automações:

### 1.1 `profiles`
Gerencia informações adicionais dos usuários autenticados (além do sistema padrão do Supabase Auth).
- **id** (`UUID`): Chave estrangeira que se liga à tabela de autenticação `auth.users`.
- **name** (`TEXT`): Nome de exibição do usuário.
- **role** (`TEXT`): Nível de permissão (ex: `admin` ou `standard`).
- **is_admin** (`BOOLEAN`): Indicador genérico de "super" permissões no painel.
- **job_title** (`TEXT`): Ocupação (ex: "Sócio Administrador").
- **avatar_url** (`TEXT`): Imagem de perfil do usuário.
- **assigned_company_ids** (`JSONB` / `ARRAY`): Lista de IDs das empresas às quais este usuário tem acesso. Apenas Admins enxergam tudo sem restrição.

### 1.2 `campaign_terms`
A estrutura central do Dashboard. Armazena as milhares de linhas das planilhas de Google Ads processadas para cada cliente.
- **id** (`TEXT`): ID único (formato de concatenação entre empresa e índice para indexação rápida).
- **company_id** (`UUID`): Empresa dona destes termos de pesquisa.
- **campaign_id** / **campaign_name** (`TEXT`): Identificação das Campanhas de origem.
- **keyword** / **search_term** (`TEXT`): Palavras-chave originais e o termo exato pesquisado pelo usuário.
- **Métricas Primárias** (`NUMERIC`): `clicks`, `cost`, `impressions`, `ctr`, `conversions`, `cost_per_conversion`, `conversion_rate`.
- **Análise Semântica** (`TEXT`): `duvida` (para o robô), `suggestion_group`, `segment`.
- **intervencao_humana** / **added_excluded** (`TEXT`): Marcadores para auditoria (Se a IA negativou o termo de forma autônoma ou se um estrategista fez a curadoria).
- **synced_at** (`TIMESTAMPTZ`): Data e hora exata da última sincronização para controle temporal.

### 1.3 `whatsapp_bot_configs`
Armazena as configurações direcionadas para automações (como disparo para n8n ou Make).
- **company_id** (`UUID`): Chave estrangeira da empresa.
- **webhook_url** (`TEXT`): A URL de Payload externa onde o dashboard fará via POST a requisição para iniciar um fluxo de conversa com o cliente via WhatsApp.
- **created_at** / **updated_at** (`TIMESTAMPTZ`): Data de inserção da URL e última vez alterada.

### 1.4 `duvidas_clientes`
Funciona como um diário de auditoria / log operacional. Loga toda vez que um termo do Google Ads é classificado como "Dúvida" e o analista solicita validação do cliente via WhatsApp.
- **id** (`UUID`): Identificador do Log.
- **company_id** (`UUID`): Empresa atrelada à dúvida.
- **term** / **campaign** / **ad_group**: Referências textuais do termo questionado.
- **comentario_analista** (`TEXT`): Adicional livre de texto que o estrategista envia junto com a dúvida.
- **sent_by** (`TEXT`): Email/ID do Analista de Gestão de Tráfego que disparou a dúvida.
- **sent_at** (`TIMESTAMPTZ`): Data do envio (Para relatórios de Governança).

---

## 2. Lógica de Integração Frontend ↔ Supabase

O frontend React se conecta a essas tabelas utilizando as seguintes metodologias:

### A. Fluxo de Autenticação (AuthContext.tsx)
O Dashboard possui proteção forçada com `persistSession: false` no App, o que exige credenciais seguras a cada nova visita ao domínio do painel. Ao executar lógica de `signInWithPassword`, o sistema invoca a validação e, ao obter um JWT válido, resgata a linha da tabela **`profiles`**. Dali partem os bloqueios do menu principal.

### B. Ingestão de Dados e Sincronia Rápida 
A extração contínua nos Utils (`dataIngestion.ts` e `supabaseSync.ts`):
1. Quando o analista aperta o botão **`SINCRONIZAR`**, o app faz a extração crua através do link publicado do Google Sheets.
2. A API assíncrona **`syncCampaignTermsToSupabase`** é ativada.
3. Para garantir higienização e evitar dados multiplicados, o Backend executa um comando `DELETE` de toda a base pertencente somente a esse exato `company_id`.
4. Os novos Dados são organizados e "fatiados" em **Batches de 500 linhas**. O supabase processará inserções em pacotes para suportar planilhas grandes sem risco de "Timeout" por restrição da Vercel/Navegador.
5. As requisições de dashboard comuns utilizam a leitura indexada contida em **`fetchCampaignTermsFromSupabase`**.

### C. Segurança via RLS (Row Level Security)
Para anular riscos de brechas nos bancos se a API Key vazar ou for injetada via Console maliciosa:
Todas as tabelas de infraestrutura (`campaign_terms`, `duvidas_clientes`, `whatsapp_bot_configs`) estão devidamente vedadas via scripts RLS no SQL (`fix-rls.sql`).
- As Policies do banco de dados interceptam requisições para proibir a leitura caso não haja um JWT autenticado (`auth.uid() IS NOT NULL`). Apenas requisições assinadas por dentro da interface são computadas.
