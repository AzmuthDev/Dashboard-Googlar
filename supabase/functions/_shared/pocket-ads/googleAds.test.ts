import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarCatalogo, criarClienteAds, ErroConexaoGoogle } from './googleAds.ts';
import { chaveExistente } from './destinos.ts';
import { ErroUsuario } from './mcp.ts';

const cred = {
    developerToken: 'DEVTOK-secreto', clientId: 'cid.apps', clientSecret: 'CSEC-secreto', refreshToken: 'RTOK-secreto',
};
const SEGREDOS = ['DEVTOK-secreto', 'CSEC-secreto', 'RTOK-secreto', 'ACCESS-secreto'];
const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

interface Chamada { url: string; init: RequestInit; corpo: any; headers: Record<string, string> }
type Resp = Response | ((c: Chamada) => Response);

/** `rotas` devolve a resposta; undefined no token = resposta padrão de token válido. */
function falso(rotas: (c: Chamada) => Resp | undefined) {
    const chamadas: Chamada[] = [];
    const f = (async (url: string, init: RequestInit = {}) => {
        const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>)
            .map(([k, v]) => [k.toLowerCase(), v]));
        let corpo: any = init.body;
        if (typeof corpo === 'string' && headers['content-type']?.includes('json')) corpo = JSON.parse(corpo);
        const c = { url: String(url), init, corpo, headers };
        chamadas.push(c);
        const r = rotas(c);
        if (c.url === 'https://oauth2.googleapis.com/token' && !r) return json({ access_token: 'ACCESS-secreto', expires_in: 3600 });
        if (!r) throw new Error('rota inesperada ' + c.url);
        return typeof r === 'function' ? r(c) : r;
    }) as unknown as typeof fetch;
    return { f, chamadas, tokens: () => chamadas.filter((c) => c.url.includes('oauth2')) };
}
const ehToken = (c: Chamada) => c.url.includes('oauth2');

test('token trocado uma vez para duas consultas; corpo form-encoded', async () => {
    const m = falso((c) => (ehToken(c) ? undefined : json({ results: [] })));
    const ads = criarClienteAds(cred, m.f);
    await ads.pesquisar('123', 'SELECT 1');
    await ads.pesquisar('123', 'SELECT 2');
    assert.equal(m.tokens().length, 1);
    const p = new URLSearchParams(String(m.tokens()[0].corpo));
    assert.equal(p.get('grant_type'), 'refresh_token');
    assert.equal(p.get('refresh_token'), 'RTOK-secreto');
    assert.equal(p.get('client_id'), 'cid.apps');
    assert.equal(p.get('client_secret'), 'CSEC-secreto');
    const busca = m.chamadas.filter((c) => c.url.includes('googleAds:search'));
    assert.equal(busca[0].headers['authorization'], 'Bearer ACCESS-secreto');
    assert.equal(busca[0].headers['developer-token'], 'DEVTOK-secreto');
});

test('developer-token: ausente quando undefined/vazio, presente quando definido', async () => {
    for (const dt of [undefined, '']) {
        const m = falso((c) => (ehToken(c) ? undefined : json({ results: [] })));
        await criarClienteAds({ ...cred, developerToken: dt }, m.f).pesquisar('1', 'q');
        const busca = m.chamadas.find((c) => c.url.includes('googleAds:search'))!;
        assert.equal('developer-token' in busca.headers, false);
    }
    const m = falso((c) => (ehToken(c) ? undefined : json({ results: [] })));
    await criarClienteAds({ ...cred, developerToken: 'X' }, m.f).pesquisar('1', 'q');
    assert.equal(m.chamadas.find((c) => c.url.includes('googleAds:search'))!.headers['developer-token'], 'X');
});

test('token expirado (margem de 60 s) é renovado', async () => {
    let agora = 1_000_000;
    const realNow = Date.now;
    Date.now = () => agora;
    try {
        const m = falso((c) => (ehToken(c) ? undefined : json({ results: [] })));
        const ads = criarClienteAds(cred, m.f);
        await ads.pesquisar('1', 'q');
        agora += 3500_000;
        await ads.pesquisar('1', 'q');
        assert.equal(m.tokens().length, 1);
        agora += 100_000;
        await ads.pesquisar('1', 'q');
        assert.equal(m.tokens().length, 2);
    } finally { Date.now = realNow; }
});

