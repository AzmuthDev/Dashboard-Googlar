import type { CampaignTerm } from '../types';

/**
 * Normaliza strings para chave de origem:
 * - Remove acentos/diacríticos
 * - Converte para minúsculas
 * - Remove espaços extras nas pontas e entre palavras
 */
export function normalizeOriginString(str: any): string {
    if (str === null || str === undefined) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * Gera a chave composta única da origem do termo:
 * Campanha + Grupo de Anúncios + Palavra-Chave + Termo de Pesquisa
 */
export function getTermOriginKey(term: Partial<CampaignTerm> | Record<string, any>): string {
    const campanha = normalizeOriginString(term.campanha || term.campaign_name || term.campaign || '—');
    const grupo = normalizeOriginString(term.grupo_de_anuncios || term.ad_group || term.grupo || '—');
    const palavra = normalizeOriginString(term.palavra_chave || term.keyword || term.criterio || '—');
    const termo = normalizeOriginString(
        term.termo_de_pesquisa || 
        term.search_term || 
        term.termo || 
        term['Termo de pesquisa'] || 
        term['Search term'] || 
        '—'
    );

    return `${campanha}|||${grupo}|||${palavra}|||${termo}`;
}

/**
 * Mescla dois registros com a mesma origem, garantindo que nenhum status
 * de envio ao cliente (WhatsApp, enquetes, respostas) ou triagem seja perdido.
 */
export function mergeDuplicateTerms(a: CampaignTerm, b: CampaignTerm): CampaignTerm {
    // Prioriza como base aquele que já foi enviado para o cliente
    const aSent = a.enviado_para_grupo === true;
    const bSent = b.enviado_para_grupo === true;

    const base: CampaignTerm = (!aSent && bSent) ? { ...b } : { ...a };
    const other: CampaignTerm = (!aSent && bSent) ? a : b;

    // Preservar flags booleanas de comunicação e triagem (OR lógico)
    base.enviado_para_grupo = Boolean(a.enviado_para_grupo || b.enviado_para_grupo);
    base.respondido_cliente = Boolean(a.respondido_cliente || b.respondido_cliente);
    base.pode_enviar = Boolean(a.pode_enviar || b.pode_enviar);
    base.triagem1 = Boolean(a.triagem1 || b.triagem1);
    base.triagem2 = Boolean(a.triagem2 || b.triagem2);

    // Julgamentos de triagem semântica
    if (!base.negativar && other.negativar) base.negativar = other.negativar;
    if (!base.segmentar && other.segmentar) base.segmentar = other.segmentar;
    if (!base.teste_ab && other.teste_ab) base.teste_ab = other.teste_ab;
    if (!base.duvida && other.duvida) base.duvida = other.duvida;
    if (!base.manter && other.manter) base.manter = other.manter;

    // Metadados de enquete/WhatsApp e comentários
    if (!base.id_enquete && other.id_enquete) base.id_enquete = other.id_enquete;
    if (!base.data_envio_enquete && other.data_envio_enquete) base.data_envio_enquete = other.data_envio_enquete;
    if (!base.data_resposta && other.data_resposta) base.data_resposta = other.data_resposta;
    if (!base.acao && other.acao) base.acao = other.acao;
    if (!base.observacao && other.observacao) base.observacao = other.observacao;
    if (!base.sugestao_grupo && other.sugestao_grupo) base.sugestao_grupo = other.sugestao_grupo;
    if (!base.auditor_comment && other.auditor_comment) base.auditor_comment = other.auditor_comment;
    if (!base.usuario && other.usuario) base.usuario = other.usuario;
    if (!base.tipo_corresp && other.tipo_corresp) base.tipo_corresp = other.tipo_corresp;

    // Métricas numéricas
    const parseNum = (v: any) => {
        if (typeof v === 'number') return isNaN(v) ? 0 : v;
        const n = parseFloat(String(v || '0').replace(',', '.'));
        return isNaN(n) ? 0 : n;
    };

    const costA = parseNum(a.custo);
    const costB = parseNum(b.custo);
    const cliquesA = parseNum(a.cliques);
    const cliquesB = parseNum(b.cliques);
    const impA = parseNum(a.impressoes);
    const impB = parseNum(b.impressoes);
    const convA = parseNum(a.conversoes);
    const convB = parseNum(b.conversoes);

    // Se as métricas são idênticas (linha duplicada pura), não duplica a soma
    const isIdenticalMetrics = costA === costB && cliquesA === cliquesB && impA === impB;

    if (isIdenticalMetrics) {
        base.custo = costA;
        base.cliques = cliquesA;
        base.impressoes = impA;
        base.conversoes = convA;
    } else {
        base.custo = Number((costA + costB).toFixed(2));
        base.cliques = cliquesA + cliquesB;
        base.impressoes = impA + impB;
        base.conversoes = Number((convA + convB).toFixed(2));
    }

    if (base.impressoes > 0) {
        base.ctr = Number(((base.cliques / base.impressoes) * 100).toFixed(2));
    }
    if (base.cliques > 0) {
        base.cpc_medio = Number((base.custo / base.cliques).toFixed(2));
    }
    if (base.conversoes > 0) {
        base.custo_conv = Number((base.custo / base.conversoes).toFixed(2));
        base.taxa_conv = Number(((base.conversoes / base.cliques) * 100).toFixed(2));
    }

    return base;
}

export interface DeduplicationResult<T> {
    deduplicated: T[];
    duplicateCount: number;
    duplicateIds: string[];
}

/**
 * Filtra e exclui termos repetidos que tenham a mesma origem:
 * mesma campanha, mesmo grupo de anúncios, mesma palavra-chave e mesmo termo de pesquisa.
 */
export function deduplicateTermsByOrigin<T extends Partial<CampaignTerm>>(
    terms: T[]
): DeduplicationResult<T> {
    if (!Array.isArray(terms) || terms.length === 0) {
        return { deduplicated: [], duplicateCount: 0, duplicateIds: [] };
    }

    const map = new Map<string, T>();
    const duplicateIds: string[] = [];
    let duplicateCount = 0;

    for (const term of terms) {
        if (!term) continue;
        const key = getTermOriginKey(term);

        if (!map.has(key)) {
            map.set(key, { ...term });
        } else {
            duplicateCount++;
            const existing = map.get(key)!;
            
            // Rastrear ID duplicado que foi excluído
            if (term.id && term.id !== existing.id) {
                duplicateIds.push(term.id);
            }

            // Mesclar para não perder flags de envio ou triagem
            const merged = mergeDuplicateTerms(existing as CampaignTerm, term as CampaignTerm) as T;
            map.set(key, merged);
        }
    }

    return {
        deduplicated: Array.from(map.values()),
        duplicateCount,
        duplicateIds
    };
}
