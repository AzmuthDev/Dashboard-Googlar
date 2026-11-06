import type { CampaignTerm } from '../types';

/**
 * Converte valores que chegam do Supabase/planilha em número.
 * Aceita número, "8.24", "1,5" e "R$ 1.234,56". Qualquer coisa inválida vira 0.
 */
export function paraNumero(valor: unknown): number {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
    if (valor === null || valor === undefined) return 0;
    let s = String(valor).replace(/R\$|\s/g, '').trim();
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
        s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

// Uma flag do agente pode vir como booleano, emoji (✅ ❌ ⚠️ ❓ ➡️) ou texto "true".
const flag = (valor: unknown, emoji: string) =>
    valor === true || String(valor ?? '').includes(emoji) || String(valor ?? '').toLowerCase() === 'true';

export const isNeg = (t: CampaignTerm) => flag(t?.negativar, '❌');
export const isDuv = (t: CampaignTerm) => flag(t?.duvida, '❓');
export const isSeg = (t: CampaignTerm) => flag(t?.segmentar, '✅');
export const isTst = (t: CampaignTerm) => flag(t?.teste_ab, '⚠️');
export const isMnt = (t: CampaignTerm) => flag(t?.manter, '➡️');

export interface ContagemStatus {
    total: number;
    negativas: number;
    duvidas: number;
    aprovadas: number;
    ab_test: number;
    respostas: number;
    semCategoria: number;
}

/**
 * Mesma regra das abas da Triagem: termo já enviado ao cliente só conta em "respostas";
 * os demais contam na categoria marcada pelo agente.
 */
export function contarStatus(termos: CampaignTerm[]): ContagemStatus {
    const c: ContagemStatus = { total: termos.length, negativas: 0, duvidas: 0, aprovadas: 0, ab_test: 0, respostas: 0, semCategoria: 0 };
    for (const t of termos) {
        if (!t) continue;
        if (t.enviado_para_grupo === true) {
            c.respostas++;
            continue;
        }
        const neg = isNeg(t), duv = isDuv(t), seg = isSeg(t), tst = isTst(t);
        if (neg) c.negativas++;
        if (duv) c.duvidas++;
        if (seg) c.aprovadas++;
        if (tst) c.ab_test++;
        if (!neg && !duv && !seg && !tst) c.semCategoria++;
    }
    return c;
}

export interface MetricasDashboard {
    totalTermos: number;
    campanhas: number;
    /** Custo dos termos negativados: é o gasto que deixa de acontecer. */
    economia: number;
    conversoes: number;
    custoTotal: number;
    /** Dúvidas ainda não enviadas ao cliente (mesmo número da aba Dúvidas da Triagem). */
    duvidasPendentes: number;
    /** Termos enviados ao cliente que ainda não têm resposta. */
    aguardandoCliente: number;
    /** Termos com decisão tomada (negativar, segmentar, teste A/B, manter ou resposta do cliente). */
    decididos: number;
    percentualDecidido: number;
}

export function calcularMetricas(termos: CampaignTerm[]): MetricasDashboard {
    const lista = (Array.isArray(termos) ? termos : []).filter(Boolean);
    const campanhas = new Set<string>();
    let economia = 0, conversoes = 0, custoTotal = 0, duvidasPendentes = 0, aguardandoCliente = 0, decididos = 0;

    for (const t of lista) {
        if (t.campanha) campanhas.add(t.campanha);
        const custo = paraNumero(t.custo);
        custoTotal += custo;
        conversoes += paraNumero(t.conversoes);

        const irrelevanteLegado = String(t.status_granularidade ?? '').includes('Irrelevante');
        if (isNeg(t) || irrelevanteLegado) economia += custo;

        // Mesma prioridade da Triagem: enviado ao cliente > dúvida > outra categoria.
        const respondido = t.respondido_cliente === true;
        const enviado = t.enviado_para_grupo === true;
        if (enviado) {
            if (respondido) decididos++;
            else aguardandoCliente++;
        } else if (isDuv(t)) {
            duvidasPendentes++;
        } else if (isNeg(t) || isSeg(t) || isTst(t) || isMnt(t)) {
            decididos++;
        }
    }

    const arred = (n: number) => Math.round(n * 100) / 100;
    return {
        totalTermos: lista.length,
        campanhas: campanhas.size,
        economia: arred(economia),
        conversoes: arred(conversoes),
        custoTotal: arred(custoTotal),
        duvidasPendentes,
        aguardandoCliente,
        decididos,
        percentualDecidido: lista.length ? Math.round((decididos / lista.length) * 100) : 0,
    };
}

export interface CustoCampanha {
    campanha: string;
    custo: number;
    conversoes: number;
    termos: number;
    negativados: number;
}

/** Campanhas ordenadas pelo custo somado dos termos de pesquisa. */
export function custoPorCampanha(termos: CampaignTerm[], limite = 8): CustoCampanha[] {
    const mapa = new Map<string, CustoCampanha>();
    for (const t of Array.isArray(termos) ? termos : []) {
        if (!t) continue;
        const nome = String(t.campanha ?? '').trim() || 'Sem campanha';
        const c = mapa.get(nome) ?? { campanha: nome, custo: 0, conversoes: 0, termos: 0, negativados: 0 };
        c.custo += paraNumero(t.custo);
        c.conversoes += paraNumero(t.conversoes);
        c.termos++;
        if (isNeg(t)) c.negativados++;
        mapa.set(nome, c);
    }
    return [...mapa.values()]
        .map(c => ({ ...c, custo: Math.round(c.custo * 100) / 100, conversoes: Math.round(c.conversoes * 100) / 100 }))
        .sort((a, b) => b.custo - a.custo)
        .slice(0, limite);
}

/** Termos que gastaram e não converteram, do mais caro para o mais barato. */
export function maioresCustosSemConversao(termos: CampaignTerm[], limite = 6): CampaignTerm[] {
    return (Array.isArray(termos) ? termos : [])
        .filter(t => t && paraNumero(t.conversoes) === 0 && paraNumero(t.custo) > 0)
        .sort((a, b) => paraNumero(b.custo) - paraNumero(a.custo))
        .slice(0, limite);
}
