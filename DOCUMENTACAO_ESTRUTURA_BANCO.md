# Documentação Técnica: Estrutura de Dados e Tabelas

Esta documentação descreve detalhadamente o esquema das tabelas utilizadas no Antygraviti OS, focando na gestão de empresas e no armazenamento de dados de auditoria semântica.

---

## 1. Tabela: `companies` (Empresas/Tenants)
Esta tabela armazena os metadados das empresas cadastradas no ecossistema. É a base para a arquitetura multitenant.

| Coluna | Tipo SQL | Formato / Exemplo | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `550e8400-e29b...` | Chave primária única da empresa. |
| `name` | `text` | `Googlar Tech` | Nome fantasia ou razão social. |
| `owner_id` | `uuid` | `auth.users.id` | ID do proprietário (FK para autenticação). |
| `isActive` | `boolean` | `true / false` | Define se a empresa está visível no seletor. |
| `sheetsUrl` | `text` | `https://docs...` | Link para a planilha do Google Sheets. |
| `dataSourceType`| `text` | `sheets` ou `local` | Origem prioritária dos dados. |
| `logoUrl` | `text` | `https://cdn...` | Link para o logotipo da empresa. |
| `coverUrl` | `text` | `https://cdn...` | Link para imagem de destaque. |
| `users` | `jsonb` | `[{email, role}]` | Lista de usuários e seus níveis de acesso. |
| `created_at` | `timestamp`| `2025-01-01...` | Data e hora de registro. |

---

## 2. Tabela: `campaign_terms` (Dados de Campanha)
Esta tabela centraliza todos os termos de pesquisa importados. O isolamento entre clientes é feito via coluna `company_id`.

### **Identificadores e Contexto**
| Coluna | Tipo SQL | Descrição |
| :--- | :--- | :--- |
| `id` | `text` | ID único do registro (PK). |
| `company_id` | `uuid` | Vínculo obrigatório com a empresa (FK). |
| `campanha` | `text` | Nome da campanha original no Google Ads. |
| `grupo_de_anuncios`| `text` | Nome do grupo de anúncios. |

### **Dados Semânticos e de Triagem**
| Coluna | Tipo SQL | Descrição |
| :--- | :--- | :--- |
| `termo_de_pesquisa`| `text` | O termo real digitado pelo usuário. |
| `palavra_chave` | `text` | A palavra-chave que ativou o anúncio. |
| `observacao` | `text` | Comentários e notas do analista de auditoria. |
| `negativar` | `text/bool` | Flag: Indica se deve ser excluído (❌). |
| `duvida` | `text/bool` | Flag: Requer validação do cliente (❓). |
| `segmentar` | `text/bool` | Flag: Sugestão para novo grupo (✅). |
| `teste_ab` | `text/bool` | Flag: Marcado para experimento (⚠️). |
| `sugestao_grupo` | `text` | Nome sugerido para a nova segmentação. |
| `status_granularidade`| `text` | Avaliação da IA sobre a relevância do termo. |

### **Métricas de Performance (Numéricas)**
| Coluna | Tipo SQL | Descrição |
| :--- | :--- | :--- |
| `impressoes` | `numeric` | Quantidade de vezes que o anúncio apareceu. |
| `cliques` | `numeric` | Quantidade de cliques recebidos. |
| `custo` | `numeric` | Investimento total gasto no termo (R$). |
| `conversoes` | `numeric` | Quantidade de conversões registradas. |
| `ctr` | `numeric` | Click-Through Rate (%). |
| `cpc_medio` | `numeric` | Custo por clique médio. |
| `taxa_conv` | `numeric` | Percentual de cliques que viraram conversão. |
| `custo_conv` | `numeric` | Quanto custou cada conversão individualmente. |

### **Metadados Técnicos**
| Coluna | Tipo SQL | Descrição |
| :--- | :--- | :--- |
| `tipo_corresp` | `text` | Tipo de correspondência (Exata, Frase, Ampla). |
| `adicionada_excluida`| `text` | Status de implementação na conta de anúncios. |
| `synced_at` | `timestamp`| Data/Hora da última sincronização com o Dashboard. |

---

## 3. Considerações de Formato
1.  **Valores Monetários:** Todas as colunas de custo e CPC são tratadas como `numeric` no banco de dados, mas o Dashboard realiza a formatação para Real Brasileiro (`R$ 0,00`) na camada de interface.
2.  **Sinalizadores (Flags):** Embora suportem `boolean`, o sistema aceita `text` para permitir ícones visuais (como o emoji ❌) vindos diretamente de exportações de planilhas formatadas.
3.  **Performance:** A tabela `campaign_terms` utiliza índices na coluna `company_id` para garantir que consultas em massa (Bulk Select) sejam instantâneas mesmo com milhões de linhas.

---
*© 2025 GOOGLAR — ANTYGRAVITI OS*
