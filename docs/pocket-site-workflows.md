# Workflows do Pocket do site (n8n)

Esteira dos 5 workflows do site reconstruída no molde do Pocket interno (`ee8wTgiHKx1HUvek`). Gerador: `n8n/scripts/gen-ops-site.mjs` (testado com `npm test`); código dos nós Code em `n8n/code/*-site.cjs`; prompts em `n8n/prompts/*.txt`.

| Cliente | Workflow | Tabela | Grupo do cliente | Estado |
|---|---|---|---|---|
| Endomarcas | `izqF7glcXxReCXY2` | `mesa_endomarcas` | `120363407305667257@g.us` | ativo |
| Comparar Seguro Viagem | `yEITJcoPpuJB9sRI` | `mesa_comparar_seguro_viagem` | `120363411772521802@g.us` | **inativo** |
| Estremoz | `YzrPAnuQVoC2vyOhfRyb1` | `mesa_estremoz` | `120363406729550086@g.us` | ativo |
| Magic Hands | `pUdnw0fcaEM33izI` | `mesa_magic_hands` | `120363427648562835@g.us` | ativo |
| Qualipix | `wtNTrZrjPaXRpiiM` | `mesa_qualipix` | `120363402801713988@g.us` | ativo |

## Diagnóstico (2026-10-20)

- **Endomarcas parado**: o nó morto `Create a row` usava uma credencial apagada (`Supabase account 3`). O n8n checa credenciais antes de rodar, então o workflow inteiro falhava a cada minuto (2.015 execuções com erro em ~33 h): nem o envio de enquetes nem a análise semanal rodavam.
- **Negativas nunca gravadas** (Endomarcas, Estremoz, Magic Hands, Comparar): o código lia `NEGATIVO` em vez de `NEGATIVAR`, então `negativar` ia sempre `false` para o banco.
- **Observação apagada**: o formatador sobrescrevia a justificativa da IA com "Processado com sucesso"; a enquete mostrava isso como "Análise".
- **Lote processado duas vezes**: a gravação no Supabase e a cópia para a planilha voltavam as duas para o loop, que avançava duas vezes por lote.
- **Sem agente reserva**: um erro do Gemini (cota, timeout) derrubava a execução e os lotes seguintes não eram processados. No Endomarcas, o segundo agente ("blindagem") rodava em série, dobrando o ponto de falha.
- **Duplicatas**: toda rodada inseria de novo os mesmos termos (Qualipix com 9.000 linhas); o site não gravava `origem`, cliques nem impressões.
- **Prompts fora do padrão** do `AGENTS.md` (granularidade, sugestão de grupo, listas de grupos, 21 colunas de métricas).
- **Enquete com JSON quebrável**: termo ou observação com aspas/quebra de linha quebrava o corpo do `sendPoll` e o mesmo lote de 5 era tentado para sempre.
- **Histórico de execuções**: o envio a cada minuto gerava ~1.440 execuções/dia por workflow e a poda do n8n apagava as execuções semanais.
- **Qualipix**: ramo de votos morto (webhook `whatsapp-survey-response` que a Evolution não chama; gravava coluna `synced_at` inexistente, chamava URL de exemplo e mandava texto da Magic Hands para o grupo da Magic Hands).

### Por que a resposta do cliente nunca caiu no site

O caminho existe desde 2026-10-14 (roteador do interno → `registrar_resposta_cliente` acha o `id_enquete` numa `mesa_*`), e o payload de voto da Evolution (`messages.upsert` com `pollUpdateMessage`) é lido corretamente. Mas:

1. As 37 enquetes do site foram enviadas entre abril e julho de 2026, antes desse caminho existir; votos daquela época não foram registrados. Nenhuma enquete do site saiu depois de 2026-07-24 (a fila depende da triagem 1/2 + "pode enviar" no site; Comparar Seguro Viagem tinha o envio desconectado e o Endomarcas estava quebrado).
2. Quando o **interno** despacha a enquete de dúvida para o cliente, ele não guardava o id dessa enquete no banco. O voto do cliente dependia de reconstruir termo/cliente lendo o texto da enquete na Evolution e da memória do workflow.

Correção: nó `Preparar Vínculo da Enquete` → `Vincular Enquete do Cliente (RPC)` no interno grava o id da enquete enviada (`vincular_enquete_cliente`). O voto do cliente passa a ser achado por `registrar_resposta_cliente`, marcado como respondido e notificado ("RESPOSTA DO CLIENTE RECEBIDA (POCKET INTERNO|SITE: …)"), aparecendo em Respostas Cliente.

## Nova esteira (por workflow)

