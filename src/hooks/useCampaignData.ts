import { useQuery } from '@tanstack/react-query';
import { fetchTermsFromTable, fetchCompanies, fetchCampaignTerms } from '../lib/supabaseProvider';
import { type CampaignTerm } from '../types';
import { deduplicateTermsByOrigin } from '../utils/termDeduplication';

/**
 * Hook para buscar dados da Empresa (Arquitetura V4 - Híbrida)
 * Suporta tanto Mesas Exclusivas (tableName) quanto Tabela Central (companyId)
 */
export const useCampaignTerms = (companyId?: string, tableName?: string) => {
    return useQuery({
        queryKey: ['campaign-terms', companyId, tableName],
        queryFn: async () => {
            const targetTable = tableName || (companyId ? `data_company_${companyId}` : null);

            if (!targetTable) return [];

            console.log(`[useCampaignTerms] 🔍 Buscando dados na mesa: ${targetTable}`);
            const data = await fetchTermsFromTable(targetTable);

            if (data && data.length > 0) {
                console.log(`[useCampaignTerms] ✅ ${data.length} termos brutos carregados da mesa ${targetTable}.`);
                
                // Sanitização: Garante que campos numéricos que vêm como string do BD sejam números para o JS
                const sanitized = data.map(term => ({
                    ...term,
                    cliques: Number(term.cliques || 0),
                    impressoes: Number(term.impressoes || 0),
                    ctr: Number(String(term.ctr || 0).replace(',', '.')),
                    custo: Number(String(term.custo || 0).replace(',', '.')),
                    cpc_medio: Number(String(term.cpc_medio || 0).replace(',', '.')),
                    conversoes: Number(String(term.conversoes || 0).replace(',', '.')),
                    custo_conv: Number(String(term.custo_conv || 0).replace(',', '.')),
                    taxa_conv: Number(String(term.taxa_conv || 0).replace(',', '.'))
                }));

                // Excluir termos repetidos com a mesma origem (mesma campanha, mesmo grupo, mesma palavra-chave e mesmo termo)
                const { deduplicated, duplicateCount } = deduplicateTermsByOrigin(sanitized);
                if (duplicateCount > 0) {
                    console.log(`[useCampaignTerms] 🧹 ${duplicateCount} termos repetidos com a mesma origem foram excluídos. Termos únicos: ${deduplicated.length}`);
                }
                return deduplicated;
            }

            console.log(`[useCampaignTerms] 📭 Mesa ${targetTable} está vazia ou não processada.`);
            return [];
        },
        staleTime: 5 * 60 * 1000,
        enabled: !!(companyId || tableName),
    });
};

export const useCompanies = () => {
    return useQuery({
        queryKey: ['companies'],
        queryFn: async () => {
            return await fetchCompanies();
        },
        staleTime: 30 * 1000,
    });
};
