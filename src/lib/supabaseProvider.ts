import { supabase } from './supabase'
import type { CampaignTerm, Company } from '../types'

const BATCH_SIZE = 500

/**
 * Operações de EMPRESA (Companies)
 */

export async function fetchCompanies(): Promise<Company[]> {
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('name', { ascending: true })

        if (error) {
            console.error('Erro ao buscar empresas:', error)
            return []
        }

        return (data || []) as Company[]
    } catch (err) {
        console.error('Exceção ao buscar empresas:', err)
        return []
    }
}

/**
 * Chama a função RPC para criar uma mesa física exclusiva no banco de dados
 */
export async function provisionCompanyTable(companyName: string): Promise<{ error: any }> {
    try {
        const { error } = await supabase.rpc('provision_company_table', { 
            company_name: companyName 
        })
        return { error }
    } catch (err: any) {
        return { error: err.message }
    }
}

export async function createCompany(companyData: Partial<Company>): Promise<{ data: Company | null, error: any }> {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        
        const payload = {
            ...companyData,
            owner_id: session?.user?.id || null // Permite criação mesmo sem sessão (modo bypass)
        }

        const { data, error } = await supabase
            .from('companies')
            .insert([payload])
            .select()
            .single()

        return { data, error }
    } catch (err: any) {
        return { data: null, error: err.message }
    }
}

export async function deleteCompany(id: string): Promise<{ error: any }> {
    try {
        const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', id)

        return { error }
    } catch (err: any) {
        return { error: err.message }
    }
}

export async function updateCompany(id: string, updates: Partial<Company>): Promise<{ error: any }> {
    try {
        const { error } = await supabase
            .from('companies')
            .update(updates)
            .eq('id', id)

        return { error }
    } catch (err: any) {
        return { error: err.message }
    }
}

/**
 * Operações de TERMOS (Mesas Isoladas V4)
 * Busca os dados diretamente da mesa exclusiva da empresa.
 */
export async function fetchTermsFromTable(tableName: string): Promise<CampaignTerm[]> {
  try {
    if (!tableName) return []

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('custo', { ascending: false })

    if (error) {
      console.error(`Erro ao buscar dados da mesa ${tableName}:`, error)
      return []
    }

    return (data || []) as CampaignTerm[]
  } catch (err) {
    console.error(`Exceção ao acessar mesa ${tableName}:`, err)
    return []
  }
}

/**
 * Busca termos da tabela central campaign_terms filtrando por empresa
 */
export async function fetchCampaignTerms(companyId: string): Promise<CampaignTerm[]> {
    try {
        const { data, error } = await supabase
            .from('campaign_terms')
            .select('*')
            .eq('company_id', companyId)
            .order('custo', { ascending: false });

        if (error) {
            console.error(`[Supabase] Erro ao buscar termos da empresa ${companyId}:`, error);
            return [];
        }

        return (data || []) as CampaignTerm[];
    } catch (err) {
        console.error(`[Supabase] Exceção ao buscar termos da empresa ${companyId}:`, err);
        return [];
    }
}

/**
 * Função de emergência / bypass manual.
 * Recebe dados locais (JSON) pareados com a tipagem CampaignTerm e empurra em Batch pro BD.
 * Realiza Wipe-out e Reinserção garantindo o 'synced_at'.
 */
export async function insertCampaignTermsBatch(
  companyId: string,
  terms: CampaignTerm[],
  tableName?: string | null
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const targetTable = tableName || `data_company_${companyId}`
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      console.warn(`[Supabase] Batch inserting into ${targetTable} without active session`)
    }

    // 1. Limpar (Wipe) a Tabela da Empresa
    // Se for mesa central 'campaign_terms', usamos filtro. Se for mesa dinâmica, limpamos tudo.
    const query = supabase.from(targetTable).delete()
    if (targetTable === 'campaign_terms') {
        query.eq('company_id', companyId)
    } else {
        // Para mesas dinâmicas, o ID do registro pode ser simples ou composto
        query.neq('id', 'placeholder_force_delete_all') 
    }

    const { error: deleteError } = await query

    if (deleteError) {
      return { success: false, count: 0, error: deleteError.message }
    }

    if (terms.length === 0) {
      return { success: true, count: 0 }
    }

    // 2. Preparar linhas
    const rows = terms.map((term, index) => ({
      ...term,
      // Se for mesa central, garantimos ID único e company_id. 
      // Se for dinâmica, o company_id é implícito mas bom manter se a coluna existir.
      id: targetTable === 'campaign_terms' ? `${companyId}_${index}` : term.id || `${index}`,
      company_id: companyId,
      synced_at: new Date().toISOString()
    }))

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await supabase
        .from(targetTable)
        .insert(batch)
      
      if (insertError) {
        console.error(`[Supabase] Batch Insert Error na mesa ${targetTable}:`, insertError)
        return { success: false, count: i, error: insertError.message }
      }
    }

    return { success: true, count: rows.length }
  } catch (err: any) {
    console.error(`[Supabase] Exception na mesa selecionada:`, err)
    return { success: false, count: 0, error: err.message }
  }
}
