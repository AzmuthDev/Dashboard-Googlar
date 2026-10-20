-- Pocket do site passa a gravar vereditos pelo mesmo RPC do interno, e o interno passa a guardar o id
-- da enquete que despacha no grupo do cliente (o voto do cliente cai direto no site).

-- upsert_veredito: origem configuravel (interno | site) e metricas opcionais da planilha.
-- A assinatura antiga (2 argumentos) sai para a chamada com {p_tabela, p_linhas} nao ficar ambigua.
drop function if exists public.upsert_veredito(text, jsonb);

create or replace function public.upsert_veredito(p_tabela text, p_linhas jsonb, p_origem text default 'interno')
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  e jsonb; n integer := 0;
  v_id uuid; v_resp boolean;
  v_termo text; v_camp text; v_grupo text; v_kw text; v_obs text; v_impr text; v_conv text;
  v_seg boolean; v_neg boolean; v_tst boolean; v_duv boolean;
  v_origem text := coalesce(nullif(btrim(p_origem), ''), 'interno');
begin
  if p_tabela is null or not (p_tabela = any (public._mesas_cliente())) then
    raise exception 'tabela invalida: %', p_tabela;
  end if;
  if v_origem not in ('interno', 'site') then
    raise exception 'origem invalida: %', p_origem;
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) loop
    v_termo := nullif(btrim(e->>'termo'), '');
    if v_termo is null then continue; end if;
    v_camp := coalesce(e->>'campanha', ''); v_grupo := coalesce(e->>'grupo', '');
    v_kw := e->>'palavra_chave'; v_obs := e->>'observacao';
    v_impr := coalesce(e->>'impressoes', '0'); v_conv := coalesce(e->>'conversoes', '0');
    v_seg := coalesce((e->>'segmentar')::boolean, false);
    v_neg := coalesce((e->>'negativar')::boolean, false);
    v_tst := coalesce((e->>'teste_ab')::boolean, false);
    v_duv := coalesce((e->>'duvida')::boolean, false);

    v_id := null; v_resp := null;
    execute format('select id, coalesce(respondido_cliente, false) from public.%I where public._chave_norm(termo_de_pesquisa) = public._chave_norm($1) and public._chave_norm(campanha) = public._chave_norm($2) and public._chave_norm(grupo_de_anuncios) = public._chave_norm($3) order by created_at limit 1', p_tabela)
      into v_id, v_resp using v_termo, v_camp, v_grupo;

    if v_id is not null then
      if v_resp then continue; end if;
      execute format('update public.%I set segmentar = $2, negativar = $3, teste_ab = $4, duvida = $5, observacao = $6, origem = coalesce(origem, $7) where id = $1', p_tabela)
        using v_id, v_seg, v_neg, v_tst, v_duv, v_obs, v_origem;
    else
      execute format('insert into public.%I (termo_de_pesquisa, campanha, grupo_de_anuncios, palavra_chave, segmentar, negativar, teste_ab, duvida, observacao, impressoes, conversoes, cliques, custo, ctr, cpc_medio, tipo_corresp, origem, usuario, pode_enviar) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, coalesce($12, ''0''), $13, $14, $15, $16, $17, $18, false)', p_tabela)
        using v_termo, v_camp, v_grupo, v_kw, v_seg, v_neg, v_tst, v_duv, v_obs, v_impr, v_conv,
              nullif(e->>'cliques', ''), nullif(e->>'custo', ''), nullif(e->>'ctr', ''), nullif(e->>'cpc_medio', ''), nullif(e->>'tipo_corresp', ''),
              v_origem, case v_origem when 'site' then 'Agente Site' else 'Pocket Interno' end;
    end if;
    n := n + 1;
  end loop;

  return n;
end $$;

-- Enquete de duvida despachada pelo interno no grupo do cliente: grava o id na linha do termo
-- (mesma chave e mesmo fallback por termo de registrar_decisao_interna; cria a linha se ainda nao existe).
create or replace function public.vincular_enquete_cliente(
  p_tabela text, p_termo text, p_campanha text, p_grupo text, p_id_enquete text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_sem_contexto boolean :=
    public._chave_norm(p_campanha) in ('', 'geral') and public._chave_norm(p_grupo) in ('', 'geral');
begin
  if p_tabela is null or not (p_tabela = any (public._mesas_cliente())) then
    raise exception 'tabela invalida: %', p_tabela;
  end if;
  if nullif(btrim(p_id_enquete), '') is null or nullif(btrim(p_termo), '') is null then
    return jsonb_build_object('ignorado', true, 'tabela', p_tabela);
  end if;

  execute format('select id from public.%I where public._chave_norm(termo_de_pesquisa) = public._chave_norm($1) and public._chave_norm(campanha) = public._chave_norm($2) and public._chave_norm(grupo_de_anuncios) = public._chave_norm($3) order by created_at limit 1', p_tabela)
    into v_id using p_termo, p_campanha, p_grupo;

  if v_id is null and v_sem_contexto then
    execute format('select id from public.%I where public._chave_norm(termo_de_pesquisa) = public._chave_norm($1) order by coalesce(respondido_cliente, false), coalesce(duvida, false) desc, created_at limit 1', p_tabela)
      into v_id using p_termo;
  end if;

  if v_id is null then
    execute format('insert into public.%I (termo_de_pesquisa, campanha, grupo_de_anuncios, origem, usuario) values ($1, $2, $3, ''interno'', ''Pocket Interno'') returning id', p_tabela)
      into v_id using p_termo, p_campanha, p_grupo;
  end if;

  execute format('update public.%I set id_enquete = $2, duvida = true, segmentar = false, negativar = false, teste_ab = false, enviado_para_grupo = true, respondido_cliente = false, acao = null where id = $1', p_tabela)
    using v_id, p_id_enquete;

  return jsonb_build_object('ignorado', false, 'tabela', p_tabela, 'id', v_id);
end $$;

revoke all on function public.upsert_veredito(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.vincular_enquete_cliente(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.upsert_veredito(text, jsonb, text) to service_role;
grant execute on function public.vincular_enquete_cliente(text, text, text, text, text) to service_role;
