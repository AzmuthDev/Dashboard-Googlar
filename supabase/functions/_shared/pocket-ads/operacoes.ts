// Módulo puro, compartilhado entre Edge Functions (Deno) e o front. Sem imports externos.
//
// Procedência (consulta em 2026-11-09):
//  - Versão: página de release notes buscada diretamente (WebFetch, primeiros 100 mil caracteres):
//    https://developers.google.com/google-ads/api/docs/release-notes -> última major v26 (2026-10-14);
//    v26.1 (2026-10-28) é minor da mesma versão, então a URL REST usa `v26`.
//  - NÍVEL CONTA NÃO VERIFICADO na página oficial: a URL tentada de negativas de conta retornou 404 e o
//    que segue vem de resumos secundários de busca (páginas shared-sets / add-customer-negative-criteria
//    do Google e fóruns), não de leitura direta. Confirmar no teste ponta a ponta em conta de teste do Google Ads.
//
// Hipótese para o nível `conta`: um conjunto compartilhado do tipo ACCOUNT_LEVEL_NEGATIVE_KEYWORDS
// (aparentemente no máx. 1 por conta) vinculado à conta por um CustomerNegativeCriterion. Contrato deste
// módulo: QUEM CHAMA acha/cria esse shared set e o vincula; aqui a negativa é adicionada ao shared set
// cujo id vem em `alvo.listaId`, no mesmo formato do nível `lista`:
//   POST /vN/customers/{C}/sharedCriteria:mutate
//   { operations: [{ create: { sharedSet: 'customers/C/sharedSets/S', keyword: { text, matchType } } }],
//     partialFailure: true }
// Limites divergem entre fontes; confirmar no uso real.
import { matchDe } from './destinos.ts';
import type { Alvo, ItemResolvido } from './destinos.ts';

export { matchDe } from './destinos.ts';

export const GOOGLE_ADS_API_VERSION = 'v26';

export interface Mutacao {
    /** `sharedSets`/`campaignSharedSets`/`customerNegativeCriteria`: criação e vínculo de listas (ferramentas.ts). */
    servico: 'adGroupCriteria' | 'campaignCriteria' | 'sharedCriteria' | 'customerNegativeCriteria' | 'sharedSets' | 'campaignSharedSets';
    operations: unknown[];
    /** posição do ItemResolvido de cada operação */
    indices: number[];
}

export interface ResultadoItem { indice: number; ok: boolean; resourceName?: string; erro?: string }

export function montarMutacoes(customerId: string, itens: ItemResolvido[], alvo: Alvo): Mutacao[] {
    const c = `customers/${customerId.replace(/^customers\//, '').replace(/-/g, '')}`;
    const operations: unknown[] = [];
    const indices: number[] = [];
    let servico: Mutacao['servico'];

    if (alvo.tipo === 'negativar' && (alvo.nivel === 'lista' || alvo.nivel === 'conta')) {
        if (!alvo.listaId) {
            throw new Error(alvo.nivel === 'conta' ? 'lista de negativas da conta ausente' : 'lista de negativas ausente');
        }
        servico = 'sharedCriteria';
    } else if (alvo.tipo === 'negativar' && alvo.nivel === 'campanha') servico = 'campaignCriteria';
    else servico = 'adGroupCriteria';

    itens.forEach((it, i) => {
        if (it.situacao !== 'ok') return;
        let op: unknown;
        if (alvo.tipo !== 'negativar') {
            const keyword = { text: it.texto, matchType: 'EXACT' };
            op = { create: { adGroup: `${c}/adGroups/${it.destino!.grupoId}`, status: alvo.tipo === 'teste_ab' ? 'PAUSED' : 'ENABLED', keyword } };
        } else {
            const keyword = { text: it.texto, matchType: matchDe(alvo.correspondencia) };
            if (alvo.nivel === 'lista' || alvo.nivel === 'conta') op = { create: { sharedSet: `${c}/sharedSets/${alvo.listaId}`, keyword } };
            else if (alvo.nivel === 'campanha') op = { create: { campaign: `${c}/campaigns/${it.destino!.campanhaId}`, negative: true, keyword } };
            else op = { create: { adGroup: `${c}/adGroups/${it.destino!.grupoId}`, negative: true, keyword } };
        }
        operations.push(op);
        indices.push(i);
    });

    return operations.length ? [{ servico, operations, indices }] : [];
}

interface ErroApi { message?: string; location?: { fieldPathElements?: { index?: number }[] } }

/**
 * `validateOnly`: o Google não devolve `results` na validação, então uma operação sem erro indexado é ok;
 * um erro sem nenhuma localização indexada continua marcando todas como falha.
 */
export function lerResultado(m: Mutacao, resposta: unknown, opcoes: { validateOnly?: boolean } = {}): ResultadoItem[] {
    const r = (resposta ?? {}) as {
        results?: { resourceName?: string }[];
        partialFailureError?: { message?: string; details?: { errors?: ErroApi[] }[] };
    };
    const falha = r.partialFailureError;
    const erros = new Map<number, string>();
    let geral: string | undefined;
    if (falha) {
        geral = falha.message || 'falha ao enviar ao Google Ads';
        for (const d of falha.details ?? []) {
            for (const e of d.errors ?? []) {
                const idx = e.location?.fieldPathElements?.[0]?.index;
                if (typeof idx === 'number' && !erros.has(idx)) erros.set(idx, e.message || geral);
            }
        }
    }
    return m.indices.map((indice, pos) => {
        const resourceName = r.results?.[pos]?.resourceName;
        if (erros.has(pos)) return { indice, ok: false, erro: erros.get(pos) };
        const semLocalizacao = erros.size === 0;
        if (falha && !resourceName && (!opcoes.validateOnly || semLocalizacao)) return { indice, ok: false, erro: geral };
        return resourceName ? { indice, ok: true, resourceName } : { indice, ok: true };
    });
}
