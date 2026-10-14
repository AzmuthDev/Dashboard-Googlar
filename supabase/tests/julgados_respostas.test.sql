-- Teste das mesas/funcoes de julgados e respostas do cliente.
-- Rodar inteiro (SQL Editor ou execute_sql). Tudo ocorre em transacao com ROLLBACK final.
-- Qualquer falha de ASSERT aborta o script com a mensagem do teste.
begin;

-- (a) colunas novas e mesas novas
do $$
declare t text;
begin
  foreach t in array array['mesa_magic_hands','mesa_endomarcas','mesa_qualipix','mesa_estremoz',
                           'mesa_run_service','mesa_reportei','mesa_style_brokers','mesa_comparar_seguro_viagem'] loop
    assert exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='origem'),
      'coluna origem ausente em ' || t;
    assert exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='data_resposta'),
      'coluna data_resposta ausente em ' || t;
  end loop;
end $$;

-- (b) normalizacao e mapeamento de opcao
do $$
begin
  assert public._chave_norm('  Pé  de CABRA ') = 'pe de cabra', 'chave_norm basico';
  assert public._chave_norm(null) = '', 'chave_norm null';
  assert public._acao_de_opcao('✅ Relevante') = 'segmentar', 'opcao relevante';
  assert public._acao_de_opcao('✅ Segmentar') = 'segmentar', 'opcao segmentar';
  assert public._acao_de_opcao('🏢 Concorrente') = 'negativar', 'opcao concorrente';
  assert public._acao_de_opcao('❌ Negativar') = 'negativar', 'opcao negativar';
  assert public._acao_de_opcao('⚠️ Teste A/B') = 'teste_ab', 'opcao teste ab';
  assert public._acao_de_opcao('❓ Dúvida (Enviar ao Cliente)') is null, 'duvida nao tem acao';
  assert public._acao_de_opcao(null) is null, 'opcao null';
end $$;

-- (c) registrar_resposta_cliente
insert into public.mesa_qualipix (campanha, grupo_de_anuncios, palavra_chave, termo_de_pesquisa, id_enquete, duvida, enviado_para_grupo)
values ('Camp A', 'Grupo A', 'kw', 'termo teste', 'T-1', true, true);

do $$
declare r jsonb; l record;
begin
  r := public.registrar_resposta_cliente('T-1', '❌ Negativar', 'fulano');
  assert (r->>'encontrado')::boolean, 'encontrou T-1';
  assert r->>'tabela' = 'mesa_qualipix', 'tabela devolvida';
  assert r->>'origem' = 'site', 'origem padrao site';
  assert r->>'acao' = 'negativar', 'acao devolvida';
  select * into l from public.mesa_qualipix where id_enquete = 'T-1';
  assert l.acao = 'negativar' and l.respondido_cliente and l.negativar and not l.duvida and not l.segmentar and l.data_resposta is not null,
    'linha apos negativar';

  r := public.registrar_resposta_cliente('T-1', '✅ Relevante', 'fulano');
  select * into l from public.mesa_qualipix where id_enquete = 'T-1';
  assert l.acao = 'segmentar' and l.segmentar and not l.negativar, 'ultima opcao vence';

  r := public.registrar_resposta_cliente('T-1', '❓ Dúvida (Enviar ao Cliente)', null);
  assert (r->>'ignorado')::boolean and (r->>'encontrado')::boolean, 'opcao sem acao e ignorada';
  select * into l from public.mesa_qualipix where id_enquete = 'T-1';
  assert l.acao = 'segmentar', 'opcao ignorada nao altera';

  r := public.registrar_resposta_cliente('NAO-EXISTE', '✅ Relevante', null);
  assert not (r->>'encontrado')::boolean, 'id inexistente';
  r := public.registrar_resposta_cliente(null, '✅ Relevante', null);
  assert not (r->>'encontrado')::boolean, 'id nulo';
end $$;

