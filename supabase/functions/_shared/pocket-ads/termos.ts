// Módulo puro, compartilhado entre Edge Functions (Deno) e o front (React). Sem imports externos.

export type TipoAcao = 'segmentar' | 'negativar' | 'teste_ab';

/** Ação do cliente para o termo; `manter` (legado) vale `segmentar`; sem `acao`, usa as flags. */
export function acaoDoTermo(t: {
    acao?: string | null;
    segmentar?: boolean | null;
    negativar?: boolean | null;
    teste_ab?: boolean | null;
}): TipoAcao | null {
    if (t.acao === 'manter') return 'segmentar';
    if (t.acao === 'segmentar' || t.acao === 'negativar' || t.acao === 'teste_ab') return t.acao;
    if (t.acao) return null;
    if (t.negativar === true) return 'negativar';
    if (t.teste_ab === true) return 'teste_ab';
    if (t.segmentar === true) return 'segmentar';
    return null;
}

/** Igual à `_chave_norm` do banco: minúsculas, sem acento, espaços colapsados, trim. */
export function normalizarNome(s: string | null | undefined): string {
    return (s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/** Campanha/grupo ausente: vazio, `n/a` ou `-`. */
export function semDestino(s: string): boolean {
    return s === '' || /^(n\/a|-)$/i.test(s);
}

/** Mensagem de erro (pt-BR) se o texto da palavra-chave passar de 80 caracteres ou 10 palavras; senão `null`. */
export function validarTextoPalavra(texto: string): string | null {
    if (texto.length > 80) return 'O texto da palavra-chave deve ter no máximo 80 caracteres.';
    if (texto.trim().split(/\s+/).filter(Boolean).length > 10) return 'O texto da palavra-chave deve ter no máximo 10 palavras.';
    return null;
}
