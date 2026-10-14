-- Julgados e respostas do cliente: mesas novas, colunas de origem/resposta e funcoes de gravacao.
-- Spec: docs/superpowers/specs/2026-10-14-julgados-e-respostas-cliente-design.md

create extension if not exists unaccent with schema extensions;

-- Conjunto das mesas de cliente aceitas pelas funcoes (lista fechada: evita SQL dinamico arbitrario).
create or replace function public._mesas_cliente() returns text[]
language sql immutable as $$
  select array['mesa_magic_hands','mesa_endomarcas','mesa_qualipix','mesa_estremoz',
               'mesa_run_service','mesa_reportei','mesa_style_brokers','mesa_comparar_seguro_viagem']::text[]
$$;

-- Mesas novas (Run Service e Reportei) com o mesmo molde da Qualipix.
create table if not exists public.mesa_run_service (like public.mesa_qualipix including all);
create table if not exists public.mesa_reportei    (like public.mesa_qualipix including all);

alter table public.mesa_run_service enable row level security;
alter table public.mesa_reportei    enable row level security;

drop policy if exists "Permitir tudo para autenticados" on public.mesa_run_service;
drop policy if exists "Permitir tudo para autenticados" on public.mesa_reportei;
create policy "Permitir tudo para autenticados" on public.mesa_run_service for all to authenticated using (true);
create policy "Permitir tudo para autenticados" on public.mesa_reportei    for all to authenticated using (true);

-- Colunas novas em todas as mesas; linhas antigas vieram dos workflows do site.
do $$
declare t text;
begin
  foreach t in array public._mesas_cliente() loop
    execute format('alter table public.%I add column if not exists origem text', t);
    execute format('alter table public.%I add column if not exists data_resposta timestamptz', t);
    execute format('update public.%I set origem = ''site'' where origem is null', t);
  end loop;
end $$;

-- Chave de comparacao: minusculas, sem acento, espacos colapsados.
create or replace function public._chave_norm(p text) returns text
language sql stable set search_path = public, extensions as $$
  select lower(btrim(regexp_replace(extensions.unaccent(coalesce(p, '')), '\s+', ' ', 'g')))
$$;

-- Opcao de enquete -> acao (por palavra-chave, nao por emoji). Null = sem acao (ex.: Duvida).
create or replace function public._acao_de_opcao(p text) returns text
language plpgsql immutable as $$
declare s text := lower(coalesce(p, ''));
begin
  if s like '%negativar%' or s like '%concorrente%' or s like '%❌%' then return 'negativar'; end if;
  if s like '%relevante%' or s like '%segmentar%' or s like '%✅%' then return 'segmentar'; end if;
  if s like '%teste%' or s like '%a/b%' or s like '%⚠%' then return 'teste_ab'; end if;
  return null;
end $$;

