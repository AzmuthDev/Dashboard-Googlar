-- registrar_decisao_interna: quando o voto vem de uma enquete cujo texto nao carrega campanha/grupo
-- (o no "3. Processar Votos e Consenso" cai em 'Geral'/'Geral'), casa a linha so pelo termo, em vez de
-- criar uma linha duplicada 'Geral/Geral' que o filtro de ja julgados e a exportacao nao reconhecem.
create or replace function public.registrar_decisao_interna(
  p_tabela text, p_termo text, p_campanha text, p_grupo text, p_palavra_chave text, p_opcao text, p_estado text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_acao text := public._acao_de_opcao(p_opcao);
  v_id uuid;
  v_sem_contexto boolean :=
    public._chave_norm(p_campanha) in ('', 'geral') and public._chave_norm(p_grupo) in ('', 'geral');
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

  -- Sem campanha/grupo reais: usa a linha ainda em aberto desse termo (duvida primeiro, mais antiga primeiro).
  if v_id is null and v_sem_contexto then
    execute format('select id from public.%I where public._chave_norm(termo_de_pesquisa) = public._chave_norm($1) order by coalesce(respondido_cliente, false), coalesce(duvida, false) desc, created_at limit 1', p_tabela)
      into v_id using p_termo;
  end if;

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

revoke all on function public.registrar_decisao_interna(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_decisao_interna(text, text, text, text, text, text, text) to service_role;
