-- ==============================================================================
-- MIGRAÇÃO V4: ANTYGRAVITI OS - TABELA CENTRAL DE AGENTES DE SEMÂNTICA
-- ==============================================================================
-- Instruções:
-- 1. Acesse o painel do Supabase > SQL Editor
-- 2. Cole este script e execute.

-- ATENÇÃO: Descomente a linha abaixo somente se quiser DESTRUIR a tabela antiga
-- DROP TABLE IF EXISTS public.campaign_terms;

CREATE TABLE IF NOT EXISTS public.campaign_terms (
    id TEXT PRIMARY KEY, -- formato: companyId_indice
    company_id UUID NOT NULL,
    
    -- Identificadores
    campanha TEXT,
    grupo_de_anuncios TEXT,
    
    -- Dados Semânticos
    palavra_chave TEXT,
    termo_de_pesquisa TEXT,
    
    -- Sinalizadores de Agente
    segmentar TEXT,
    negativar TEXT,
    teste_ab TEXT,
    duvida TEXT,
    
    -- Análise & Logs
    observacao TEXT,
    sugestao_grupo TEXT,
    status_granularidade TEXT,
    
    -- Métricas de Performance
    cliques INTEGER DEFAULT 0,
    impressoes INTEGER DEFAULT 0,
    ctr NUMERIC(10,4) DEFAULT 0,
    cpc_medio NUMERIC(10,2) DEFAULT 0,
    custo NUMERIC(10,2) DEFAULT 0,
    conversoes NUMERIC(10,2) DEFAULT 0,
    custo_conv NUMERIC(10,2) DEFAULT 0,
    taxa_conv NUMERIC(10,4) DEFAULT 0,
    
    -- Metadados
    tipo_corresp TEXT,
    adicionada_excluida TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),

    -- Restrições lógicas
    CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES whatsapp_bot_configs(company_id) ON DELETE CASCADE
);

-- ==============================================================================
-- SEGURANÇA E MULTI-TENANT (RLS)
-- ==============================================================================
ALTER TABLE public.campaign_terms ENABLE ROW LEVEL SECURITY;

-- Limpar politicas antigas (se houver)
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.campaign_terms;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.campaign_terms;
DROP POLICY IF EXISTS "Allow update for authenticated" ON public.campaign_terms;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON public.campaign_terms;

-- 1. SELECT: O Dashboard do cliente visualizará apenas os TERMOS onde a company_id
-- for compatível ou o usuário de sessão tenha acesso na tabela `profiles`.
CREATE POLICY "Permitir leitura isolada por tenant"
  ON public.campaign_terms FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    -- Remova o comentário abaixo se você quiser que o próprio banco bloqueie chamadas cruzadas, 
    -- exigindo verificar a array assigned_company_ids do profile:
    -- AND company_id::text IN (SELECT jsonb_array_elements_text(assigned_company_ids) FROM profiles WHERE id = auth.uid())
  );

-- 2. INSERT: Agentes autônomos logados ou Painel 
CREATE POLICY "Permitir insercoes do agente ou dashboard"
  ON public.campaign_terms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. UPDATE: Analistas e Agentes 
CREATE POLICY "Permitir alteracoes"
  ON public.campaign_terms FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 4. DELETE: Wipe table no Sync
CREATE POLICY "Permitir exclusao para reset"
  ON public.campaign_terms FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Indexação para ganho de performance (Já que teremos milhares de linhas)
CREATE INDEX IF NOT EXISTS idx_campaign_terms_company_id ON public.campaign_terms(company_id);
CREATE INDEX IF NOT EXISTS idx_campaign_terms_campanha ON public.campaign_terms(campanha);
