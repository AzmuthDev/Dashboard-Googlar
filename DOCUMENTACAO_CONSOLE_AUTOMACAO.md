# Documentação Técnica: Console de Automação Antygraviti

O **Console de Automação** é o centro de comando para orquestração de processos externos, inteligência artificial e gatilhos de comunicação do ecossistema Googlar.

---

## 1. Módulos do Console

O console é dividido em abas estratégicas, cada uma responsável por um tipo de integração:

### **A. Automações n8n (Webhooks)**
- **Função:** Permite cadastrar e disparar manualmente fluxos de trabalho hospedados no n8n.
- **Workflow:** O usuário cadastra uma URL de webhook do n8n vinculada à empresa. Ao clicar em "Disparar", o Dashboard envia um payload JSON contendo os dados da empresa e o timestamp da execução.
- **Diferencial:** Possui um sistema de "Status: Online/Pendente" e registra a data da última execução.

### **B. Copilot IA (Agente Multimodal)**
- **Motor:** Gemini 1.5 Pro (Google Cloud).
- **Capacidades:** 
    - Análise de imagens (visão computacional).
    - Processamento de documentos e planilhas complexas.
    - Geração de mockups e sugestões de otimização de anúncios.
- **Integração:** O agente tem consciência do contexto da empresa selecionada (nome, automações ativas, triggers).

### **C. Gatilhos de Conversação**
- **Função:** Gerencia webhooks focados em fluxos de diálogo e atendimento.
- **Uso:** Ideal para disparar fluxos que iniciam conversas em plataformas externas ou sistemas de CRM baseados em gatilhos específicos (ex: "Novo Lead", "Erro de Fluxo").

### **D. Bot WhatsApp**
- **Função:** Interface de configuração para o robô de comunicação com o cliente.
- **Configuração:** Armazena a URL do webhook que o bot de WhatsApp deve escutar para receber dados da Auditoria Semântica.

---

## 2. Terminal Antygraviti (v2.log)

Uma das funcionalidades mais críticas para desenvolvedores e analistas sênior é o **Terminal de Log integrado**.

- **Monitoramento em Tempo Real:** Ao disparar qualquer webhook, o terminal abre automaticamente.
- **Logs de Execução:** Exibe o passo a passo da comunicação:
    1. Conexão com o servidor orbitador.
    2. Preparação do payload JSON.
    3. Resposta do servidor (ex: 200 OK ou erros HTTP).
    4. Finalização de processamento seguro.
- **Visual:** Interface estilo "hacker" em preto e neon para facilitar a identificação de erros críticos (vermelho) ou sucessos (verde).

---

## 3. Segurança e Configurações Globais

### **Gestão de Chaves de API**
Na aba de **Configurações**, administradores podem gerenciar a `GEMINI_API_KEY`.
- **Local Storage Seguro:** As chaves são armazenadas localmente no navegador do administrador, garantindo que o dashboard possa realizar chamadas diretas ao motor da IA sem expor a chave em logs de servidor intermediários.
- **Status do Motor:** Indicador visual (pulso verde) que confirma se o motor de IA está configurado e pronto para uso.

---

## 4. Arquitetura de Comunicação (Payload)

Sempre que uma automação é disparada, o Dashboard envia o seguinte padrão de dados para o n8n/Webhook:

```json
{
  "companyName": "Nome da Empresa Selecionada",
  "timestamp": "2025-05-20T10:00:00.000Z",
  "automationId": "123456789",
  "context": "n8n_manual_trigger"
}
```

Isso permite que o n8n saiba exatamente qual empresa está solicitando a automação e possa buscar dados complementares via API do Supabase se necessário.

---

## 5. Ferramentas Utilizadas
- **Lucide React:** Para iconografia de status (Zap, Activity, Bot).
- **Ant Design Modals:** Para formulários de cadastro de novos webhooks.
- **Tailwind CSS + Glassmorphism:** Interface moderna com desfoque de fundo e bordas metálicas.
- **Evervault Card:** Efeito visual premium nos cards de automação.

---
*© 2025 GOOGLAR — ANTYGRAVITI OS*
