// Ferramentas MCP do conector do Pocket. Sem dependências de Deno: banco, Google Ads e credenciais
// chegam por `dep` (pocket-mcp/index.ts liga ao Supabase; os testes usam falsos em memória).
//
// Contrato de `dep`:
//  - perfil: quem chamou (do link pessoal). `empresas` = assigned_company_ids; admin vê todas.
//  - db: Repositorio (abaixo), com service_role. As ferramentas re-filtram as empresas pelo perfil.
//  - ads(cred): cliente da Google Ads API (criarClienteAds).
//  - conexao(): a google_ads_conexoes ativa do perfil (modo, e-mail) ou null.
//  - credenciais(cliente): Credenciais para aquele cliente (o login-customer-id depende dele;
//    null = só a conexão, usado por status_conexao) ou null se o Google Ads não está conectado.
import { acaoDoTermo, normalizarNome, semDestino } from './termos.ts';
import type { TipoAcao } from './termos.ts';
import { carregarCatalogo, ErroConexaoGoogle } from './googleAds.ts';
import type { ClienteAds, Credenciais } from './googleAds.ts';
import { emLotes, resolverItens } from './destinos.ts';
import type { Alvo, Correspondencia, ItemResolvido, LinhaTermo, Nivel } from './destinos.ts';
import { lerResultado, montarMutacoes } from './operacoes.ts';
import type { Mutacao, ResultadoItem } from './operacoes.ts';
import { ErroUsuario } from './mcp.ts';
import type { Ferramenta } from './mcp.ts';
import { decifrar } from './cifra.ts';

/** Só tabelas `mesa_*` com nome seguro chegam a `.from(mesa)`. */
export const MESA_VALIDA = /^mesa_[a-z0-9_]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE = 500;
const CAMINHO_CONEXAO = 'Pocket › Conectar ao Claude › Conectar com Google';
const NOME_LISTA_CONTA = 'Negativas da conta (Pocket)';
const PROVISORIA = 'a-criar';

export interface Perfil { id: string; isAdmin: boolean; empresas: string[]; nome?: string | null; email?: string | null }
export interface Empresa { id: string; nome: string; mesa: string | null; customerId: string | null; loginCustomerId: string | null }
export interface LinhaMesa {
    id: string;
    termo_de_pesquisa: string | null;
    campanha: string | null;
    grupo_de_anuncios: string | null;
    palavra_chave: string | null;
    acao: string | null;
    segmentar: boolean | null;
    negativar: boolean | null;
    teste_ab: boolean | null;
    respondido_cliente: boolean | null;
    data_resposta: string | null;
    observacao: string | null;
}
export interface RegistroEnvio {
    profile_id: string;
    mesa: string;
    linha_id: string;
    customer_id: string;
    tipo: TipoAcao;
    nivel?: Nivel | null;
    correspondencia?: Correspondencia | null;
    lista_negativa?: string | null;
    status: 'ok' | 'ja_existia' | 'erro';
    erro?: string | null;
    resource_name?: string | null;
}
/** A mesa do cliente não tem as colunas de resposta do cliente no formato do Pocket (ex.: mesa_supress). */
export class ErroMesaIncompativel extends Error {
    constructor(mensagem = 'mesa sem colunas de resposta do cliente') {
        super(mensagem);
        this.name = 'ErroMesaIncompativel';
    }
}
const MSG_MESA_INCOMPATIVEL = 'A mesa deste cliente não tem respostas de cliente no formato do Pocket.';

export interface Repositorio {
    /** Empresas do perfil (todas se admin). */
    empresasDoPerfil(perfil: Perfil): Promise<Empresa[]>;
    /** Linhas com respondido_cliente = true. */
    linhasRespondidas(mesa: string): Promise<LinhaMesa[]>;
    linhasPorIds(mesa: string, ids: string[]): Promise<LinhaMesa[]>;
    /** linha_id com envio status ok/ja_existia para mesa + tipo. */
    jaSubidos(mesa: string, tipo: TipoAcao): Promise<Set<string>>;
    registrarEnvios(registros: RegistroEnvio[]): Promise<void>;
}
export interface ConexaoGoogle { modo: 'pocket' | 'proprio'; googleEmail?: string | null }
export interface DepFerramentas {
    perfil: Perfil;
    db: Repositorio;
    ads: (cred: Credenciais) => ClienteAds;
    conexao: () => Promise<ConexaoGoogle | null>;
    credenciais: (cliente: Empresa | null) => Promise<Credenciais | null>;
}

