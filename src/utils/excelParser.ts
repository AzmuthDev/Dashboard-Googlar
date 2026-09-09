import * as XLSX from 'xlsx';

/**
 * Normaliza uma string de cabeçalho:
 * 1. Remove acentos
 * 2. Minúsculas
 * 3. Substitui pontuação por espaço
 * 4. Remove espaços duplicados
 */
export function normalizeKey(raw: string): string {
    return String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Parser de número robusto que suporta:
 * - Formato brasileiro: "1.234,56", "R$ 150,00"
 * - Formato internacional: "1,234.56", "$150.00", "12.5"
 * - Moedas, porcentagens, hífens, etc.
 */
export function parseFlexNumber(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim();
    if (s === '--' || s === '-' || s.toLowerCase() === 'nan') return 0;
    
    // Remove símbolos de moeda no início e espaços
    s = s.replace(/^[^\d\-+]+/, '').replace(/[^\d.,\-+]+$/, '').trim();
    s = s.replace(/^(r\$|\$|€|£|us\$)\s*/i, '').trim();

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
        // e.g. 1.234,56 ou 1,234.56
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        if (lastComma > lastDot) {
            // 1.234,56 (BR: ponto é milhar, vírgula é decimal)
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            // 1,234.56 (EN: vírgula é milhar, ponto é decimal)
            s = s.replace(/,/g, '');
        }
    } else if (hasComma) {
        // 1234,56 -> 1234.56
        s = s.replace(',', '.');
    }
    // Se tiver apenas ponto (ex: 1234.56 ou 12.5), mantém como decimal padrão

    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

export interface ParsedSpreadsheetResult {
    items: any[];
    detectedSheet: string;
    headerIdx: number;
    headers: string[];
    rowCount: number;
}

/**
 * Decodifica qualquer arquivo XLSX, XLS ou CSV de termos de pesquisa:
 * - Varre todas as abas (SheetNames) e seleciona automaticamente a que contém os dados
 * - Identifica a linha real de cabeçalho ignorando metadados de relatório (ex: títulos e períodos de datas)
 * - Mapeia colunas de termos, palavras-chave, métricas (custo, conv, impr, cliques, etc.) de forma flexível
 * - Ignora linhas de total e resumo
 */
export function parseSpreadsheet(buffer: ArrayBuffer | Uint8Array, fileName?: string): ParsedSpreadsheetResult {
    const wb = XLSX.read(buffer, { type: 'array' });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error("O arquivo não contém nenhuma aba ou planilha de dados válida.");
    }

    let bestSheet = wb.SheetNames[0];
    let bestScore = -1;
    let bestRawRows: any[][] = [];
    let bestHeaderIdx = -1;
    let bestHeaders: string[] = [];

    // 1. Varredura inteligente de abas
    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws || !ws['!ref']) continue;

        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rawRows.length === 0) continue;

        let headerIdx = -1;
        // Varre até as primeiras 35 linhas para encontrar o cabeçalho real da tabela
        for (let i = 0; i < Math.min(rawRows.length, 35); i++) {
            const row = rawRows[i];
            if (!row || !Array.isArray(row)) continue;

            const nonEmpties = row.filter(c => String(c).trim().length > 0);
            if (nonEmpties.length < 3) continue; // Cabeçalho real de tabela do Google Ads possui múltiplas colunas

            const hasTermCol = row.some(c => {
                const norm = normalizeKey(String(c));
                return norm === 'termo de pesquisa' || norm === 'search term' || norm === 'termo' || norm === 'termos' ||
                       norm === 'termos de pesquisa' || norm === 'termo de busca' || norm === 'search query' || norm === 'query' ||
                       norm === 'palavra chave' || norm === 'palavra chave' || norm === 'keyword' ||
                       norm.includes('termo de pesquisa') || norm.includes('search term') || norm.includes('termo de busca') ||
                       norm.includes('consulta');
            });

            const hasMetricCol = row.some(c => {
                const norm = normalizeKey(String(c));
                return norm.includes('clique') || norm.includes('click') || norm.includes('impr') || norm.includes('custo') ||
                       norm.includes('cost') || norm.includes('conv') || norm.includes('grupo') || norm.includes('group') ||
                       norm.includes('taxa') || norm.includes('rate') || norm.includes('cpc') || norm.includes('ctr') ||
                       norm.includes('moeda') || norm.includes('currency') || norm.includes('roas');
            });

            if (hasTermCol && hasMetricCol) {
                headerIdx = i;
                break;
            }
        }

        const normSheet = sheetName.toLowerCase();
        const nameBonus = (normSheet.includes('termo') || normSheet.includes('search') || normSheet.includes('busca') || normSheet.includes('relat')) ? 500 : 0;
        const score = (headerIdx >= 0 ? 10000 : 0) + rawRows.length + nameBonus;

        if (score > bestScore) {
            bestScore = score;
            bestSheet = sheetName;
            bestRawRows = rawRows;
            bestHeaderIdx = headerIdx;
            bestHeaders = headerIdx >= 0 ? (rawRows[headerIdx] || []).map(h => String(h).trim()) : [];
        }
    }

    // Se nenhuma linha cumpriu ambos os critérios estritos, pega a primeira linha com >= 3 células
    if (bestHeaderIdx === -1) {
        for (let i = 0; i < Math.min(bestRawRows.length, 10); i++) {
            const r = bestRawRows[i];
            if (r && r.filter(c => String(c).trim().length > 0).length >= 3) {
                bestHeaderIdx = i;
                bestHeaders = (bestRawRows[i] || []).map(h => String(h).trim());
                break;
            }
        }
        if (bestHeaderIdx === -1) {
            bestHeaderIdx = 0;
            bestHeaders = (bestRawRows[0] || []).map(h => String(h).trim());
        }
    }

    // 2. Mapeamento flexível de índices de coluna
    const colMap: {
        termo?: number;
        kw?: number;
        grupo?: number;
        campanha?: number;
        impr?: number;
        cliques?: number;
        custo?: number;
        conv?: number;
        receita?: number;
        cpa?: number;
        roas?: number;
        ctr?: number;
        cpc?: number;
        tipoCorresp?: number;
        adicionada?: number;
    } = {};

    bestHeaders.forEach((h, idx) => {
        const norm = normalizeKey(h);
        if (colMap.termo === undefined && (
            norm.includes('termo de pesquisa') || norm.includes('search term') || norm.includes('termo de busca') ||
            norm === 'termo' || norm === 'termos' || norm.includes('search query') || norm === 'query' ||
            norm.includes('consulta de pesquisa') || norm === 'consulta'
        )) {
            colMap.termo = idx;
        } else if (colMap.kw === undefined && (norm.includes('palavra chave') || norm.includes('keyword') || norm === 'criterio' || norm === 'criterion')) {
            colMap.kw = idx;
        } else if (colMap.grupo === undefined && (norm.includes('grupo de anuncios') || norm.includes('ad group') || norm === 'grupo' || norm === 'conjunto')) {
            colMap.grupo = idx;
        } else if (colMap.campanha === undefined && (norm.includes('campanha') || norm.includes('campaign'))) {
            colMap.campanha = idx;
        } else if (colMap.impr === undefined && (norm.includes('impr') || norm.includes('impress'))) {
            colMap.impr = idx;
        } else if (colMap.cliques === undefined && (norm.includes('clique') || norm.includes('click') || norm.includes('interac'))) {
            colMap.cliques = idx;
        } else if (colMap.custo === undefined && (norm === 'custo' || norm === 'cost' || norm === 'investimento' || norm === 'gasto' || norm === 'custo total')) {
            colMap.custo = idx;
        } else if (colMap.conv === undefined && (norm === 'conversoes' || norm === 'conversions' || norm === 'conv' || norm === 'todas as conv' || norm.includes('conversoes'))) {
            colMap.conv = idx;
        } else if (colMap.receita === undefined && (
            norm.includes('valor conv') || norm.includes('conv value') || norm === 'receita' ||
            norm.includes('valor de todas as conv') || norm.includes('valor todas as conv') || norm.includes('faturamento')
        )) {
            colMap.receita = idx;
        } else if (colMap.cpa === undefined && (norm.includes('custo conv') || norm.includes('cpa') || norm.includes('cost conv'))) {
            colMap.cpa = idx;
        } else if (colMap.roas === undefined && (norm.includes('roas') || norm.includes('valor conv custo') || norm.includes('conv value cost'))) {
            colMap.roas = idx;
        } else if (colMap.ctr === undefined && (norm === 'ctr' || norm.includes('taxa de cliques'))) {
            colMap.ctr = idx;
        } else if (colMap.cpc === undefined && (norm.includes('cpc') || norm.includes('custo medio'))) {
            colMap.cpc = idx;
        } else if (colMap.tipoCorresp === undefined && (norm.includes('corresp') || norm.includes('match type'))) {
            colMap.tipoCorresp = idx;
        } else if (colMap.adicionada === undefined && (norm.includes('adicionada') || norm.includes('excluida') || norm.includes('added') || norm.includes('status'))) {
            colMap.adicionada = idx;
        }
    });

    // Se termo não foi achado, usa palavra-chave como fallback
    if (colMap.termo === undefined && colMap.kw !== undefined) {
        colMap.termo = colMap.kw;
    }

    // 3. Extração dos objetos de dados
    const items: any[] = [];
    for (let i = bestHeaderIdx + 1; i < bestRawRows.length; i++) {
        const r = bestRawRows[i];
        if (!r || r.length === 0) continue;

        const firstCell = String(r[0] || '').trim().toLowerCase();
        // Ignora linhas de total geral ou rodapés de resumo
        if (firstCell.startsWith('total') || firstCell.startsWith('todas') || firstCell.startsWith('soma') || firstCell.startsWith('resumo')) {
            continue;
        }

        const termVal = colMap.termo !== undefined ? String(r[colMap.termo] || '').trim() : '';
        if (!termVal) continue;

        const kwVal = colMap.kw !== undefined ? String(r[colMap.kw] || '').trim() : '';
        const grupoVal = colMap.grupo !== undefined ? String(r[colMap.grupo] || '').trim() : 'Grupo Geral';
        const campVal = colMap.campanha !== undefined ? String(r[colMap.campanha] || '').trim() : '';

        const imprVal = colMap.impr !== undefined ? parseFlexNumber(r[colMap.impr]) : 0;
        const cliquesVal = colMap.cliques !== undefined ? parseFlexNumber(r[colMap.cliques]) : 0;
        const custoVal = colMap.custo !== undefined ? parseFlexNumber(r[colMap.custo]) : 0;
        const convVal = colMap.conv !== undefined ? parseFlexNumber(r[colMap.conv]) : 0;
        const receitaVal = colMap.receita !== undefined ? parseFlexNumber(r[colMap.receita]) : 0;
        const cpaVal = colMap.cpa !== undefined ? parseFlexNumber(r[colMap.cpa]) : 0;
        const roasVal = colMap.roas !== undefined ? parseFlexNumber(r[colMap.roas]) : 0;
        const ctrVal = colMap.ctr !== undefined ? parseFlexNumber(r[colMap.ctr]) : 0;
        const cpcVal = colMap.cpc !== undefined ? parseFlexNumber(r[colMap.cpc]) : 0;
        const tipoCorrespVal = colMap.tipoCorresp !== undefined ? String(r[colMap.tipoCorresp] || '').trim() : '';
        const adicionadaVal = colMap.adicionada !== undefined ? String(r[colMap.adicionada] || '').trim() : '';

        const item: Record<string, any> = {
            'Termo de pesquisa': termVal,
            termo: termVal,
            termo_de_pesquisa: termVal,
            'Palavra-chave': kwVal,
            palavra_chave: kwVal,
            'Grupo de anúncios': grupoVal,
            grupo_de_anuncios: grupoVal,
            campanha: campVal,
            'Impr.': imprVal,
            impressoes: imprVal,
            'Cliques': cliquesVal,
            cliques: cliquesVal,
            'Custo': custoVal,
            custo: custoVal,
            'Conversões': convVal,
            conversoes: convVal,
            'Valor de conv.': receitaVal,
            valor_conv: receitaVal,
            'Custo / conv.': cpaVal,
            custo_conv: cpaVal,
            'ROAS': roasVal,
            ctr: ctrVal,
            cpc_medio: cpcVal,
            tipo_corresp: tipoCorrespVal,
            adicionada_excluida: adicionadaVal
        };

        // Preserva também todas as colunas com os nomes originais da planilha
        bestHeaders.forEach((h, colIdx) => {
            if (h && !(h in item)) {
                item[h] = r[colIdx] !== undefined ? r[colIdx] : '';
            }
        });

        items.push(item);
    }

    if (items.length === 0) {
        throw new Error(
            `A planilha na aba "${bestSheet}" está vazia ou não contém termos de busca reconhecíveis. ` +
            `Verifique se as colunas de "Termo de pesquisa", "Impressões" ou "Custo" estão presentes.`
        );
    }

    return {
        items,
        detectedSheet: bestSheet,
        headerIdx: bestHeaderIdx,
        headers: bestHeaders,
        rowCount: items.length
    };
}
