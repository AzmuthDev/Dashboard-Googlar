# Filtro "já julgado" e Respostas do Cliente

Spec: `docs/superpowers/specs/2026-10-14-julgados-e-respostas-cliente-design.md` · Plano: `docs/superpowers/plans/2026-10-14-julgados-e-respostas-cliente.md`

## Banco (Supabase "Dashboard Googlar", `jmptroahcezmpjdplxwy`)

Migrações: `supabase/migrations/20261014120000_julgados_respostas.sql` e `20261014120500_helpers_search_path.sql`. Teste: `supabase/tests/julgados_respostas.test.sql` (roda em transação com rollback).

- Mesas novas `mesa_run_service` e `mesa_reportei` (molde da `mesa_qualipix`, RLS e política "Permitir tudo para autenticados").
- Todas as 8 `mesa_*` ganham `origem` (`interno` | `site`; linhas antigas = `site`) e `data_resposta`.
- Funções (somente `service_role` executa; nunca `anon`/`authenticated`):
  - `registrar_resposta_cliente(p_id_enquete, p_opcao, p_voter)` — voto numa enquete do site; a última opção vence.
  - `registrar_decisao_interna(p_tabela, p_termo, p_campanha, p_grupo, p_palavra_chave, p_opcao, p_estado)` — estados `aguardando_cliente`, `decidido_equipe`, `respondido_cliente`.
  - `upsert_veredito(p_tabela, p_linhas)` — vereditos da IA do interno; não toca linhas já respondidas.
- Chave de comparação: termo + campanha + grupo, minúsculas, sem acento, espaços colapsados (`_chave_norm`).

## n8n (workflow `ee8wTgiHKx1HUvek`)

Código dos nós Code vive em `n8n/code/*.cjs` (testado com `npm test`); `n8n/scripts/gen-ops.mjs` gera as operações de `update_workflow` (`node n8n/scripts/gen-ops.mjs <backup.json> <cliente|roteador>`; saída em `n8n/out/`, ignorada pelo git por conter a apikey).

- Por esteira: `Buscar Julgados` → `Excluir Já Julgados` → `Há Termos Novos?` → `Inicializar Estatísticas`; aviso no grupo da equipe (`Montar Aviso do Filtro` → `Notificar Filtro`); a saída da IA vai também para `Normalizar Vereditos` → `Gravar Vereditos` (RPC `upsert_veredito`).
- Roteador: `1. Extrair ID e Voto` → `Registrar Resposta Site (RPC)` → `Classificar Origem do Voto` → `É Enquete do Site?` (sim: notifica a equipe; não: caminho antigo). Decisões do interno: `3. Processar Votos e Consenso` → `Preparar Registro de Decisão` → `Gravar Decisão (RPC)`.
- Origem: `id_enquete` achado numa `mesa_*` = `site`; caso contrário `interno`.
- Reverter: `restore_workflow_version` para a versão `4e8b3a2a-6067-4527-8c47-efef24fea8af` (backup em `n8n/backups/`, não versionado).

## Tela "Respostas Cliente"

`src/components/SemanticAudit.tsx` + `src/utils/adsExport.ts`: coluna e filtro de origem, status por ação (segmentar/negativar/teste A/B) e exportação por tipo (formato Google Ads Editor: `Campaign`, `Ad group`, `Keyword`, `Criterion Type`; negativa Exata/Frase/Ampla; Teste A/B em lista separada).

## Pendências conhecidas (não alteradas)

- Chave da Evolution API em texto puro em vários nós (inclusive nos nós novos, que copiam o padrão dos vizinhos).
- Workflow de Endomarcas do site com um nó gravando em `mesa_qualipix`.
- `Trigger Refresh Dashboard` do Qualipix do site aponta para URL de exemplo.
- Sem controle de "resposta exportada": vale a última opção votada.
- "Concorrente" conta como negativar, mas a observação "concorrente" não é registrada.
- Alertas de segurança do Supabase que já existiam: `handle_new_user` e `provision_company_table` executáveis por `anon`/`authenticated`; `mesa_supress` com política pública; proteção contra senhas vazadas desativada.
