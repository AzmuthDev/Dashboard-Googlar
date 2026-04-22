# 📖 Documentação: Googlar Dashboard

Bem-vindo à documentação oficial do **Googlar Dashboard — Antygraviti OS**. Este sistema foi projetado com uma estética **B&W Premium (Black & White)**, focada em alta performance, clareza visual e micro-interações dinâmicas.

---

## 🎨 Sistema de Design: B&W Premium

O dashboard utiliza um sistema de cores binário de alto contraste, complementado por tons de cinza (Zinc/Slate) e cores de destaque semântico.

### 🌓 Temas
| Elemento | Modo Claro (Light) | Modo Escuro (Dark) |
| :--- | :--- | :--- |
| **Fundo (Background)** | `#f8fafc` (Slate-50) | `#09090b` (Zinc-950) |
| **Texto Principal** | `#0f172a` (Slate-950) | `#fafafa` (Zinc-50) |
| **Cards & Popovers** | `#ffffff` (Branco Puro) | `#09090b` (Preto Interativo) |
| **Bordas** | `#e4e4e7` (Zinc-200) | `#27272a` (Zinc-800) |
| **Primário/Ação** | `#18181b` (Zinc-900) | `#fafafa` (Zinc-50) |

### 🌈 Cores de Destaque (Semânticas)
Usadas para categorização de dados e estados do sistema:
- 🔵 **Info/Auditoria (Blue)**: `#1890FF`
- 🔴 **Negativo/Alerta (Red)**: `#F85149` / `#ef4444`
- 🟢 **Positivo/Sucesso (Green)**: `#00A37E` / `#00ffbc`
- 🟡 **Dúvida/Atenção (Orange)**: `#FAAD14` / `#f59e0b`
- 🟣 **Teste A/B (Purple)**: `#8b5cf6`

---

## 🚀 Opções do Dashboard (Navegação)

### 1. 📊 Dashboard Principal
Visualização consolidada de KPIs de performance e economia.
- **Cores**: Usa o sistema **Evervault** (preto/branco com glow) para os cards de destaque.
- **Gráficos**: Recharts customizados com gradientes em tons de cinza e azul.
- **Funcionalidade**: Ingestão de dados via Planilhas Google ou local (CSV/XLSX).

### 2. 🏢 Gerenciador de Empresas
Central de controle para alternar entre diferentes contas de clientes.
- **Estética**: Cards interativos que se invertem (Preto -> Branco) quando selecionados.
- **Cores**: Fundo neutro com bordas sutis.

### 3. 🔍 Auditoria Semântica
Análise profunda de termos de busca e intenção de compra.
- **Visual**: Tabela de alta densidade com **Linhas Coloridas** (Tints):
    - Vermelho Suave: Intenções Negativas.
    - Laranja Suave: Dúvidas de Clientes.
    - Verde Suave: Oportunidades de Segmentação.
- **Scrolling**: Scrollbar ultra-fina B&W.

### 4. 🪄 Planejador (Keyword Planner)
Integração com o motor **Antygraviti BI** para análise de concorrentes.
- **Micro-animações**: Skeleton screens em tons de cinza durante o carregamento via Webhook.
- **Feedback**: Badges brilhantes (`glow-badge`) para status de sucesso ou erro.

### 5. ⚡ Ferramenta (Automation Console)
Console para automações e disparos via WhatsApp.
- **Estética**: Estilo "Cyberpunk Minimalista" no Modo Escuro, com bordas iluminadas (`glowing-effect`).
- **Cores**: Azul elétrico e verde neon em detalhes de interação.

### 6. 🧪 Laboratório A/B
Ambiente de testes para comparação de campanhas.
- **Foco**: Clareza visual total com separação por cores de marca de teste (Roxo/Azul).

### 7. 👥 Gerenciar Acessos (User Manager)
Controle de usuários, permissões de Admin e vinculação de empresas.
- **Tabelas**: Estilo Ant Design customizado para remover todos os tons azuis padrão, substituindo por Preto/Cinza.

---

## 🛠️ Componentes Exclusivos

### Botão B&W Inverse
O botão padrão do sistema (`.btn-bw-inverse`). 
- No **Light Mode**: Fundo Branco / Texto Preto -> Hover vira Fundo Preto / Texto Branco.
- No **Dark Mode**: Fundo Preto / Texto Branco -> Hover vira Fundo Branco / Texto Preto.

### Evervault Card
Cards de estatísticas com efeito de "rastro" de mouse e tipografia de luxo. Utiliza transparências e blur (`backdrop-blur`) para um visual premium.

### Skeleton Screens
Utilizados durante o fetch de dados. Possuem um pulso suave em cinza claro, evitando o "salto" de conteúdo na tela.

---

> [!NOTE]
> Esta documentação reflete o estado atual da **V3 Premium**. Todas as interações foram desenhadas para serem responsivas e manterem o contraste acessível em ambos os temas.