Planilha → `Buscar Julgados` (todas as linhas da mesa) → `Excluir Já Julgados` (cabeçalho PT/EN, sem total/duplicadas/já julgados) → `Há Termos Novos?` → `Lote de Itens` (15) → `Preparar Texto IA` (só as 6 chaves) → `IA Auditor Semântico` (Gemini 2.5 Flash-Lite, conta 3, 3 tentativas) → erro → `IA Auditor Semântico (Reserva)` (Gemini 2.5 Flash, conta 2) → erro → `Registrar Falha do Lote` → `Pausa Entre Lotes` → próximo lote.

`Normalizar Vereditos` cruza a resposta com o lote: métricas vêm da planilha, termo inventado é ignorado, termo omitido ou com 0/2+ símbolos fica sem veredito (volta na próxima rodada), dúvida que bate com a palavra-chave vira segmentar. Grava com `upsert_veredito(p_tabela, p_linhas, p_origem => 'site')` (não duplica, não toca linhas já respondidas pelo cliente). Endomarcas, Estremoz e Qualipix continuam copiando os vereditos para a planilha de saída (ramo que não volta ao loop). No fim, `Concluir Auditoria` → resumo no grupo da equipe (`120363424743503833@g.us`). `Error Trigger` → alerta no mesmo grupo. Execuções de sucesso não são mais salvas (erros sim).

Envio de enquetes: `Buscar 5 Pendentes` → `Montar Enquete` (JSON.stringify, formato Cliente/Termo/KW/Obs, ≤ 250 caracteres) → `Enviar Enquete Evolution` (1 a cada 3 s, 2 tentativas) → `Enquete Criada?` → `Marcar como Enviado` (só com id da Evolution).

## Banco

Migração `supabase/migrations/20261020120000_site_vereditos_vinculo_enquete.sql` (teste: `supabase/tests/site_vereditos_vinculo.test.sql`, roda em transação com rollback):

- `upsert_veredito(p_tabela, p_linhas, p_origem default 'interno')`: origem `interno|site`, usuário `Agente Site` no site, grava cliques/custo/ctr/cpc/tipo de correspondência quando vierem. A assinatura antiga de 2 argumentos é removida (a chamada do interno continua igual).
- `vincular_enquete_cliente(p_tabela, p_termo, p_campanha, p_grupo, p_id_enquete)`: mesma chave e fallback por termo de `registrar_decisao_interna`; cria a linha se não existir.

## Publicação

Publicado em 2026-10-20 (~20:12 UTC), depois de aplicar a migração `site_vereditos_vinculo_enquete`:

| Workflow | Versão publicada |
|---|---|
| Interno | `e5cd05ef-c4c9-42c3-9381-eaa95b00002d` |
| Endomarcas | `fd7d6b61-aae0-4aa0-b81e-a3a8b65a0744` |
| Estremoz | `bef68e4b-dfa1-443c-b4ce-4896c956633a` |
| Magic Hands | `b9d374d2-9f21-4bb4-ba33-b5db267ad173` |
| Qualipix | `8aacc4c6-21bc-4cc5-9215-6e6158bc86f0` |

Comparar Seguro Viagem ficou com o rascunho novo (`2fe24c63-5ce0-4c59-820a-900a7a4e6bcf`) e **inativo**. O Endomarcas parou de falhar a cada minuto logo após a publicação. A migração precisa vir antes da publicação: os workflows chamam `upsert_veredito` com `p_origem`.

Reverter: `restore_workflow_version` + publicar as versões anteriores:

| Workflow | Versão anterior (ativa em 2026-10-20) |
|---|---|
| Endomarcas | `14b24be6-f408-4c67-b5fc-cce5c156f4b8` |
| Comparar Seguro Viagem | `f8a79b66-2736-4ac6-b02a-8a9ec6697a10` |
| Estremoz | `e3ac47fc-2e58-4ab8-a59c-4b4c42567d51` |
| Magic Hands | `80080c74-34e3-457d-983d-66fe74518f27` |
| Qualipix | `734278f3-1287-4543-ad1e-f83baa62c2f8` |
| Interno | `012bc7e0-c514-4d21-a8b0-7cb32f3a1c8c` |

## Pendências conhecidas

- Chave da Evolution API em texto puro nos nós HTTP (padrão herdado; ideal: credencial `httpHeaderAuth`).
- Votos dados nas 37 enquetes antigas do site (abril–julho) não foram reprocessados.
- Linhas importadas pelo site (`SemanticAudit`) entram com `origem` nula e `id_enquete` aleatório até a enquete ser enviada.
