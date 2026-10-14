# 🛠️ DOCUMENTAÇÃO TÉCNICA: ECOSSISTEMA POCKET & ANTYGRAVITI OS
## Arquitetura de Dados, Orquestração no n8n e Engenharia do Pocket Interno

---

## 1. Visão Geral da Arquitetura Técnica

O ecossistema do **Pocket** é projetado em uma arquitetura desacoplada, orientada a eventos e multitenant, integrando 5 camadas fundamentais:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           INTERFACES DE USUÁRIO (UI)                            │
├──────────────────────────────────────┬──────────────────────────────────────────┤
│  WhatsApp (Equipe & Clientes)        │  Googlar Dashboard (Antygraviti OS)      │
│  - Enquetes Interativas Nativas      │  - React 19 + TypeScript + Tailwind v4   │
│  - Comandos de Terminal (/ups ...)   │  - Console de Automação & Logs v2.log   │
└──────────────────┬───────────────────┴────────────────────┬─────────────────────┘
                   │                                        │
                   ▼ Webhooks (POST)                        ▼ REST / Realtime
┌──────────────────────────────────────┐  ┌───────────────────────────────────────┐
│     EVOLUTION API (WhatsApp Engine)  │  │        SUPABASE (PostgreSQL BaaS)     │
│ - Gestão de Sessões WhatsApp         │  │ - Auth & Row Level Security (RLS)     │
│ - Disparo e Leitura de Enquetes      │  │ - Multitenancy (Mesas Isoladas V4)    │
│ - Webhook de Eventos (Poll Updates)  │  │ - RPCs e Batch Ingestion (500 itens)  │
└──────────────────┬───────────────────┘  └───────────────────▲───────────────────┘
                   │                                          │
                   ▼ POST Webhook                             │
┌─────────────────────────────────────────────────────────────┴───────────────────┐
│                          ORQUESTRADOR N8N (WORKFLOW ENGINE)                     │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Roteador Central de Comandos & Votos (Guarda Anti-Loop)                     │ │
│ ├─────────────────────────────────────────────────────────────────────────────┤ │
│ │ Esteiras Especializadas de IA (Gemini 1.5 / Flash) com Lotes de 30 itens    │ │
│ ├─────────────────────────────────────────────────────────────────────────────┤ │
│ │ Motor de Consenso (2 Votos Internos) & Decisão Soberana do Cliente (1 Voto) │ │
│ ├─────────────────────────────────────────────────────────────────────────────┤ │
│ │ Despacho Dinâmico por JID & Alerta Global de Divergência/Erros              │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Organização do Supabase (Banco de Dados & BaaS)

O **Supabase** é a espinha dorsal de persistência, controle de acesso e governança multitenant do sistema.

### 2.1 Modelagem das Tabelas Principais

#### A. Tabela `profiles` (Usuários e Permissões)
Estende o `auth.users` nativo do Supabase com papéis e controle de visibilidade de empresas:
```sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'standard')) DEFAULT 'standard',
    is_admin BOOLEAN DEFAULT false,
    job_title TEXT,
    avatar_url TEXT,
    assigned_company_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- **Controle de Tenant:** Usuários com `role = 'standard'` só conseguem consultar ou modificar dados de empresas cujos IDs constam em `assigned_company_ids`. Usuários com `is_admin = true` ignoram o filtro e têm visão global.

---

#### B. Tabela `companies` (Tenants / Clientes)
Armazena a parametrização de cada cliente atendido no ecossistema:
```sql
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    "isActive" BOOLEAN DEFAULT true,
    "sheetsUrl" TEXT,
    "dataSourceType" TEXT CHECK ("dataSourceType" IN ('sheets', 'local')) DEFAULT 'sheets',
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    users JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### C. Tabela `campaign_terms` (Base Central de Auditoria)
Centraliza os termos de pesquisa importados do Google Ads:
```sql
CREATE TABLE public.campaign_terms (
    id TEXT PRIMARY KEY,                 -- Padrão composto: ${company_id}_${index}
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    campanha TEXT,
    grupo_de_anuncios TEXT,
    palavra_chave TEXT,
    termo_de_pesquisa TEXT NOT NULL,
    
    -- Flags Semânticas e Julgamento
    negativar TEXT,                      -- '❌' ou flag booleana
    duvida TEXT,                         -- '❓' ou flag booleana
    segmentar TEXT,                      -- '✅' ou flag booleana
    teste_ab TEXT,                       -- '⚠️' ou flag booleana
    observacao TEXT,                     -- Comentários técnicos do auditor
    sugestao_grupo TEXT,                 -- Sugestão de novo grupo de anúncio (STAG)
    status_granularidade TEXT,           -- Avaliação de contexto
    
    -- Métricas de Performance do Google Ads
    impressoes NUMERIC DEFAULT 0,
    cliques NUMERIC DEFAULT 0,
    custo NUMERIC DEFAULT 0,
    conversoes NUMERIC DEFAULT 0,
    ctr NUMERIC DEFAULT 0,
    cpc_medio NUMERIC DEFAULT 0,
    taxa_conv NUMERIC DEFAULT 0,
    custo_conv NUMERIC DEFAULT 0,
    
    -- Metadados de Auditoria
    intervencao_humana TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_terms_company ON public.campaign_terms(company_id);
CREATE INDEX idx_campaign_terms_custo ON public.campaign_terms(custo DESC);
```

