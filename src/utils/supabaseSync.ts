import { supabase } from '../lib/supabase'
import type { CampaignTerm } from '../types'

const BATCH_SIZE = 500

/**
 * Sincroniza os termos de campanha de uma empresa com o Supabase.
 * Apaga os dados antigos da empresa e insere os novos em batches.
 */
export async function syncCampaignTermsToSupabase(
  companyId: string,
  terms: CampaignTerm[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // ── Verificar se há sessão ativa ──────────────────────────────────────
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const msg = 'Sem sessão autenticada. Faça login novamente.'
      console.error('[Sync] ❌', msg)
      return { success: false, count: 0, error: msg }
    }
    console.log(`[Sync] 🔑 Sessão ativa: ${session.user.email}`)

    // ── 1. Deletar todos os dados antigos desta empresa ───────────────────
    const { error: deleteError } = await supabase
      .from('campaign_terms')
      .delete()
      .eq('company_id', companyId)

    if (deleteError) {
      const msg = `DELETE falhou: [${deleteError.code}] ${deleteError.message}`
      console.error('[Sync] ❌', msg, deleteError)
      return { success: false, count: 0, error: msg }
    }
    console.log(`[Sync] 🗑️ Dados antigos da empresa ${companyId} removidos.`)

    if (terms.length === 0) {
      return { success: true, count: 0 }
    }

    // ── 2. Preparar os dados garantindo company_id correto e synced_at ────
    const rows = terms.map((term, index) => ({
      id: `${companyId}_${index}`,   // ID único por empresa + índice
      company_id: companyId,
      campaign_id: term.campaign_id || `cmp_${companyId}_${index}`,
      campaign_name: term.campaign_name || '',
      ad_group: term.ad_group || '',
      keyword: term.keyword || '',
      search_term: term.search_term || '',
      observation: term.observation || '',
      duvida: term.duvida || '',
      suggestion_group: term.suggestion_group || '',
      segment: term.segment || '',
      negativize: term.negativize || '',
      ab_test: term.ab_test || '',
      status_granularity: term.status_granularity || '',
      clicks: Number(term.clicks) || 0,
      impressions: Number(term.impressions) || 0,
      ctr: Number(term.ctr) || 0,
      avg_cpc: Number(term.avg_cpc) || 0,
      cost: Number(term.cost) || 0,
      conversions: Number(term.conversions) || 0,
      cost_per_conversion: Number(term.cost_per_conversion) || 0,
      conversion_rate: Number(term.conversion_rate) || 0,
      match_type: term.match_type || '',
      added_excluded: term.added_excluded || '',
      intervencao_humana: term.intervencao_humana || '',
      synced_at: new Date().toISOString(),
    }))

    // ── 3. Inserir em batches para evitar timeout em planilhas grandes ────
    let totalInserted = 0
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await supabase
        .from('campaign_terms')
        .insert(batch)

      if (insertError) {
        const msg = `INSERT batch ${Math.floor(i / BATCH_SIZE) + 1} falhou: [${insertError.code}] ${insertError.message}`
        console.error('[Sync] ❌', msg, insertError)
        return { success: false, count: totalInserted, error: msg }
      }

      totalInserted += batch.length
      console.log(`[Sync] ✅ Batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(rows.length / BATCH_SIZE)} — ${totalInserted}/${rows.length} linhas`)
    }

    console.log(`[Sync] 🎉 ${totalInserted} termos sincronizados para empresa ${companyId}`)
    return { success: true, count: totalInserted }
  } catch (err: any) {
    const msg = `Exceção inesperada: ${err.message}`
    console.error('[Sync] 💥', msg, err)
    return { success: false, count: 0, error: msg }
  }
}

/**
 * Busca os termos de campanha de uma empresa diretamente do Supabase.
 */
export async function fetchCampaignTermsFromSupabase(
  companyId: string
): Promise<{ data: CampaignTerm[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('campaign_terms')
      .select('*')
      .eq('company_id', companyId)
      .order('synced_at', { ascending: false })

    if (error) {
      console.error('[Fetch] ❌ Erro ao buscar do Supabase:', `[${error.code}] ${error.message}`)
      return { data: [], error: `[${error.code}] ${error.message}` }
    }

    return { data: (data || []) as CampaignTerm[] }
  } catch (err: any) {
    console.error('[Fetch] 💥 Exceção ao buscar do Supabase:', err)
    return { data: [], error: err.message }
  }
}
