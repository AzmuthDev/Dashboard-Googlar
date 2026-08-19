-- Execute este SQL no Supabase SQL Editor
-- https://supabase.com/dashboard/project/dowqvqaubqeodzamzwxy/sql/new

-- 1. Remover política antiga
DROP POLICY IF EXISTS "Authenticated users can access campaign_terms" ON public.campaign_terms;

-- 2. Criar políticas separadas e corretas

-- SELECT: usuário autenticado pode ver
CREATE POLICY "Allow select for authenticated"
  ON public.campaign_terms FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: usuário autenticado pode inserir
CREATE POLICY "Allow insert for authenticated"
  ON public.campaign_terms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: usuário autenticado pode atualizar
CREATE POLICY "Allow update for authenticated"
  ON public.campaign_terms FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: usuário autenticado pode deletar
CREATE POLICY "Allow delete for authenticated"
  ON public.campaign_terms FOR DELETE
  USING (auth.uid() IS NOT NULL);
