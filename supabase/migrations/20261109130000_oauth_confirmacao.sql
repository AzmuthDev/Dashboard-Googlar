-- Confirmação do OAuth do Google Ads: o /retorno guarda o token aqui e só o /confirmar (com o JWT do
-- mesmo usuário que iniciou) o move para google_ads_conexoes. Tabela continua só do service_role.
alter table public.google_ads_oauth_estados
  add column if not exists refresh_token_cifrado text,
  add column if not exists google_email text,
  add column if not exists confirmacao_hash text;
