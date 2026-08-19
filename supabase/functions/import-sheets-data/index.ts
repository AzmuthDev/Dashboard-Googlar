import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const googleApiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Tratamento de preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { companyId, sheetsUrl } = await req.json();

        if (!companyId || !sheetsUrl) {
            throw new Error("companyId e sheetsUrl são obrigatórios");
        }

        // Extrai o Spreadsheet ID da URL pública
        const regex = /\/d\/([a-zA-Z0-9-_]+)/;
        const match = sheetsUrl.match(regex);
        const spreadsheetId = match ? match[1] : null;

        if (!spreadsheetId) {
            throw new Error("URL da planilha inválida. Formato esperado: https://docs.google.com/spreadsheets/d/[ID_AQUI]/edit");
        }

        if (!googleApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error("Faltam variáveis de ambiente (Google API, Supabase URL, Service Role)");
        }

        // Carrega os dados da aba "Resultados_n8n"
        const range = "Resultados_n8n!A2:S";
        const fetchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${googleApiKey}`;

        console.log(`Buscando dados no Google Sheets para o ID: ${spreadsheetId}`);
        const response = await fetch(fetchUrl);

        if (!response.ok) {
            throw new Error(`Google Sheets API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const rows = data.values;

        if (!rows || rows.length === 0) {
            return new Response(JSON.stringify({ message: "Planilha não tem dados na aba Resultados_n8n.", count: 0 }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Instancia DB Root do Supabase
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        console.log(`Encontrados ${rows.length} registros. Fazendo Parse e persistindo...`);

        // Extrai Campanhas Únicas (opcional) - Pode ser gravado em uma db "campaigns"
        const uniqueCampaigns = new Set<string>();
        rows.forEach((row: any[]) => uniqueCampaigns.add(row[0]));

        // Vamos realizar o UPSERT pesado de termos! 
        // Lógica: Para o array inserido, vamos fazer um mapping das colunas baseadas na ordem da planilha original
        const payloadToInsert = rows.map((row: any[]) => {
            return {
                company_id: companyId,
                campaign_name: row[0] || '—',
                ad_group: row[1] || '—',
                keyword: row[2] || '—',
                search_term: row[3] || '—',
                observation: row[4] || '',
                suggestion_group: row[5] || '',
                segment: row[6] || '',
                negativize: row[7] || '',
                ab_test: row[8] || '',
                status_granularity: row[9] || '',
                clicks: parseInt(row[10]) || 0,
                impressions: parseInt(row[11]) || 0,
                ctr: parseFloat(row[12]?.replace('%', '').replace(',', '.')) || 0,
                avg_cpc: parseFloat(row[13]?.replace('R$', '').replace(',', '.')) || 0,
                cost: parseFloat(row[14]?.replace('R$', '').replace(',', '.')) || 0,
                conversions: parseFloat(row[15]?.replace(',', '.')) || 0,
                cost_per_conversion: parseFloat(row[16]?.replace('R$', '').replace(',', '.')) || 0,
                conversion_rate: parseFloat(row[17]?.replace('%', '').replace(',', '.')) || 0,
                match_type: row[18] || '',
                added_excluded: row[19] || '',
                campaign_id: `generated_${row[0]}`, // Simplificação sem tabela referencial real pra não quebrar
            };
        });

        // Deleção dos dados anteriores daquela empresa para não vazar duplicação (Wipe and Replace Strategy para simplificar a sincronização passiva)
        await supabase
            .from('campaign_terms')
            .delete()
            .eq('company_id', companyId);

        // Batch Insert dos novos relatórios Parseados!
        const { error: insertError } = await supabase
            .from('campaign_terms')
            .insert(payloadToInsert);

        if (insertError) {
            throw new Error(`Erro na inserção do Banco: ${insertError.message}`);
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Sincronização de Termos concluída com sucesso.",
            count: rows.length,
            companyId: companyId
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Erro na Edge Function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
