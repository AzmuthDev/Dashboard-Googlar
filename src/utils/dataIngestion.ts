import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseSpreadsheet, parseFlexNumber } from './excelParser';
import type { CampaignTerm } from '../types';

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

    const getNum = (val: any) => parseFlexNumber(val);

    const getStr = (val: any) => {
        return val !== null && val !== undefined ? String(val).trim() : '';
    };

    return {
        campanha:            getStr(row['campanha'] || row['campaign_name'] || row['campaign'] || '—'),
        grupo_de_anuncios:   getStr(row['grupo de anuncios'] || row['ad_group'] || row['grupo'] || '—'),
        palavra_chave:       getStr(row['palavra-chave'] || row['keyword'] || row['palavra chave'] || row['criterio'] || '—'),
        termo_de_pesquisa:   getStr(row['termo de pesquisa'] || row['search_term'] || row['termo'] || row['termos de pesquisa'] || row['termo de busca'] || row['search query'] || row['query'] || '—'),
        observacao:          getStr(row['observacao'] || row['observation'] || row['obs.'] || row['obs'] || ''),
        duvida:              getStr(row['duvida'] || row['duvida?'] || row['duvidas'] || ''),
        sugestao_grupo:      getStr(row['grupo de sugestao'] || row['suggestion_group'] || ''),
        segmentar:           getStr(row['segmentar'] || row['segmento'] || row['segment'] || ''),
        negativar:           getStr(row['negativar?'] || row['negativar'] || row['negativize'] || ''),
        teste_ab:            getStr(row['teste_ab'] || row['teste a/b'] || row['teste_a_b'] || row['ab_test'] || ''),
        status_granularidade: getStr(row['status_granularidade'] || row['status de granularidade'] || row['status_granularity'] || row['status'] || ''),
        cliques:             getNum(row['cliques'] || row['clicks'] || row['interacoes']),
        impressoes:          getNum(row['impr.'] || row['impressoes'] || row['impressions'] || row['impr']),
        ctr:                 getNum(row['ctr'] || row['taxa de cliques']),
        cpc_medio:           getNum(row['cpc medio'] || row['avg_cpc'] || row['cpc med.'] || row['custo medio']),
        custo:               getNum(row['custo'] || row['cost'] || row['investimento']),
        conversoes:          getNum(row['conversoes'] || row['conversions'] || row['conv.'] || row['todas as conv.']),
        custo_conv:          getNum(row['custo / conv.'] || row['custo por conversao'] || row['cost_per_conversion'] || row['cpa']),
        taxa_conv:           getNum(row['taxa de conv.'] || row['taxa de conversao'] || row['conversion_rate']),
        tipo_corresp:        getStr(row['tipo de correspondencia'] || row['match_type'] || row['tipo de corresp.'] || ''),
        adicionada_excluida: getStr(row['adicionado/excluido'] || row['added_excluded'] || row['adicionada/excluid'] || ''),
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
            const sheetIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (!sheetIdMatch) {
                throw new Error("Link do Google Sheets inválido. Certifique-se de usar a URL completa da planilha.");
            }
            const sheetId = sheetIdMatch[1];
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
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target?.result as ArrayBuffer);
                            const { items: jsonData } = parseSpreadsheet(data, file.name);

                            if (jsonData.length > 0) {
                                console.log("Primeira linha processada (Smart Parser):", jsonData[0]);
                            }

                            const cleanData = jsonData.map((row: any, index: number) => ({
                                id: index.toString(),
                                company_id: companyId,
                                campaign_id: `cmp_${companyId}_${index}`,
                                ...cleanAndFormatRow(row)
                            })) as CampaignTerm[];

                            resolve(cleanData);
                        } catch (err: any) {
                            reject(new Error(`Erro ao processar planilha: ${err.message}`));
                        }
                    };
                    reader.onerror = () => reject(new Error("Erro ao ler arquivo."));
                    reader.readAsArrayBuffer(file);
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
