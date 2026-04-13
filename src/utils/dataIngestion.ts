import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { CampaignTerm } from '../hooks/useCampaignData';

/**
 * Normalizes a CSV header key:
 * 1. Strips accents (NFD decomposition + combining char removal)
 * 2. Lowercases
 * 3. Trims whitespace
 * Result: "Observação" → "observacao", "Impr." → "impr.", "Grupo de Anúncios" → "grupo de anuncios"
 */
function normalizeKey(raw: string): string {
    return raw
        .normalize('NFD')                         // decompose accented chars
        .replace(/[\u0300-\u036f]/g, '')          // strip combining diacritics
        .toLowerCase()
        .trim();
}

let _debugLoggedOnce = false;

/**
 * Função utilitária para limpar colunas e formatar números pt-BR para float.
 */
function cleanAndFormatRow(rawRow: any): Partial<CampaignTerm> {
    // Normalize ALL header keys (accent-free, lowercase, trimmed)
    const row: Record<string, any> = {};
    for (const key in rawRow) {
        if (Object.prototype.hasOwnProperty.call(rawRow, key)) {
            row[normalizeKey(key)] = rawRow[key];
        }
    }

    // Debug: log normalized keys once per file load so the dev can verify column names
    if (!_debugLoggedOnce) {
        console.log('[Googlar] Normalized CSV keys:', Object.keys(row));
        _debugLoggedOnce = true;
    }

    const getNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let cleanStr = val.replace(/R\$\s?/gi, '').trim();
            cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(cleanStr);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    const getStr = (val: any) => {
        return val !== null && val !== undefined ? String(val).trim() : '';
    };

    return {
        // All lookups now use accent-free, lowercase keys
        campaign_name: getStr(row['campanha'] || row['campaign_name'] || '—'),
        ad_group:      getStr(row['grupo de anuncios'] || row['ad_group'] || '—'),
        keyword:       getStr(row['palavra-chave'] || row['keyword'] || '—'),
        search_term:   getStr(row['termo de pesquisa'] || row['search_term'] || '—'),
        observation:   getStr(row['observacao'] || row['observation'] || row['obs.'] || row['obs'] || ''),
        duvida:        getStr(row['duvida'] || row['duvida?'] || row['duvidas'] || ''),
        suggestion_group:    getStr(row['grupo de sugestao'] || row['suggestion_group'] || ''),
        segment:             getStr(row['segmentar'] || row['segmento'] || row['segment'] || ''),
        negativize:          getStr(row['negativar?'] || row['negativar'] || row['negativize'] || ''),
        ab_test:             getStr(row['teste_ab'] || row['teste a/b'] || row['teste_a_b'] || row['ab_test'] || ''),
        status_granularity:  getStr(row['status_granularidade'] || row['status de granularidade'] || row['status_granularity'] || row['status'] || ''),
        clicks:              getNum(row['cliques'] || row['clicks']),
        impressions:         getNum(row['impr.'] || row['impressoes'] || row['impressions']),
        ctr:                 getNum(row['ctr']),
        avg_cpc:             getNum(row['cpc medio'] || row['avg_cpc']),
        cost:                getNum(row['custo'] || row['cost']),
        conversions:         getNum(row['conversoes'] || row['conversions']),
        cost_per_conversion: getNum(row['custo / conv.'] || row['custo por conversao'] || row['cost_per_conversion']),
        conversion_rate:     getNum(row['taxa de conv.'] || row['taxa de conversao'] || row['conversion_rate']),
        match_type:          getStr(row['tipo de correspondencia'] || row['match_type'] || ''),
        added_excluded:      getStr(row['adicionado/excluido'] || row['added_excluded'] || ''),
        intervencao_humana:  getStr(row['comentario (otavio)'] || row['intervencao humana'] || row['manual_intervention'] || ''),
    };
}


/**
 * Carrega dados de Google Sheets (via URL) ou arquivos locais (Excel/CSV).
 */
