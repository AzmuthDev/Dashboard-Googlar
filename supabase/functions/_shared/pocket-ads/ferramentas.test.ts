/* eslint-disable @typescript-eslint/no-explicit-any -- respostas JSON das ferramentas e operações da API lidas nos asserts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarFerramentas, montarCredenciais } from './ferramentas.ts';
import type { Empresa, LinhaMesa, Perfil, RegistroEnvio, Repositorio, ConexaoGoogle } from './ferramentas.ts';
import { ErroUsuario } from './mcp.ts';
import type { Ferramenta } from './mcp.ts';
import { ErroConexaoGoogle } from './googleAds.ts';
import type { ClienteAds, Credenciais } from './googleAds.ts';
import type { Mutacao } from './operacoes.ts';
import { cifrar } from './cifra.ts';

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CONTA = '1234567890';

const EMPRESAS: Empresa[] = [
    { id: 'c1', nome: 'Magic Hands', mesa: 'mesa_magic_hands', customerId: CONTA, loginCustomerId: null },
    { id: 'c2', nome: 'Endomarcas', mesa: 'mesa_endomarcas', customerId: null, loginCustomerId: null },
    { id: 'c3', nome: 'Qualipix', mesa: 'mesa_qualipix', customerId: '1112223333', loginCustomerId: null },
    { id: 'c4', nome: 'Estremoz', mesa: 'mesa; drop table x', customerId: '2223334444', loginCustomerId: null },
];

const linha = (n: number, termo: string, campanha: string, grupo: string, acao: string | null, extra: Partial<LinhaMesa> = {}): LinhaMesa => ({
    id: u(n), termo_de_pesquisa: termo, campanha, grupo_de_anuncios: grupo, palavra_chave: 'luva', acao,
    segmentar: null, negativar: null, teste_ab: null, respondido_cliente: true,
    data_resposta: '2026-11-01', observacao: null, ...extra,
});

const MESAS: Record<string, LinhaMesa[]> = {
    mesa_magic_hands: [
        linha(1, 'luva nitrilica', 'Search Luvas', 'Luvas', 'segmentar'),
        linha(2, 'Luva  Nitrílica', 'Search Luvas', 'Luvas', 'manter'),
        linha(3, 'luva barata', 'Search Luvas', 'Luvas', 'negativar'),
        linha(4, 'luva teste', 'Search Luvas', 'Luvas', 'teste_ab'),
        linha(5, 'sem campanha', 'n/a', 'Luvas', 'segmentar'),
        linha(6, 'grupo vazio', 'Search Luvas', '', 'segmentar'),
        linha(7, 'nao respondido', 'Search Luvas', 'Luvas', 'segmentar', { respondido_cliente: false }),
        linha(8, 'grupo inexistente', 'Search Luvas', 'Fantasma', 'segmentar'),
        linha(9, 'luva existente', 'Search Luvas', 'Luvas', 'segmentar'),
        linha(10, 'luva pmax neg', 'PMax Luvas', '', 'negativar'),
        linha(11, 'luva existente', 'Search Luvas', 'Luvas', 'negativar'),
        linha(12, 'luva flag', 'Search Luvas', 'Luvas', null, { negativar: true }),
    ],
    mesa_qualipix: [linha(101, 'camera', 'Search', 'Cameras', 'segmentar')],
};

function repoFalso(opts: { enviados?: RegistroEnvio[] } = {}) {
    const registrados: RegistroEnvio[] = [];
    const chamadas: string[] = [];
    const enviados = opts.enviados ?? [];
    const repo: Repositorio = {
        async empresasDoPerfil() { chamadas.push('empresas'); return EMPRESAS; },
        async linhasRespondidas(mesa) {
            chamadas.push(`respondidas:${mesa}`);
            return (MESAS[mesa] ?? []).filter((l) => l.respondido_cliente);
        },
        async linhasPorIds(mesa, ids) {
            chamadas.push(`porIds:${mesa}`);
            return (MESAS[mesa] ?? []).filter((l) => ids.includes(l.id));
        },
        async jaSubidos(mesa, tipo) {
            return new Set(enviados.filter((e) => e.mesa === mesa && e.tipo === tipo && e.status !== 'erro').map((e) => e.linha_id));
        },
        async registrarEnvios(rs) { registrados.push(...rs); },
    };
    return { repo, registrados, chamadas };
}

interface ChamadaMutar { customerId: string; m: Mutacao; validateOnly: boolean }
interface OpcoesAds {
    contaLista?: boolean;
    contaVinculada?: boolean;
    mutar?: (c: ChamadaMutar) => unknown;
    contas?: () => Promise<string[]>;
}

function adsFalso(o: OpcoesAds = {}) {
    const mutacoes: ChamadaMutar[] = [];
    const consultas: string[] = [];
    const sets = [
        { id: '31', name: 'Negativas Gerais', type: 'NEGATIVE_KEYWORDS', memberCount: 2 },
        { id: '32', name: 'Concorrentes', type: 'NEGATIVE_KEYWORDS', memberCount: 0 },
        ...(o.contaLista ? [{ id: '41', name: 'Conta', type: 'ACCOUNT_LEVEL_NEGATIVE_KEYWORDS', memberCount: 1 }] : []),
    ];
    const kw = (text: string, matchType: string) => ({ keyword: { text, matchType } });
    const ads: ClienteAds = {
        async pesquisar(_c: string, gaql: string) {
            consultas.push(gaql);
            const de = /FROM (\w+)/.exec(gaql)?.[1];
            if (de === 'campaign') return [
                { campaign: { id: '11', name: 'Search Luvas', advertisingChannelType: 'SEARCH' } },
                { campaign: { id: '12', name: 'PMax Luvas', advertisingChannelType: 'PERFORMANCE_MAX' } },
            ];
            if (de === 'ad_group') return [{ adGroup: { id: '21', name: 'Luvas' }, campaign: { id: '11' } }];
            if (de === 'ad_group_criterion') {
                return gaql.includes('negative = true')
                    ? [{ adGroup: { id: '21' }, adGroupCriterion: kw('luva existente', 'EXACT') }]
                    : [{ adGroup: { id: '21' }, adGroupCriterion: kw('luva existente', 'EXACT') },
                        { adGroup: { id: '21' }, adGroupCriterion: kw('luva barata', 'EXACT') }];
            }
            if (de === 'campaign_criterion') return [{ campaign: { id: '11' }, campaignCriterion: kw('luva barata', 'PHRASE') }];
            if (de === 'shared_criterion') {
                const rows = [{ sharedSet: { id: '41' }, sharedCriterion: kw('luva barata', 'EXACT') },
                    { sharedSet: { id: '31' }, sharedCriterion: kw('luva existente', 'EXACT') }];
                return rows.filter((r) => new RegExp(`\\b${r.sharedSet.id}\\b`).test(gaql.split('IN')[1] ?? ''));
            }
            if (de === 'shared_set') {
                return sets.filter((s) => gaql.includes(`= ${s.type}`) || gaql.includes(`= '${s.type}'`))
                    .map((s) => ({ sharedSet: s }));
            }
            if (de === 'customer_negative_criterion') {
                return o.contaLista && o.contaVinculada !== false
                    ? [{ customerNegativeCriterion: { negativeKeywordList: { sharedSet: `customers/${CONTA}/sharedSets/41` } } }]
                    : [];
            }
            throw new Error('consulta inesperada ' + gaql);
        },
        async mutar(customerId: string, m: Mutacao, validateOnly: boolean) {
            const c = { customerId, m, validateOnly };
            mutacoes.push(c);
            if (o.mutar) {
                const r = o.mutar(c);
                if (r !== undefined) return r;
            }
            if (validateOnly) return {};
            const base = m.servico === 'sharedSets' ? 900 : 0;
            return { results: m.operations.map((_, i) => ({ resourceName: `customers/${customerId}/${m.servico}/${base + i}` })) };
        },
        async contasAcessiveis() { return o.contas ? o.contas() : [CONTA]; },
    };
    return { ads, mutacoes, consultas };
}

const CRED: Credenciais = { developerToken: 'd', clientId: 'i', clientSecret: 's', refreshToken: 'r' };

function montar(o: {
    perfil?: Partial<Perfil>;
    ads?: OpcoesAds;
    enviados?: RegistroEnvio[];
    semCred?: boolean;
    conexao?: ConexaoGoogle | null;
} = {}) {
    const r = repoFalso({ enviados: o.enviados });
    const a = adsFalso(o.ads);
    const credPedidas: (Empresa | null)[] = [];
    const lista = criarFerramentas({
        perfil: { id: 'p1', isAdmin: false, empresas: ['c1', 'c2', 'c4'], nome: 'Ana', email: 'ana@x.com', ...o.perfil },
        db: r.repo,
        ads: () => a.ads,
        conexao: async () => (o.semCred ? null : o.conexao === undefined ? { modo: 'pocket', googleEmail: 'ana@gmail.com' } : o.conexao),
        credenciais: async (cliente) => { credPedidas.push(cliente); return o.semCred ? null : CRED; },
    });
    const t = Object.fromEntries(lista.map((f) => [f.name, f])) as Record<string, Ferramenta>;
    const run = (nome: string, args: Record<string, unknown>) => t[nome].executar(args) as Promise<any>;
    return { lista, t, run, ...r, ...a, credPedidas };
}

const erroUsuario = (re: RegExp) => (e: unknown) => {
    assert.ok(e instanceof ErroUsuario, `esperado ErroUsuario, veio ${e}`);
    assert.match((e as Error).message, re);
    return true;
};

// ---------- catálogo das ferramentas ----------

test('sete ferramentas com schemas JSON e descrição exigindo prévia e ok', () => {
    const { lista } = montar();
    assert.deepEqual(lista.map((f) => f.name).sort(), [
        'listar_clientes', 'listar_listas_negativas', 'listar_termos_respondidos', 'status_conexao',
        'subir_negativas', 'subir_segmentadas', 'subir_teste_ab',
    ]);
    for (const f of lista) {
        const s = f.inputSchema as any;
        assert.equal(s.type, 'object');
        assert.ok(Array.isArray(s.required), f.name);
        if (f.name.startsWith('subir_')) {
            assert.match(f.description, /previa/);
            assert.match(f.description, /gravar/);
            assert.match(f.description, /confirma/i);
            assert.deepEqual(s.required.sort(), (f.name === 'subir_negativas' ? ['cliente', 'ids', 'modo', 'nivel'] : ['cliente', 'ids', 'modo']).sort());
            assert.deepEqual(s.properties.modo.enum, ['previa', 'gravar']);
            assert.equal(s.properties.ids.type, 'array');
            assert.equal(s.properties.ids.items.type, 'string');
            assert.equal(s.properties.ids.maxItems, 500);
        }
    }
    const neg = lista.find((f) => f.name === 'subir_negativas')!.inputSchema as any;
    assert.deepEqual(neg.properties.nivel.enum, ['grupo', 'campanha', 'lista', 'conta']);
    assert.deepEqual(neg.properties.correspondencia.enum, ['exata', 'frase', 'ampla']);
    const lt = lista.find((f) => f.name === 'listar_termos_respondidos')!.inputSchema as any;
    assert.deepEqual(lt.properties.tipo.enum, ['segmentar', 'negativar', 'teste_ab']);
});

// ---------- acesso ----------

test('perfil sem a empresa → "cliente fora do seu acesso" (nome e id)', async () => {
    const m = montar();
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Qualipix', ids: [u(101)], modo: 'previa' }),
        erroUsuario(/cliente fora do seu acesso/));
    await assert.rejects(m.run('listar_termos_respondidos', { cliente: 'c3', tipo: 'segmentar' }),
        erroUsuario(/cliente fora do seu acesso/));
    assert.equal(m.mutacoes.length, 0);
});

test('admin acessa qualquer empresa; cliente aceita nome normalizado ou id', async () => {
    const m = montar({ perfil: { isAdmin: true, empresas: [] } });
    const r = await m.run('listar_termos_respondidos', { cliente: '  QUALIPIX ', tipo: 'segmentar' });
    assert.equal(r.total, 1);
    const r2 = await m.run('listar_termos_respondidos', { cliente: 'c3', tipo: 'segmentar' });
    assert.equal(r2.total, 1);
});

test('mesa com nome fora do padrão mesa_* → ErroUsuario, sem consultar a tabela', async () => {
    const m = montar();
    await assert.rejects(m.run('listar_termos_respondidos', { cliente: 'Estremoz', tipo: 'segmentar' }), erroUsuario(/mesa/));
    assert.ok(!m.chamadas.some((c) => c.includes('drop')));
});

// ---------- listar ----------

test('listar_clientes: só os do perfil, conta ou "não configurado", pendentes por tipo', async () => {
    const m = montar({ enviados: [{ profile_id: 'p1', mesa: 'mesa_magic_hands', linha_id: u(1), customer_id: CONTA, tipo: 'segmentar', status: 'ok' }] });
    const r = await m.run('listar_clientes', {});
    assert.deepEqual(r.clientes.map((c: any) => c.nome), ['Magic Hands', 'Endomarcas', 'Estremoz']);
    const mh = r.clientes[0];
    assert.equal(mh.conta, CONTA);
    assert.equal(mh.mesa, 'mesa_magic_hands');
    // segmentar respondidas com destino: 1,2,8,9 → menos o 1 já subido = 3
    assert.deepEqual(mh.pendentes, { segmentar: 3, negativar: 4, teste_ab: 1 });
    assert.equal(r.clientes[1].conta, 'não configurado');
    assert.equal(r.clientes[2].pendentes, null);
});

test('listar_termos_respondidos: filtra tipo, omite sem destino, esconde já subidos', async () => {
    const enviados: RegistroEnvio[] = [
        { profile_id: 'p1', mesa: 'mesa_magic_hands', linha_id: u(1), customer_id: CONTA, tipo: 'segmentar', status: 'ok' },
        { profile_id: 'p1', mesa: 'mesa_magic_hands', linha_id: u(9), customer_id: CONTA, tipo: 'segmentar', status: 'ja_existia' },
        { profile_id: 'p1', mesa: 'mesa_magic_hands', linha_id: u(8), customer_id: CONTA, tipo: 'segmentar', status: 'erro' },
        { profile_id: 'p1', mesa: 'mesa_magic_hands', linha_id: u(2), customer_id: CONTA, tipo: 'negativar', status: 'ok' },
    ];
    const m = montar({ enviados });
    const r = await m.run('listar_termos_respondidos', { cliente: 'Magic Hands', tipo: 'segmentar' });
    assert.deepEqual(r.termos.map((t: any) => t.id), [u(2), u(8)]);
    assert.equal(r.total, 2);
    assert.equal(r.omitidos, 2); // 5 (sem campanha) e 6 (sem grupo)
    assert.equal(r.ja_subidos_ocultos, 2);
    const t2 = r.termos[0];
    assert.deepEqual(Object.keys(t2).sort(), ['campanha', 'data_resposta', 'grupo', 'id', 'observacao', 'palavra_chave', 'termo'].sort());
    assert.equal(t2.termo, 'Luva  Nitrílica');

    const todos = await m.run('listar_termos_respondidos', { cliente: 'Magic Hands', tipo: 'segmentar', incluir_ja_subidos: true });
    assert.deepEqual(todos.termos.map((t: any) => t.id), [u(1), u(2), u(8), u(9)]);
    assert.equal(todos.termos[0].ja_subido, true);
    assert.equal(todos.total, 4);

    const neg = await m.run('listar_termos_respondidos', { cliente: 'Magic Hands', tipo: 'negativar' });
    assert.deepEqual(neg.termos.map((t: any) => t.id), [u(3), u(10), u(11), u(12)]); // grupo vazio ok para negativa
    assert.equal(neg.omitidos, 0);
});

test('listar_termos_respondidos: tipo inválido → ErroUsuario', async () => {
    const m = montar();
    await assert.rejects(m.run('listar_termos_respondidos', { cliente: 'Magic Hands', tipo: 'duvida' }), erroUsuario(/tipo/));
});

test('listar_listas_negativas: listas NEGATIVE_KEYWORDS da conta', async () => {
    const m = montar();
    const r = await m.run('listar_listas_negativas', { cliente: 'Magic Hands' });
    assert.equal(r.conta, CONTA);
    assert.deepEqual(r.listas, [{ id: '31', nome: 'Negativas Gerais', termos: 2 }, { id: '32', nome: 'Concorrentes', termos: 0 }]);
    assert.ok(m.consultas.some((q) => /shared_set\.status != 'REMOVED'/.test(q)));
});

// ---------- pré-condições dos envios ----------

test('ids de outra mesa ou inexistentes → "termo não pertence a este cliente" e mutar não é chamado', async () => {
    const m = montar();
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1), u(101)], modo: 'previa' }),
        erroUsuario(/termo não pertence a este cliente/));
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(999)], modo: 'gravar' }),
        erroUsuario(/termo não pertence a este cliente/));
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: ['nao-e-uuid'], modo: 'gravar' }),
        erroUsuario(/termo não pertence a este cliente/));
    assert.equal(m.mutacoes.length, 0);
    assert.equal(m.registrados.length, 0);
});

test('ids não respondidos ou de outro tipo → ErroUsuario, sem mutar', async () => {
    const m = montar();
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(7)], modo: 'previa' }), erroUsuario(/respondid/));
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(3)], modo: 'previa' }), erroUsuario(/segmentar/));
    assert.equal(m.mutacoes.length, 0);
});

test('empresa sem google_ads_customer_id → pede ao admin', async () => {
    const m = montar();
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Endomarcas', ids: [u(1)], modo: 'previa' }), erroUsuario(/admin/));
});

test('sem credenciais → caminho "Pocket › Conectar ao Claude › Conectar com Google"', async () => {
    const m = montar({ semCred: true });
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1)], modo: 'previa' }),
        erroUsuario(/Pocket › Conectar ao Claude › Conectar com Google/));
    await assert.rejects(m.run('listar_listas_negativas', { cliente: 'Magic Hands' }),
        erroUsuario(/Pocket › Conectar ao Claude › Conectar com Google/));
});

test('credenciais pedidas com o cliente em mãos (para o login-customer-id)', async () => {
    const m = montar();
    await m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1)], modo: 'previa' });
    assert.equal(m.credPedidas[0]?.id, 'c1');
});

test('501 ids → ErroUsuario pedindo para dividir; ids vazio ou modo inválido também', async () => {
    const m = montar();
    const ids = Array.from({ length: 501 }, (_, i) => u(i + 1000));
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Magic Hands', ids, modo: 'previa' }), erroUsuario(/500.*divid|divid.*500/i));
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [], modo: 'previa' }), erroUsuario(/ids/));
    await assert.rejects(m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1)], modo: 'ja' }), erroUsuario(/modo/));
    assert.equal(m.mutacoes.length, 0);
});

// ---------- prévia e gravação ----------

test('previa: mutar(..., true), nada registrado, situações por termo', async () => {
    const m = montar();
    const r = await m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1), u(2), u(8), u(9)], modo: 'previa' });
    assert.equal(m.mutacoes.length, 1);
    assert.equal(m.mutacoes[0].validateOnly, true);
    assert.equal(m.mutacoes[0].customerId, CONTA);
    assert.equal(m.mutacoes[0].m.servico, 'adGroupCriteria');
    assert.equal(m.mutacoes[0].m.operations.length, 1); // 1 e 2 são o mesmo termo no mesmo grupo
    assert.equal(m.registrados.length, 0);
    assert.equal(r.modo, 'previa');
    assert.equal(r.cliente, 'Magic Hands');
    assert.equal(r.conta, CONTA);
    assert.deepEqual(r.resumo, { ok: 1, ja_existe: 1, erro: 1 });
    const porTermo = Object.fromEntries(r.itens.map((i: any) => [i.termo, i]));
    assert.equal(porTermo['luva nitrilica'].situacao, 'ok');
    assert.deepEqual(porTermo['luva nitrilica'].ids, [u(1), u(2)]);
    assert.equal(porTermo['luva nitrilica'].campanha, 'Search Luvas');
    assert.equal(porTermo['luva nitrilica'].grupo, 'Luvas');
    assert.equal(porTermo['luva existente'].situacao, 'ja_existe');
    assert.equal(porTermo['grupo inexistente'].situacao, 'erro');
    assert.match(porTermo['grupo inexistente'].erro, /grupo não encontrado/);
    // catálogo positivo do grupo de destino
    assert.ok(m.consultas.some((q) => /ad_group_criterion/.test(q) && /negative = false/.test(q) && /IN \(21\)/.test(q)));
});

test('previa: falha parcial na validação vira erro do item', async () => {
    const m = montar({
        ads: {
            mutar: ({ validateOnly }) => validateOnly ? {
                partialFailureError: { message: 'x', details: [{ errors: [{ message: 'Política violada', location: { fieldPathElements: [{ index: 0 }] } }] }] },
            } : undefined,
        },
    });
    const r = await m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1)], modo: 'previa' });
    assert.equal(r.itens[0].situacao, 'erro');
    assert.match(r.itens[0].erro, /Política violada/);
    assert.deepEqual(r.resumo, { ok: 0, ja_existe: 0, erro: 1 });
});

test('previa: com 2 termos, só o que falha na validação vira erro', async () => {
    const m = montar({
        ads: {
            mutar: ({ validateOnly }) => validateOnly ? {
                partialFailureError: { message: 'Multiple errors', details: [{ errors: [{ message: 'Política violada', location: { fieldPathElements: [{ index: 1 }] } }] }] },
            } : undefined,
        },
    });
    const r = await m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3), u(12)], nivel: 'grupo', modo: 'previa' });
    assert.equal(m.mutacoes.length, 1);
    assert.equal(m.mutacoes[0].m.operations.length, 2);
    const por = Object.fromEntries(r.itens.map((i: any) => [i.termo, i]));
    assert.equal(por['luva barata'].situacao, 'ok');
    assert.equal(por['luva barata'].erro, undefined);
    assert.equal(por['luva flag'].situacao, 'erro');
    assert.match(por['luva flag'].erro, /Política violada/);
    assert.deepEqual(r.resumo, { ok: 1, ja_existe: 0, erro: 1 });
});

test('previa: erro da API no lote inteiro marca os itens do lote; ErroConexaoGoogle propaga', async () => {
    const m = montar({ ads: { mutar: () => { throw new ErroUsuario('Google Ads: sem permissão'); } } });
    const r = await m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1)], modo: 'previa' });
    assert.equal(r.itens[0].situacao, 'erro');
    assert.match(r.itens[0].erro, /sem permissão/);
    const m2 = montar({ ads: { mutar: () => { throw new ErroConexaoGoogle(); } } });
    await assert.rejects(m2.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1)], modo: 'previa' }),
        (e) => e instanceof ErroConexaoGoogle);
});

test('gravar: mutar(..., false) e uma linha de envio por id, inclusive erros antes da API', async () => {
    const m = montar({
        ads: {
            mutar: ({ validateOnly, m: mu }) => validateOnly ? undefined : {
                results: mu.operations.map((_, i) => ({ resourceName: `customers/${CONTA}/adGroupCriteria/21~${i}` })),
            },
        },
    });
    const r = await m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1), u(2), u(8), u(9)], modo: 'gravar' });
    assert.equal(m.mutacoes.length, 1);
    assert.equal(m.mutacoes[0].validateOnly, false);
    const op = m.mutacoes[0].m.operations[0] as any;
    assert.equal(op.create.status, 'ENABLED');
    assert.equal(op.create.keyword.matchType, 'EXACT');
    assert.equal(r.modo, 'gravar');
    assert.deepEqual(r.resumo, { ok: 1, ja_existe: 1, erro: 1 });
    const por = Object.fromEntries(m.registrados.map((x) => [x.linha_id, x]));
    assert.equal(m.registrados.length, 4);
    for (const id of [u(1), u(2)]) {
        assert.equal(por[id].status, 'ok');
        assert.equal(por[id].resource_name, `customers/${CONTA}/adGroupCriteria/21~0`);
    }
    assert.equal(por[u(9)].status, 'ja_existia');
    assert.equal(por[u(8)].status, 'erro');
    assert.match(por[u(8)].erro!, /grupo não encontrado/);
    for (const x of m.registrados) {
        assert.equal(x.profile_id, 'p1');
        assert.equal(x.mesa, 'mesa_magic_hands');
        assert.equal(x.customer_id, CONTA);
        assert.equal(x.tipo, 'segmentar');
        assert.equal(x.correspondencia, 'exata');
        assert.equal(x.nivel ?? null, null);
    }
});

test('gravar: falha parcial registra erro com a mensagem do Google', async () => {
    const m = montar({
        ads: {
            mutar: ({ validateOnly }) => validateOnly ? undefined : {
                results: [{}],
                partialFailureError: { message: 'x', details: [{ errors: [{ message: 'Texto proibido', location: { fieldPathElements: [{ index: 0 }] } }] }] },
            },
        },
    });
    const r = await m.run('subir_segmentadas', { cliente: 'Magic Hands', ids: [u(1)], modo: 'gravar' });
    assert.equal(r.itens[0].situacao, 'erro');
    assert.equal(m.registrados[0].status, 'erro');
    assert.match(m.registrados[0].erro!, /Texto proibido/);
});

test('subir_teste_ab: palavra exata pausada, tipo teste_ab no registro', async () => {
    const m = montar();
    await m.run('subir_teste_ab', { cliente: 'Magic Hands', ids: [u(4)], modo: 'gravar' });
    const op = m.mutacoes[0].m.operations[0] as any;
    assert.equal(op.create.status, 'PAUSED');
    assert.equal(op.create.adGroup, `customers/${CONTA}/adGroups/21`);
    assert.equal(m.registrados[0].tipo, 'teste_ab');
});

// ---------- negativas ----------

test('negativas nível grupo: catálogo de negativas (polaridade), já existente vira ja_existe', async () => {
    const m = montar();
    const r = await m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3), u(11)], nivel: 'grupo', modo: 'gravar' });
    const por = Object.fromEntries(r.itens.map((i: any) => [i.termo, i]));
    assert.equal(por['luva barata'].situacao, 'ok'); // existe só como positiva
    assert.equal(por['luva existente'].situacao, 'ja_existe');
    const op = m.mutacoes[0].m.operations[0] as any;
    assert.equal(op.create.negative, true);
    assert.equal(op.create.keyword.matchType, 'EXACT');
    assert.ok(m.consultas.some((q) => /ad_group_criterion/.test(q) && /negative = true/.test(q)));
    assert.equal(r.nivel, 'grupo');
    assert.equal(r.correspondencia, 'exata');
    for (const x of m.registrados) {
        assert.equal(x.tipo, 'negativar');
        assert.equal(x.nivel, 'grupo');
        assert.equal(x.correspondencia, 'exata');
    }
});

test('negativas nível campanha com frase: existente na campanha → ja_existe', async () => {
    const m = montar();
    const r = await m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3)], nivel: 'campanha', correspondencia: 'frase', modo: 'previa' });
    assert.equal(r.itens[0].situacao, 'ja_existe');
    assert.equal(r.itens[0].grupo, undefined);
    assert.equal(m.mutacoes.length, 0);
});

test('negativas nível lista por nome: usa o shared set achado', async () => {
    const m = montar();
    const r = await m.run('subir_negativas', {
        cliente: 'Magic Hands', ids: [u(3), u(11), u(10)], nivel: 'lista', lista: { nome: 'negativas gerais' }, modo: 'gravar',
    });
    const por = Object.fromEntries(r.itens.map((i: any) => [i.termo, i]));
    assert.equal(por['luva existente'].situacao, 'ja_existe');
    assert.equal(por['luva barata'].situacao, 'ok');
    assert.equal(por['luva pmax neg'].situacao, 'ok'); // PMax permitido em lista
    assert.equal(m.mutacoes.length, 1);
    assert.equal(m.mutacoes[0].m.servico, 'sharedCriteria');
    assert.equal((m.mutacoes[0].m.operations[0] as any).create.sharedSet, `customers/${CONTA}/sharedSets/31`);
    assert.ok(m.registrados.every((x) => x.nivel === 'lista' && x.lista_negativa === 'Negativas Gerais'));
});

test('negativas nível lista por id inexistente ou nome ausente sem criar → "lista não encontrada"', async () => {
    const m = montar();
    await assert.rejects(m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3)], nivel: 'lista', lista: { nome: 'Nova' }, modo: 'previa' }),
        erroUsuario(/lista não encontrada/));
    await assert.rejects(m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3)], nivel: 'lista', lista: { id: '777' }, modo: 'previa' }),
        erroUsuario(/lista não encontrada/));
    await assert.rejects(m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3)], nivel: 'lista', modo: 'previa' }),
        erroUsuario(/lista/));
    assert.equal(m.mutacoes.length, 0);
});

test('lista.criar na prévia: não cria, não valida esses itens e devolve aviso', async () => {
    const m = montar();
    const r = await m.run('subir_negativas', {
        cliente: 'Magic Hands', ids: [u(3)], nivel: 'lista', lista: { nome: 'Nova Lista', criar: true }, modo: 'previa',
    });
    assert.equal(m.mutacoes.length, 0);
    assert.equal(r.itens[0].situacao, 'ok');
    assert.ok(r.avisos.includes('a lista "Nova Lista" será criada e vinculada às campanhas dos termos'));
    assert.equal(m.registrados.length, 0);
});

test('lista.criar no gravar: cria o shared set, vincula às campanhas e adiciona as negativas', async () => {
    const m = montar();
    const r = await m.run('subir_negativas', {
        cliente: 'Magic Hands', ids: [u(3), u(10)], nivel: 'lista', lista: { nome: 'Nova Lista', criar: true }, correspondencia: 'ampla', modo: 'gravar',
    });
    const servicos = m.mutacoes.map((x) => x.m.servico);
    assert.deepEqual(servicos, ['sharedSets', 'campaignSharedSets', 'sharedCriteria']);
    assert.ok(m.mutacoes.every((x) => !x.validateOnly));
    assert.deepEqual((m.mutacoes[0].m.operations[0] as any).create, { name: 'Nova Lista', type: 'NEGATIVE_KEYWORDS' });
    const vinculos = m.mutacoes[1].m.operations.map((o: any) => o.create);
    assert.deepEqual(vinculos.map((v: any) => v.campaign).sort(), [`customers/${CONTA}/campaigns/11`, `customers/${CONTA}/campaigns/12`]);
    assert.ok(vinculos.every((v: any) => v.sharedSet === `customers/${CONTA}/sharedSets/900`));
    const ops = m.mutacoes[2].m.operations as any[];
    assert.ok(ops.every((o) => o.create.sharedSet === `customers/${CONTA}/sharedSets/900` && o.create.keyword.matchType === 'BROAD'));
    assert.deepEqual(r.resumo, { ok: 2, ja_existe: 0, erro: 0 });
    assert.ok(m.registrados.every((x) => x.lista_negativa === 'Nova Lista' && x.correspondencia === 'ampla'));
});

test('nível conta com lista existente e vinculada: usa o shared set e o catálogo da conta', async () => {
    const m = montar({ ads: { contaLista: true } });
    const r = await m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3), u(12)], nivel: 'conta', modo: 'gravar' });
    const por = Object.fromEntries(r.itens.map((i: any) => [i.termo, i]));
    assert.equal(por['luva barata'].situacao, 'ja_existe');
    assert.equal(por['luva flag'].situacao, 'ok');
    assert.deepEqual(m.mutacoes.map((x) => x.m.servico), ['sharedCriteria']);
    assert.equal((m.mutacoes[0].m.operations[0] as any).create.sharedSet, `customers/${CONTA}/sharedSets/41`);
    assert.ok(m.consultas.some((q) => /ACCOUNT_LEVEL_NEGATIVE_KEYWORDS/.test(q)));
    assert.ok(m.registrados.every((x) => x.nivel === 'conta'));
});

test('nível conta sem lista na prévia: não cria nada, aviso, sem validar', async () => {
    const m = montar();
    const r = await m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3)], nivel: 'conta', modo: 'previa' });
    assert.equal(m.mutacoes.length, 0);
    assert.equal(r.itens[0].situacao, 'ok');
    assert.ok(r.avisos.some((a: string) => /conta/.test(a) && /criada/.test(a)));
});

test('nível conta sem lista no gravar: cria o set da conta, vincula ao cliente e adiciona', async () => {
    const m = montar();
    await m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3)], nivel: 'conta', modo: 'gravar' });
    assert.deepEqual(m.mutacoes.map((x) => x.m.servico), ['sharedSets', 'customerNegativeCriteria', 'sharedCriteria']);
    assert.deepEqual((m.mutacoes[0].m.operations[0] as any).create, { name: 'Negativas da conta (Pocket)', type: 'ACCOUNT_LEVEL_NEGATIVE_KEYWORDS' });
    assert.deepEqual((m.mutacoes[1].m.operations[0] as any).create, { negativeKeywordList: { sharedSet: `customers/${CONTA}/sharedSets/900` } });
    assert.equal((m.mutacoes[2].m.operations[0] as any).create.sharedSet, `customers/${CONTA}/sharedSets/900`);
});

test('nível conta com lista existente mas não vinculada: gravar só vincula', async () => {
    const m = montar({ ads: { contaLista: true, contaVinculada: false } });
    await m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(12)], nivel: 'conta', modo: 'gravar' });
    assert.deepEqual(m.mutacoes.map((x) => x.m.servico), ['customerNegativeCriteria', 'sharedCriteria']);
});

test('nível conta: Google recusa a criação → ErroUsuario com a mensagem do Google, nada registrado', async () => {
    const m = montar({ ads: { mutar: ({ m: mu }) => { if (mu.servico === 'sharedSets') throw new ErroUsuario('Google Ads: tipo não suportado'); return undefined; } } });
    await assert.rejects(m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3)], nivel: 'conta', modo: 'gravar' }),
        erroUsuario(/tipo não suportado/));
    assert.equal(m.registrados.length, 0);
});

test('negativas: nível ou correspondência inválidos → ErroUsuario', async () => {
    const m = montar();
    await assert.rejects(m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3)], nivel: 'mcc', modo: 'previa' }), erroUsuario(/nível|nivel/));
    await assert.rejects(m.run('subir_negativas', { cliente: 'Magic Hands', ids: [u(3)], nivel: 'grupo', correspondencia: 'x', modo: 'previa' }),
        erroUsuario(/correspond/));
});

// ---------- status_conexao ----------

test('status_conexao: conectado, com clientes e contas', async () => {
    const m = montar();
    const r = await m.run('status_conexao', {});
    assert.deepEqual(r.usuario, { nome: 'Ana', email: 'ana@x.com', admin: false });
    assert.equal(r.google_ads, 'conectado');
    assert.equal(r.modo, 'pocket');
    assert.equal(r.google_email, 'ana@gmail.com');
    assert.deepEqual(r.clientes, [
        { nome: 'Magic Hands', conta: CONTA }, { nome: 'Endomarcas', conta: null }, { nome: 'Estremoz', conta: '2223334444' },
    ]);
});

test('status_conexao: ErroConexaoGoogle → "reconectar" sem lançar; outro erro → reconectar com detalhe', async () => {
    const m = montar({ ads: { contas: async () => { throw new ErroConexaoGoogle(); } } });
    const r = await m.run('status_conexao', {});
    assert.equal(r.google_ads, 'reconectar');
    const m2 = montar({ ads: { contas: async () => { throw new ErroUsuario('Falha ao renovar o acesso ao Google (x).'); } } });
    const r2 = await m2.run('status_conexao', {});
    assert.equal(r2.google_ads, 'reconectar');
    assert.match(r2.detalhe, /Falha ao renovar/);
});

test('status_conexao: sem conexão → nao_conectado, sem chamar o Google', async () => {
    let chamou = false;
    const m = montar({ semCred: true, ads: { contas: async () => { chamou = true; return []; } } });
    const r = await m.run('status_conexao', {});
    assert.equal(r.google_ads, 'nao_conectado');
    assert.equal(chamou, false);
});

// ---------- montarCredenciais ----------

const CHAVE = Buffer.alloc(32, 7).toString('base64');

test('montarCredenciais modo pocket: segredos do Pocket + refresh decifrado; login do cliente', async () => {
    const con = { modo: 'pocket' as const, refresh_token_cifrado: await cifrar('RT', CHAVE) };
    const c = await montarCredenciais(con, EMPRESAS[0], { developerToken: 'DEV', clientId: 'CID', clientSecret: 'CS', chave: CHAVE });
    assert.deepEqual(c, { developerToken: 'DEV', clientId: 'CID', clientSecret: 'CS', refreshToken: 'RT' });
    const c2 = await montarCredenciais(con, { ...EMPRESAS[0], loginCustomerId: '9998887777' },
        { developerToken: 'DEV', clientId: 'CID', clientSecret: 'CS', chave: CHAVE });
    assert.equal(c2!.loginCustomerId, '9998887777');
    assert.equal(await montarCredenciais(null, EMPRESAS[0], { chave: CHAVE }), null);
});

test('montarCredenciais modo pocket sem developer token: ok, sem a chave', async () => {
    const con = { modo: 'pocket' as const, refresh_token_cifrado: await cifrar('RT', CHAVE) };
    const c = await montarCredenciais(con, EMPRESAS[0], { clientId: 'CID', clientSecret: 'CS', chave: CHAVE });
    assert.deepEqual(c, { clientId: 'CID', clientSecret: 'CS', refreshToken: 'RT' });
    await assert.rejects(montarCredenciais(con, EMPRESAS[0], { clientSecret: 'CS', chave: CHAVE }));
});

test('montarCredenciais modo proprio sem developer token (null): ok', async () => {
    const con = {
        modo: 'proprio' as const,
        refresh_token_cifrado: await cifrar('RT', CHAVE),
        developer_token_cifrado: null,
        client_id: 'CIDU',
        client_secret_cifrado: await cifrar('CSU', CHAVE),
    };
    const c = await montarCredenciais(con, EMPRESAS[0], { chave: CHAVE });
    assert.deepEqual(c, { clientId: 'CIDU', clientSecret: 'CSU', refreshToken: 'RT' });
});

test('montarCredenciais modo proprio: tudo da linha; login próprio tem prioridade', async () => {
    const con = {
        modo: 'proprio' as const,
        refresh_token_cifrado: await cifrar('RT', CHAVE),
        developer_token_cifrado: await cifrar('DEVU', CHAVE),
        client_id: 'CIDU',
        client_secret_cifrado: await cifrar('CSU', CHAVE),
        login_customer_id: '1231231234',
    };
    const c = await montarCredenciais(con, { ...EMPRESAS[0], loginCustomerId: '9998887777' }, { developerToken: 'DEV', chave: CHAVE });
    assert.deepEqual(c, { developerToken: 'DEVU', clientId: 'CIDU', clientSecret: 'CSU', refreshToken: 'RT', loginCustomerId: '1231231234' });
});