/** Linha de google_ads_conexoes (só as colunas usadas). */
export interface LinhaConexaoGoogle {
    modo: 'pocket' | 'proprio';
    refresh_token_cifrado: string;
    developer_token_cifrado?: string | null;
    client_id?: string | null;
    client_secret_cifrado?: string | null;
    login_customer_id?: string | null;
}
export interface SegredosPocket { developerToken?: string; clientId?: string; clientSecret?: string; chave: string }

/** modo pocket: segredos do Pocket + refresh do usuário; modo proprio: tudo da linha. login: conexão > cliente > nenhum. */
export async function montarCredenciais(
    con: LinhaConexaoGoogle | null, cliente: Empresa | null, s: SegredosPocket,
): Promise<Credenciais | null> {
    if (!con) return null;
    const refreshToken = await decifrar(con.refresh_token_cifrado, s.chave);
    let base: Credenciais;
    if (con.modo === 'proprio') {
        if (!con.client_id || !con.client_secret_cifrado) {
            throw new ErroUsuario(`Conexão própria do Google Ads incompleta; refaça em ${CAMINHO_CONEXAO}.`);
        }
        base = {
            ...(con.developer_token_cifrado ? { developerToken: await decifrar(con.developer_token_cifrado, s.chave) } : {}),
            clientId: con.client_id,
            clientSecret: await decifrar(con.client_secret_cifrado, s.chave),
            refreshToken,
        };
    } else {
        if (!s.clientId || !s.clientSecret) throw new Error('Segredos do Google Ads do Pocket ausentes.');
        base = { ...(s.developerToken ? { developerToken: s.developerToken } : {}), clientId: s.clientId, clientSecret: s.clientSecret, refreshToken };
    }
    const login = con.login_customer_id || cliente?.loginCustomerId;
    return login ? { ...base, loginCustomerId: login } : base;
}

// ---------- validação de argumentos ----------

const TIPOS: TipoAcao[] = ['segmentar', 'negativar', 'teste_ab'];
const NIVEIS: Nivel[] = ['grupo', 'campanha', 'lista', 'conta'];
const CORRESPONDENCIAS: Correspondencia[] = ['exata', 'frase', 'ampla'];
type Modo = 'previa' | 'gravar';

function escolha<T extends string>(v: unknown, opcoes: T[], nome: string, padrao?: T): T {
    if ((v === undefined || v === null) && padrao) return padrao;
    if (typeof v === 'string' && (opcoes as string[]).includes(v)) return v as T;
    throw new ErroUsuario(`${nome} deve ser ${opcoes.map((o) => `"${o}"`).join(', ')}.`);
}

function validarIds(v: unknown): string[] {
    if (!Array.isArray(v) || v.length === 0) throw new ErroUsuario('Informe ids: a lista de ids dos termos (de listar_termos_respondidos).');
    if (v.length > LIMITE) throw new ErroUsuario(`No máximo ${LIMITE} termos por chamada; divida o pedido em partes de até ${LIMITE}.`);
    if (v.some((x) => typeof x !== 'string')) throw new ErroUsuario('ids deve ser uma lista de textos.');
    return [...new Set(v as string[])];
}