---

#### D. O Conceito de Mesas Físicas Isoladas V4 (`provision_company_table`)
Para contas de grande escala (acima de 50.000 termos mensais), o sistema implementa provisionamento dinâmico de tabelas físicas isoladas por meio de uma RPC PostgreSQL:
```sql
CREATE OR REPLACE FUNCTION provision_company_table(company_name TEXT)
RETURNS VOID AS $$
DECLARE
    table_name TEXT;
BEGIN
    table_name := 'data_company_' || lower(regexp_replace(company_name, '[^a-zA-Z0-9]', '_', 'g'));
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I (
            LIKE public.campaign_terms INCLUDING ALL
        );
    ', table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
* **Vantagem Técnica:** Elimina contenção de índices em bancos de alto volume, permite truncamento (`TRUNCATE`) instantâneo de dados da empresa durante sincronizações completas e isola completamente o I/O de disco por cliente.

---

#### E. Tabela `whatsapp_bot_configs` e `duvidas_clientes`
- `whatsapp_bot_configs`: Mapeia webhooks externos e parâmetros de WhatsApp por empresa (`company_id`, `webhook_url`, `created_at`, `updated_at`).
- `duvidas_clientes`: Log histórico e rastreabilidade de todas as dúvidas despachadas via WhatsApp (`id`, `company_id`, `term`, `campaign`, `ad_group`, `comentario_analista`, `sent_by`, `sent_at`).

---

### 2.2 Camada de Ingestão e Batching no Frontend (`supabaseProvider.ts`)
Para evitar bloqueios de taxa (*Rate Limit* do Supabase) e garantir sincronizações sem queda por *timeout*, o provedor do Supabase no frontend implementa três padrões essenciais:

1. **Deduplicação de Termos em Memória:**
   Antes de disparar qualquer inserção, o método `deduplicateTermsByOrigin(terms)` remove linhas redundantes originadas da mesma combinação de campanha e grupo.
2. **Inserção em Lotes (*Batching*):**
   ```typescript
   const BATCH_SIZE = 500;
   for (let i = 0; i < rows.length; i += BATCH_SIZE) {
       const batch = rows.slice(i, i + BATCH_SIZE);
       const { error } = await supabase.from(targetTable).insert(batch);
       if (error) throw error;
   }
   ```
3. **Estratégia Wipe & Replace com Carimbo Temporal:**
   O sistema executa um `.delete().eq('company_id', companyId)` para limpar os dados obsoletos daquele tenant e insere os novos dados etiquetados com o ISO timestamp em `synced_at`.

---

### 2.3 Segurança e Isolamento via RLS (Row Level Security)
Todas as tabelas operam com RLS ativo:
- **Leitura/Escrita protegida por JWT:** Chamadas sem `auth.uid()` válido são automaticamente rejeitadas.
- **Isolamento de Tenant:** As *policies* garantem que `company_id` deve bater com as empresas atribuídas no `profiles` do usuário solicitante ou o usuário deve ser superadmin.

---

## 3. Arquitetura e Engenharia no n8n

O **n8n** é o motor de orquestração assíncrona do ecossistema. Ele opera fluxos complexos de mais de 100 nós que conectam a ingestão de dados, processamento cognitivo via IA, mensageria via WhatsApp e persistência de dados.

### 3.1 Padrão Obrigatório de Prompts dos Agentes de IA (`AGENTS.md`)
Para garantir máxima velocidade, baixo custo de tokens e respostas padronizadas em formato JSON consumível por código, os prompts das esteiras seguem diretrizes restritas:

* **Escopo Estrito:** A IA tem a missão única de classificar o termo entre `SEGMENTAR` (✅), `NEGATIVAR` (❌), `TESTE_AB` (⚠️) ou `DUVIDA` (❓). As outras 3 opções devem retornar estritamente como string vazia (`""`).
* **Regra de Ouro do Negócio:** Se o termo bater com a Palavra-chave ou produto core da empresa, marcar **SEMPRE SEGMENTAR (✅)** e **NUNCA DÚVIDA**.
* **Payload de Saída Ultraleve (11 Chaves):**
  ```json
  [
    {
      "Termo de pesquisa": "nome do termo",
      "Palavra-chave": "palavra-chave ativadora",
      "Campanha": "nome da campanha",
      "Grupo de anúncios": "nome do grupo",
      "SEGMENTAR": "✅",
      "NEGATIVAR": "",
      "TESTE_AB": "",
      "DUVIDA": "",
      "Observacao": "Justificativa sintética",
      "Conversões": "0",
      "Impr.": "120"
    }
  ]
  ```
* **Tamanho do Prompt:** Entre 2.500 e 3.000 caracteres, reduzindo a latência de inferência em até 3x.

---

### 3.2 Processamento em Lotes (Batching) no n8n
Para não estourar a janela de contexto ou os limites de requisições por minuto da API do Google Gemini:
- Os termos extraídos da planilha ou do Supabase são divididos em **lotes de 30 itens** (Nó `Lote de 30 Itens`).
- Cada lote é serializado em JSON compacto e enviado ao nó do **Google Gemini (Chat Model)**.
- Um parser inteligente (`extrairJSON`) extrai a resposta entre `[` e `]` mesmo que a IA responda com formatações Markdown adicionais.

---

### 3.3 Gestão e Monitoramento Global de Falhas
O workflow conta com o nó nativo **`Error Trigger`**. Qualquer exceção não tratada em qualquer nó da árvore interrompe o fluxo com segurança e dispara um webhook de alerta formatado no grupo de WhatsApp com:
- Nome do nó que falhou;
- Mensagem de erro da stack trace;
- Timestamp da falha.

---

## 4. O Pocket Interno: Estrutura, Lógica e Funcionamento

O **Pocket Interno** é o coração da operação ágil da agência. Ele é o robô que vive dentro do grupo técnico de WhatsApp e conecta os analistas às esteiras de auditoria por meio de comandos de texto e enquetes interativas.

### 4.1 O Roteador Central de Comandos e Votos
Toda mensagem ou atualização recebida pela Evolution API chega ao webhook `webhook-votos-evolution`. O nó de código JavaScript executa uma série de validações e roteamento:

#### A. Guarda Crítica Anti-Loop
Como o bot também posta mensagens no mesmo grupo, ele possui um filtro estrito para não processar as suas próprias notificações:
```javascript
const textoTotal = allTexts.join(" ");
if (
  textoTotal.includes("1º VOTO REGISTRADO") ||
  textoTotal.includes("DÚVIDA ENVIADA AO CLIENTE") ||
  textoTotal.includes("DECISÃO CONCLUÍDA") ||
  textoTotal.includes("DIVERGÊNCIA DE VOTOS") ||
  textoTotal.includes("AUDITORIA FINALIZADA") ||
  textoTotal.includes("ERRO NO WORKFLOW")
) {
  return [{ json: { tipo_evento: "IGNORAR", motivo: "Prevenção anti-loop" } }];
}
```

#### B. Roteador de Comandos (/ups)
Detecta comandos no chat e direciona para as esteiras específicas:
* `/ups magichands` ➔ Dispara a esteira **Magic Hands** (Limpeza residencial/comercial nos EUA).
* `/ups endomarcas` ➔ Dispara a esteira **Endomarcas** (Equipamentos de endoscopia B2B).
* `/ups qualipix` ➔ Dispara a esteira **Qualipix** (Lousas digitais, totens, painéis de LED).
* `/ups estremoz` ➔ Dispara a esteira **Estremoz** (Cercamentos metálicos, gradil, telas industriais).
* `/ups runservice` ➔ Dispara a esteira **Run Service** (Controle de pragas, dedetizadora, desentupidora, limpa fossa e limpeza de caixas d'água).

---

### 4.2 As Esteiras de Julgamento Especializadas
Cada cliente atendido pelo Pocket possui uma sub-esteira no n8n calibrada com regras específicas:

| Cliente | Especialidade & Regras de Negócio Injetadas |
| :--- | :--- |
| **Magic Hands** | Serviços locais nos EUA. Separa intenção de contratação de vagas de emprego (`jobs`, `hiring`) e tutoriais DIY (`how to clean`). |
| **Endomarcas** | Termos médicos e hospitalares. Filtra peças de reposição e diferencia equipamentos humanos vs. veterinários. |
| **Qualipix** | Hardware B2B. Aplica regra de polegadas para eliminar TVs domésticas e monitores gamers B2C. |
| **Estremoz** | Cercamento perimetral. Bloqueia materiais fora do catálogo (madeira, alumínio, concertina, rede de nylon). |
| **Run Service** | Controle ambiental e desentupimento. Bloqueia tutoriais DIY ("como matar", "como acabar"), venenos caseiros de balcão e foca em serviços técnicos comerciais e residenciais (BH e região). |

---

### 4.3 O Algoritmo de Consenso de Votos (O Motor de Decisão)

O processamento de votos do Pocket Interno ocorre no nó de código **`3. Processar Votos e Consenso`**, utilizando memória persistente do n8n (`$getWorkflowStaticData('global')`):

```
                                Voto Recebido
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
         Veio de Grupo de Cliente?              Veio da Equipe Interna?
                   │                                     │
         ┌─────────┴─────────┐                  ┌────────┴────────┐
         │ VOTO SOBERANO     │                  │ Reconciliação   │
         │ (1 Voto Encerra)  │                  │ de Votos no Map │
         └─────────┬─────────┘                  └────────┬────────┘
                   │                                     │
                   ▼                                     ▼
          Grava Decisão &                       Bateu 2 Votos na Mesma Opção?
          Notifica Equipe                       ┌────────┴────────┐
                                               SIM               NÃO
                                                │                 │
                                                ▼                 ▼
                                        CONSENSO ATINGIDO   Houve Opções Distintas?
                                        - Se Dúvida:        ┌─────┴─────┐
                                          Despacha Cliente  SIM         NÃO
                                        - Se Decisão:        │           │
                                          Encerra Interno    ▼           ▼
                                                       DIVERGÊNCIA   1º Voto
                                                       (Alerta Chat) Registrado
