import { useQuery } from '@tanstack/react-query';
import { carregarDados } from '../utils/dataIngestion';
import { syncCampaignTermsToSupabase, fetchCampaignTermsFromSupabase } from '../utils/supabaseSync';
import { message } from 'antd';
import { type CampaignTerm } from '../types';

export const useCampaignTerms = (companyId?: string) => {
    return useQuery({
        queryKey: ['campaign-terms', companyId],
        queryFn: async () => {
            if (!companyId) return [];

            const companiesStr = localStorage.getItem('googlar_companies');
            if (!companiesStr) return [];

            const companies = JSON.parse(companiesStr);
            const company = companies.find((c: any) => c.id === companyId);
            if (!company) return [];

            // ─── PRIORIDADE 1: Supabase ───────────────────────────────────────
            console.log('[useCampaignTerms] 🔍 Buscando dados no Supabase...');
            const { data: supabaseData, error: supabaseError } = await fetchCampaignTermsFromSupabase(companyId);

            if (!supabaseError && supabaseData.length > 0) {
                console.log(`[useCampaignTerms] ✅ ${supabaseData.length} termos carregados do Supabase.`);
                return supabaseData;
            }

            if (supabaseError) {
                console.warn('[useCampaignTerms] ⚠️ Erro no Supabase, tentando fallback:', supabaseError);
            } else {
                console.log('[useCampaignTerms] 📭 Supabase vazio. Buscando no Google Sheets e sincronizando...');
            }

            // ─── PRIORIDADE 2: Arquivo Local (localStorage) ───────────────────
            if (company.dataSourceType === 'local') {
                const localDataStr = localStorage.getItem(`googlar_local_data_${companyId}`);
                if (localDataStr) {
                    try {
                        const parsed = JSON.parse(localDataStr);
                        const localData: CampaignTerm[] = parsed.data || [];

                        // Sincroniza com Supabase em background
                        if (localData.length > 0) {
                            syncCampaignTermsToSupabase(companyId, localData).then(result => {
                                if (result.success) {
                                    console.log(`[useCampaignTerms] ☁️ ${result.count} termos locais sincronizados com Supabase.`);
                                }
                            });
                        }

                        return localData;
                    } catch (e) {
                        console.error("Erro ao ler dados locais da empresa:", e);
                        return [];
                    }
                }
                return [];
            }

            // ─── PRIORIDADE 3: Google Sheets (fallback + auto-sync) ───────────
            if (!company.sheetsUrl) return [];

            try {
                console.log('[useCampaignTerms] 📊 Carregando do Google Sheets...');
                const parsedRows = await carregarDados(company.sheetsUrl, 'sheets', companyId);

                // Sincroniza com Supabase automaticamente em background
                if (parsedRows.length > 0) {
                    syncCampaignTermsToSupabase(companyId, parsedRows).then(result => {
                        if (result.success) {
                            console.log(`[useCampaignTerms] ☁️ ${result.count} termos do Sheets sincronizados com Supabase.`);
                        } else {
                            console.warn('[useCampaignTerms] ⚠️ Falha ao sincronizar com Supabase:', result.error);
                        }
                    });
                }

                return parsedRows;
            } catch (err: any) {
                message.error(err.message || "Erro desconhecido ao carregar planilha.");
                throw new Error(err.message || "Erro desconhecido ao carregar planilha.");
            }
        },
        staleTime: 5 * 60 * 1000, // Cache de 5 minutos
    });
};
