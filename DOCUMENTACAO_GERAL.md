# Documentação Geral: Googlar Dashboard (Antygraviti OS)

O **Googlar Dashboard** é um sistema avançado de Business Intelligence e automação (Antygraviti OS) projetado para gerenciar campanhas de marketing, auditorias semânticas e infraestrutura multitenant de forma automatizada e inteligente.

---

## 🛠️ Stack Tecnológica (Ferramentas)

A plataforma utiliza as tecnologias mais modernas do mercado para garantir performance, escalabilidade e uma experiência de usuário (UX) premium.

### **Frontend Core**
- **React 19 & TypeScript**: Base sólida e tipagem estrita para maior segurança no desenvolvimento.
- **Vite**: Build tool ultrarrápida para desenvolvimento e produção.
- **TanStack React Query**: Gerenciamento de estado assíncrono e cache de dados do Supabase.
- **React Router Dom**: Navegação fluida entre os módulos do dashboard.

### **Design & Experiência (UI/UX)**
- **Tailwind CSS 4**: Estilização moderna com utilitários de última geração.
- **Framer Motion & GSAP**: Animações fluidas, transições de página e micro-interações de alta performance.
- **Ant Design (v6)**: Componentes de interface robustos (Tabelas, Modais, Seletores).
- **Radix UI**: Primitivas acessíveis para componentes customizados (Tabs, Dialogs).
- **Lucide React & Ant Design Icons**: Conjunto iconográfico moderno e consistente.
- **Styled Components**: Estilização dinâmica para componentes específicos.

### **Visualização de Dados**
- **Recharts**: Gráficos interativos para análise de KPIs e performance de termos.
- **Cobe & Globe.gl**: Visualizações 3D de globos para representação de dados globais e infraestrutura.

### **Backend & Infraestrutura**
- **Supabase**: Backend-as-a-Service (BaaS) provendo:
  - **PostgreSQL**: Banco de dados relacional com suporte a RLS (Row Level Security).
  - **Supabase Auth**: Autenticação segura com suporte a múltiplos níveis de acesso (Admin/Usuário).
- **Multi-tenancy**: Arquitetura de tabela única com isolamento rigoroso por empresa (Company ID).

### **Inteligência Artificial (AI)**
- **Google Generative AI (Gemini 1.5 Pro)**: Motor de inteligência para auditorias semânticas, análise multimodal (texto/imagem) e geração de insights de BI.

---

## 🚀 Funcionalidades Principais

### **1. Unified Dashboard (Home)**
- **KPIs em Tempo Real**: Visualização imediata de Economia Gerada, Termos Auditados, Novos Leads B2B e Acurácia da IA.
- **Gráficos de Performance**: Análise de distribuição de intenção e tendências de termos de campanha via Recharts.
- **Ingestão de Dados Híbrida**: 
    - **Arquivos Locais**: Suporte total para CSV, XLS e XLSX com normalização automática de cabeçalhos.
    - **Google Sheets**: Sincronização via URL pública (exportação CSV) com suporte a abas específicas (GID).
    - **Persistência**: Sincronização em massa com o Supabase para persistência de dados auditados.

### **2. Auditoria Semântica Premium**
- **Triagem Inteligente**: Categorização de termos em "Negativar", "Dúvida", "Segmentar", "Teste A/B" ou "Manter".
- **Workflow Colaborativo**: Sistema de confirmação dupla (QC1 e QC2) para garantir a qualidade da auditoria.
- **DNA BI Integration**: Busca automática de DNA da empresa e métricas vivas (Volume, KD, CPC) integradas.

### **3. Console de Automação**
- **Orquestração n8n**: Gerenciamento e disparo manual de webhooks do n8n diretamente pelo dashboard.
- **Terminal Antygraviti**: Interface de log em tempo real para monitorar a execução de automações e retornos de APIs.
- **Triggers de Conversação**: Configuração de gatilhos automáticos baseados em eventos externos.

### **4. Antygraviti BI (AI Copilot)**
- **Agente Multimodal**: Chat interativo alimentado pelo Gemini 1.5 Pro capaz de analisar imagens de landing pages, mockups e métricas complexas.
- **Análise Comercial**: Geração de prompts otimizados e resumos estratégicos para tomada de decisão.

### **5. Planejador de Palavras-Chave (Keyword Planner)**
- Ferramenta dedicada para pesquisa e planejamento de novos termos estratégicos baseados nos dados históricos das campanhas.

### **6. Gestão Multitenant (Empresas e Usuários)**
- **Company Manager**: Interface para criação de novas empresas com provisionamento automático de infraestrutura.
- **User Manager**: Controle granular de permissões, papéis (Admin/User) e acesso a empresas específicas.

### **7. Laboratório A/B**
- Playground experimental para testar hipóteses e variações de termos antes da implementação em larga escala.

---

## 🔌 Integrações

O Dashboard atua como um hub central, conectando-se a diversos serviços externos:

- **Supabase (Core)**: Sincronização em tempo real de todas as configurações, auditorias e logs.
- **Google Gemini API**: Inteligência artificial para análise de dados e visão computacional.
- **n8n**: Motor de automação de fluxo de trabalho para processamento de dados e notificações.
- **WhatsApp (via Webhook)**: Envio direto de termos categorizados como "Dúvida" para o cliente final via bot automatizado.
- **SEMrush (Via n8n/BI)**: Obtenção de métricas vivas de SEO e tráfego pago (Volume, Dificuldade, CPC).
- **Hostinger/VPS (Provisionamento)**: Integração via Coolify para deploy automático e configuração de infraestrutura/DNS (workflow `/app`).

---

## 🔒 Segurança e Isolamento

- **Row Level Security (RLS)**: Cada empresa só visualiza seus próprios dados, garantindo total privacidade em um ambiente multitenant.
- **Encryption**: Chaves de API (como a do Gemini) são gerenciadas de forma segura e, quando armazenadas localmente, permanecem isoladas no navegador do usuário.
- **Roles & Permissions**: Sistema de controle de acesso que restringe funções administrativas (como exclusão de automações ou criação de empresas) apenas a usuários autorizados.

---
*© 2025 GOOGLAR — ANTYGRAVITI OS*
