-- SCRIPT DE CRIAÇÃO DA TABELA DE CONFIGURAÇÃO DO BOT WHATSAPP
-- Local: Supabase > SQL Editor > New Query
-- Copie e cole o código abaixo e clique em "Run"

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_configs (
    company_id UUID PRIMARY KEY,
    webhook_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS (Segurança de Linha)
ALTER TABLE public.whatsapp_bot_configs ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de Acesso

-- Permissão: SELECT (Usuários autenticados podem ver as configurações)
CREATE POLICY "Permitir leitura para autenticados"
ON public.whatsapp_bot_configs FOR SELECT
TO authenticated
USING (true);

-- Permissão: INSERT/UPDATE (Usuários autenticados podem salvar/atualizar)
CREATE POLICY "Permitir insert/update para autenticados"
ON public.whatsapp_bot_configs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Adicionar Comentários (Opcional, para organização)
COMMENT ON TABLE public.whatsapp_bot_configs IS 'Armazena as URLs de webhook dinâmicas por empresa para o Bot de WhatsApp.';