export async function carregarDados(caminho_ou_url: string | File, tipo: "sheets" | "local", companyId: string): Promise<CampaignTerm[]> {
    // Reset debug flag so normalized keys are logged for each new load
    _debugLoggedOnce = false;
    try {
        if (tipo === "sheets" && typeof caminho_ou_url === "string") {
            const url = caminho_ou_url;

            // Extrai o ID da planilha e converte para link de exportação CSV
            const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (!idMatch) {
                throw new Error("Erro: URL do Google Sheets inválida.");
            }

            const sheetId = idMatch[1];
            // Tenta identificar o GID (aba específica) se houver
            const gidMatch = url.match(/gid=([0-9]+)/);
            const gid = gidMatch ? gidMatch[1] : "0";

            const urlFinal = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

            return new Promise((resolve, reject) => {
                Papa.parse(urlFinal, {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.errors.length && !results.data.length) {
                            reject(new Error(`Erro ao ler CSV: ${results.errors[0].message}`));
                            return;
                        }

                        // Se encontrou dados mas HTML, provavelmente é planilha privada
                        if (results.data.length > 0 && typeof results.data[0] === 'object' && Object.keys(results.data[0] as object)[0]?.toLowerCase().includes('!doctype html')) {
                            reject(new Error("Aviso: A planilha parece ser privada ou não existe. Altere a permissão para 'Qualquer pessoa com o link'."));
                            return;
                        }

                        if (results.data.length > 0) {
                            console.log("Primeira linha processada (Sheets):", results.data[0]);
                        }

                        const cleanData = results.data.map((row: any, index: number) => ({
                            id: index.toString(),
                            company_id: companyId,
                            campaign_id: `cmp_${companyId}_${index}`,
                            ...cleanAndFormatRow(row)
                        })) as CampaignTerm[];

                        resolve(cleanData);
                    },
                    error: (error: any) => {
                        reject(new Error(`Erro de rede ou CORS: ${error.message}`));
                    }
                });
            });

        } else if (tipo === "local" && caminho_ou_url instanceof File) {
            const file = caminho_ou_url;
            return new Promise((resolve, reject) => {
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target?.result as ArrayBuffer);
                            const workbook = XLSX.read(data, { type: 'array' });
                            const firstSheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[firstSheetName];
                            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                            if (jsonData.length > 0) {
                                console.log("Primeira linha processada (XLSX):", jsonData[0]);
                            }

                            const cleanData = jsonData.map((row: any, index: number) => ({
                                id: index.toString(),
                                company_id: companyId,
                                campaign_id: `cmp_${companyId}_${index}`,
                                ...cleanAndFormatRow(row)
                            })) as CampaignTerm[];

                            resolve(cleanData);
                        } catch (err: any) {
                            reject(new Error(`Erro ao ler arquivo Excel: ${err.message}`));
                        }
                    };
                    reader.onerror = () => reject(new Error("Erro ao ler arquivo."));
                    reader.readAsArrayBuffer(file);
                } else if (file.name.endsWith('.csv')) {
                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            if (results.errors.length && !results.data.length) {
                                reject(new Error(`Erro ao ler CSV local: ${results.errors[0].message}`));
                                return;
                            }

                            if (results.data.length > 0) {
                                console.log("Primeira linha processada (CSV Local):", results.data[0]);
                            }

                            const cleanData = results.data.map((row: any, index: number) => ({
                                id: index.toString(),
                                company_id: companyId,
                                campaign_id: `cmp_${companyId}_${index}`,
                                ...cleanAndFormatRow(row)
                            })) as CampaignTerm[];

                            resolve(cleanData);
                        },
                        error: (error: any) => {
                            reject(new Error(`Erro ao processar CSV: ${error.message}`));
                        }
                    });
                } else {
                    reject(new Error("Formato não suportado. Use CSV, XLS ou XLSX."));
                }
            });
        }
        throw new Error("Parâmetros inválidos para carregar dados.");
    } catch (e: any) {
        throw new Error(`Erro ao carregar dados: ${e.message}`);
    }
}