-- (d) registrar_decisao_interna
do $$
declare r jsonb; l record;
begin
  -- aguardando_cliente cria linha nova com origem interno
  r := public.registrar_decisao_interna('mesa_reportei', 'Termo Novo', 'Camp R', 'Grupo R', 'kw', null, 'aguardando_cliente');
  select * into l from public.mesa_reportei where termo_de_pesquisa = 'Termo Novo';
  assert l.origem = 'interno' and l.usuario = 'Pocket Interno', 'linha nova interno';
  assert l.duvida and l.enviado_para_grupo and not l.respondido_cliente, 'estado aguardando';

  -- mesma chave com caixa/acento diferentes nao duplica
  r := public.registrar_decisao_interna('mesa_reportei', 'termo  NOVO', 'camp r', 'grupo r', 'kw', '❌ Negativar', 'respondido_cliente');
  assert (select count(*) from public.mesa_reportei where public._chave_norm(termo_de_pesquisa) = 'termo novo') = 1, 'sem duplicar';
  select * into l from public.mesa_reportei where termo_de_pesquisa = 'Termo Novo';
  assert l.acao = 'negativar' and l.respondido_cliente and not l.duvida and l.negativar and l.data_resposta is not null, 'respondido_cliente';

  -- decidido_equipe nao marca respondido_cliente
  r := public.registrar_decisao_interna('mesa_run_service', 'outro termo', 'C', 'G', 'k', '⚠️ Teste A/B', 'decidido_equipe');
  select * into l from public.mesa_run_service where termo_de_pesquisa = 'outro termo';
  assert l.teste_ab and not l.duvida and not coalesce(l.respondido_cliente,false), 'decidido_equipe';

  -- opcao sem acao nos estados que exigem acao
  r := public.registrar_decisao_interna('mesa_run_service', 'outro termo', 'C', 'G', 'k', '❓ Dúvida (Enviar ao Cliente)', 'respondido_cliente');
  assert (r->>'ignorado')::boolean, 'opcao sem acao ignorada';

  -- validacoes
  begin
    perform public.registrar_decisao_interna('mesa_reportei', 'x', 'c', 'g', 'k', null, 'x');
    assert false, 'estado invalido deveria falhar';
  exception when others then
    assert sqlerrm like '%estado%', 'mensagem de estado invalido: ' || sqlerrm;
  end;
  begin
    perform public.registrar_decisao_interna('profiles', 'x', 'c', 'g', 'k', null, 'decidido_equipe');
    assert false, 'tabela invalida deveria falhar';
  exception when others then
    assert sqlerrm like '%tabela%', 'mensagem de tabela invalida: ' || sqlerrm;
  end;
end $$;

-- (e) upsert_veredito
do $$
declare n int; l record;
begin
  n := public.upsert_veredito('mesa_magic_hands', jsonb_build_array(
    jsonb_build_object('termo','Limpeza Casa','campanha','C1','grupo','G1','palavra_chave','kw','segmentar',true,'negativar',false,'teste_ab',false,'duvida',false,'observacao','ok','impressoes','10','conversoes','1'),
    jsonb_build_object('termo','jobs cleaning','campanha','C1','grupo','G1','palavra_chave','kw','segmentar',false,'negativar',true,'teste_ab',false,'duvida',false,'observacao','vaga','impressoes','5','conversoes','0')));
  assert n = 2, 'insere 2 linhas, retornou ' || n;
  select * into l from public.mesa_magic_hands where termo_de_pesquisa = 'Limpeza Casa';
  assert l.origem = 'interno' and l.segmentar and not coalesce(l.pode_enviar,false), 'linha inserida';

  n := public.upsert_veredito('mesa_magic_hands', jsonb_build_array(
    jsonb_build_object('termo','LIMPEZA  casa','campanha','c1','grupo','g1','palavra_chave','kw','segmentar',false,'negativar',false,'teste_ab',true,'duvida',false,'observacao','mudou','impressoes','11','conversoes','1')));
  assert (select count(*) from public.mesa_magic_hands where public._chave_norm(termo_de_pesquisa)='limpeza casa') = 1, 'nao duplica';
  select * into l from public.mesa_magic_hands where termo_de_pesquisa = 'Limpeza Casa';
  assert l.teste_ab and not l.segmentar, 'atualizou flags';

  -- linha respondida pelo cliente nao e tocada
  update public.mesa_magic_hands set respondido_cliente = true, acao = 'negativar', negativar = true, teste_ab = false
   where termo_de_pesquisa = 'Limpeza Casa';
  n := public.upsert_veredito('mesa_magic_hands', jsonb_build_array(
    jsonb_build_object('termo','Limpeza Casa','campanha','C1','grupo','G1','palavra_chave','kw','segmentar',true,'negativar',false,'teste_ab',false,'duvida',false,'observacao','x','impressoes','1','conversoes','0')));
  select * into l from public.mesa_magic_hands where termo_de_pesquisa = 'Limpeza Casa';
  assert l.acao = 'negativar' and l.negativar and not l.segmentar, 'respondido nao e sobrescrito';

  begin
    perform public.upsert_veredito('profiles', '[]'::jsonb);
    assert false, 'tabela invalida deveria falhar';
  exception when others then
    assert sqlerrm like '%tabela%', 'mensagem de tabela invalida: ' || sqlerrm;
  end;
end $$;

-- (f) privilegios: somente service_role
do $$
declare f text;
begin
  foreach f in array array[
    'public.upsert_veredito(text,jsonb)',
    'public.registrar_resposta_cliente(text,text,text)',
    'public.registrar_decisao_interna(text,text,text,text,text,text,text)'] loop
    assert not has_function_privilege('anon', f, 'execute'), 'anon nao deve executar ' || f;
    assert not has_function_privilege('authenticated', f, 'execute'), 'authenticated nao deve executar ' || f;
    assert has_function_privilege('service_role', f, 'execute'), 'service_role deve executar ' || f;
  end loop;
end $$;

rollback;
select 'OK - todos os testes passaram' as resultado;
