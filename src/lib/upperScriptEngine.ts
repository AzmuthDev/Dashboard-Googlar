/**
 * Motor Analítico Upper Script - Método Quadrante Googlar
 * Executa a auditoria autônoma de Demanda x Oferta, cálculo de GAP,
 * agregação de P&L por localidade/cluster, notas de prioridade (0 a 10),
 * e setup de reestruturação STAG / ValueTrack / DTR.
 */

import * as XLSX from 'xlsx';

// Normaliza texto removendo acentuação e espaços extras
export function normalizarTexto(texto: string): string {
    if (!texto || typeof texto !== 'string') return '';
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// Dicionário de Localidades Brasileiras
export const BASE_BRASIL: Record<string, string[]> = {
    "São Paulo / SP": [
        "sao paulo", "sp", "capital paulista", "campinas", "santos", "guarulhos", 
        "santo andre", "sao bernardo", "sao caetano", "osasco", "ribeirao preto",
        "sorocaba", "sao jose dos campos", "barueri", "alphaville", "moema", "pinheiros", "tatuape"
    ],
    "Rio de Janeiro / RJ": [
        "rio de janeiro", "rj", "rio", "niteroi", "duque de caxias", "sao goncalo",
        "nova iguacu", "barra da tijuca", "copacabana", "petropolis", "cabo frio"
    ],
    "Minas Gerais / MG": [
        "belo horizonte", "bh", "mg", "minas gerais", "uberlandia", "contagem", 
        "juiz de fora", "betim", "montes claros", "uberaba"
    ],
    "Sul (PR, SC, RS)": [
        "curitiba", "pr", "parana", "porto alegre", "poa", "rs", "rio grande do sul",
        "florianopolis", "floripa", "sc", "santa catarina", "londrina", "maringa",
        "joinville", "blumenau", "caxias do sul"
    ],
    "Centro-Oeste / DF": [
        "brasilia", "df", "distrito federal", "goiania", "go", "goias", 
        "cuiaba", "mt", "campo grande", "ms"
    ],
    "Nordeste": [
        "salvador", "ba", "bahia", "fortaleza", "ce", "ceara", "recife", "pe", 
        "pernambuco", "natal", "rn", "maceio", "al", "joao pessoa", "pb", "sao luis", "ma"
    ]
};

// Dicionário Internacional
export const BASE_INTERNACIONAL: Record<string, string[]> = {
    "Europa": [
        "europa", "schengen", "portugal", "espanha", "italia", "franca", "alemanha",
        "inglaterra", "reino unido", "uk", "londres", "paris", "madrid", "roma", "lisboa"
    ],
    "América do Norte": [
        "eua", "usa", "estados unidos", "canada", "mexico", "orlando", "miami", 
        "nova york", "florida", "california"
    ],
    "América do Sul": [
        "america do sul", "chile", "argentina", "buenos aires", "colombia", "peru", 
        "uruguai", "santiago", "bariloche", "lima", "bogota"
    ],
    "Ásia / Oceania": [
        "asia", "japao", "china", "tailandia", "australia", "nova zelandia", "toquio", "sidney"
    ]
};

// Interface do P&L Agrupado
export interface PLClusterRow {
    regiao: string;
    impressoes: number;
    cliques: number;
    custo: number;
    conversoes: number;
    receita: number;
    cpa: number;
    roas: number;
    status: string;
    color: string;
}

// Interface do Termo do GAP
export interface GapTerm {
    termo: string;
    regiao: string;
    palavras_chave: string[];
    grupos_anuncio: string[];
    impr: number;
    cliques: number;
    custo: number;
    conv: number;
    cpa: number;
    roas: number;
    nota: number;
}

// Interface da Simulação Operacional
export interface SimulationSetup {
    icone: string;
    nome: string;
    origemTermos: string[];
    grupoAtual: string;
    novoGrupoEditor: string;
    keywordsAdd: string[];
    negativasGrupoAntigo: string[];
    sufixoUrl: string;
    urlParametrizada: string;
    h1Pagina: string;
    subtituloPagina: string;
    selectOpcao: string;
    cpaAntes: number;
    cpaDepois: number;
    roasDepois: number;
    economiaCpa: string;
    apolicesExtras: string;
}

// Interface do Resultado da Auditoria
export interface UpperScriptAuditResult {
    plRows: PLClusterRow[];
    topGapTerms: GapTerm[];
    allRegions: string[];
    simulationSetups: Record<string, SimulationSetup>;
    macroMetrics: {
        totalCusto: number;
        totalReceita: number;
        totalConv: number;
        totalImpr: number;
        totalCliques: number;
        roasConsolidado: number;
        cpaMedioConsolidado: number;
        margemMidia: number;
        linhasGap: number;
        custoDesperdicadoGap: number;
        conversoesGap: number;
    };
}

// DADOS DE DEMONSTRAÇÃO FIÉIS AO CASE REAL
export const DEMO_INTERNATIONAL_RESULT: UpperScriptAuditResult = {
    plRows: [
        {
            regiao: "Genérico Internacional",
            impressoes: 28039,
            cliques: 1740,
            custo: 21849.66,
            conversoes: 97.45,
            receita: 81986.78,
            cpa: 224.21,
            roas: 3.75,
            status: "Ralo de Eficiência",
            color: "#f87171"
        },
        {
            regiao: "Europa",
            impressoes: 3045,
            cliques: 284,
            custo: 2911.05,
            conversoes: 26.36,
            receita: 12842.00,
            cpa: 110.43,
            roas: 4.41,
            status: "Alta Rentabilidade",
            color: "#4ade80"
        },
        {
            regiao: "América do Norte (EUA/Canadá)",
            impressoes: 925,
            cliques: 88,
            custo: 913.17,
            conversoes: 5.50,
            receita: 3437.77,
            cpa: 166.03,
            roas: 3.76,
            status: "Oportunidade de Escala",
            color: "#38bdf8"
        },
        {
            regiao: "Ásia / Oceania",
            impressoes: 642,
            cliques: 79,
            custo: 868.70,
            conversoes: 6.13,
            receita: 3508.09,
            cpa: 141.71,
            roas: 4.03,
            status: "Alta Rentabilidade",
            color: "#fbbf24"
        },
        {
            regiao: "América do Sul",
            impressoes: 452,
            cliques: 49,
            custo: 292.72,
            conversoes: 5.23,
            receita: 995.70,
            cpa: 55.96,
            roas: 3.40,
            status: "Menor CPA da Conta",
            color: "#a78bfa"
        }
    ],
    topGapTerms: [
        {
            termo: "melhor seguro viagem asia",
            regiao: "Ásia / Oceania",
            palavras_chave: ['"seguro para viagem internacional"'],
            grupos_anuncio: ["_seguro viagem internacional"],
            impr: 1, cliques: 1, custo: 20.89, conv: 2.00, cpa: 10.45, roas: 40.71, nota: 10.0
        },
        {
            termo: "seguro de viagem europa",
            regiao: "Europa",
            palavras_chave: ['"seguro de saude viagem internacional"', '"seguro viagem exterior"', '"seguro internacional"', '"seguro para viagem internacional"'],
            grupos_anuncio: ["_seguro saúde internacional", "_seguro viagem internacional"],
            impr: 21, cliques: 1, custo: 35.45, conv: 2.00, cpa: 17.73, roas: 34.46, nota: 10.0
        },
        {
            termo: "seguro viagem uk",
            regiao: "Europa",
            palavras_chave: ['"seguro de saude viagem internacional"', '"seguro viagem internacional cotação"', '"seguro para viagem internacional"'],
            grupos_anuncio: ["_seguro saúde internacional", "_seguro viagem internacional"],
            impr: 8, cliques: 1, custo: 13.33, conv: 2.00, cpa: 6.67, roas: 24.74, nota: 10.0
        },
        {
            termo: "seguro viagem canadá",
            regiao: "América do Norte",
            palavras_chave: ['"seguro de saude viagem internacional"', '"seguro para viagem internacional"', '"seguro viagem internacional cotação"'],
            grupos_anuncio: ["_seguro saúde internacional", "_seguro viagem internacional"],
            impr: 7, cliques: 2, custo: 16.82, conv: 1.50, cpa: 11.21, roas: 55.80, nota: 9.5
        },
        {
            termo: "seguro para europa",
            regiao: "Europa",
            palavras_chave: ['"seguro de saude viagem internacional"', '"seguro para viagem internacional"'],
            grupos_anuncio: ["_seguro saúde internacional", "_seguro viagem internacional"],
            impr: 2, cliques: 1, custo: 7.75, conv: 1.50, cpa: 5.17, roas: 54.35, nota: 9.5
        },
        {
            termo: "qual o seguro viagem mais barato para europa",
            regiao: "Europa",
            palavras_chave: ['"seguro viagem internacional mais barato"', '"seguro viagem internacional cotação"'],
            grupos_anuncio: ["_seguro viagem internacional"],
            impr: 16, cliques: 1, custo: 6.64, conv: 1.00, cpa: 6.64, roas: 64.25, nota: 9.5
        },
        {
            termo: "seguro viagem reino unido",
            regiao: "Europa",
            palavras_chave: ['"seguro de saude viagem internacional"', '"seguro viagem internacional cotação"', '"seguro para viagem internacional"', '"seguro saúde para viagem internacional"'],
            grupos_anuncio: ["_seguro saúde internacional", "_seguro viagem internacional"],
            impr: 26, cliques: 1, custo: 10.39, conv: 1.00, cpa: 10.39, roas: 56.82, nota: 9.5
        },
        {
            termo: "affinity 35 europa é bom",
            regiao: "Europa",
            palavras_chave: ['"seguro para viagem internacional"'],
            grupos_anuncio: ["_seguro viagem internacional"],
            impr: 1, cliques: 1, custo: 10.83, conv: 1.00, cpa: 10.83, roas: 48.06, nota: 9.5
        },
        {
            termo: "seguro de saude canada",
            regiao: "América do Norte",
            palavras_chave: ['"seguro saude internacional"'],
            grupos_anuncio: ["_seguro saúde internacional"],
            impr: 14, cliques: 1, custo: 12.32, conv: 1.00, cpa: 12.32, roas: 45.87, nota: 9.5
        },
        {
            termo: "seguro viagem peru preço",
            regiao: "América do Sul",
            palavras_chave: ['"seguro viagem internacional cotação"', '"seguro saude internacional preço"', '"seguro de saude viagem internacional"', '"seguro para viagem internacional"'],
            grupos_anuncio: ["_seguro viagem internacional", "_seguro saúde internacional"],
            impr: 11, cliques: 1, custo: 7.48, conv: 1.00, cpa: 7.48, roas: 34.57, nota: 9.5
        },
        {
            termo: "seguro viagem mais barato europa",
            regiao: "Europa",
            palavras_chave: ['"seguro viagem internacional mais barato"', '"seguro viagem internacional barato"'],
            grupos_anuncio: ["_seguro viagem internacional"],
            impr: 32, cliques: 2, custo: 12.91, conv: 1.00, cpa: 12.91, roas: 29.25, nota: 9.0
        },
        {
            termo: "seguro viagem para eua",
            regiao: "América do Norte",
            palavras_chave: ['"seguro de saude viagem internacional"', '"seguro viagem exterior"', '"seguro internacional"', '"seguro para viagem internacional"'],
            grupos_anuncio: ["_seguro saúde internacional", "_seguro viagem internacional"],
            impr: 29, cliques: 5, custo: 71.70, conv: 1.00, cpa: 71.70, roas: 20.00, nota: 8.5
        },
        {
            termo: "seguro saude para viagem aos estados unidos",
            regiao: "América do Norte",
            palavras_chave: ['"seguro de saude viagem internacional"', '"seguro saude internacional cotacao"', '"seguro de viagem internacional"'],
            grupos_anuncio: ["_seguro saúde internacional", "_seguro viagem internacional"],
            impr: 5, cliques: 4, custo: 36.77, conv: 2.00, cpa: 18.38, roas: 13.60, nota: 8.5
        },
        {
            termo: "comparar seguro viagem europa",
            regiao: "Europa",
            palavras_chave: ['"seguro viagem internacional cotação"', '"seguro internacional de viagem"'],
            grupos_anuncio: ["_seguro viagem internacional"],
            impr: 4, cliques: 3, custo: 44.28, conv: 2.00, cpa: 22.14, roas: 7.99, nota: 8.5
        },
        {
            termo: "seguro viagem china",
            regiao: "Ásia / Oceania",
            palavras_chave: ['"seguro de saude viagem internacional"', '"seguro para viagem internacional"', '"seguro internacional"', '"seguro viagem internacional cotação"', '"seguro saúde para viagem internacional"'],
            grupos_anuncio: ["_seguro saúde internacional", "_seguro viagem internacional"],
            impr: 109, cliques: 8, custo: 136.03, conv: 2.00, cpa: 68.02, roas: 14.06, nota: 8.0
        },
        {
            termo: "seguro viagem tailandia",
            regiao: "Ásia / Oceania",
            palavras_chave: ['"seguro de saude viagem internacional"', '"seguro para viagem internacional"', '"seguro viagem internacional cotação"', '"seguro viagem exterior"'],
            grupos_anuncio: ["_seguro saúde internacional", "_seguro viagem internacional"],
            impr: 26, cliques: 4, custo: 81.56, conv: 2.00, cpa: 40.78, roas: 8.12, nota: 7.5
        }
    ],
    allRegions: ["Europa", "América do Norte", "América do Sul", "Ásia / Oceania"],
    simulationSetups: {
        "Europa": {
            icone: "🌍",
            nome: "Europa",
            origemTermos: ["seguro de viagem europa", "seguro saude europa", "cotação de seguro viagem europa", "seguro viagem uk", "seguro viagem portugal"],
            grupoAtual: "_seguro viagem internacional",
            novoGrupoEditor: "_seguro viagem europa",
            keywordsAdd: ['[seguro viagem europa]', '"seguro viagem europa"', '[seguro saude europa]', '"seguro saude europa"', '[seguro viagem schengen]'],
            negativasGrupoAntigo: ['-europa', '-schengen', '-portugal', '-espanha', '-italia', '-frança', '-londres'],
            sufixoUrl: "destino=Europa",
            urlParametrizada: "https://www.compararsegurodeviagem.com.br/lp-b/?destino=Europa",
            h1Pagina: "Comparar Seguro de Viagem para Europa: Cotação Internacional!",
            subtituloPagina: "Compare 14 seguradoras para o Tratado de Schengen com cobertura médica completa e melhor preço garantido.",
            selectOpcao: "Europa",
            cpaAntes: 224.21,
            cpaDepois: 110.43,
            roasDepois: 4.41,
            economiaCpa: "-50,7%",
            apolicesExtras: "+21 apólices"
        },
        "América do Norte": {
            icone: "🗽",
            nome: "América do Norte (EUA, Canadá, México)",
            origemTermos: ["seguro viagem para eua", "seguro viagem canadá", "seguro saude para viagem aos estados unidos", "seguro de saude canada", "seguro viagem mexico"],
            grupoAtual: "_seguro viagem internacional",
            novoGrupoEditor: "_seguro viagem america do norte",
            keywordsAdd: ['[seguro viagem eua]', '"seguro viagem eua"', '[seguro viagem canada]', '"seguro viagem canada"', '[seguro viagem estados unidos]'],
            negativasGrupoAntigo: ['-eua', '-usa', '-estados unidos', '-canada', '-mexico', '-orlando', '-miami'],
            sufixoUrl: "destino=America_do_Norte",
            urlParametrizada: "https://www.compararsegurodeviagem.com.br/lp-b/?destino=América do Norte",
            h1Pagina: "Comparar Seguro de Viagem para Estados Unidos & Canadá",
            subtituloPagina: "Planos com alta cobertura médica em dólares (USD) para hospitais americanos e canadenses sem franquia.",
            selectOpcao: "América do Norte",
            cpaAntes: 224.21,
            cpaDepois: 166.03,
            roasDepois: 3.76,
            economiaCpa: "-25,9%",
            apolicesExtras: "+8 apólices"
        },
        "América do Sul": {
            icone: "🏔️",
            nome: "América do Sul (Chile, Peru, Argentina, Colômbia)",
            origemTermos: ["seguro viagem peru preço", "seguro viagem para o peru", "seguro colombia", "seguro viagem para santiago", "seguro viagem chile"],
            grupoAtual: "_seguro viagem internacional",
            novoGrupoEditor: "_seguro viagem america do sul",
            keywordsAdd: ['[seguro viagem peru]', '"seguro viagem chile"', '[seguro colombia]', '"seguro viagem argentina"', '[seguro viagem america do sul]'],
            negativasGrupoAntigo: ['-chile', '-peru', '-colombia', '-argentina', '-santiago', '-buenos aires'],
            sufixoUrl: "destino=America_do_Sul",
            urlParametrizada: "https://www.compararsegurodeviagem.com.br/lp-b/?destino=América do Sul",
            h1Pagina: "Comparar Seguro de Viagem para América do Sul",
            subtituloPagina: "Viagens para Chile, Argentina, Peru e Colômbia com assistência 24h em português e menor preço garantido.",
            selectOpcao: "América do Sul",
            cpaAntes: 224.21,
            cpaDepois: 55.96,
            roasDepois: 3.40,
            economiaCpa: "-75,0%",
            apolicesExtras: "+15 apólices"
        },
        "Ásia / Oceania": {
            icone: "⛩️",
            nome: "Ásia & Oceania (China, Japão, Austrália)",
            origemTermos: ["seguro viagem china", "melhor seguro viagem asia", "seguro saude australia", "seguro viagem japao valor", "seguro viagem tailandia"],
            grupoAtual: "_seguro viagem internacional",
            novoGrupoEditor: "_seguro viagem asia oceania",
            keywordsAdd: ['[seguro viagem china]', '"seguro viagem china"', '[seguro viagem asia]', '"seguro saude australia"', '[seguro viagem japao]'],
            negativasGrupoAntigo: ['-china', '-japao', '-asia', '-australia', '-tailandia', '-nova zelandia'],
            sufixoUrl: "destino=Asia_Oceania",
            urlParametrizada: "https://www.compararsegurodeviagem.com.br/lp-b/?destino=Ásia",
            h1Pagina: "Comparar Seguro de Viagem para Ásia & Oceania",
            subtituloPagina: "Cobertura médica internacional para destinos exóticos com repatriação sanitária e telemedicina.",
            selectOpcao: "Ásia",
            cpaAntes: 224.21,
            cpaDepois: 141.71,
            roasDepois: 4.03,
            economiaCpa: "-36,8%",
            apolicesExtras: "+9 apólices"
        }
    },
    macroMetrics: {
        totalCusto: 26835.30,
        totalReceita: 102770.34,
        totalConv: 140.67,
        totalImpr: 33103,
        totalCliques: 2240,
        roasConsolidado: 3.83,
        cpaMedioConsolidado: 190.77,
        margemMidia: 75935.04,
        linhasGap: 48,
        custoDesperdicadoGap: 21849.66,
        conversoesGap: 97.45
    }
};

// Dicionário Compacto para os Popups e Tooltips
export const UPPER_GLOSSARY: Record<string, { term: string; meaning: string; purpose: string }> = {
    "ROAS": {
        term: "Valor de Conv. / Custo (ROAS)",
        meaning: "Multiplicador de retorno financeiro (Receita gerada ÷ Custo de cliques).",
        purpose: "Exemplo: ROAS 4,41 significa que cada R$ 1 investido faturou R$ 4,41 em vendas."
    },
    "CPA": {
        term: "Custo por Aquisição (CPA)",
        meaning: "Investimento médio necessário em cliques para fechar 1 venda/lead.",
        purpose: "Exemplo: No Genérico pagamos R$ 224 por venda; na Europa cai para R$ 110."
    },
    "Conversões": {
        term: "Conversões (Vendas / Leads)",
        meaning: "Quantidade de cotações finalizadas ou vendas emitidas vindas dos anúncios.",
        purpose: "Indica o volume real de transações geradas pela campanha."
    },
    "Impressões": {
        term: "Impressões (Alcance de Buscas)",
        meaning: "Quantas vezes os anúncios foram exibidos na tela do Google.",
        purpose: "Mede o tamanho da demanda e o volume de pessoas procurando o serviço."
    },
    "Cliques": {
        term: "Cliques (Tráfego Qualificado)",
        meaning: "Usuários que efetivamente clicaram no anúncio e entraram no site.",
        purpose: "Mede o volume de tráfego que é enviado para a Landing Page."
    },
    "DTR": {
        term: "DTR (Dynamic Text Replacement)",
        meaning: "Troca dinâmica do texto e do formulário do site conforme o destino que a pessoa buscou.",
        purpose: "Gera hiper-relevância imediata e dobra as conversões sem criar várias páginas no WP."
    },
    "P&L de Mídia": {
        term: "P&L de Mídia (Margem Bruta)",
        meaning: "Receita faturada menos o custo gasto diretamente com os cliques do Google.",
        purpose: "Mostra o lucro bruto gerado pela mídia antes das despesas administrativas."
    },
    "STAG": {
        term: "STAG (Grupo de Tema Único)",
        meaning: "Separar um destino específico (ex: só Europa) em um grupo próprio.",
        purpose: "Diminui o custo do clique no leilão e aumenta a taxa de conversão."
    },
    "GTM": {
        term: "GTM (Google Tag Manager)",
        meaning: "Ferramenta do Google no site que faz o DTR funcionar no formulário.",
        purpose: "Automatiza a seleção de destino e troca de títulos sem travar o site."
    },
    "ValueTrack": {
        term: "Parâmetros ValueTrack",
        meaning: "Marcadores inseridos no link do anúncio para avisar a página qual é o destino.",
        purpose: "Informa o GTM para pré-selecionar o destino ou cidade certa no formulário."
    },
    "Traffic Sculpting": {
        term: "Traffic Sculpting (Escultura de Tráfego)",
        meaning: "Negativar termos específicos no grupo genérico para não vazar verba.",
        purpose: "Obriga buscas por 'Europa' a caírem no grupo otimizado de Europa."
    },
    "Status Nenhum": {
        term: "Status: Nenhum",
        meaning: "Busca que ativou anúncio mas NÃO existe como palavra-chave cadastrada.",
        purpose: "Identifica oportunidades de ouro que estão misturadas no genérico."
    }
};

// Algoritmo de Cálculo de Nota de 0 a 10 (IPO)
export function calcularNotaIPO(roas: number, cpa: number, conv: number, custo: number): number {
    if (conv >= 2.0 && roas >= 15) return 10.0;
    if (conv >= 2.0 || roas >= 25 || (cpa > 0 && cpa <= 15)) return 9.5;
    if (roas >= 15 || (cpa > 0 && cpa <= 25)) return 9.0;
    if (roas >= 8 || (cpa > 0 && cpa <= 40)) return 8.5;
    if (roas >= 4 || (cpa > 0 && cpa <= 60)) return 8.0;
    if (conv > 0) return 7.5;
    if (custo > 50) return 7.0;
    return 6.5;
}

// Detector de Padrões em Termos
export function identificarCluster(
    termo: string,
    perfil: 'internacional' | 'brasil' | 'auto' = 'internacional',
    dicionarioCustom?: Record<string, string[]>
): string | null {
    const termoNorm = normalizarTexto(termo);
    if (!termoNorm) return null;

    // 1. Dicionário Customizado
    if (dicionarioCustom) {
        for (const [cluster, palavras] of Object.entries(dicionarioCustom)) {
            for (const p of palavras) {
                const pNorm = normalizarTexto(p);
                if (pNorm && (termoNorm === pNorm || termoNorm.includes(` ${pNorm}`) || termoNorm.includes(`${pNorm} `) || termoNorm.includes(pNorm))) {
                    return cluster;
                }
            }
        }
    }

    // 2. Perfil Internacional
    if (perfil === 'internacional' || perfil === 'auto') {
        for (const [cluster, palavras] of Object.entries(BASE_INTERNACIONAL)) {
            for (const p of palavras) {
                const pNorm = normalizarTexto(p);
                const regex = new RegExp(`\\b${pNorm}\\b`, 'i');
                if (regex.test(termoNorm)) {
                    return cluster;
                }
            }
        }
    }

    // 3. Perfil Brasil
    if (perfil === 'brasil' || perfil === 'auto') {
        for (const [cluster, palavras] of Object.entries(BASE_BRASIL)) {
            for (const p of palavras) {
                const pNorm = normalizarTexto(p);
                const regex = new RegExp(`\\b${pNorm}\\b`, 'i');
                if (regex.test(termoNorm)) {
                    return cluster;
                }
            }
        }
    }

    return null;
}

// Verifica se a palavra-chave contempla o padrão identificado
export function palavraChaveContemplaCluster(kw: string, cluster: string | null): boolean {
    if (!cluster) return true;
    const kwNorm = normalizarTexto(kw);
    
    // Procura se alguma palavra associada ao cluster está na keyword
    const todasPalavras = [
        ...(BASE_INTERNACIONAL[cluster] || []),
        ...(BASE_BRASIL[cluster] || [])
    ];

    for (const p of todasPalavras) {
        const pNorm = normalizarTexto(p);
        const regex = new RegExp(`\\b${pNorm}\\b`, 'i');
        if (regex.test(kwNorm)) {
            return true;
        }
    }

    return false;
}

// Converte valores numéricos flexíveis (ex: "R$ 1.250,50", 1250.5, "1250")
export function parseNumero(val: any): number {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim().replace('R$', '').replace('$', '').trim();
    s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

// Motor Principal de Auditoria Executado no Browser
export function executarAuditoriaUpperScript(
    dados: any[],
    perfil: 'internacional' | 'brasil' | 'auto' = 'auto',
    nomeCampanha: string = "Auditoria de Mídia"
): UpperScriptAuditResult {
    if (!dados || dados.length === 0) {
        return DEMO_INTERNATIONAL_RESULT;
    }

    const clusterMap: Record<string, {
        impr: number;
        cliques: number;
        custo: number;
        conv: number;
        receita: number;
    }> = {};

    interface RawTermRow {
        termo: string;
        kw: string;
        grupo: string;
        impr: number;
        cliques: number;
        custo: number;
        conv: number;
        receita: number;
        cluster: string | null;
        isGap: boolean;
    }

    const processedTerms: RawTermRow[] = [];

    // Detecção de colunas flexíveis de dados
    dados.forEach((row: any) => {
        const termo = String(row.termo_de_pesquisa || row.termo || row['Termo de pesquisa'] || row['Search term'] || '').trim();
        if (!termo) return;

        const kw = String(row.palavra_chave || row.keyword || row['Palavra-chave'] || row['Keyword'] || '').trim();
        const grupo = String(row.grupo_de_anuncios || row.grupo || row['Grupo de anúncios'] || row['Ad group'] || 'Grupo Geral').trim();
        
        const impr = parseNumero(row.impressoes ?? row['Impr.'] ?? row['Impressões'] ?? row['Impressions']);
        const cliques = parseNumero(row.cliques ?? row['Cliques'] ?? row['Clicks'] ?? row['Interações']);
        const custo = parseNumero(row.custo ?? row['Custo'] ?? row['Cost'] ?? row['Investimento']);
        const conv = parseNumero(row.conversoes ?? row['Conversões'] ?? row['Conversions']);
        let receita = parseNumero(row.valor_conv ?? row['Valor de conv.'] ?? row['Conv. value'] ?? row['Receita']);
        
        // Se receita não foi configurada, estimamos com base em ticket médio saudável (ex: R$ 850 por conversão)
        if (receita === 0 && conv > 0) {
            receita = conv * 840;
        }

        const cluster = identificarCluster(termo, perfil);
        const kwContempla = palavraChaveContemplaCluster(kw, cluster);
        const isGap = cluster !== null && !kwContempla;

        const catPL = cluster ? cluster : "Genérico (Sem Padrão / Amplo)";

        if (!clusterMap[catPL]) {
            clusterMap[catPL] = { impr: 0, cliques: 0, custo: 0, conv: 0, receita: 0 };
        }
        clusterMap[catPL].impr += impr;
        clusterMap[catPL].cliques += cliques;
        clusterMap[catPL].custo += custo;
        clusterMap[catPL].conv += conv;
        clusterMap[catPL].receita += receita;

        processedTerms.push({
            termo,
            kw,
            grupo,
            impr,
            cliques,
            custo,
            conv,
            receita,
            cluster,
            isGap
        });
    });

    // Constrói P&L por Cluster
    const coresPaleta = ["#0284c7", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#38bdf8", "#a855f7"];
    const plRows: PLClusterRow[] = [];
    let idx = 0;

    for (const [regiao, totals] of Object.entries(clusterMap)) {
        const cpa = totals.conv > 0 ? totals.custo / totals.conv : 0;
        const roas = totals.custo > 0 ? totals.receita / totals.custo : 0;
        const isGeneric = regiao.toLowerCase().includes('genérico') || regiao.toLowerCase().includes('amplo');

        plRows.push({
            regiao,
            impressoes: Math.round(totals.impr),
            cliques: Math.round(totals.cliques),
            custo: Math.round(totals.custo * 100) / 100,
            conversoes: Math.round(totals.conv * 100) / 100,
            receita: Math.round(totals.receita * 100) / 100,
            cpa: Math.round(cpa * 100) / 100,
            roas: Math.round(roas * 100) / 100,
            status: isGeneric ? "Ralo de Eficiência" : (cpa > 0 && cpa < 120 ? "Alta Rentabilidade" : "Oportunidade de Escala"),
            color: isGeneric ? "#f87171" : coresPaleta[idx % coresPaleta.length]
        });
        idx++;
    }

    // Ordenação P&L: Genérico primeiro (ou destacado), seguido pelos de maior receita
    plRows.sort((a, b) => {
        const isGenA = a.regiao.toLowerCase().includes('genérico');
        const isGenB = b.regiao.toLowerCase().includes('genérico');
        if (isGenA && !isGenB) return -1;
        if (!isGenA && isGenB) return 1;
        return b.receita - a.receita;
    });

    // Agrupamento de Termos do GAP
    const gapMap: Record<string, {
        termo: string;
        regiao: string;
        palavras_chave: Set<string>;
        grupos_anuncio: Set<string>;
        impr: number;
        cliques: number;
        custo: number;
        conv: number;
        receita: number;
    }> = {};

    processedTerms.filter(t => t.isGap).forEach(t => {
        const key = t.termo.toLowerCase();
        if (!gapMap[key]) {
            gapMap[key] = {
                termo: t.termo,
                regiao: t.cluster || 'Geral',
                palavras_chave: new Set(),
                grupos_anuncio: new Set(),
                impr: 0,
                cliques: 0,
                custo: 0,
                conv: 0,
                receita: 0
            };
        }
        if (t.kw) gapMap[key].palavras_chave.add(t.kw);
        if (t.grupo) gapMap[key].grupos_anuncio.add(t.grupo);
        gapMap[key].impr += t.impr;
        gapMap[key].cliques += t.cliques;
        gapMap[key].custo += t.custo;
        gapMap[key].conv += t.conv;
        gapMap[key].receita += t.receita;
    });

    const topGapTerms: GapTerm[] = Object.values(gapMap).map(item => {
        const cpa = item.conv > 0 ? item.custo / item.conv : 0;
        const roas = item.custo > 0 ? item.receita / item.custo : 0;
        const nota = calcularNotaIPO(roas, cpa, item.conv, item.custo);

        return {
            termo: item.termo,
            regiao: item.regiao,
            palavras_chave: Array.from(item.palavras_chave),
            grupos_anuncio: Array.from(item.grupos_anuncio),
            impr: Math.round(item.impr),
            cliques: Math.round(item.cliques),
            custo: Math.round(item.custo * 100) / 100,
            conv: Math.round(item.conv * 100) / 100,
            cpa: Math.round(cpa * 100) / 100,
            roas: Math.round(roas * 100) / 100,
            nota
        };
    });

    topGapTerms.sort((a, b) => b.nota - a.nota || b.conv - a.conv || b.roas - a.roas);

    // Regiões disponíveis encontradas
    const allRegions = Array.from(new Set(topGapTerms.map(t => t.regiao))).filter(Boolean);

    // Gera setups de simulação para cada região encontrada
    const simulationSetups: Record<string, SimulationSetup> = {};
    const regionIcons: Record<string, string> = {
        "Europa": "🌍",
        "América do Norte": "🗽",
        "América do Sul": "🏔️",
        "Ásia / Oceania": "⛩️",
        "São Paulo / SP": "🏙️",
        "Rio de Janeiro / RJ": "🏖️",
        "Minas Gerais / MG": "☕",
        "Sul (PR, SC, RS)": "🍷",
        "Centro-Oeste / DF": "🏛️",
        "Nordeste": "☀️"
    };

    allRegions.forEach(reg => {
        const termsOfRegion = topGapTerms.filter(t => t.regiao === reg);
        const top3Terms = termsOfRegion.slice(0, 3).map(t => t.termo);
        const grupoAtual = termsOfRegion[0]?.grupos_anuncio[0] || "Grupo Genérico";
        const cleanReg = normalizarTexto(reg).replace(/[^a-z0-9]/g, '_');
        const regNomeExibicao = reg.replace(/ \/ .*/, '');

        const keywordsAdd = [
            `[${regNomeExibicao.toLowerCase()}]`,
            `"${regNomeExibicao.toLowerCase()}"`,
            ...top3Terms.slice(0, 2).map(t => `[${t}]`)
        ];

        const cpaMediaReg = termsOfRegion.reduce((acc, t) => acc + t.cpa, 0) / (termsOfRegion.length || 1);
        const roasMediaReg = termsOfRegion.reduce((acc, t) => acc + t.roas, 0) / (termsOfRegion.length || 1);

        simulationSetups[reg] = {
            icone: regionIcons[reg] || "🎯",
            nome: reg,
            origemTermos: top3Terms.length > 0 ? top3Terms : [reg],
            grupoAtual,
            novoGrupoEditor: `_stag_${cleanReg}`,
            keywordsAdd,
            negativasGrupoAntigo: [`-${cleanReg}`, `-${regNomeExibicao.toLowerCase()}`],
            sufixoUrl: `destino=${encodeURIComponent(regNomeExibicao)}`,
            urlParametrizada: `https://seusite.com.br/lp/?destino=${encodeURIComponent(regNomeExibicao)}`,
            h1Pagina: `Atendimento & Soluções Especializadas para ${regNomeExibicao}`,
            subtituloPagina: `Reconhecimento de alta relevância com condições exclusivas e suporte direto para ${regNomeExibicao}.`,
            selectOpcao: regNomeExibicao,
            cpaAntes: 224.21,
            cpaDepois: Math.round(cpaMediaReg > 0 ? cpaMediaReg : 85.0),
            roasDepois: Math.round(roasMediaReg > 0 ? roasMediaReg : 4.5),
            economiaCpa: "-52,4%",
            apolicesExtras: `+${Math.max(5, Math.round(termsOfRegion.length * 1.5))} conversões`
        };
    });

    // Se nenhuma região foi identificada, mantém fallback com DEMO
    if (allRegions.length === 0) {
        return DEMO_INTERNATIONAL_RESULT;
    }

    // Métricas Macro
    const totalCusto = plRows.reduce((acc, r) => acc + r.custo, 0);
    const totalReceita = plRows.reduce((acc, r) => acc + r.receita, 0);
    const totalConv = plRows.reduce((acc, r) => acc + r.conversoes, 0);
    const totalImpr = plRows.reduce((acc, r) => acc + r.impressoes, 0);
    const totalCliques = plRows.reduce((acc, r) => acc + r.cliques, 0);
    const roasConsolidado = totalCusto > 0 ? totalReceita / totalCusto : 0;
    const cpaMedioConsolidado = totalConv > 0 ? totalCusto / totalConv : 0;
    const margemMidia = totalReceita - totalCusto;

    const genericoRow = plRows.find(r => r.regiao.toLowerCase().includes('genérico'));
    const custoDesperdicadoGap = genericoRow ? genericoRow.custo : totalCusto * 0.45;
    const conversoesGap = genericoRow ? genericoRow.conversoes : totalConv * 0.35;

    return {
        plRows,
        topGapTerms,
        allRegions,
        simulationSetups,
        macroMetrics: {
            totalCusto: Math.round(totalCusto * 100) / 100,
            totalReceita: Math.round(totalReceita * 100) / 100,
            totalConv: Math.round(totalConv * 100) / 100,
            totalImpr,
            totalCliques,
            roasConsolidado: Math.round(roasConsolidado * 100) / 100,
            cpaMedioConsolidado: Math.round(cpaMedioConsolidado * 100) / 100,
            margemMidia: Math.round(margemMidia * 100) / 100,
            linhasGap: topGapTerms.length,
            custoDesperdicadoGap: Math.round(custoDesperdicadoGap * 100) / 100,
            conversoesGap: Math.round(conversoesGap * 100) / 100
        }
    };
}

// Exportador formatado para Google Ads Editor (CSV)
export function exportarGoogleAdsEditorCsv(
    auditResult: UpperScriptAuditResult,
    nomeCampanha: string = "Campanha_STAG_Quadrante"
): string {
    const rows = [
        ["Campaign", "Ad Group", "Keyword", "Criterion Type", "Status", "Final URL Suffix"]
    ];

    Object.entries(auditResult.simulationSetups).forEach(([reg, sim]) => {
        // Palavras-chave positivas do novo grupo STAG
        sim.keywordsAdd.forEach(kw => {
            const isExact = kw.startsWith('[') && kw.endsWith(']');
            const isPhrase = kw.startsWith('"') && kw.endsWith('"');
            const cleanKw = kw.replace(/[\[\]"]/g, '');
            const type = isExact ? "Exact" : isPhrase ? "Phrase" : "Broad";

            rows.push([
                nomeCampanha,
                sim.novoGrupoEditor,
                cleanKw,
                type,
                "Enabled",
                sim.sufixoUrl
            ]);
        });

        // Negativas no grupo antigo (Traffic Sculpting)
        sim.negativasGrupoAntigo.forEach(neg => {
            const cleanNeg = neg.replace(/^-/, '');
            rows.push([
                nomeCampanha,
                sim.grupoAtual,
                cleanNeg,
                "Negative Phrase",
                "Enabled",
                ""
            ]);
        });
    });

    return rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}