test('login-customer-id enviado quando informado (normalizado) e ausente quando não', async () => {
    const m1 = falso((c) => (ehToken(c) ? undefined : json({ results: [] })));
    await criarClienteAds({ ...cred, loginCustomerId: '999-888-7777' }, m1.f).pesquisar('customers/123-456-7890', 'q');
    const c1 = m1.chamadas.find((c) => c.url.includes('googleAds:search'))!;
    assert.equal(c1.headers['login-customer-id'], '9998887777');
    assert.equal(c1.url, 'https://googleads.googleapis.com/v26/customers/1234567890/googleAds:search');
    const m2 = falso((c) => (ehToken(c) ? undefined : json({ results: [] })));
    await criarClienteAds(cred, m2.f).pesquisar('123', 'q');
    assert.equal('login-customer-id' in m2.chamadas.find((c) => c.url.includes('googleAds:search'))!.headers, false);
});

test('paginação junta duas páginas seguindo nextPageToken', async () => {
    const m = falso((c) => {
        if (ehToken(c)) return undefined;
        return c.corpo.pageToken === 'P2'
            ? json({ results: [{ b: 2 }] })
            : json({ results: [{ a: 1 }], nextPageToken: 'P2' });
    });
    const r = await criarClienteAds(cred, m.f).pesquisar('1', 'SELECT x');
    assert.deepEqual(r, [{ a: 1 }, { b: 2 }]);
    const buscas = m.chamadas.filter((c) => c.url.includes('googleAds:search'));
    assert.equal(buscas.length, 2);
    assert.equal(buscas[0].corpo.query, 'SELECT x');
    assert.equal('pageToken' in buscas[0].corpo, false);
});

test('invalid_grant no token -> ErroConexaoGoogle', async () => {
    const m = falso((c) => (ehToken(c)
        ? json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400) : undefined));
    await assert.rejects(criarClienteAds(cred, m.f).pesquisar('1', 'q'), (e: Error) => {
        assert.ok(e instanceof ErroConexaoGoogle);
        assert.ok(e instanceof ErroUsuario);
        assert.match(e.message, /Reconecte o Google Ads em Pocket › Conectar ao Claude\./);
        return true;
    });
});

test('outro erro do token -> ErroUsuario (não de conexão)', async () => {
    const m = falso((c) => (ehToken(c)
        ? json({ error: 'invalid_client', error_description: 'Unauthorized' }, 401) : undefined));
    await assert.rejects(criarClienteAds(cred, m.f).pesquisar('1', 'q'), (e: Error) => {
        assert.ok(e instanceof ErroUsuario);
        assert.ok(!(e instanceof ErroConexaoGoogle));
        for (const s of SEGREDOS) assert.ok(!e.message.includes(s));
        return true;
    });
});

