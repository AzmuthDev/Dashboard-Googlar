import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
    ZoomIn, 
    ZoomOut, 
    RotateCcw, 
    Maximize2, 
    Minimize2, 
    Download, 
    Search, 
    Sun,
    Moon,
    Flame
} from 'lucide-react';
import type { PLClusterRow } from '../lib/upperScriptEngine';

export interface SpokeQueryItem {
    query: string;
    cluster: string;
    volume: number;
    cpc: number;
    conversoes?: number;
    cpa?: number;
    roas?: number;
    colorCategory?: string;
}

interface AnswerThePublicRadialProps {
    plRows: PLClusterRow[];
    centralTheme?: string;
    height?: number;
    onNodeSelect?: (item: SpokeQueryItem) => void;
}

type TabCategory = 'clusters' | 'perguntas' | 'destinos' | 'gap' | 'alfabetica';

export const AnswerThePublicRadial: React.FC<AnswerThePublicRadialProps> = ({
    plRows,
    centralTheme = "o que é seo",
    height = 840,
    onNodeSelect
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    // Estados de controle
    const [activeTab, setActiveTab] = useState<TabCategory>('clusters');
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false); // Padrão claro idêntico ao vídeo
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [activeHoverQuery, setActiveHoverQuery] = useState<SpokeQueryItem | null>(null);
    const [hudTooltip, setHudTooltip] = useState<{
        item: SpokeQueryItem;
        x: number;
        y: number;
    } | null>(null);

    // Derivar os itens de busca com base nos dados do P&L (ou fallback rico do case "o que é seo")
    const categoryDatasets = useMemo<Record<TabCategory, SpokeQueryItem[]>>(() => {
        // Se houver plRows com subClusters ou termos reais
        if (plRows && plRows.length > 0) {
            const allItems: SpokeQueryItem[] = [];

            plRows.forEach(row => {
                const subClusters = row.subClusters || [];
                if (subClusters.length > 0) {
                    subClusters.forEach(sub => {
                        allItems.push({
                            query: sub.ancora || sub.label,
                            cluster: row.regiao,
                            volume: sub.impressoes || 1000,
                            cpc: sub.cliques > 0 ? (sub.custo / sub.cliques) : 0.25,
                            conversoes: sub.conversoes,
                            cpa: sub.cpa,
                            roas: sub.roas,
                            colorCategory: row.color
                        });

                        if (sub.exemplosTermos) {
                            sub.exemplosTermos.forEach((t, i) => {
                                allItems.push({
                                    query: t,
                                    cluster: row.regiao,
                                    volume: Math.round((sub.impressoes || 500) * 0.4 / (i + 1)),
                                    cpc: sub.cliques > 0 ? (sub.custo / sub.cliques) : 0.25,
                                    conversoes: Math.round((sub.conversoes || 1) * 0.4 / (i + 1)),
                                    cpa: sub.cpa,
                                    roas: sub.roas,
                                    colorCategory: row.color
                                });
                            });
                        }
                    });
                } else {
                    allItems.push({
                        query: `Buscas em ${row.regiao}`,
                        cluster: row.regiao,
                        volume: row.impressoes,
                        cpc: row.cliques > 0 ? (row.custo / row.cliques) : 0.30,
                        conversoes: row.conversoes,
                        cpa: row.cpa,
                        roas: row.roas,
                        colorCategory: row.color
                    });
                }
            });

            // Limitar a ~36 a 48 itens para o visual exato da roda do vídeo
            const clustersItems = allItems.slice(0, 36);

            // Perguntas (o que, como, onde, quanto)
            const perguntasItems = allItems
                .filter(i => /^(o que|como|onde|quanto|por que|qual|quando)/i.test(i.query))
                .concat(allItems.slice(0, 20))
                .slice(0, 36);

            // Destinos / Preposições
            const destinosItems = allItems
                .filter(i => /(para|em|com|de|na|no)/i.test(i.query) || i.cluster.toLowerCase().includes('brasil') || i.cluster.toLowerCase().includes('internacional'))
                .concat(allItems.slice(0, 16))
                .slice(0, 26);

            // Ordem Alfabética
            const alfabeticaItems = [...allItems].sort((a, b) => a.query.localeCompare(b.query)).slice(0, 42);

            // Termos do GAP
            const gapItems = allItems
                .filter(i => (i.cpa || 0) > 35 || (i.roas || 0) < 3.0)
                .concat(allItems.slice(0, 18))
                .slice(0, 24);

            return {
                clusters: clustersItems.length > 0 ? clustersItems : allItems.slice(0, 30),
                perguntas: perguntasItems.length > 0 ? perguntasItems : allItems.slice(0, 30),
                destinos: destinosItems.length > 0 ? destinosItems : allItems.slice(0, 22),
                gap: gapItems.length > 0 ? gapItems : allItems.slice(0, 20),
                alfabetica: alfabeticaItems.length > 0 ? alfabeticaItems : allItems.slice(0, 36)
            };
        }

        // Fallback Fiel ao Vídeo do YouTube ("o que é seo")
        const seoItems: SpokeQueryItem[] = [
            { query: "seo o que é como funciona", cluster: "Conceito", volume: 18200, cpc: 0.31 },
            { query: "seo o que é isso", cluster: "Conceito", volume: 14500, cpc: 0.20 },
            { query: "seo o que significa", cluster: "Conceito", volume: 22400, cpc: 0.29 },
            { query: "seo o que é", cluster: "Conceito", volume: 26800, cpc: 0.50 },
            { query: "o que é seo", cluster: "Principal", volume: 32000, cpc: 0.27 },
            { query: "o que é seo youtube", cluster: "Canais", volume: 9800, cpc: 0.15 },
            { query: "o que é seo no marketing", cluster: "Marketing", volume: 12400, cpc: 0.35 },
            { query: "o que é seo e sem", cluster: "Comparação", volume: 16100, cpc: 0.42 },
            { query: "o que é seo no instagram", cluster: "Redes", volume: 11200, cpc: 0.18 },
            { query: "o que é seo e como aplicar", cluster: "Aplicação", volume: 15400, cpc: 0.38 },
            { query: "o que é seo copywriter", cluster: "Profissão", volume: 7200, cpc: 0.22 },
            { query: "o que é seo tecnico", cluster: "Técnico", volume: 8900, cpc: 0.45 },
            { query: "o que é seo on page e off page", cluster: "Técnico", volume: 13800, cpc: 0.40 },
            { query: "o que é seo de imagem", cluster: "Imagens", volume: 6400, cpc: 0.16 },
            { query: "o que é seo local", cluster: "Local", volume: 9100, cpc: 0.33 },
            { query: "como fazer seo no google", cluster: "Como", volume: 21500, cpc: 0.48 },
            { query: "como funciona seo do youtube", cluster: "Como", volume: 8700, cpc: 0.19 },
            { query: "como aprender seo do zero", cluster: "Como", volume: 14200, cpc: 0.30 },
            { query: "como usar seo no site", cluster: "Como", volume: 10500, cpc: 0.36 },
            { query: "como melhorar o seo do site", cluster: "Como", volume: 17800, cpc: 0.52 },
            { query: "onde estudar seo gratis", cluster: "Onde", volume: 6800, cpc: 0.14 },
            { query: "onde colocar palavras chaves seo", cluster: "Onde", volume: 11900, cpc: 0.37 },
            { query: "onde contratar especialista seo", cluster: "Onde", volume: 5900, cpc: 0.85 },
            { query: "por que o seo é importante", cluster: "Por que", volume: 8400, cpc: 0.25 },
            { query: "por que investir em seo", cluster: "Por que", volume: 7600, cpc: 0.60 },
            { query: "qual o objetivo do seo", cluster: "Qual", volume: 13200, cpc: 0.32 },
            { query: "qual a diferenca seo e trafego pago", cluster: "Qual", volume: 16900, cpc: 0.55 },
            { query: "qual melhor ferramenta de seo", cluster: "Qual", volume: 12100, cpc: 0.44 },
            { query: "quando contratar consultoria seo", cluster: "Quando", volume: 5200, cpc: 0.75 },
            { query: "quando o seo da resultado", cluster: "Quando", volume: 9900, cpc: 0.34 },
            { query: "quanto custa servico de seo", cluster: "Preço", volume: 14700, cpc: 0.90 },
            { query: "quanto tempo demora resultado", cluster: "Preço", volume: 11400, cpc: 0.39 },
            { query: "quem faz o trabalho de seo", cluster: "Quem", volume: 6100, cpc: 0.26 },
            { query: "quem é o profissional seo", cluster: "Quem", volume: 5500, cpc: 0.24 },
            { query: "sao tecnicas de seo white hat", cluster: "Técnicas", volume: 4800, cpc: 0.21 },
            { query: "seo para pequenas empresas", cluster: "Empresas", volume: 10800, cpc: 0.33 }
        ];

        return {
            clusters: seoItems,
            perguntas: seoItems,
            destinos: seoItems.slice(0, 22),
            gap: seoItems.slice(0, 15),
            alfabetica: [...seoItems].sort((a, b) => a.query.localeCompare(b.query))
        };
    }, [plRows]);

    const activeList = useMemo(() => {
        const list = categoryDatasets[activeTab] || categoryDatasets.clusters;
        if (!searchTerm.trim()) return list;
        return list.filter(item => item.query.toLowerCase().includes(searchTerm.toLowerCase().trim()));
    }, [categoryDatasets, activeTab, searchTerm]);

    // RENDERIZADOR D3.JS RADIAL WHEEL EXATO DO VÍDEO
    useEffect(() => {
        if (!svgRef.current || activeList.length === 0) return;

        const container = containerRef.current;
        const width = 1100;
        const currentHeight = isFullscreen ? window.innerHeight - 140 : height;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        svg
            .attr('viewBox', [-width / 2, -currentHeight / 2, width, currentHeight])
            .attr('style', `max-width: 100%; height: auto; font-family: 'Inter', system-ui, sans-serif;`);

        // Camada principal com Zoom e Pan
        const g = svg.append('g').attr('class', 'wheel-zoom-group');

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.45, 3.2])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        zoomBehaviorRef.current = zoom;
        svg.call(zoom);

        // Raios da geometria idêntica ao vídeo
        const rInner = 68;          // Círculo branco interno
        const rDonut = 118;         // Anel laranja externo
        const rDots = 195;          // Anel concêntrico dos marcadores de calor
        const rText = 212;          // Início do texto radial
        const rOuterSpoke = 450;    // Final do raio onde fica o número

        const count = activeList.length;
        const volumes = activeList.map(d => d.volume);
        const minVol = d3.min(volumes) || 1000;
        const maxVol = d3.max(volumes) || 30000;

        // Escala de cor exata do vídeo:
        // "EU PESQUISEI 'O QUE É SEO' E ONDE TEM O LARANJA ESCURO..."
        const getHeatColor = (vol: number) => {
            const norm = (vol - minVol) / (maxVol - minVol || 1);
            if (norm > 0.65) return '#e04f16'; // Laranja escuro / forte (alta demanda)
            if (norm > 0.35) return '#f97316'; // Laranja vivo
            if (norm > 0.15) return '#fdba74'; // Pêssego / Laranja claro
            return '#cbd5e1';                  // Cinza / Baixo volume
        };

        const defs = g.append('defs');

        // Caminhos de arco para o texto curvo no anel laranja
        defs.append('path')
            .attr('id', 'top-donut-arc')
            .attr('d', d3.arc()({
                innerRadius: 84,
                outerRadius: 84,
                startAngle: -Math.PI * 0.42,
                endAngle: Math.PI * 0.42
            }) as string);

        defs.append('path')
            .attr('id', 'bottom-donut-arc')
            .attr('d', d3.arc()({
                innerRadius: 94,
                outerRadius: 94,
                startAngle: Math.PI * 0.62,
                endAngle: Math.PI * 1.38
            }) as string);

        // 1. TÍTULO E CONTADOR SUPERIOR "30/36 Perguntas"
        const topHeaderGroup = g.append('g')
            .attr('transform', `translate(0, -${rDonut + 38})`)
            .attr('text-anchor', 'middle');

        topHeaderGroup.append('text')
            .attr('font-size', '28px')
            .attr('font-weight', '800')
            .attr('fill', isDarkMode ? '#ffffff' : '#0f172a')
            .text(`${count}/${categoryDatasets[activeTab]?.length || count}`);

        topHeaderGroup.append('text')
            .attr('dy', '18px')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .attr('letter-spacing', '0.05em')
            .attr('fill', '#64748b')
            .text(activeTab.toUpperCase());

        // 2. LINHAS RADIAIS (SPOKES EM 360°)
        const spokesGroup = g.append('g').attr('class', 'spokes-group');
        const dotsGroup = g.append('g').attr('class', 'dots-group');
        const textGroup = g.append('g').attr('class', 'text-group');

        activeList.forEach((item, i) => {
            // Ângulo uniforme em radianos
            const angle = (2 * Math.PI / count) * i - Math.PI / 2;
            const angleDeg = (angle * 180 / Math.PI);
            const isLeftHemisphere = angleDeg > 90 || angleDeg < -90;
            const heatColor = getHeatColor(item.volume);

            // Linha radial suave (spoke ray)
            const spokeLine = spokesGroup.append('line')
                .attr('x1', Math.cos(angle) * (rDonut + 4))
                .attr('y1', Math.sin(angle) * (rDonut + 4))
                .attr('x2', Math.cos(angle) * (rOuterSpoke + 25))
                .attr('y2', Math.sin(angle) * (rOuterSpoke + 25))
                .attr('stroke', isDarkMode ? '#1e293b' : '#e2e8f0')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '2, 3');

            // Marcador de Calor Concêntrico (Heat Dot)
            const dot = dotsGroup.append('circle')
                .attr('cx', Math.cos(angle) * rDots)
                .attr('cy', Math.sin(angle) * rDots)
                .attr('r', item.volume > 20000 ? 5.5 : 4.2)
                .attr('fill', heatColor)
                .attr('stroke', isDarkMode ? '#0f172a' : '#ffffff')
                .attr('stroke-width', 1.5)
                .attr('cursor', 'pointer');

            // Rótulo de Texto da Busca Alinhado ao Raio
            const labelGroup = textGroup.append('g')
                .attr('transform', `translate(${Math.cos(angle) * rText}, ${Math.sin(angle) * rText}) rotate(${isLeftHemisphere ? angleDeg + 180 : angleDeg})`)
                .attr('cursor', 'pointer');

            const textEl = labelGroup.append('text')
                .attr('dy', '0.34em')
                .attr('text-anchor', isLeftHemisphere ? 'end' : 'start')
                .attr('fill', isDarkMode ? '#cbd5e1' : '#334155')
                .attr('font-size', '10.5px')
                .attr('font-weight', '500')
                .text(item.query);

            // Métrica externa na ponta do raio (ex: $0.29 ou Volume)
            const metricGroup = textGroup.append('g')
                .attr('transform', `translate(${Math.cos(angle) * (rOuterSpoke + 6)}, ${Math.sin(angle) * (rOuterSpoke + 6)}) rotate(${isLeftHemisphere ? angleDeg + 180 : angleDeg})`);

            metricGroup.append('text')
                .attr('dy', '0.34em')
                .attr('text-anchor', isLeftHemisphere ? 'end' : 'start')
                .attr('fill', '#94a3b8')
                .attr('font-size', '9px')
                .attr('font-weight', '600')
                .text(`$${item.cpc.toFixed(2)}`);

            // Interatividade idêntica ao vídeo
            const handleHover = (event: MouseEvent) => {
                spokeLine
                    .attr('stroke', '#f25b2a')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', 'none');

                dot
                    .attr('r', 7)
                    .attr('stroke', '#f25b2a')
                    .attr('stroke-width', 2);

                textEl
                    .attr('fill', '#f25b2a')
                    .attr('font-weight', '800');

                setActiveHoverQuery(item);

                // Tooltip flutuante
                const [mx, my] = d3.pointer(event, container);
                setHudTooltip({
                    item,
                    x: mx,
                    y: my
                });
            };

            const handleLeave = () => {
                spokeLine
                    .attr('stroke', isDarkMode ? '#1e293b' : '#e2e8f0')
                    .attr('stroke-width', 1)
                    .attr('stroke-dasharray', '2, 3');

                dot
                    .attr('r', item.volume > 20000 ? 5.5 : 4.2)
                    .attr('stroke', isDarkMode ? '#0f172a' : '#ffffff')
                    .attr('stroke-width', 1.5);

                textEl
                    .attr('fill', isDarkMode ? '#cbd5e1' : '#334155')
                    .attr('font-weight', '500');

                setActiveHoverQuery(null);
                setHudTooltip(null);
            };

            dot.on('mouseenter', handleHover).on('mouseleave', handleLeave);
            labelGroup.on('mouseenter', handleHover).on('mouseleave', handleLeave);
            labelGroup.on('click', () => {
                if (onNodeSelect) onNodeSelect(item);
            });
        });

        // 3. ANEL LARANJA (DONUT RING) DO ANSWER THE PUBLIC
        const donutGroup = g.append('g').attr('class', 'donut-hub');

        donutGroup.append('path')
            .attr('d', d3.arc()({
                innerRadius: rInner,
                outerRadius: rDonut,
                startAngle: 0,
                endAngle: 2 * Math.PI
            }) as string)
            .attr('fill', '#f25b2a')
            .attr('stroke', isDarkMode ? '#0f172a' : '#ffffff')
            .attr('stroke-width', 2.5);

        // Texto Curvo Superior no Donut: "Volume de busca" ou valor do hover
        donutGroup.append('text')
            .attr('fill', '#ffffff')
            .attr('font-size', '10px')
            .attr('font-weight', '700')
            .attr('letter-spacing', '0.03em')
            .append('textPath')
            .attr('href', '#top-donut-arc')
            .attr('startOffset', '50%')
            .attr('text-anchor', 'middle')
            .text(activeHoverQuery ? `Volume: ${activeHoverQuery.volume.toLocaleString('pt-BR')}` : 'Volume de busca');

        // Texto Curvo Inferior no Donut: "Custo por clique"
        donutGroup.append('text')
            .attr('fill', '#ffffff')
            .attr('font-size', '10px')
            .attr('font-weight', '700')
            .attr('letter-spacing', '0.03em')
            .append('textPath')
            .attr('href', '#bottom-donut-arc')
            .attr('startOffset', '50%')
            .attr('text-anchor', 'middle')
            .text(activeHoverQuery ? `CPC: $${activeHoverQuery.cpc.toFixed(2)}` : 'Custo por clique: $0.11');

        // 4. CÍRCULO BRANCO CENTRAL COM O TEMA PRINCIPAL
        donutGroup.append('circle')
            .attr('r', rInner)
            .attr('fill', isDarkMode ? '#0f172a' : '#ffffff')
            .attr('stroke', '#f25b2a')
            .attr('stroke-width', 2.2);

        donutGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', isDarkMode ? '#f8fafc' : '#0f172a')
            .attr('font-size', '13px')
            .attr('font-weight', '800')
            .text(() => {
                if (activeHoverQuery) {
                    const q = activeHoverQuery.query;
                    return q.length > 17 ? q.substring(0, 15) + '...' : q;
                }
                const name = centralTheme || (plRows[0]?.regiao || 'o que é seo');
                return name.length > 18 ? name.substring(0, 16) + '...' : name;
            });

    }, [activeList, activeTab, isDarkMode, centralTheme, height, isFullscreen, activeHoverQuery, categoryDatasets, plRows, onNodeSelect]);

    // Controles de Zoom
    const handleZoomIn = () => {
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
    };

    const handleZoomOut = () => {
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.75);
    };

    const handleResetZoom = () => {
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        d3.select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    };

    // Exportar SVG
    const handleExportSVG = () => {
        if (!svgRef.current) return;
        const serializer = new XMLSerializer();
        const source = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(svgRef.current);
        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `answerthepublic_wheel_${activeTab}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div 
            ref={containerRef}
            className={`relative flex flex-col rounded-2xl border transition-all overflow-hidden ${
                isDarkMode 
                    ? 'bg-slate-950 border-slate-800 text-slate-100 shadow-2xl' 
                    : 'bg-white border-slate-200 text-slate-900 shadow-xl'
            } ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}
        >
            {/* CABEÇALHO SUPERIOR FIEL AO VÍDEO DO ANSWER THE PUBLIC */}
            <div className={`flex flex-wrap items-center justify-between gap-3 p-4 border-b ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
                <div className="flex items-center gap-3">
                    <span className="bg-[#f25b2a] text-white font-black text-xs px-2.5 py-1 rounded-md uppercase tracking-wide shadow-sm">
                        AnswerThePublic
                    </span>
                    <div>
                        <h3 className="text-sm font-black flex items-center gap-2">
                            <span>{centralTheme || "o que é seo"}</span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                Search Cloud Wheel
                            </span>
                        </h3>
                        <p className="text-[11px] text-slate-400">
                            Gráfico radial idêntico ao modelo com anel concêntrico de calor (Laranja Escuro = Maior Volume)
                        </p>
                    </div>
                </div>

                {/* Filtro de Busca & Ações */}
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar frase..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`pl-8 pr-3 py-1.5 rounded-lg text-xs transition-all w-36 sm:w-48 outline-none border ${
                                isDarkMode 
                                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-[#f25b2a]' 
                                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#f25b2a]'
                            }`}
                        />
                    </div>

                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        title={isDarkMode ? "Mudar para Modo Claro (Oficial)" : "Mudar para Modo Escuro"}
                        className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 font-semibold transition-all ${
                            isDarkMode 
                                ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700' 
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                        {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{isDarkMode ? "Claro" : "Escuro"}</span>
                    </button>

                    <div className="flex items-center gap-1 border-l pl-2 border-slate-300 dark:border-slate-800">
                        <button
                            onClick={handleZoomIn}
                            title="Aproximar (+)"
                            className="p-1.5 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-[#f25b2a]"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleZoomOut}
                            title="Afastar (-)"
                            className="p-1.5 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-[#f25b2a]"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleResetZoom}
                            title="Centralizar"
                            className="p-1.5 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-[#f25b2a]"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleExportSVG}
                            title="Baixar SVG"
                            className="p-1.5 rounded-lg bg-[#f25b2a] hover:bg-[#d94a1d] text-white border border-[#f25b2a]"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                            className="p-1.5 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ABAS DE CATEGORIA EXATAS DO VÍDEO */}
            <div className={`flex items-center justify-center gap-4 sm:gap-8 px-4 py-2 border-b overflow-x-auto text-xs font-bold uppercase tracking-wider ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
                <button
                    onClick={() => setActiveTab('clusters')}
                    className={`py-1.5 border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'clusters'
                            ? 'text-[#f25b2a] border-[#f25b2a]'
                            : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                >
                    <span>Clusters P&L</span>
                    <span className="text-[10px] opacity-75">[{categoryDatasets.clusters.length}]</span>
                </button>

                <button
                    onClick={() => setActiveTab('perguntas')}
                    className={`py-1.5 border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'perguntas'
                            ? 'text-[#f25b2a] border-[#f25b2a]'
                            : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                >
                    <span>Perguntas</span>
                    <span className="text-[10px] opacity-75">[{categoryDatasets.perguntas.length}]</span>
                </button>

                <button
                    onClick={() => setActiveTab('destinos')}
                    className={`py-1.5 border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'destinos'
                            ? 'text-[#f25b2a] border-[#f25b2a]'
                            : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                >
                    <span>Preposições / Destinos</span>
                    <span className="text-[10px] opacity-75">[{categoryDatasets.destinos.length}]</span>
                </button>

                <button
                    onClick={() => setActiveTab('gap')}
                    className={`py-1.5 border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'gap'
                            ? 'text-[#f25b2a] border-[#f25b2a]'
                            : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                >
                    <span>Termos do GAP</span>
                    <span className="text-[10px] opacity-75">[{categoryDatasets.gap.length}]</span>
                </button>

                <button
                    onClick={() => setActiveTab('alfabetica')}
                    className={`py-1.5 border-b-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'alfabetica'
                            ? 'text-[#f25b2a] border-[#f25b2a]'
                            : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                >
                    <span>Ordem Alfabética</span>
                    <span className="text-[10px] opacity-75">[{categoryDatasets.alfabetica.length}]</span>
                </button>
            </div>

            {/* CANVAS DA RODA ANSWER THE PUBLIC */}
            <div className="relative flex-1 w-full min-h-[620px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden">
                <svg
                    ref={svgRef}
                    className="w-full h-full"
                    style={{ minHeight: isFullscreen ? 'calc(100vh - 140px)' : `${height}px` }}
                />

                {/* LEGENDA DE CALOR EXATA DO VÍDEO */}
                <div className={`absolute bottom-4 left-4 p-3 rounded-xl border text-xs flex flex-col gap-1.5 pointer-events-none shadow-lg backdrop-blur-md ${
                    isDarkMode ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'
                }`}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Flame className="w-3.5 h-3.5 text-[#f25b2a]" />
                        <span>Volume de Busca (Calor):</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-semibold">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#e04f16] shadow-sm" />
                            <span>Laranja Escuro (Alto)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                            <span>Laranja (Médio)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#fdba74]" />
                            <span>Claro</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1]" />
                            <span>Cinza (Cauda)</span>
                        </div>
                    </div>
                </div>

                {/* HUD TOOLTIP FLUTUANTE */}
                {hudTooltip && (
                    <div
                        className={`absolute z-30 pointer-events-none p-3.5 rounded-xl border shadow-2xl text-xs backdrop-blur-md min-w-[220px] transition-all transform -translate-x-1/2 -translate-y-full -mt-3 ${
                            isDarkMode ? 'bg-slate-900/95 border-slate-700 text-white' : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300'
                        }`}
                        style={{
                            left: `${hudTooltip.x}px`,
                            top: `${hudTooltip.y}px`
                        }}
                    >
                        <div className="font-bold text-[#f25b2a] text-xs border-b pb-1.5 mb-2 border-slate-200 dark:border-slate-800">
                            {hudTooltip.item.query}
                        </div>
                        <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Volume:</span>
                                <span className="font-bold">{hudTooltip.item.volume.toLocaleString('pt-BR')} buscas</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Custo por clique (CPC):</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">${hudTooltip.item.cpc.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Cluster:</span>
                                <span className="font-bold text-sky-500">{hudTooltip.item.cluster}</span>
                            </div>
                            {hudTooltip.item.conversoes !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Conversões:</span>
                                    <span className="font-bold text-purple-500">{hudTooltip.item.conversoes}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
