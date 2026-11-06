import type { CampaignTerm } from '../types';

/** Minúsculas e sem acento, para a busca não depender de como o termo foi digitado. */
export function normalizarBusca(texto: unknown): string {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Filtra por termo de pesquisa, palavra-chave, campanha e grupo de anúncios.
 * Cada palavra digitada precisa aparecer em algum desses campos.
 */
export function filtrarPorBusca(termos: CampaignTerm[], consulta: string): CampaignTerm[] {
    const palavras = normalizarBusca(consulta).split(/\s+/).filter(Boolean);
    if (palavras.length === 0) return termos;
    return termos.filter(t => {
        const alvo = normalizarBusca([t?.termo_de_pesquisa, t?.palavra_chave, t?.campanha, t?.grupo_de_anuncios].join(' '));
        return palavras.every(p => alvo.includes(p));
    });
}