test('401 UNAUTHENTICATED da Ads API -> ErroConexaoGoogle', async () => {
    const m = falso((c) => (ehToken(c) ? undefined
        : json({ error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' } }, 401)));
    await assert.rejects(criarClienteAds(cred, m.f).pesquisar('1', 'q'), ErroConexaoGoogle);
});

test('403 USER_PERMISSION_DENIED -> mensagem com o ID da conta', async () => {
    const m = falso((c) => (ehToken(c) ? undefined : json({
        error: {
            code: 403, message: 'User does not have permission to access customer.', status: 'PERMISSION_DENIED',
            details: [{ errors: [{ errorCode: { authorizationError: 'USER_PERMISSION_DENIED' }, message: 'x' }] }],
        },
    }, 403)));
    await assert.rejects(criarClienteAds(cred, m.f).pesquisar('123-456-7890', 'q'), (e: Error) => {
        assert.ok(e instanceof ErroUsuario);
        assert.ok(!(e instanceof ErroConexaoGoogle));
        assert.equal(e.message, 'Sua conta Google não tem acesso à conta 1234567890 do Google Ads.');
        return true;
    });
});

test('outros erros -> ErroUsuario com a primeira message do Google; nunca vaza segredos', async () => {
    const m = falso((c) => (ehToken(c) ? undefined : json({
        error: {
            code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT',
            details: [{ errors: [{ errorCode: { queryError: 'BAD_FIELD_NAME' }, message: 'Unrecognized field in the query.' }] }],
        },
    }, 400)));
    await assert.rejects(criarClienteAds(cred, m.f).pesquisar('1', 'SELECT x'), (e: Error) => {
        assert.ok(e instanceof ErroUsuario);
        assert.match(e.message, /Request contains an invalid argument\./);
        for (const s of SEGREDOS) assert.ok(!e.message.includes(s), `vazou ${s}`);
        return true;
    });
    const m2 = falso((c) => (ehToken(c) ? json({ error: 'invalid_grant' }, 400) : undefined));
    await assert.rejects(criarClienteAds(cred, m2.f).pesquisar('1', 'q'), (e: Error) => {
        for (const s of SEGREDOS) assert.ok(!e.message.includes(s));
        return true;
    });
});

test('corpo não-JSON -> ErroUsuario de resposta inesperada', async () => {
    const m = falso((c) => (ehToken(c) ? undefined : new Response('<html>oops</html>', { status: 502 })));
    await assert.rejects(criarClienteAds(cred, m.f).pesquisar('1', 'q'), (e: Error) => {
        assert.ok(e instanceof ErroUsuario);
        assert.equal(e.message, 'Resposta inesperada do Google Ads (HTTP 502).');
        return true;
    });
});

test('mutar envia validateOnly e partialFailure, no serviço certo', async () => {
    const m = falso((c) => (ehToken(c) ? undefined : json({ results: [{ resourceName: 'r' }] })));
    const ads = criarClienteAds(cred, m.f);
    const ops = [{ create: { a: 1 } }];
    const r = await ads.mutar('123-456', { servico: 'adGroupCriteria', operations: ops, indices: [0] }, true);
    assert.deepEqual(r, { results: [{ resourceName: 'r' }] });
    const c = m.chamadas.find((x) => x.url.includes(':mutate'))!;
    assert.equal(c.url, 'https://googleads.googleapis.com/v26/customers/123456/adGroupCriteria:mutate');
    assert.equal(c.init.method, 'POST');
    assert.deepEqual(c.corpo, { operations: ops, partialFailure: true, validateOnly: true });
    await ads.mutar('123', { servico: 'sharedCriteria', operations: ops, indices: [0] }, false);
    assert.equal(m.chamadas.filter((x) => x.url.includes(':mutate')).at(-1)!.corpo.validateOnly, false);
});

test('contasAcessiveis devolve ids sem prefixo', async () => {
    const m = falso((c) => (ehToken(c) ? undefined : json({ resourceNames: ['customers/111', 'customers/222'] })));
    const r = await criarClienteAds(cred, m.f).contasAcessiveis();
    assert.deepEqual(r, ['111', '222']);
    const c = m.chamadas.find((x) => x.url.includes('listAccessibleCustomers'))!;
    assert.equal(c.url, 'https://googleads.googleapis.com/v26/customers:listAccessibleCustomers');
    assert.equal(c.init.method, 'GET');
});

// ---- catálogo ----
function catalogoFalso(extra: Record<string, unknown[]> = {}) {
    const consultas: string[] = [];
    const m = falso((c) => {
        if (ehToken(c)) return undefined;
        const q: string = c.corpo.query;
        consultas.push(q);
        const de = /FROM (\w+)/.exec(q)![1];
        if (de === 'campaign') return json({ results: [
            { campaign: { id: '10', name: 'Camp A', advertisingChannelType: 'SEARCH' } },
            { campaign: { id: '11', name: 'Camp B', advertisingChannelType: 'PERFORMANCE_MAX' } },
        ] });
        if (de === 'ad_group') return json({ results: [{ adGroup: { id: '20', name: 'Grupo 1' }, campaign: { id: '10' } }] });
        return json({ results: extra[de] ?? [] });
    });
    return { m, consultas };
}

test('catálogo: campanhas e grupos sempre; sem escopos não consulta critérios', async () => {
    const { m, consultas } = catalogoFalso();
    const cat = await carregarCatalogo(criarClienteAds(cred, m.f), '123', []);
    assert.deepEqual(cat.campanhas, [
        { id: '10', nome: 'Camp A', tipoCanal: 'SEARCH' }, { id: '11', nome: 'Camp B', tipoCanal: 'PERFORMANCE_MAX' }]);
    assert.deepEqual(cat.grupos, [{ id: '20', nome: 'Grupo 1', campanhaId: '10' }]);
    assert.equal(cat.existentes.size, 0);
    assert.equal(consultas.length, 2);
    assert.match(consultas[0], /campaign\.advertising_channel_type/);
    assert.match(consultas[0], /campaign\.status != 'REMOVED'/);
    assert.match(consultas[1], /ad_group\.status != 'REMOVED'/);
});

test('catálogo: escopos g/c/l/conta consultam cada tipo com IN e chaves certas', async () => {
    const { m, consultas } = catalogoFalso({
        ad_group_criterion: [{ adGroupCriterion: { keyword: { text: 'Sapato Azul', matchType: 'EXACT' } }, adGroup: { id: '20' } }],
        campaign_criterion: [{ campaignCriterion: { keyword: { text: 'grátis', matchType: 'PHRASE' } }, campaign: { id: '10' } }],
    });
    // o stub devolve linhas de shared_criterion conforme o shared_set consultado
    const base = m.f;
    const ads = criarClienteAds(cred, (async (u: string, i: RequestInit) => {
        const r = await base(u, i);
        return r;
    }) as unknown as typeof fetch);
    const cat = await carregarCatalogo(ads, '123', ['g:20', 'g:21', 'c:10', 'l:30', 'conta'], { contaListaId: '40', negativas: true });
    const gq = consultas.find((q) => q.includes('FROM ad_group_criterion'))!;
    assert.match(gq, /ad_group\.id IN \(20, 21\)/);
    assert.match(gq, /ad_group_criterion\.negative = true/);
    assert.match(gq, /ad_group_criterion\.type = KEYWORD/);
    assert.match(gq, /ad_group_criterion\.status != 'REMOVED'/);
    const cq = consultas.find((q) => q.includes('FROM campaign_criterion'))!;
    assert.match(cq, /campaign\.id IN \(10\)/);
    assert.match(cq, /campaign_criterion\.negative = true/);
    const sq = consultas.filter((q) => q.includes('FROM shared_criterion'));
    assert.equal(sq.length, 2);
    assert.ok(sq.some((q) => /shared_set\.id IN \(30\)/.test(q)));
    assert.ok(sq.some((q) => /shared_set\.id IN \(40\)/.test(q)));
    assert.ok(cat.existentes.has(chaveExistente('g:20', 'sapato azul', 'EXACT')));
    assert.ok(cat.existentes.has(chaveExistente('c:10', 'grátis', 'PHRASE')));
});

test('catálogo: shared_criterion vira l:<id> e conta conforme o shared set', async () => {
    const consultas: string[] = [];
    const m = falso((c) => {
        if (ehToken(c)) return undefined;
        const q: string = c.corpo.query;
        consultas.push(q);
        const de = /FROM (\w+)/.exec(q)![1];
        if (de === 'campaign' || de === 'ad_group') return json({ results: [] });
        const id = /shared_set\.id IN \((\d+)\)/.exec(q)![1];
        return json({ results: [{ sharedCriterion: { keyword: { text: 'barato ' + id, matchType: 'BROAD' } }, sharedSet: { id } }] });
    });
    const cat = await carregarCatalogo(criarClienteAds(cred, m.f), '123', ['l:30', 'conta'], { contaListaId: '40' });
    assert.ok(cat.existentes.has(chaveExistente('l:30', 'barato 30', 'BROAD')));
    assert.ok(cat.existentes.has(chaveExistente('conta', 'barato 40', 'BROAD')));
    assert.ok(!cat.existentes.has(chaveExistente('l:40', 'barato 40', 'BROAD')));
});

test('catálogo: negativas padrão false nos grupos; conta sem id é ignorada', async () => {
    const { m, consultas } = catalogoFalso();
    await carregarCatalogo(criarClienteAds(cred, m.f), '123', ['g:20', 'conta']);
    assert.match(consultas.find((q) => q.includes('FROM ad_group_criterion'))!, /ad_group_criterion\.negative = false/);
    assert.equal(consultas.filter((q) => q.includes('shared_criterion')).length, 0);
});

test('catálogo: id não numérico é rejeitado antes de consultar', async () => {
    const { m, consultas } = catalogoFalso();
    const ads = criarClienteAds(cred, m.f);
    await assert.rejects(carregarCatalogo(ads, '123', ['g:1) OR (1=1']), ErroUsuario);
    await assert.rejects(carregarCatalogo(ads, '123', ['c:abc']), ErroUsuario);
    await assert.rejects(carregarCatalogo(ads, '123', ['conta'], { contaListaId: "5' OR" }), ErroUsuario);
    assert.equal(consultas.length, 0);
});
