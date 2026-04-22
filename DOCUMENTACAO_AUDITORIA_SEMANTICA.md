# Documentação Técnica: Auditoria Semântica Premium

Esta documentação detalha o funcionamento do módulo de **Auditoria Semântica**, a ferramenta central para triagem estratégica de termos de pesquisa e otimização de campanhas no Antygraviti OS.

---

## 1. Visão Geral
A Auditoria Semântica é um fluxo de trabalho (workflow) colaborativo e inteligente que permite aos analistas processar grandes volumes de termos de busca, categorizando-os com base na intenção de compra e relevância para o negócio do cliente.

### **Objetivos Principais:**
- Eliminar desperdício de verba (Negativação).
- Identificar oportunidades de novos grupos de anúncios (Segmentação).
- Resolver ambiguidades comerciais (Dúvidas).
- Validar a qualidade das campanhas através de um processo de auditoria humana + IA.

---

## 2. Ferramentas Utilizadas
O módulo é construído sobre uma arquitetura moderna e integrada:
- **Frontend:** React 19 + TypeScript (Tipagem estrita para segurança de dados).
- **Componentes:** Ant Design v6 (Tabelas complexas com scroll fixo e seletores customizados).
- **Animações:** Framer Motion (Transições de estados e feedbacks visuais).
- **Ícones:** Lucide React (Representação visual de ações).
- **Backend/DB:** Supabase (Persistência em tempo real e isolamento RLS).
- **Integração Externa:** n8n (Orquestração de análise de DNA) e WhatsApp (Bot de dúvidas).

---

## 3. O Fluxo de Triagem (Workflow)

### **A. Seleção e Filtragem**
O analista seleciona uma **Campanha** e um **Grupo de Anúncios**. O sistema então filtra o banco de dados para exibir apenas os termos daquele contexto específico, permitindo foco total na estrutura da conta de anúncios.

### **B. Categorização (As 5 Intenções)**
Para cada termo, o analista seleciona uma categoria:
1.  **❌ Negativar:** Termos irrelevantes que consomem verba.
2.  **❓ Dúvida:** Termos que precisam de validação do cliente.
3.  **✅ Segmentar:** Termos bons que merecem um grupo de anúncio próprio.
4.  **⚠️ Teste A/B:** Termos para validação experimental.
5.  **➡️ Manter:** Termos que já estão performando corretamente.

### **C. Sistema de Confirmação Dupla (Quality Control)**
Para garantir 100% de precisão, o módulo implementa o sistema de **QC (Quality Control)**:
- **QC1:** Primeira revisão feita por um analista.
- **QC2:** Revisão final (geralmente por um analista sênior ou coordenador).
Ambas as confirmações registram o e-mail do auditor no banco de dados.

---

## 4. Integrações e Comunicação

### **A. Comunicação com Planilhas (Ingestão)**
Diferente de uma planilha tradicional, a Auditoria Semântica **não edita o arquivo original diretamente**. O fluxo é:
1.  A planilha (Google Sheets/CSV/XLSX) é lida pela camada de **Data Ingestion**.
2.  Os dados são "limpos" e normalizados (cabeçalhos unificados).
3.  Os dados são inseridos no **Supabase** na tabela `campaign_terms`.
4.  A Auditoria Semântica lê e edita esses dados **dentro do Supabase**. Isso permite colaboração em tempo real sem conflitos de arquivo.

### **B. Integração n8n (DNA da Empresa)**
Ao clicar na lupa de busca de um termo, o sistema dispara um webhook para o **n8n**:
- O n8n recebe o termo e a URL do site da empresa.
- Ele realiza uma busca profunda para entender se aquele termo tem "DNA comercial" com o produto do cliente.
- Retorna métricas vivas como volume de busca e dificuldade (KD) via integração com APIs de SEO (SEMrush).

### **C. Integração WhatsApp (Bot de Dúvidas)**
Existe um botão específico **"Enviar Dúvidas ao Cliente"**:
1.  O sistema filtra todos os termos categorizados como "Dúvida".
2.  Valida se o analista deixou um comentário explicando a dúvida.
3.  Dispara um payload JSON para o webhook do **WhatsApp Bot**.
4.  O bot formata esses termos e envia diretamente para o WhatsApp do cliente final para validação.

---

## 5. Estrutura de Dados (Supabase)
O módulo se comunica principalmente com a tabela `campaign_terms`:
- `id`: UUID único do termo.
- `company_id`: Vínculo com a empresa (Multi-tenancy).
- `observacao`: Comentários do analista (sincronizados via `handleCommentSync`).
- `negativar`, `duvida`, `segmentar`, `teste_ab`: Flags de sinalização.

---
*© 2025 GOOGLAR — ANTYGRAVITI OS*