-- Voto de cliente numa enquete do site: acha o id_enquete nas mesas e fecha a duvida.
create or replace function public.registrar_resposta_cliente(p_id_enquete text, p_opcao text, p_voter text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  t text;
  v_acao text := public._acao_de_opcao(p_opcao);
  v_id uuid; v_origem text; v_termo text; v_camp text; v_grupo text; v_kw text;
begin
  if p_id_enquete is null or btrim(p_id_enquete) = '' then
    return jsonb_build_object('encontrado', false);
  end if;

  foreach t in array public._mesas_cliente() loop
    v_id := null;
    execute format('select id, origem, termo_de_pesquisa, campanha, grupo_de_anuncios, palavra_chave from public.%I where id_enquete = $1 limit 1', t)
      into v_id, v_origem, v_termo, v_camp, v_grupo, v_kw using p_id_enquete;
    if v_id is not null then
      if v_acao is null then
        return jsonb_build_object('encontrado', true, 'ignorado', true, 'tabela', t);
      end if;
      execute format('update public.%I set segmentar = ($2 = ''segmentar''), negativar = ($2 = ''negativar''), teste_ab = ($2 = ''teste_ab''), duvida = false, respondido_cliente = true, enviado_para_grupo = true, acao = $2, data_resposta = now(), origem = coalesce(origem, ''site'') where id = $1', t)
        using v_id, v_acao;
      return jsonb_build_object('encontrado', true, 'ignorado', false, 'tabela', t,
        'origem', coalesce(v_origem, 'site'), 'acao', v_acao, 'termo', v_termo,
        'campanha', v_camp, 'grupo', v_grupo, 'palavra_chave', v_kw);
    end if;
  end loop;

  return jsonb_build_object('encontrado', false);
end $$;

-- Decisao do Pocket interno (consenso da equipe, despacho ao cliente ou voto do cliente) por termo+campanha+grupo.
create or replace function public.registrar_decisao_interna(
  p_tabela text, p_termo text, p_campanha text, p_grupo text, p_palavra_chave text, p_opcao text, p_estado text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_acao text := public._acao_de_opcao(p_opcao);
  v_id uuid;
begin
  if p_tabela is null or not (p_tabela = any (public._mesas_cliente())) then
    raise exception 'tabela invalida: %', p_tabela;
  end if;
  if p_estado is null or p_estado not in ('aguardando_cliente', 'decidido_equipe', 'respondido_cliente') then
    raise exception 'estado invalido: %', p_estado;
  end if;
  if p_estado in ('decidido_equipe', 'respondido_cliente') and v_acao is null then
    return jsonb_build_object('ignorado', true, 'tabela', p_tabela);
  end if;

  execute format('select id from public.%I where public._chave_norm(termo_de_pesquisa) = public._chave_norm($1) and public._chave_norm(campanha) = public._chave_norm($2) and public._chave_norm(grupo_de_anuncios) = public._chave_norm($3) order by created_at limit 1', p_tabela)
    into v_id using p_termo, p_campanha, p_grupo;

  if v_id is null then
    execute format('insert into public.%I (termo_de_pesquisa, campanha, grupo_de_anuncios, palavra_chave, origem, usuario) values ($1, $2, $3, $4, ''interno'', ''Pocket Interno'') returning id', p_tabela)
      into v_id using p_termo, p_campanha, p_grupo, p_palavra_chave;
  end if;

  if p_estado = 'aguardando_cliente' then
    execute format('update public.%I set duvida = true, segmentar = false, negativar = false, teste_ab = false, enviado_para_grupo = true, respondido_cliente = false, acao = null where id = $1', p_tabela)
      using v_id;
  elsif p_estado = 'decidido_equipe' then
    execute format('update public.%I set segmentar = ($2 = ''segmentar''), negativar = ($2 = ''negativar''), teste_ab = ($2 = ''teste_ab''), duvida = false where id = $1', p_tabela)
      using v_id, v_acao;
  else
    execute format('update public.%I set segmentar = ($2 = ''segmentar''), negativar = ($2 = ''negativar''), teste_ab = ($2 = ''teste_ab''), duvida = false, respondido_cliente = true, enviado_para_grupo = true, acao = $2, data_resposta = now() where id = $1', p_tabela)
      using v_id, v_acao;
  end if;

  return jsonb_build_object('ignorado', false, 'tabela', p_tabela, 'estado', p_estado, 'acao', v_acao);
end $$;

-- Vereditos da IA do Pocket interno: atualiza por chave normalizada (sem tocar respondidas) ou insere.
create or replace function public.upsert_veredito(p_tabela text, p_linhas jsonb)
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  e jsonb; n integer := 0;
  v_id uuid; v_resp boolean;
  v_termo text; v_camp text; v_grupo text; v_kw text; v_obs text; v_impr text; v_conv text;
  v_seg boolean; v_neg boolean; v_tst boolean; v_duv boolean;
begin
  if p_tabela is null or not (p_tabela = any (public._mesas_cliente())) then
    raise exception 'tabela invalida: %', p_tabela;
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
      execute format('update public.%I set segmentar = $2, negativar = $3, teste_ab = $4, duvida = $5, observacao = $6, origem = coalesce(origem, ''interno'') where id = $1', p_tabela)
        using v_id, v_seg, v_neg, v_tst, v_duv, v_obs;
    else
      execute format('insert into public.%I (termo_de_pesquisa, campanha, grupo_de_anuncios, palavra_chave, segmentar, negativar, teste_ab, duvida, observacao, impressoes, conversoes, origem, usuario, pode_enviar) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ''interno'', ''Pocket Interno'', false)', p_tabela)
        using v_termo, v_camp, v_grupo, v_kw, v_seg, v_neg, v_tst, v_duv, v_obs, v_impr, v_conv;
    end if;
    n := n + 1;
  end loop;

  return n;
end $$;

-- Escrita somente via service_role (n8n). Nunca anon/authenticated.
revoke all on function public.registrar_resposta_cliente(text, text, text) from public, anon, authenticated;
revoke all on function public.registrar_decisao_interna(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.upsert_veredito(text, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_resposta_cliente(text, text, text) to service_role;
grant execute on function public.registrar_decisao_interna(text, text, text, text, text, text, text) to service_role;
grant execute on function public.upsert_veredito(text, jsonb) to service_role;
