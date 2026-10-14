# Regra Obrigatória: Otimização de Prompts para Agentes de Auditoria Semântica (Pocket Googlar)

Esta regra é MANDATÓRIA e se aplica a TODOS os agentes de IA existentes e a qualquer novo cliente/agente adicionado aos workflows do n8n (ex: Magic Hands, Endomarcas, Qualipix e futuros anunciantes).

---

## 1. Escopo Estrito de Atuação (Apenas Classificação Semântica)
O agente de IA no n8n tem uma **única missão objetiva**: classificar cada termo de pesquisa entre as 4 opções de decisão da esteira:
- `SEGMENTAR`: ("✅" ou "")
- `NEGATIVAR`: ("❌" ou "")
- `TESTE_AB`: ("⚠️" ou "")
- `DUVIDA`: ("❓" ou "")
- `Observacao`: Motivo conciso caso seja Negativação ou Dúvida.

### 🚫 Atividades Terminantemente Proibidas nos Prompts:
1. **Auditoria de Granularidade / Categoria:**
   - **NUNCA** incluir instruções de checagem de grupo como `STATUS_GRANULARIDADE="⚠️ DESLOCADO"` ou `STATUS_GRANULARIDADE="✅ CORRETO"`.
2. **Sugestão de Grupos de Anúncios:**
   - **NUNCA** instruir preenchimento de `Sugestao_Grupo`. O workflow opera no WhatsApp para aprovação de termos e não executa reestruturação de campanhas em tempo real.
3. **Lista de Grupos Oficiais:**
   - **NUNCA** injetar listas de dezenas de grupos oficiais no prompt (`#Endoscopio Flexivel`, `#Olympus`, etc.). Isso consome milhares de tokens sem nenhuma utilidade prática.
4. **Metadados e Filosofias Longas:**
   - Evitar textos prolixos ("robô de cópia cega", "o espelho", etc.). Seja direto nas instruções operacionais.

---

## 2. Formato de Saída JSON Ultraleve (Apenas 11 Chaves)
O nó de IA deve retornar **APENAS** as 11 chaves estritamente necessárias consumidas pelo nó seguinte (`Avaliar Lote (Dúvidas?)`) e pela enquete do WhatsApp:

```json
[
  {
    "Termo de pesquisa": "exatamente como na entrada",
    "Palavra-chave": "exatamente como na entrada",
    "Campanha": "exatamente como na entrada",
    "Grupo de anúncios": "exatamente como na entrada",
    "SEGMENTAR": "✅",
    "NEGATIVAR": "",
    "TESTE_AB": "",
    "DUVIDA": "",
    "Observacao": "",
    "Conversões": "0",
    "Impr.": "0"
  }
]
```

### 🚫 Proibido Gerar Colunas Inúteis de Métricas:
**JAMAIS** pedir para a IA retornar ou copiar colunas de métricas brutas:
- ❌ "Cliques", "CTR", "CPC méd.", "Custo", "Custo / conv.", "Tipo de corresp.", "Adicionada/excluída", "Taxa de conv.", "STATUS_GRANULARIDADE", "Sugestao_Grupo".

---

## 3. Tamanho e Estrutura Padrão dos Prompts (Máx. 2.500 - 3.000 caracteres)
Todos os prompts devem seguir rigorosamente esta estrutura enxuta:

1. **Cabeçalho:**
   `=🎯 COMANDO: AUDITORIA SEMÂNTICA [B2B / Local] ([Nome do Cliente])`
   `DADOS DE ENTRADA: {{ $json.meu_texto_pronto }}`
2. **Identidade e Missão em 2 frases:**
   Especialista no nicho do cliente, com missão de classificar cada termo em exatamente UMA das 4 colunas.
3. **Critérios de Decisão (Bullet points objetivos):**
   - **1. ❌ NEGATIVAR:** Vazamentos de verba (vagas, DIY, curiosos, termos fora do escopo, B2C se a empresa for B2B).
   - **2. ✅ SEGMENTAR:** Intenção de compra/serviço, marcas core, aparelhos, suprimentos.
     - *Regra de Ouro:* Se o termo corresponder à Palavra-chave ou ao produto/serviço core legítimo, marcar **SEMPRE SEGMENTAR (✅)** e **NUNCA DÚVIDA**.
   - **3. ❓ DÚVIDA:** Apenas real ambiguidade comercial humana (ex: idioma estrangeiro comercial, termo vago de 1 palavra sem contexto).
   - **4. ⚠️ TESTE_AB:** Nichos comerciais promissores para validação de expansão.
4. **Instruções de Saída:**
   Array JSON puro, mesma quantidade de linhas da entrada, sem markdown (sem \`\`\`json).
