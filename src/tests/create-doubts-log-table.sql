-- SCRIPT DE CRIAÇÃO DA TABELA DE LOG DE DÚVIDAS DE CLIENTES
-- Local: Supabase > SQL Editor > New Query

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS public.duvidas_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    term TEXT NOT NULL,
    comentario_analista TEXT,
    campaign TEXT,
    ad_group TEXT,
    clicks INTEGER DEFAULT 0,
    cost NUMERIC(10,2) DEFAULT 0,
    sent_by TEXT, -- E-mail do analista
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.duvidas_clientes ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas

-- SELECT: Usuários autenticados podem ver os logs
CREATE POLICY "Permitir leitura logs para autenticados"
ON public.duvidas_clientes FOR SELECT
TO authenticated
USING (true);

-- INSERT: Usuários autenticados podem gravar logs
CREATE POLICY "Permitir insert logs para autenticados"
ON public.duvidas_clientes FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Comentário Informativo
COMMENT ON TABLE public.duvidas_clientes IS 'Logs de disparos de dúvidas para clientes via WhatsApp. Serve como histórico de auditoria.';
