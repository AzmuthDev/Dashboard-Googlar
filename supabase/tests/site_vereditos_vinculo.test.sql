-- Teste de upsert_veredito com origem/metricas e de vincular_enquete_cliente.
-- Rodar inteiro (SQL Editor ou execute_sql). Tudo ocorre em transacao com ROLLBACK final.
begin;

-- (a) vereditos do site: origem site, usuario Agente Site, metricas da planilha
do $$
declare n integer; l record;
begin
  n := public.upsert_veredito('mesa_estremoz', jsonb_build_array(jsonb_build_object(
    'termo', 'zz teste site', 'campanha', 'Camp Z', 'grupo', 'Grupo Z', 'palavra_chave', 'kw',
    'segmentar', false, 'negativar', false, 'teste_ab', false, 'duvida', true, 'observacao', 'obs',
    'impressoes', '120', 'conversoes', '1', 'cliques', '7', 'custo', '9,90', 'ctr', '5%', 'cpc_medio', '1,41', 'tipo_corresp', 'Frase')), 'site');
  assert n = 1, 'upsert site gravou 1';
  select * into l from public.mesa_estremoz where termo_de_pesquisa = 'zz teste site';
  assert l.origem = 'site' and l.usuario = 'Agente Site', 'origem/usuario site';
  assert l.duvida and not l.pode_enviar, 'duvida sem liberar envio';
  assert l.cliques = '7' and l.custo = '9,90' and l.ctr = '5%' and l.cpc_medio = '1,41' and l.tipo_corresp = 'Frase' and l.impressoes = '120', 'metricas';

  -- mesma chave (acento/caixa diferentes) atualiza em vez de duplicar
  n := public.upsert_veredito('mesa_estremoz', jsonb_build_array(jsonb_build_object(
    'termo', 'ZZ TESTE SITE', 'campanha', 'camp z', 'grupo', 'grupo z', 'negativar', true, 'observacao', 'novo')), 'site');
  assert (select count(*) from public.mesa_estremoz where public._chave_norm(termo_de_pesquisa) = 'zz teste site') = 1, 'sem duplicata';
  assert (select negativar and not duvida from public.mesa_estremoz where termo_de_pesquisa = 'zz teste site'), 'veredito atualizado';
end $$;

-- (b) chamada antiga do interno (sem p_origem) continua valendo e grava origem interno
do $$
begin
  perform public.upsert_veredito('mesa_estremoz', jsonb_build_array(jsonb_build_object('termo', 'zz teste interno', 'campanha', 'C', 'grupo', 'G', 'segmentar', true)));
  assert (select origem = 'interno' and usuario = 'Pocket Interno' from public.mesa_estremoz where termo_de_pesquisa = 'zz teste interno'), 'default interno';
end $$;

-- (c) origem invalida e rejeitada
do $$
begin
  begin
    perform public.upsert_veredito('mesa_estremoz', '[]'::jsonb, 'qualquer');
    assert false, 'deveria rejeitar origem';
  exception when raise_exception then null;
  end;
end $$;

-- (d) vincular_enquete_cliente acha a linha pelo termo (sem contexto) e o voto do cliente fecha a duvida
insert into public.mesa_reportei (campanha, grupo_de_anuncios, termo_de_pesquisa, duvida)
values ('Camp R', 'Grupo R', 'zz termo cliente', true);

do $$
declare r jsonb; l record;
begin
  r := public.vincular_enquete_cliente('mesa_reportei', 'ZZ termo cliente', 'Geral', 'Geral', 'ENQ-ZZ-1');
  assert (r->>'ignorado')::boolean = false, 'vinculou';
  select * into l from public.mesa_reportei where termo_de_pesquisa = 'zz termo cliente';
  assert l.id_enquete = 'ENQ-ZZ-1' and l.enviado_para_grupo and l.duvida and not l.respondido_cliente, 'estado aguardando cliente';
  assert (select count(*) from public.mesa_reportei where public._chave_norm(termo_de_pesquisa) = 'zz termo cliente') = 1, 'nao duplicou';

  r := public.registrar_resposta_cliente('ENQ-ZZ-1', '❌ Negativar', 'cliente');
  assert (r->>'encontrado')::boolean and r->>'acao' = 'negativar', 'voto achado pelo id vinculado';
  select * into l from public.mesa_reportei where termo_de_pesquisa = 'zz termo cliente';
  assert l.respondido_cliente and l.negativar and not l.duvida and l.data_resposta is not null, 'resposta registrada';
end $$;

-- (e) termo inexistente: cria a linha ja vinculada; id vazio e ignorado
do $$
declare r jsonb;
begin
  r := public.vincular_enquete_cliente('mesa_reportei', 'zz termo novo', 'Camp N', 'Grupo N', 'ENQ-ZZ-2');
  assert (select origem = 'interno' and id_enquete = 'ENQ-ZZ-2' from public.mesa_reportei where termo_de_pesquisa = 'zz termo novo'), 'criou vinculada';
  r := public.vincular_enquete_cliente('mesa_reportei', 'zz termo novo', 'Camp N', 'Grupo N', '  ');
  assert (r->>'ignorado')::boolean, 'id vazio ignorado';
end $$;

-- (f) permissoes: so service_role executa
do $$
begin
  assert not has_function_privilege('anon', 'public.upsert_veredito(text, jsonb, text)', 'execute'), 'anon nao executa upsert';
  assert not has_function_privilege('authenticated', 'public.vincular_enquete_cliente(text, text, text, text, text)', 'execute'), 'authenticated nao executa vincular';
  assert has_function_privilege('service_role', 'public.vincular_enquete_cliente(text, text, text, text, text)', 'execute'), 'service_role executa vincular';
end $$;

rollback;
