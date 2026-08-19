-- ==============================================================================
-- SCRIPT DE PROVISIONAMENTO DE INFRAESTRUTURA V4.3 (ESQUEMA FINAL)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.provision_company_table(company_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_name_sanitized text;
BEGIN
    -- 1. Sanitizar o nome da empresa
    table_name_sanitized := 'mesa_' || lower(regexp_replace(company_name, '[^a-zA-Z0-9]', '_', 'g'));

    -- 2. Criar a tabela com o ESQUEMA ATUALIZADO (Flags como BOOLEAN)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS public.%I (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            created_at timestamp with time zone DEFAULT now(),
            usuario text,
            id_enquete text,
            folhas_url text,
            tipo_fonte_de_dados text,
            nome_do_arquivo_local text,
            campanha text,
            grupo_de_anuncios text,
            palavra_chave text,
            termo_de_pesquisa text,
            tipo_corresp text,
            adicionada_excluida text,
            cliques text DEFAULT ''0'',
            impressoes text DEFAULT ''0'',
            ctr text,
            cpc_medio text,
            custo text,
            conversoes text,
            custo_conv text,
            taxa_conv text,
            segmentar boolean DEFAULT false,
            negativar boolean DEFAULT false,
            teste_ab boolean DEFAULT false,
            duvida boolean DEFAULT false,
            pode_enviar boolean DEFAULT false,
            enviado_para_grupo boolean DEFAULT false,
            respondido_cliente boolean DEFAULT false,
            acao text,
            comentario text,
            descricao text,
            observacao text,
            sugestao_grupo text,
            status_granularidade text,
            manter boolean DEFAULT false,
            triagem1 boolean DEFAULT false,
            triagem2 boolean DEFAULT false,
            auditor_comment text,
            constraint %I_pkey primary key (id)
        )', table_name_sanitized, table_name_sanitized);

    -- 3. Segurança RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name_sanitized);

    -- 4. Política de Acesso
    EXECUTE format('
        DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.%I;
        CREATE POLICY "Permitir tudo para autenticados" ON public.%I
        FOR ALL TO authenticated USING (true)', table_name_sanitized, table_name_sanitized);

END;
$$;