const curto = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}…` : s);
const txt = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const listaCurta = (xs: string[]) => xs.slice(0, 5).map((x) => `"${curto(x)}"`).join(', ') + (xs.length > 5 ? ` e mais ${xs.length - 5}` : '');
const ultimoSegmento = (rn: string) => rn.split('/').pop() ?? '';

/** Divide uma mutação em lotes de até 500 operações. */
function emLotesMutacao(m: Mutacao): Mutacao[] {
    return emLotes(m.operations.map((_, i) => i), LIMITE).map((pos) => ({
        servico: m.servico,
        operations: pos.map((i) => m.operations[i]),
        indices: pos.map((i) => m.indices[i]),
    }));
}

// ---------- descrições ----------

const AVISO_GRAVAR = 'Use SEMPRE modo:"previa" primeiro e mostre ao usuário a tabela com o resultado; ' +
    'só chame modo:"gravar" depois da confirmação explícita do usuário no chat ("ok", "pode subir"). ' +
    'Nunca grave sem a prévia e a confirmação do mesmo pedido. No máximo 500 ids por chamada.';
const P_CLIENTE = { type: 'string', description: 'Nome do cliente (como em listar_clientes) ou o id dele.' };
const P_IDS = { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: LIMITE, description: 'ids das linhas, vindos de listar_termos_respondidos.' };
const P_MODO = { type: 'string', enum: ['previa', 'gravar'], description: '"previa" valida sem gravar; "gravar" só após o ok do usuário.' };

export function criarFerramentas(dep: DepFerramentas): Ferramenta[] {
    const { perfil, db } = dep;
    let cacheEmpresas: Promise<Empresa[]> | null = null;

    const acessiveis = (): Promise<Empresa[]> => {
        cacheEmpresas ??= db.empresasDoPerfil(perfil)
            .then((todas) => (perfil.isAdmin ? todas : todas.filter((e) => perfil.empresas.includes(e.id))));
        return cacheEmpresas;
    };

    async function acharCliente(v: unknown): Promise<Empresa> {
        if (typeof v !== 'string' || !v.trim()) throw new ErroUsuario('Informe o cliente (nome ou id).');
        const empresas = await acessiveis();
        const porId = empresas.find((e) => e.id === v.trim());
        if (porId) return porId;
        const chave = normalizarNome(v);
        const achados = empresas.filter((e) => normalizarNome(e.nome) === chave);
        if (achados.length > 1) throw new ErroUsuario('Nome de cliente ambíguo; use o id (veja listar_clientes).');
        if (!achados.length) throw new ErroUsuario(`cliente fora do seu acesso ou não encontrado: "${curto(v)}". Veja listar_clientes.`);
        return achados[0];
    }

    const mesaValida = (e: Empresa): string | null => (e.mesa && MESA_VALIDA.test(e.mesa) ? e.mesa : null);
    function mesaDe(e: Empresa): string {
        const m = mesaValida(e);
        if (!m) throw new ErroUsuario(`O cliente ${e.nome} não tem a mesa de termos configurada; peça a um admin do Pocket.`);
        return m;
    }
    function contaDe(e: Empresa): string {
        if (!e.customerId) {
            throw new ErroUsuario(`O cliente ${e.nome} não tem a conta do Google Ads configurada. ` +
                'Peça a um admin do Pocket para cadastrar o "ID da conta Google Ads" na tela de empresas.');
        }
        return e.customerId.replace(/-/g, '');
    }
    async function adsDo(e: Empresa | null): Promise<ClienteAds> {
        const cred = await dep.credenciais(e);
        if (!cred) throw new ErroUsuario(`Google Ads não conectado. Conecte em ${CAMINHO_CONEXAO}.`);
        return dep.ads(cred);
    }

    /** Termos respondidos de um tipo, sem os que não têm destino e (salvo `incluir`) sem os já subidos. */
    async function termosDoTipo(mesa: string, tipo: TipoAcao, incluir: boolean) {
        let linhas: LinhaMesa[];
        let subidos: Set<string>;
        try {
            [linhas, subidos] = await Promise.all([db.linhasRespondidas(mesa), db.jaSubidos(mesa, tipo)]);
        } catch (e) {
            if (e instanceof ErroMesaIncompativel) throw new ErroUsuario(MSG_MESA_INCOMPATIVEL);
            throw e;
        }
        let omitidos = 0;
        let ocultos = 0;
        const visiveis: { linha: LinhaMesa; jaSubido: boolean }[] = [];
        for (const l of linhas) {
            if (l.respondido_cliente !== true || acaoDoTermo(l) !== tipo) continue;
            const semCampanha = semDestino(txt(l.campanha).trim());
            const semGrupo = tipo !== 'negativar' && semDestino(txt(l.grupo_de_anuncios).trim());
            if (semCampanha || semGrupo) { omitidos++; continue; }
            const jaSubido = subidos.has(l.id);
            if (jaSubido && !incluir) { ocultos++; continue; }
            visiveis.push({ linha: l, jaSubido });
        }
        return { visiveis, omitidos, ocultos };
    }

    /** Valida que todos os ids são da mesa, respondidos e do tipo; devolve as linhas na ordem dos ids. */
    async function linhasDoPedido(mesa: string, ids: string[], tipo: TipoAcao): Promise<LinhaMesa[]> {
        const invalidos = ids.filter((id) => !UUID.test(id));
        if (invalidos.length) throw new ErroUsuario(`termo não pertence a este cliente: ${listaCurta(invalidos)}.`);
        let encontradas: LinhaMesa[];
        try {
            encontradas = await db.linhasPorIds(mesa, ids);
        } catch (e) {
            if (e instanceof ErroMesaIncompativel) throw new ErroUsuario(MSG_MESA_INCOMPATIVEL);
            throw e;
        }
        const porId = new Map(encontradas.map((l) => [l.id, l]));
        const faltam = ids.filter((id) => !porId.has(id));
        if (faltam.length) throw new ErroUsuario(`termo não pertence a este cliente: ${listaCurta(faltam)}.`);
        const linhas = ids.map((id) => porId.get(id)!);
        const naoRespondidas = linhas.filter((l) => l.respondido_cliente !== true);
        if (naoRespondidas.length) {
            throw new ErroUsuario(`Termo ainda não respondido pelo cliente: ${listaCurta(naoRespondidas.map((l) => txt(l.termo_de_pesquisa)))}.`);
        }
        const outroTipo = linhas.filter((l) => acaoDoTermo(l) !== tipo);
        if (outroTipo.length) {
            throw new ErroUsuario(`Termo respondido com outra ação (não é ${tipo}): ${listaCurta(outroTipo.map((l) => txt(l.termo_de_pesquisa)))}.`);
        }
        return linhas;
    }

    // ---------- listas compartilhadas ----------

    interface ListaAlvo { id?: string; nome: string; vincularConta?: boolean }

    async function listasNegativas(ads: ClienteAds, conta: string, tipo: 'NEGATIVE_KEYWORDS' | 'ACCOUNT_LEVEL_NEGATIVE_KEYWORDS') {
        const rs = await ads.pesquisar(conta,
            'SELECT shared_set.id, shared_set.name, shared_set.member_count, shared_set.type FROM shared_set ' +
            `WHERE shared_set.type = ${tipo} AND shared_set.status != 'REMOVED'`);
        return rs.map((r) => {
            const s = (r as { sharedSet?: { id?: unknown; name?: unknown; memberCount?: unknown } }).sharedSet;
            return { id: txt(s?.id), nome: txt(s?.name), termos: Number(s?.memberCount ?? 0) };
        });
    }

    async function acharListaConta(ads: ClienteAds, conta: string): Promise<ListaAlvo> {
        const [lista] = await listasNegativas(ads, conta, 'ACCOUNT_LEVEL_NEGATIVE_KEYWORDS');
        if (!lista) return { nome: NOME_LISTA_CONTA };
        const vinculos = await ads.pesquisar(conta,
            'SELECT customer_negative_criterion.negative_keyword_list.shared_set FROM customer_negative_criterion');
        const vinculada = vinculos.some((r) => {
            const c = (r as { customerNegativeCriterion?: { negativeKeywordList?: { sharedSet?: unknown } } }).customerNegativeCriterion;
            return ultimoSegmento(txt(c?.negativeKeywordList?.sharedSet)) === lista.id;
        });
        return { id: lista.id, nome: lista.nome, vincularConta: !vinculada };
    }

    async function acharLista(ads: ClienteAds, conta: string, pedido: unknown): Promise<ListaAlvo> {
        const p = (typeof pedido === 'object' && pedido !== null ? pedido : {}) as { id?: unknown; nome?: unknown; criar?: unknown };
        const id = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : undefined;
        const nome = typeof p.nome === 'string' && p.nome.trim() ? p.nome.trim() : undefined;
        if (!id && !nome) throw new ErroUsuario('Para o nível lista, informe lista.id ou lista.nome (veja listar_listas_negativas).');
        if (id && !/^\d+$/.test(id)) throw new ErroUsuario('lista.id inválido: use o id numérico de listar_listas_negativas.');
        const listas = await listasNegativas(ads, conta, 'NEGATIVE_KEYWORDS');
        if (id) {
            const achada = listas.find((l) => l.id === id);
            if (!achada) throw new ErroUsuario(`lista não encontrada: id ${id}.`);
            return { id: achada.id, nome: achada.nome };
        }
        const achadas = listas.filter((l) => normalizarNome(l.nome) === normalizarNome(nome));
        if (achadas.length > 1) throw new ErroUsuario(`Nome de lista ambíguo: "${curto(nome!)}"; use lista.id.`);
        if (achadas.length === 1) return { id: achadas[0].id, nome: achadas[0].nome };
        if (p.criar !== true) throw new ErroUsuario(`lista não encontrada: "${curto(nome!)}". Use lista.criar = true para criar.`);
        return { nome: nome! };
    }

    async function criarUm(ads: ClienteAds, conta: string, servico: Mutacao['servico'], create: unknown): Promise<string> {
        const m: Mutacao = { servico, operations: [{ create }], indices: [0] };
        const [r] = lerResultado(m, await ads.mutar(conta, m, false));
        if (!r?.ok || !r.resourceName) throw new ErroUsuario(r?.erro ? `Google Ads: ${r.erro}` : 'O Google Ads não devolveu o recurso criado.');
        return r.resourceName;
    }

    // ---------- envio ----------

    async function subir(tipo: TipoAcao, args: Record<string, unknown>) {
        const empresa = await acharCliente(args.cliente);
        const ids = validarIds(args.ids);
        const modo = escolha<Modo>(args.modo, ['previa', 'gravar'], 'modo');
        const nivel = tipo === 'negativar' ? escolha(args.nivel, NIVEIS, 'nível') : null;
        const correspondencia = tipo === 'negativar' ? escolha(args.correspondencia, CORRESPONDENCIAS, 'correspondência', 'exata') : null;
        const mesa = mesaDe(empresa);
        const conta = contaDe(empresa);
        const linhas = await linhasDoPedido(mesa, ids, tipo);
        const ads = await adsDo(empresa);
        const avisos: string[] = [];
        const c = `customers/${conta}`;

        let lista: ListaAlvo | undefined;
        if (nivel === 'lista') lista = await acharLista(ads, conta, args.lista);
        else if (nivel === 'conta') lista = await acharListaConta(ads, conta);

        let alvo: Alvo = tipo === 'negativar'
            ? { tipo, nivel: nivel!, correspondencia: correspondencia!, ...(lista ? { listaId: lista.id ?? PROVISORIA } : {}) }
            : { tipo };
        const negativas = tipo === 'negativar';
        const termos: LinhaTermo[] = linhas.map((l) => ({
            id: l.id, termo: txt(l.termo_de_pesquisa), campanha: txt(l.campanha).trim(), grupo: txt(l.grupo_de_anuncios).trim(),
        }));

        // 1ª passada: campanhas/grupos para descobrir os destinos; 2ª: com as palavras existentes desses destinos.
        let itens = resolverItens(termos, await carregarCatalogo(ads, conta, [], { negativas }), alvo);
        const escopos = new Set<string>();
        for (const it of itens) {
            if (it.situacao === 'erro') continue;
            if (nivel === 'lista' && lista?.id) escopos.add(`l:${lista.id}`);
            else if (nivel === 'conta' && lista?.id) escopos.add('conta');
            else if (nivel === 'campanha') escopos.add(`c:${it.destino!.campanhaId}`);
            else if (nivel === null || nivel === 'grupo') escopos.add(`g:${it.destino!.grupoId}`);
        }
        if (escopos.size) {
            const cat = await carregarCatalogo(ads, conta, [...escopos], { negativas, contaListaId: nivel === 'conta' ? lista?.id : undefined });
            itens = resolverItens(termos, cat, alvo);
        }
        const temOk = itens.some((i) => i.situacao === 'ok');

        if (modo === 'previa') {
            if (nivel === 'lista' && !lista!.id) avisos.push(`a lista "${lista!.nome}" será criada e vinculada às campanhas dos termos`);
            if (nivel === 'conta' && !lista!.id) avisos.push(`a lista de negativas da conta ("${lista!.nome}") será criada e vinculada à conta ao gravar`);
            if (nivel === 'conta' && lista!.vincularConta) avisos.push(`a lista de negativas da conta ("${lista!.nome}") será vinculada à conta ao gravar`);
        } else if (temOk && lista) {
            if (!lista.id) {
                const tipoSet = nivel === 'conta' ? 'ACCOUNT_LEVEL_NEGATIVE_KEYWORDS' : 'NEGATIVE_KEYWORDS';
                lista.id = ultimoSegmento(await criarUm(ads, conta, 'sharedSets', { name: lista.nome, type: tipoSet }));
                if (nivel === 'conta') lista.vincularConta = true;
                else avisos.push(...await vincularCampanhas(ads, conta, lista, itens));
            }
            if (lista.vincularConta) {
                await criarUm(ads, conta, 'customerNegativeCriteria', { negativeKeywordList: { sharedSet: `${c}/sharedSets/${lista.id}` } });
            }
            alvo = { ...(alvo as Extract<Alvo, { tipo: 'negativar' }>), listaId: lista.id };
        }

        // Prévia de lista ainda inexistente: não há o que validar na API (ver aviso).
        const recursos = new Map<number, string>();
        const validavel = !lista || Boolean(lista.id);
        if (temOk && validavel) {
            for (const m of montarMutacoes(conta, itens, alvo)) {
                for (const lote of emLotesMutacao(m)) {
                    let res: ResultadoItem[];
                    try {
                        const validateOnly = modo === 'previa';
                        res = lerResultado(lote, await ads.mutar(conta, lote, validateOnly), { validateOnly });
                    } catch (e) {
                        if (e instanceof ErroConexaoGoogle || !(e instanceof ErroUsuario)) throw e;
                        res = lote.indices.map((indice) => ({ indice, ok: false, erro: e.message }));
                    }
                    for (const r of res) {
                        if (!r.ok) { itens[r.indice].situacao = 'erro'; itens[r.indice].erro = r.erro ?? 'erro no Google Ads'; }
                        else if (r.resourceName) recursos.set(r.indice, r.resourceName);
                    }
                }
            }
        }

        if (modo === 'gravar') {
            const registros: RegistroEnvio[] = itens.flatMap((it, i) => it.idsLinhas.map((linha_id) => ({
                profile_id: perfil.id,
                mesa,
                linha_id,
                customer_id: conta,
                tipo,
                nivel,
                correspondencia: correspondencia ?? 'exata',
                lista_negativa: lista?.nome ?? null,
                status: it.situacao === 'ok' ? 'ok' as const : it.situacao === 'ja_existe' ? 'ja_existia' as const : 'erro' as const,
                erro: it.erro ?? null,
                resource_name: recursos.get(i) ?? null,
            })));
            await db.registrarEnvios(registros);
        }

        const porId = new Map(linhas.map((l) => [l.id, l]));
        const mostraGrupo = nivel === null || nivel === 'grupo';
        const resumo = { ok: 0, ja_existe: 0, erro: 0 };
        const saida = itens.map((it) => {
            resumo[it.situacao]++;
            const l = porId.get(it.idsLinhas[0])!;
            return {
                termo: it.texto,
                ids: it.idsLinhas,
                campanha: txt(l.campanha),
                ...(mostraGrupo ? { grupo: txt(l.grupo_de_anuncios) } : {}),
                situacao: it.situacao,
                ...(it.erro ? { erro: it.erro } : {}),
                ...(it.destino ? { destino: it.destino } : {}),
            };
        });
        return {
            modo,
            cliente: empresa.nome,
            conta,
            tipo,
            ...(nivel ? { nivel, correspondencia } : {}),
            ...(lista ? { lista: { id: lista.id ?? null, nome: lista.nome } } : {}),
            resumo,
            itens: saida,
            ...(avisos.length ? { avisos } : {}),
        };
    }

    /** Vincula a lista recém-criada às campanhas dos itens ok; falhas viram avisos. */
    async function vincularCampanhas(ads: ClienteAds, conta: string, lista: ListaAlvo, itens: ItemResolvido[]): Promise<string[]> {
        const c = `customers/${conta}`;
        const campanhas = [...new Set(itens.filter((i) => i.situacao === 'ok' && i.destino).map((i) => i.destino!.campanhaId))];
        if (!campanhas.length) return [`a lista "${lista.nome}" foi criada sem vínculo: nenhuma campanha dos termos foi encontrada`];
        const m: Mutacao = {
            servico: 'campaignSharedSets',
            operations: campanhas.map((id) => ({ create: { campaign: `${c}/campaigns/${id}`, sharedSet: `${c}/sharedSets/${lista.id}` } })),
            indices: campanhas.map((_, i) => i),
        };
        let res: ResultadoItem[];
        try {
            res = lerResultado(m, await ads.mutar(conta, m, false));
        } catch (e) {
            if (e instanceof ErroConexaoGoogle || !(e instanceof ErroUsuario)) throw e;
            return [`a lista "${lista.nome}" foi criada, mas não foi vinculada às campanhas: ${e.message}`];
        }
        return res.filter((r) => !r.ok)
            .map((r) => `não foi possível vincular a lista "${lista.nome}" à campanha ${campanhas[r.indice]}: ${r.erro}`);
    }

    // ---------- ferramentas ----------

    return [
        {
            name: 'status_conexao',
            description: 'Mostra quem é o usuário do Pocket, se o Google Ads está conectado (modo, e-mail) e quais clientes têm conta do Google Ads configurada. Rode primeiro; se faltar algo, explique o passo ao usuário e pare.',
            inputSchema: { type: 'object', properties: {}, required: [] },
            async executar() {
                const usuario = {
                    ...(perfil.nome ? { nome: perfil.nome } : {}),
                    ...(perfil.email ? { email: perfil.email } : {}),
                    admin: perfil.isAdmin,
                };
                const clientes = (await acessiveis()).map((e) => ({ nome: e.nome, conta: e.customerId ?? null }));
                const con = await dep.conexao();
                if (!con) return { usuario, google_ads: 'nao_conectado', como_conectar: CAMINHO_CONEXAO, clientes };
                const base = { usuario, modo: con.modo, ...(con.googleEmail ? { google_email: con.googleEmail } : {}) };
                try {
                    const cred = await dep.credenciais(null);
                    if (!cred) return { ...base, google_ads: 'nao_conectado', como_conectar: CAMINHO_CONEXAO, clientes };
                    await dep.ads(cred).contasAcessiveis();
                    return { ...base, google_ads: 'conectado', clientes };
                } catch (e) {
                    const detalhe = e instanceof ErroUsuario ? e.message : 'falha ao testar a conexão com o Google Ads';
                    return { ...base, google_ads: 'reconectar', detalhe, como_conectar: CAMINHO_CONEXAO, clientes };
                }
            },
        },
        {
            name: 'listar_clientes',
            description: 'Lista os clientes do usuário: nome, id, mesa, conta do Google Ads (ou "não configurado") e quantos termos respondidos pelo cliente ainda não foram subidos, por tipo.',
            inputSchema: { type: 'object', properties: {}, required: [] },
            async executar() {
                const empresas = await acessiveis();
                const clientes = await Promise.all(empresas.map(async (e) => {
                    const mesa = mesaValida(e);
                    const base = { id: e.id, nome: e.nome, mesa, conta: e.customerId ?? 'não configurado' };
                    if (!mesa) return { ...base, pendentes: null };
                    try {
                        const [s, n, t] = await Promise.all(TIPOS.map((tipo) => termosDoTipo(mesa, tipo, false)));
                        return { ...base, pendentes: { segmentar: s.visiveis.length, negativar: n.visiveis.length, teste_ab: t.visiveis.length } };
                    } catch (err) {
                        if (err instanceof ErroUsuario && err.message === MSG_MESA_INCOMPATIVEL) {
                            return { ...base, pendentes: null, observacao: 'Mesa sem respostas de cliente no formato do Pocket.' };
                        }
                        console.error(`listar_clientes: falha ao contar termos de ${e.id}:`, err instanceof Error ? err.message : err);
                        return { ...base, pendentes: null };
                    }
                }));
                return { clientes };
            },
        },
        {
            name: 'listar_termos_respondidos',
            description: 'Termos que o cliente já respondeu com a ação pedida (tipo). Devolve id, termo, palavra-chave, campanha, grupo, data da resposta e observação. Omite (e conta em "omitidos") os sem campanha ou, para segmentar/teste_ab, sem grupo. Esconde os já subidos, salvo incluir_ja_subidos. Mostre ao usuário em tabela e use os ids nas ferramentas subir_*.',
            inputSchema: {
                type: 'object',
                properties: {
                    cliente: P_CLIENTE,
                    tipo: { type: 'string', enum: TIPOS },
                    incluir_ja_subidos: { type: 'boolean', default: false },
                },
                required: ['cliente', 'tipo'],
            },
            async executar(args) {
                const empresa = await acharCliente(args.cliente);
                const tipo = escolha(args.tipo, TIPOS, 'tipo');
                const incluir = args.incluir_ja_subidos === true;
                const { visiveis, omitidos, ocultos } = await termosDoTipo(mesaDe(empresa), tipo, incluir);
                return {
                    cliente: empresa.nome,
                    tipo,
                    total: visiveis.length,
                    omitidos,
                    ja_subidos_ocultos: ocultos,
                    termos: visiveis.map(({ linha: l, jaSubido }) => ({
                        id: l.id,
                        termo: txt(l.termo_de_pesquisa),
                        palavra_chave: txt(l.palavra_chave),
                        campanha: txt(l.campanha),
                        grupo: txt(l.grupo_de_anuncios),
                        data_resposta: l.data_resposta ?? null,
                        observacao: l.observacao ?? null,
                        ...(incluir ? { ja_subido: jaSubido } : {}),
                    })),
                };
            },
        },
        {
            name: 'listar_listas_negativas',
            description: 'Listas de palavras-chave negativas compartilhadas da conta do Google Ads do cliente (nome, id, nº de termos). Use antes de subir_negativas com nível "lista".',
            inputSchema: { type: 'object', properties: { cliente: P_CLIENTE }, required: ['cliente'] },
            async executar(args) {
                const empresa = await acharCliente(args.cliente);
                const conta = contaDe(empresa);
                const ads = await adsDo(empresa);
                return { cliente: empresa.nome, conta, listas: await listasNegativas(ads, conta, 'NEGATIVE_KEYWORDS') };
            },
        },
        {
            name: 'subir_segmentadas',
            description: `Adiciona os termos como palavra-chave EXATA e ATIVA no grupo de anúncios de origem, na conta do Google Ads do cliente. ${AVISO_GRAVAR}`,
            inputSchema: { type: 'object', properties: { cliente: P_CLIENTE, ids: P_IDS, modo: P_MODO }, required: ['cliente', 'ids', 'modo'] },
            executar: (args) => subir('segmentar', args),
        },
        {
            name: 'subir_teste_ab',
            description: `Adiciona os termos de Teste A/B como palavra-chave EXATA e PAUSADA no grupo de anúncios de origem. Avise o usuário que entram pausadas. ${AVISO_GRAVAR}`,
            inputSchema: { type: 'object', properties: { cliente: P_CLIENTE, ids: P_IDS, modo: P_MODO }, required: ['cliente', 'ids', 'modo'] },
            executar: (args) => subir('teste_ab', args),
        },
        {
            name: 'subir_negativas',
            description: 'Negativa os termos no nível escolhido: "grupo" (grupo de origem), "campanha", "lista" (lista compartilhada existente por id/nome, ou nova com lista.criar = true, vinculada às campanhas dos termos) ou "conta" (lista de negativas da conta). Pergunte ao usuário o nível e a correspondência (exata é o padrão). ' + AVISO_GRAVAR,
            inputSchema: {
                type: 'object',
                properties: {
                    cliente: P_CLIENTE,
                    ids: P_IDS,
                    nivel: { type: 'string', enum: NIVEIS },
                    correspondencia: { type: 'string', enum: CORRESPONDENCIAS, default: 'exata' },
                    lista: {
                        type: 'object',
                        description: 'Só para nível "lista": id ou nome de uma lista de listar_listas_negativas; criar = true cria a lista se o nome não existir.',
                        properties: { id: { type: 'string' }, nome: { type: 'string' }, criar: { type: 'boolean' } },
                    },
                    modo: P_MODO,
                },
                required: ['cliente', 'ids', 'nivel', 'modo'],
            },
            executar: (args) => subir('negativar', args),
        },
    ];
}
