-- Conexão do Claude do usuário ao Pocket (conector MCP) e envio de termos ao Google Ads.
-- profiles.id = auth.users.id (confirmado), então as políticas usam auth.uid() direto.

-- Contas do Google Ads por cliente (empresa): 10 dígitos, sem hífens.
alter table public.companies
  add column if not exists google_ads_customer_id text check (google_ads_customer_id ~ '^\d{10}$'),
  add column if not exists google_ads_login_customer_id text check (google_ads_login_customer_id ~ '^\d{10}$');

-- Tokens do conector MCP (só o hash é guardado). O próprio usuário gerencia os seus.
create table if not exists public.claude_conexoes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text unique not null,
  rotulo text,
  criado_em timestamptz default now(),
  ultimo_uso timestamptz,
  revogado_em timestamptz
);

-- Credenciais do Google Ads por usuário. Só o service_role acessa (sem política = RLS bloqueia anon/authenticated).
create table if not exists public.google_ads_conexoes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  modo text not null check (modo in ('pocket','proprio')),
  google_email text,
  refresh_token_cifrado text not null,
  developer_token_cifrado text,
  client_id text,
  client_secret_cifrado text,
  login_customer_id text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now(),
  revogado_em timestamptz
);

-- Estados temporários do fluxo OAuth.
create table if not exists public.google_ads_oauth_estados (
  estado text primary key,
  profile_id uuid not null,
  expira_em timestamptz not null
);

-- Auditoria dos envios ao Google Ads.
create table if not exists public.envios_google_ads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  mesa text not null,
  linha_id uuid not null,
  customer_id text not null,
  tipo text check (tipo in ('segmentar','negativar','teste_ab')),
  nivel text check (nivel in ('grupo','campanha','lista','conta')),
  correspondencia text check (correspondencia in ('exata','frase','ampla')),
  lista_negativa text,
  status text check (status in ('ok','ja_existia','erro')),
  erro text,
  resource_name text,
  criado_em timestamptz default now()
);

create index if not exists envios_google_ads_mesa_linha_tipo_idx
  on public.envios_google_ads (mesa, linha_id, tipo);

alter table public.claude_conexoes enable row level security;
alter table public.google_ads_conexoes enable row level security;
alter table public.google_ads_oauth_estados enable row level security;
alter table public.envios_google_ads enable row level security;

drop policy if exists "Dono gerencia suas conexoes" on public.claude_conexoes;
create policy "Dono gerencia suas conexoes" on public.claude_conexoes
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Visão sem segredos para o front ler a própria conexão.
create or replace view public.minha_conexao_google_ads
  with (security_invoker = true) as
  select modo, google_email, criado_em, revogado_em
    from public.google_ads_conexoes
   where profile_id = auth.uid();

revoke all on public.claude_conexoes from anon;
revoke all on public.google_ads_conexoes from anon, authenticated;
revoke all on public.google_ads_oauth_estados from anon, authenticated;
revoke all on public.envios_google_ads from anon, authenticated;
revoke all on public.minha_conexao_google_ads from anon;

grant select, insert, update on public.claude_conexoes to authenticated;
grant select on public.minha_conexao_google_ads to authenticated;
