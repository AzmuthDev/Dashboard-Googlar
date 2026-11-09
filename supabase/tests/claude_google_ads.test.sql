-- Teste das tabelas de conexão do Claude e do Google Ads.
-- Rodar inteiro (SQL Editor ou execute_sql) DEPOIS de aplicar a migração 20261109120000_claude_google_ads.sql.
-- Tudo ocorre em transação com ROLLBACK final.
-- Qualquer falha de ASSERT aborta o script com a mensagem do teste.
begin;

-- (a) estruturas e colunas existem
do $$
declare t text;
begin
  foreach t in array array['claude_conexoes','google_ads_conexoes','google_ads_oauth_estados','envios_google_ads'] loop
    assert exists (select 1 from information_schema.tables where table_schema='public' and table_name=t and table_type='BASE TABLE'),
      'tabela ' || t || ' ausente';
  end loop;
  assert exists (select 1 from information_schema.views where table_schema='public' and table_name='minha_conexao_google_ads'),
    'view minha_conexao_google_ads ausente';
  assert exists (select 1 from information_schema.columns where table_schema='public' and table_name='companies' and column_name='google_ads_customer_id'),
    'coluna companies.google_ads_customer_id ausente';
  assert exists (select 1 from information_schema.columns where table_schema='public' and table_name='companies' and column_name='google_ads_login_customer_id'),
    'coluna companies.google_ads_login_customer_id ausente';
  assert (select coalesce((reloptions @> array['security_invoker=true']), false) from pg_class where oid = 'public.minha_conexao_google_ads'::regclass),
    'view deve ser security_invoker';
end $$;

-- (b) checks de companies: exatamente 10 dígitos ou nulo
do $$
begin
  begin
    insert into public.companies (name, google_ads_customer_id) values ('teste ga formato', '123-456-7890');
    assert false, 'customer_id com hifens deveria falhar';
  exception when check_violation then null;
  end;
  begin
    insert into public.companies (name, google_ads_login_customer_id) values ('teste ga curto', '123456789');
    assert false, 'login_customer_id com 9 digitos deveria falhar';
  exception when check_violation then null;
  end;
  insert into public.companies (name, google_ads_customer_id, google_ads_login_customer_id)
    values ('teste ga ok', '1234567890', '0987654321');
  insert into public.companies (name) values ('teste ga nulo');
  assert (select google_ads_customer_id is null and google_ads_login_customer_id is null from public.companies where name = 'teste ga nulo'),
    'colunas nulas por padrao';
end $$;

-- (c) RLS ligada nas 4 tabelas novas
do $$
declare t text;
begin
  foreach t in array array['claude_conexoes','google_ads_conexoes','google_ads_oauth_estados','envios_google_ads'] loop
    assert (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), 'RLS desligada em ' || t;
  end loop;
end $$;

-- (d) politicas: claude_conexoes so do dono; demais sem politica para anon/authenticated
do $$
declare p record;
begin
  select * into p from pg_policies where schemaname='public' and tablename='claude_conexoes';
  assert found, 'claude_conexoes sem politica';
  assert (select count(*) from pg_policies where schemaname='public' and tablename='claude_conexoes') = 1,
    'claude_conexoes deve ter exatamente 1 politica';
  assert p.cmd = 'ALL', 'politica de claude_conexoes deve ser for all, e e ' || p.cmd;
  assert p.roles = array['authenticated']::name[], 'politica de claude_conexoes so para authenticated';
  assert p.qual like '%profile_id%auth.uid()%', 'using de claude_conexoes: ' || coalesce(p.qual,'null');
  assert p.with_check like '%profile_id%auth.uid()%', 'with check de claude_conexoes: ' || coalesce(p.with_check,'null');

  assert not exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename in ('google_ads_conexoes','google_ads_oauth_estados','envios_google_ads')),
    'google_ads_* e envios_google_ads nao devem ter politica';
end $$;

-- (e) privilegios
do $$
declare t text;
begin
  assert not has_table_privilege('anon', 'public.claude_conexoes', 'select'), 'anon nao deve ler claude_conexoes';
  foreach t in array array['claude_conexoes','google_ads_conexoes','google_ads_oauth_estados','envios_google_ads'] loop
    assert not has_table_privilege('anon', 'public.' || t, 'select'), 'anon nao deve ler ' || t;
  end loop;
  foreach t in array array['google_ads_conexoes','google_ads_oauth_estados','envios_google_ads'] loop
    assert not has_table_privilege('authenticated', 'public.' || t, 'select'), 'authenticated nao deve ler ' || t;
  end loop;
  assert has_table_privilege('authenticated', 'public.claude_conexoes', 'select'), 'authenticated le claude_conexoes';
  assert has_table_privilege('authenticated', 'public.minha_conexao_google_ads', 'select'), 'authenticated le a view';
  assert not has_table_privilege('anon', 'public.minha_conexao_google_ads', 'select'), 'anon nao le a view';
end $$;

rollback;
select 'OK - todos os testes passaram' as resultado;
