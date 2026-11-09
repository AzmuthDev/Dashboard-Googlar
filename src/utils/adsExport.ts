import type { CampaignTerm } from '../types';

import { acaoDoTermo, semDestino, type TipoAcao } from '../../supabase/functions/_shared/pocket-ads/termos.ts';

export { acaoDoTermo };
export type TipoExport = TipoAcao;
export type MatchNegativa = 'exact' | 'phrase' | 'broad';

export interface ResultadoExportacao {
    /** TSV para colar no Google Ads Editor (negativar e segmentar). */
    editor: string;
    /** Lista simples (Campanha, Grupo, Termo) para o analista; Teste A/B não gera critério do Editor. */
    testeAb: string;
    total: number;
    /** Respostas selecionadas que não podem ser apontadas no Editor (campanha ou grupo ausente). */
    omitidos: number;
}

const CABECALHO_EDITOR = 'Campaign\tAd group\tKeyword\tCriterion Type';
const CABECALHO_TESTE_AB = 'Campanha\tGrupo\tTermo';

const CRITERIO_NEGATIVA: Record<MatchNegativa, string> = {
    exact: 'Negative Exact',
    phrase: 'Negative Phrase',
    broad: 'Negative Broad',
};

const limpar = (valor: unknown): string => String(valor ?? '').replace(/[\t\r\n]+/g, ' ').trim();

export function montarExportacao(
    termos: CampaignTerm[],
    opts: { tipos: TipoExport[]; matchNegativa: MatchNegativa }
): ResultadoExportacao {
    const linhasEditor = new Set<string>();
    const linhasTesteAb = new Set<string>();
    let omitidos = 0;

    for (const t of termos) {
        if (t.respondido_cliente !== true) continue;
        const tipo = acaoDoTermo(t);
        if (!tipo || !opts.tipos.includes(tipo)) continue;

        const campanha = limpar(t.campanha);
        const grupo = limpar(t.grupo_de_anuncios);
        const palavra = limpar(t.termo_de_pesquisa);
        if (semDestino(campanha) || semDestino(grupo) || palavra === '') { omitidos++; continue; }

        if (tipo === 'teste_ab') {
            linhasTesteAb.add(`${campanha}\t${grupo}\t${palavra}`);
        } else {
            const criterio = tipo === 'negativar' ? CRITERIO_NEGATIVA[opts.matchNegativa] : 'Exact';
            linhasEditor.add(`${campanha}\t${grupo}\t${palavra}\t${criterio}`);
        }
    }

    return {
        editor: [CABECALHO_EDITOR, ...linhasEditor].join('\n') + '\n',
        testeAb: [CABECALHO_TESTE_AB, ...linhasTesteAb].join('\n') + '\n',
        total: linhasEditor.size + linhasTesteAb.size,
        omitidos,
    };
}
