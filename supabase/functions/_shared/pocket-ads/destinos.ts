// Módulo puro, compartilhado entre Edge Functions (Deno) e o front. Sem imports externos.
import { normalizarNome, semDestino, validarTextoPalavra } from './termos.ts';

export type Correspondencia = 'exata' | 'frase' | 'ampla';
export type Nivel = 'grupo' | 'campanha' | 'lista' | 'conta';
export type Match = 'EXACT' | 'PHRASE' | 'BROAD';

export interface LinhaTermo { id: string; termo: string; campanha: string; grupo: string }
export interface Catalogo {
    campanhas: { id: string; nome: string; tipoCanal: string }[];
    grupos: { id: string; nome: string; campanhaId: string }[];
    existentes: Set<string>;
}
export interface Destino { campanhaId: string; grupoId?: string }
export interface ItemResolvido {
    texto: string;
    idsLinhas: string[];
    destino?: Destino;
    situacao: 'ok' | 'ja_existe' | 'erro';
    erro?: string;
}
export type Alvo =
    | { tipo: 'segmentar' | 'teste_ab' }
    | { tipo: 'negativar'; nivel: Nivel; correspondencia: Correspondencia; listaId?: string };

export function matchDe(c: Correspondencia): Match {
    return c === 'exata' ? 'EXACT' : c === 'frase' ? 'PHRASE' : 'BROAD';
}

/** escopo = 'g:<id>' | 'c:<id>' | 'l:<id>' | 'conta'. */
export function chaveExistente(escopo: string, texto: string, match: Match): string {
    return `${escopo}|${match}|${normalizarNome(texto)}`;
}

export function emLotes<T>(itens: T[], tamanho = 500): T[][] {
    const lotes: T[][] = [];
    for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
    return lotes;
}

const PMAX = 'PERFORMANCE_MAX';

function achar<T extends { nome: string }>(lista: T[], nome: string): { item?: T; erro?: 'ambíguo' | 'ausente' } {
    if (semDestino(nome)) return { erro: 'ausente' };
    const chave = normalizarNome(nome);
    const achados = lista.filter((x) => normalizarNome(x.nome) === chave);
    if (achados.length > 1) return { erro: 'ambíguo' };
    if (achados.length === 0) return { erro: 'ausente' };
    return { item: achados[0] };
}

export function resolverItens(linhas: LinhaTermo[], catalogo: Catalogo, alvo: Alvo): ItemResolvido[] {
    const saida: ItemResolvido[] = [];
    const porChave = new Map<string, ItemResolvido>();
    const nivel: Nivel | null = alvo.tipo === 'negativar' ? alvo.nivel : null;
    const match: Match = alvo.tipo === 'negativar' ? matchDe(alvo.correspondencia) : 'EXACT';
    const exigeCampanha = nivel !== 'lista' && nivel !== 'conta';
    const exigeGrupo = nivel === null || nivel === 'grupo';

    const erro = (l: LinhaTermo, texto: string, msg: string) =>
        saida.push({ texto, idsLinhas: [l.id], situacao: 'erro', erro: msg });

    for (const l of linhas) {
        const texto = l.termo.trim().replace(/\s+/g, ' ');
        const invalido = validarTextoPalavra(texto);
        if (invalido) { erro(l, texto, invalido); continue; }

        if (alvo.tipo === 'negativar' && alvo.nivel === 'lista' && !alvo.listaId) {
            erro(l, texto, 'escolha a lista de negativas');
            continue;
        }

        const camp = achar(catalogo.campanhas, l.campanha);
        if (exigeCampanha) {
            if (camp.erro) {
                erro(l, texto, camp.erro === 'ambíguo' ? 'nome de campanha ambíguo' : 'campanha não encontrada no Google Ads');
                continue;
            }
            if (camp.item!.tipoCanal === PMAX) {
                erro(l, texto, exigeGrupo ? 'campanha Performance Max não tem grupo de anúncios' : 'em Performance Max use lista ou conta');
                continue;
            }
        }

        let destino: Destino | undefined = camp.item ? { campanhaId: camp.item.id } : undefined;
        let escopo: string;
        if (nivel === 'lista') escopo = `l:${(alvo as { listaId?: string }).listaId}`;
        else if (nivel === 'conta') escopo = 'conta';
        else if (nivel === 'campanha') escopo = `c:${destino!.campanhaId}`;
        else {
            const grupo = achar(catalogo.grupos.filter((g) => g.campanhaId === destino!.campanhaId), l.grupo);
            if (grupo.erro) {
                erro(l, texto, grupo.erro === 'ambíguo' ? 'nome de grupo ambíguo' : 'grupo não encontrado no Google Ads');
                continue;
            }
            destino = { campanhaId: destino!.campanhaId, grupoId: grupo.item!.id };
            escopo = `g:${grupo.item!.id}`;
        }

        const chave = chaveExistente(escopo, texto, match);
        const existente = porChave.get(chave);
        if (existente) { existente.idsLinhas.push(l.id); continue; }
        const item: ItemResolvido = {
            texto,
            idsLinhas: [l.id],
            destino,
            situacao: catalogo.existentes.has(chave) ? 'ja_existe' : 'ok',
        };
        porChave.set(chave, item);
        saida.push(item);
    }
    return saida;
}