```

#### Regras do Algoritmo:
1. **Normalização de Opções:** Transforma os textos brutos das enquetes em constantes padronizadas:
   * `🏢 Concorrente`
   * `❓ Dúvida (Enviar ao Cliente)`
   * `✅ Segmentar`
   * `❌ Negativar`
   * `⚠️ Teste A/B`
2. **Reconciliação e Desduplicação de Votos:**
   O nó lê o histórico da enquete via API da Evolution e armazena os votos em um `Map(participantId -> opcao)`, garantindo que se o mesmo analista mudar de voto, apenas o seu voto mais recente é contabilizado.
3. **Critério de Consenso da Equipe (2 Votos):**
   Exige `VOTOS_NECESSARIOS = 2` na mesma opção para declarar uma opção vencedora:
   - Se a vencedora for **Dúvida**: Dispara a enquete para o cliente.
   - Se for outra opção: Registra como **Decisão Interna Concluída**.
4. **Detecção Dinâmica de Divergência:**
   Se existirem votos ativos em 2 ou mais opções distintas, o sistema gera imediatamente um aviso no WhatsApp:
   > *"⚠️ DIVERGÊNCIA DE VOTOS!*\n👤 *Analista 1:* escolheu *❌ Negativar*\n👤 *Analista 2:* escolheu *✅ Segmentar*"
5. **Voto Soberano do Cliente:**
   Quando a enquete está no grupo do cliente (identificado via JID do WhatsApp), **1 voto do cliente é imediatamente soberano e encerra o ciclo**.

---

### 4.4 Mapeamento Dinâmico de Grupos WhatsApp (JIDs)
O sistema roteia o envio de dúvidas e respostas para os IDs oficiais de grupos cadastrados no WhatsApp:
* **Reportei (Cliente):** `120363412429579994@g.us`
* **Reportei (Pocket Interno / Especialistas):** `120363435040456024@g.us`
* **Qualipix (Cliente):** `120363402801713988@g.us`
* **Endomarcas (Cliente):** `120363407305667257@g.us`
* **Estremoz (Cliente):** `120363406729550086@g.us`
* **Run Service (Cliente):** `120363415485750352@g.us`
* **Magic Hands (Cliente):** `120363427648562835@g.us`
* **Grupo Interno (Equipe Pocket - Demais Empresas):** `120363424743503833@g.us`

---

### 4.5 Proteção Operacional Anti-Spam
Para evitar bloqueios de linha ou *rate limit* do WhatsApp:
- Entre cada enquete disparada no WhatsApp, o nó `Pausa Anti-Spam` aplica um atraso controlado (delay) de 3 a 5 segundos.
- As enquetes são unificadas via nó `Unificar para 1 Sinal` antes de disparar avisos de encerramento de lote.

---

## 5. Integração com a Evolution API

A **Evolution API** é o gateway que transforma o WhatsApp em uma interface programável.

### 5.1 Envio de Enquetes Interativas (Polls)
Ao despachar uma dúvida para o WhatsApp, o n8n monta uma requisição HTTP POST para a rota `/message/sendPoll`:
```json
{
  "number": "120363402801713988@g.us",
  "name": "AUDITORIA: Qualipix | Termo: 'lousa interativa 75 polegadas'",
  "selectableCount": 1,
  "values": [
    "✅ Segmentar",
    "❌ Negativar",
    "🏢 Concorrente",
    "❓ Dúvida (Enviar ao Cliente)",
    "⚠️ Teste A/B"
  ]
}
```

### 5.2 Leitura de Respostas via Webhook
A Evolution API publica eventos do tipo `pollUpdateMessage` ou `messages.upsert`:
- O n8n intercepta a chave `pollCreationMessageKey.id` para amarrar o voto exatamente àquele termo e àquela campanha.
- Lê o índice `selectedOptions` e converte na ação correspondente.

---

## 6. Integração Frontend (Dashboard Antygraviti OS) ↔ Backend

A interface web foi desenvolvida em **React 19, TypeScript, Tailwind CSS v4, Lucide Icons e Ant Design**:

### 6.1 Módulos Centrais do Frontend
1. **`SemanticAudit.tsx`**: Interface onde analistas podem auditar termos, alterar categorizações em tempo real, filtrar por campanha/grupo e disparar o botão *"Enviar Dúvidas ao Cliente"*.
2. **`AutomationConsole.tsx`**: Painel para cadastrar webhooks do n8n, disparar rotinas manualmente e acompanhar o **Terminal Antygraviti (v2.log)**.
3. **`WhatsAppBotConfig.tsx`**: Gestão dos webhooks de comunicação com a Evolution API.
4. **`CompanyManager.tsx`**: Provisionamento de novos clientes com chamada à RPC `provision_company_table`.
5. **`AntygravitiBI.tsx` (Copilot Multimodal)**: Chat interativo que invoca o Google Gemini para analisar imagens de criativos, landing pages e relatórios analíticos.

---

## 7. Sumário dos Componentes e Arquivos no Repositório

| Arquivo / Recurso | Tipo | Descrição Técnica |
| :--- | :--- | :--- |
| `Pocket interno - Magic Hands (...).json` | Workflow n8n | Fluxo completo do Pocket Interno (124 nós, roteador multitenant, consenso e Evolution API). |
| `Run Service - Nós para Copiar e Colar (n8n).json` | Workflow n8n | Módulo isolado de julgamento da Run Service para importação modular. |
| `Qualipix - Nós para Copiar e Colar (n8n).json` | Workflow n8n | Módulo isolado de julgamento da Qualipix para importação modular. |
| `Estremoz - Nós para Copiar e Colar (n8n).json` | Workflow n8n | Módulo isolado de julgamento da Estremoz para importação modular. |
| `Analise ADS Endomarcas.json` | Workflow n8n | Esteira de auditoria com extração de site e IA para a Endomarcas. |
| `src/lib/supabase.ts` | TypeScript | Inicializador do cliente Supabase com sessão persistente. |
| `src/lib/supabaseProvider.ts` | TypeScript | Operações de CRUD de empresas, Mesas Isoladas V4, batching (500) e deduplicação. |
| `AGENTS.md` | Regras / Spec | Especificação técnica de prompts e padrão de 11 chaves JSON para o Gemini. |
| `SUPABASE_DOCUMENTATION.md` | Documentação | Detalhamento do esquema de banco de dados e políticas RLS. |
| `DOCUMENTACAO_EXECUTIVA_POCKET.md` | Documentação | Documentação executiva, estratégica e conceitual para investidores e clientes. |

---

*Documentação Técnica de Arquitetura do Sistema Pocket Googlar / Antygraviti OS.*
