# Diretrizes de Desenvolvimento: Pocket Googlar

## 1. Padrão Obrigatório de Prompts dos Agentes de IA (n8n)
Todos os agentes de IA existentes (**Magic Hands**, **Endomarcas**, **Qualipix**, **Estremoz**, **Run Service**, **Reportei**) e **qualquer novo cliente/agente adicionado** ao workflow devem seguir estritamente este padrão de prompt otimizado:

### Escopo Estrito de Atuação:
- O agente tem uma **única missão**: classificar cada termo de pesquisa entre `SEGMENTAR` (✅), `NEGATIVAR` (❌), `TESTE_AB` (⚠️) ou `DUVIDA` (❓), deixando as outras 3 vazias (`""`).
- **PROIBIDO incluir no prompt:**
  - `STATUS_GRANULARIDADE` ("⚠️ DESLOCADO" / "✅ CORRETO").
  - `Sugestao_Grupo` ou listas de grupos de anúncios (`#Endoscopio Flexivel`, etc.).
  - Colunas de métricas brutas no output (`Cliques`, `CTR`, `CPC méd.`, `Custo`, etc.).

### Formato de Saída JSON Ultraleve (Apenas 11 Chaves):
Retornar estritamente um Array JSON puro com:
`Termo de pesquisa`, `Palavra-chave`, `Campanha`, `Grupo de anúncios`, `SEGMENTAR`, `NEGATIVAR`, `TESTE_AB`, `DUVIDA`, `Observacao`, `Conversões`, `Impr.`

### Tamanho do Prompt:
- No máximo **2.500 a 3.000 caracteres**.
- Reduz o consumo de tokens em >50% e acelera o tempo de resposta em até 3x.
- Se o termo bater com a Palavra-chave ou produto core da empresa, marcar **SEMPRE SEGMENTAR (✅)** e **NUNCA DÚVIDA**.
