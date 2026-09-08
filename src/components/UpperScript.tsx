import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Sparkles, Upload, Download, RefreshCw, FileSpreadsheet,
    HelpCircle, Layers, CheckCircle, CheckCircle2, ArrowUpDown, ChevronRight,
    Search, Check, Globe, ShieldAlert, TrendingUp, AlertTriangle, X,
    BookOpen, Info, FileText, Loader2, FileUp, FolderOpen, FileCheck,
    ChevronDown, ExternalLink, BarChart3, PieChart, Flame
} from 'lucide-react';
import { message, Modal } from 'antd';
import * as XLSX from 'xlsx';
import {
    DEMO_INTERNATIONAL_RESULT,
    UPPER_GLOSSARY,
    executarAuditoriaUpperScript,
    exportarGoogleAdsEditorCsv,
    type UpperScriptAuditResult,
    type PLClusterRow,
    type SubClusterBreakdown
} from '../lib/upperScriptEngine';
import type { CampaignTerm, Company } from '../types';

// Etapas do pipeline de auditoria visual com feedback em tempo real
const PROCESSING_STAGES = [
    {
        title: "1. Leitura do Arquivo",
        desc: "Lendo e decodificando abas da planilha (.xlsx, .xls ou .csv)"
    },
    {
        title: "2. Higienização & Mapeamento",
        desc: "Normalizando colunas: termos de pesquisa, impressões, cliques, custo e conversões"
    },
    {
        title: "3. Diagnóstico de Demanda (GAP)",
        desc: "Cruzando intenções reais de busca com palavras ativas e detectando desvios"
    },
    {
        title: "4. Balanço P&L & Notas de Prioridade",
        desc: "Calculando ROAS, CPA e notas IPO (0 a 10) por região e cluster geográfico"
    },
    {
        title: "5. Compilação do Painel Executivo",
        desc: "Estruturando STAG, DTR e simulador de escala de verba"
    }
];

interface UpperScriptProps {
    activeCompanyId?: string | null;
    activeCompany?: Company;
    campaignTerms: CampaignTerm[];
    isTermsLoading?: boolean;
    isDarkMode?: boolean;
}

export function UpperScript({
    activeCompanyId,
    activeCompany,
    campaignTerms = [],
    isTermsLoading = false,
    isDarkMode = true
}: UpperScriptProps) {
    // Modo de Dados: 'demo' | 'company' | 'upload'
    const [dataSourceMode, setDataSourceMode] = useState<'demo' | 'company' | 'upload'>('demo');
    const [geoProfile, setGeoProfile] = useState<'internacional' | 'brasil' | 'auto'>('internacional');
    const [uploadedData, setUploadedData] = useState<any[] | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [processingProgress, setProcessingProgress] = useState<number>(0);
    const [processingStepIndex, setProcessingStepIndex] = useState<number>(0);
    const [processingFileMeta, setProcessingFileMeta] = useState<{
        name: string;
        size: string;
        rowCount: number;
        statusText: string;
    } | null>(null);
    const [processingError, setProcessingError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // Abas de visualização (Modelo 1, Modelo 2, Modelo 3)
    const [activeTab, setActiveTab] = useState<'tab1' | 'tab2' | 'tab3'>('tab2');

    // Estado da simulação operacional (Modelo 3)
    const [selectedSimRegion, setSelectedSimRegion] = useState<string>('Europa');

    // Estado do simulador de orçamento (Slider de 10% a 70%)
    const [migrationPercent, setMigrationPercent] = useState<number>(30);

    // Estado de filtros de multi-seleção de regiões (Modelo 2)
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

    // Estado de ordenação das colunas (Modelo 2)
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'nota',
        direction: 'desc'
    });

    // Estado e Refs para a Barra de Rolagem Superior e Arraste da Tabela (Modelo 2)
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);
    const [tableScrollWidth, setTableScrollWidth] = useState<number>(0);
    const [isDraggingTable, setIsDraggingTable] = useState<boolean>(false);
    const isMouseDownRef = useRef<boolean>(false);
    const isDraggingRef = useRef<boolean>(false);
    const startXRef = useRef<number>(0);
    const startScrollLeftRef = useRef<number>(0);
    const justDraggedRef = useRef<boolean>(false);
    const isSyncingScrollRef = useRef<boolean>(false);

    // Modal do Glossário Geral
    const [showGlossaryModal, setShowGlossaryModal] = useState(false);

    // Modal do Manual de Instruções / Como Usar
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualTab, setManualTab] = useState<'pilares' | 'gap' | 'passo-a-passo' | 'modelos'>('pilares');

    // Tooltip flutuante interativo
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        termKey: string | null;
        x: number;
        y: number;
        placement: 'top' | 'bottom';
    }>({
        visible: false,
        termKey: null,
        x: 0,
        y: 0,
        placement: 'top'
    });

    // Estado de expansão das linhas do Modelo 1 (Drill-Down / Acordeão)
    const [expandedClusterRows, setExpandedClusterRows] = useState<Record<string, boolean>>({
        "Europa": true // Europa vem expandido para evidenciar a decomposição das âncoras
    });

    // Tooltip interativo rico para Nuvem de Chips e Barra de Proporção (Stacked Bar)
    const [clusterTooltip, setClusterTooltip] = useState<{
        visible: boolean;
        clusterRow: PLClusterRow | null;
        x: number;
        y: number;
        placement: 'top' | 'bottom';
    }>({
        visible: false,
        clusterRow: null,
        x: 0,
        y: 0,
        placement: 'top'
    });

    const toggleClusterRow = (regiao: string) => {
        setExpandedClusterRows(prev => ({
            ...prev,
            [regiao]: !prev[regiao]
        }));
    };

    const showClusterTooltip = (row: PLClusterRow, targetEl: HTMLElement) => {
        if (!targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const placement = rect.top > 250 ? 'top' : 'bottom';
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const rawX = rect.left + rect.width / 2;
        const clampedX = Math.max(220, Math.min(windowWidth - 220, rawX));

        setClusterTooltip({
            visible: true,
            clusterRow: row,
            x: clampedX,
            y: placement === 'top' ? rect.top - 8 : rect.bottom + 8,
            placement
        });
    };

    const hideClusterTooltip = () => {
        setClusterTooltip(prev => ({ ...prev, visible: false }));
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Executa auditoria baseada na fonte selecionada
    const auditResult: UpperScriptAuditResult = useMemo(() => {
        if (dataSourceMode === 'demo') {
            return DEMO_INTERNATIONAL_RESULT;
        }

        if (dataSourceMode === 'upload' && uploadedData && uploadedData.length > 0) {
            return executarAuditoriaUpperScript(uploadedData, geoProfile, uploadedFileName || 'Relatório Importado');
        }

        if (dataSourceMode === 'company' && campaignTerms && campaignTerms.length > 0) {
            return executarAuditoriaUpperScript(campaignTerms, geoProfile, activeCompany?.name || 'Empresa Ativa');
        }

        return DEMO_INTERNATIONAL_RESULT;
    }, [dataSourceMode, uploadedData, uploadedFileName, campaignTerms, geoProfile, activeCompany]);

    // Atualiza regiões selecionadas ao trocar o resultado da auditoria
    useEffect(() => {
        if (auditResult.allRegions.length > 0) {
            setSelectedRegions(auditResult.allRegions);
            if (!auditResult.allRegions.includes(selectedSimRegion)) {
                setSelectedSimRegion(auditResult.allRegions[0]);
            }
        }
    }, [auditResult]);

    // Timer e Handlers do Tooltip Flutuante Interativo
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const clearTooltipTimer = () => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
        }
    };

    const showTooltip = (termKey: string, targetEl: HTMLElement) => {
        if (!targetEl) return;
        clearTooltipTimer();

        const rect = targetEl.getBoundingClientRect();
        const placement = rect.top > 160 ? 'top' : 'bottom';
        
        // Garante que o tooltip fique bem centralizado e dentro dos limites seguros da tela
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const rawX = rect.left + rect.width / 2;
        const clampedX = Math.max(160, Math.min(windowWidth - 160, rawX));

        setTooltip({
            visible: true,
            termKey,
            x: clampedX,
            y: placement === 'top' ? rect.top - 4 : rect.bottom + 4,
            placement
        });
    };

    const hideTooltip = (delayMs: number = 220) => {
        clearTooltipTimer();
        tooltipTimeoutRef.current = setTimeout(() => {
            setTooltip(prev => ({ ...prev, visible: false, termKey: null }));
        }, delayMs);
    };

    const immediateHideTooltip = () => {
        clearTooltipTimer();
        setTooltip(prev => ({ ...prev, visible: false, termKey: null }));
    };

    // Fecha o tooltip imediatamente caso o usuário role a tela, redimensione a janela ou aperte ESC
    useEffect(() => {
        if (!tooltip.visible) return;

        const handleDismiss = () => {
            immediateHideTooltip();
        };

        window.addEventListener('scroll', handleDismiss, { passive: true, capture: true });
        window.addEventListener('resize', handleDismiss, { passive: true });
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleDismiss();
        };
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('scroll', handleDismiss, { capture: true });
            window.removeEventListener('resize', handleDismiss);
            document.removeEventListener('keydown', handleKeyDown);
            clearTooltipTimer();
        };
    }, [tooltip.visible]);

    // Disparo de upload vindo do botão do cabeçalho superior (Header.tsx)
    useEffect(() => {
        const handleTrigger = () => {
            fileInputRef.current?.click();
        };
        window.addEventListener('upperscript_trigger_upload', handleTrigger);
        return () => window.removeEventListener('upperscript_trigger_upload', handleTrigger);
    }, []);

    // Alternância de Multi-Seleção de Regiões
    const toggleRegion = (region: string) => {
        const allAvailable = auditResult.allRegions;
        if (region === 'Todos') {
            if (selectedRegions.length === allAvailable.length) {
                setSelectedRegions([]);
            } else {
                setSelectedRegions([...allAvailable]);
            }
            return;
        }

        if (selectedRegions.includes(region)) {
            setSelectedRegions(selectedRegions.filter(r => r !== region));
        } else {
            setSelectedRegions([...selectedRegions, region]);
        }
    };

    // Ordenação das Colunas da Tabela do Modelo 2
    const handleSort = (key: string) => {
        // Ignora o clique se acabou de realizar um arrasto de tela
        if (justDraggedRef.current) return;
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    // Termos Filtrados e Ordenados
    const filteredTerms = useMemo(() => {
        let list = auditResult.topGapTerms.filter(t => selectedRegions.includes(t.regiao));

        return [...list].sort((a: any, b: any) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (Array.isArray(aVal)) aVal = aVal.join(", ");
            if (Array.isArray(bVal)) bVal = bVal.join(", ");

            if (typeof aVal === 'string') {
                return sortConfig.direction === 'asc'
                    ? aVal.localeCompare(bVal, 'pt-BR')
                    : bVal.localeCompare(aVal, 'pt-BR');
            }
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }, [auditResult, selectedRegions, sortConfig]);

    // Totais Consolidados dos Termos Filtrados (para o rodapé da tabela)
    const filteredTotals = useMemo(() => {
        let impr = 0;
        let cliques = 0;
        let custo = 0;
        let conv = 0;
        let receita = 0;
        let somaNotas = 0;

        filteredTerms.forEach((t: any) => {
            impr += t.impr || 0;
            cliques += t.cliques || 0;
            custo += t.custo || 0;
            conv += t.conv || 0;
            somaNotas += t.nota || 0;
            receita += (t.custo || 0) * (t.roas || 0);
        });

        const cpa = conv > 0 ? custo / conv : 0;
        const roas = custo > 0 ? receita / custo : 0;
        const notaMedia = filteredTerms.length > 0 ? somaNotas / filteredTerms.length : 0;

        return {
            impr,
            cliques,
            custo,
            conv,
            cpa,
            roas,
            notaMedia
        };
    }, [filteredTerms]);

    // Sincronização entre a barra de rolagem superior e a tabela
    const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (isSyncingScrollRef.current) return;
        if (tableScrollRef.current) {
            if (Math.abs(tableScrollRef.current.scrollLeft - e.currentTarget.scrollLeft) > 1) {
                isSyncingScrollRef.current = true;
                tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
                requestAnimationFrame(() => {
                    isSyncingScrollRef.current = false;
                });
            }
        }
    };

    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (isSyncingScrollRef.current) return;
        if (topScrollRef.current) {
            if (Math.abs(topScrollRef.current.scrollLeft - e.currentTarget.scrollLeft) > 1) {
                isSyncingScrollRef.current = true;
                topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
                requestAnimationFrame(() => {
                    isSyncingScrollRef.current = false;
                });
            }
        }
    };

    // Mede a largura total da tabela para sincronizar a barra de rolagem superior
    useEffect(() => {
        const tableEl = tableScrollRef.current;
        if (!tableEl) return;

        const updateWidth = () => {
            if (tableScrollRef.current) {
                setTableScrollWidth(tableScrollRef.current.scrollWidth);
            }
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(() => {
            updateWidth();
        });

        resizeObserver.observe(tableEl);
        const innerTable = tableEl.querySelector('table');
        if (innerTable) {
            resizeObserver.observe(innerTable);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [filteredTerms, activeTab]);

    // Arraste com o botão esquerdo para rolagem horizontal (Drag-to-Scroll)
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // Apenas botão esquerdo
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select')) {
            return;
        }
        if (!tableScrollRef.current) return;

        isMouseDownRef.current = true;
        isDraggingRef.current = false;
        startXRef.current = e.pageX;
        startScrollLeftRef.current = tableScrollRef.current.scrollLeft;
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isMouseDownRef.current || !tableScrollRef.current) return;

            const deltaX = e.pageX - startXRef.current;

            // Limiar de 5px para diferenciar clique de arrasto
            if (!isDraggingRef.current && Math.abs(deltaX) > 5) {
                isDraggingRef.current = true;
                setIsDraggingTable(true);
                window.getSelection()?.removeAllRanges();
                clearTooltipTimer();
                setTooltip(prev => ({ ...prev, visible: false, termKey: null }));
            }

            if (isDraggingRef.current) {
                e.preventDefault();
                tableScrollRef.current.scrollLeft = startScrollLeftRef.current - deltaX;
                if (topScrollRef.current) {
                    topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
                }
            }
        };

        const handleMouseUp = () => {
            if (isMouseDownRef.current) {
                isMouseDownRef.current = false;
                if (isDraggingRef.current) {
                    isDraggingRef.current = false;
                    setIsDraggingTable(false);
                    justDraggedRef.current = true;
                    setTimeout(() => {
                        justDraggedRef.current = false;
                    }, 80);
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);


    // Cálculos do Simulador de Orçamento
    const simulador = useMemo(() => {
        const { macroMetrics } = auditResult;
        const custoGenericoAtual = macroMetrics.custoDesperdicadoGap || macroMetrics.totalCusto * 0.4;
        const convGenericoAtual = macroMetrics.conversoesGap || macroMetrics.totalConv * 0.3;
        
        const verbaMigrada = (custoGenericoAtual * migrationPercent) / 100;
        const verbaGenericaRestante = custoGenericoAtual - verbaMigrada;

        const cpaGenerico = convGenericoAtual > 0 ? custoGenericoAtual / convGenericoAtual : 220.00;
        const cpaOtimizadoProjetado = Math.min(115.00, (macroMetrics.cpaMedioConsolidado || 150) * 0.6);

        const convNovasDTR = verbaMigrada / (cpaOtimizadoProjetado || 115);
        const convGenericasRestantes = verbaGenericaRestante / (cpaGenerico || 220);
        const convEspecificasExistentes = Math.max(0, macroMetrics.totalConv - convGenericoAtual);
        const convTotaisProjetadas = convGenericasRestantes + convNovasDTR + convEspecificasExistentes;

        const ticketMedio = macroMetrics.totalConv > 0 ? macroMetrics.totalReceita / macroMetrics.totalConv : 750;
        const novaReceitaProjetada = convTotaisProjetadas * ticketMedio;
        const ganhoReceita = novaReceitaProjetada - macroMetrics.totalReceita;
        const novoCpaMedio = macroMetrics.totalCusto / (convTotaisProjetadas || 1);
        const novoROAS = novaReceitaProjetada / (macroMetrics.totalCusto || 1);

        return {
            verbaMigrada,
            convTotaisProjetadas,
            ganhoConversoes: convTotaisProjetadas - macroMetrics.totalConv,
            novaReceitaProjetada,
            ganhoReceita,
            novoCpaMedio,
            novoROAS
        };
    }, [migrationPercent, auditResult]);

    // Processa arquivo com etapas visuais realistas para o usuário acompanhar o progresso
    const processFile = async (file: File) => {
        if (!file) return;

        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase();
        if (!validExtensions.includes(fileExt)) {
            message.error("Formato inválido! Por favor envie uma planilha .xlsx, .xls ou .csv.");
            return;
        }

        const sizeFormatted = file.size > 1048576 
            ? `${(file.size / 1048576).toFixed(2)} MB` 
            : `${(file.size / 1024).toFixed(1)} KB`;

        setIsProcessingFile(true);
        setProcessingStepIndex(0);
        setProcessingProgress(15);
        setProcessingError(null);
        setProcessingFileMeta({
            name: file.name,
            size: sizeFormatted,
            rowCount: 0,
            statusText: 'Iniciando leitura e decodificação do arquivo...'
        });

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            // ETAPA 1: Leitura do buffer e decodificação do XLSX / CSV
            await sleep(350);
            setProcessingProgress(30);
            setProcessingFileMeta(prev => prev ? { ...prev, statusText: 'Lendo abas e linhas da planilha...' } : null);

            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            
            if (!wb.SheetNames || wb.SheetNames.length === 0) {
                throw new Error("O arquivo não contém nenhuma aba ou planilha de dados válida.");
            }

            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];

            // Detecção inteligente da linha de cabeçalho do Google Ads (ignora metadados e linhas de resumo)
            const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            let headerRowIdx = 0;
            for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
                const row = rawRows[i];
                if (row && row.some(cell => {
                    const str = String(cell).toLowerCase();
                    return str.includes('termo de pesquisa') || str.includes('search term') || str.includes('keyword') || str.includes('palavra-chave');
                })) {
                    headerRowIdx = i;
                    break;
                }
            }

            const headers = (rawRows[headerRowIdx] || []).map(h => String(h).trim());
            let json: any[] = [];

            for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
                const r = rawRows[i];
                if (!r || r.length === 0) continue;

                const firstCell = String(r[0] || '').trim().toLowerCase();
                if (firstCell.startsWith('total') || firstCell.startsWith('todas')) {
                    continue; // ignora linhas de totais gerais
                }

                const obj: any = {};
                headers.forEach((header, colIdx) => {
                    if (header) {
                        obj[header] = r[colIdx] !== undefined ? r[colIdx] : '';
                    }
                });

                const term = obj['Termo de pesquisa'] || obj['Search term'] || obj['termo'] || obj['termo_de_pesquisa'] || '';
                if (term) {
                    json.push(obj);
                }
            }

            if (!json || json.length === 0) {
                json = XLSX.utils.sheet_to_json(ws, { defval: '' });
            }

            if (!json || json.length === 0) {
                throw new Error("A planilha está vazia ou não possui linhas de dados válidas. Verifique se há termos de busca no arquivo.");
            }

            // ETAPA 2: Normalização e Mapeamento de Métricas
            setProcessingStepIndex(1);
            setProcessingProgress(50);
            setProcessingFileMeta(prev => prev ? {
                ...prev,
                rowCount: json.length,
                statusText: `${json.length.toLocaleString('pt-BR')} linhas identificadas. Normalizando colunas e termos de busca...`
            } : null);
            await sleep(400);

            // ETAPA 3: Diagnóstico de GAP (Demanda vs Oferta)
            setProcessingStepIndex(2);
            setProcessingProgress(75);
            setProcessingFileMeta(prev => prev ? {
                ...prev,
                statusText: 'Cruzando demanda real com palavras-chave e identificando vazamentos de verba...'
            } : null);
            await sleep(450);

            // ETAPA 4: Cálculo de P&L Regional e Notas IPO (0 a 10)
            setProcessingStepIndex(3);
            setProcessingProgress(90);
            setProcessingFileMeta(prev => prev ? {
                ...prev,
                statusText: 'Agrupando P&L por região, ROAS, CPA e notas de prioridade...'
            } : null);
            
            // Validação de execução do motor
            executarAuditoriaUpperScript(json, geoProfile, file.name);
            await sleep(400);

            // ETAPA 5: Conclusão
            setProcessingStepIndex(4);
            setProcessingProgress(100);
            setProcessingFileMeta(prev => prev ? {
                ...prev,
                statusText: `Auditoria concluída com sucesso! ${json.length.toLocaleString('pt-BR')} termos processados.`
            } : null);

            setUploadedData(json);
            setUploadedFileName(file.name);
            setDataSourceMode('upload');

            // Pausa visual para o usuário contemplar a conclusão com 100%
            await sleep(650);
            setIsProcessingFile(false);
            message.success(`Planilha "${file.name}" auditada com sucesso! ${json.length} termos analisados.`);
        } catch (err: any) {
            console.error("Erro ao processar arquivo:", err);
            setProcessingError(err?.message || "Ocorreu um erro ao processar a planilha.");
            setProcessingFileMeta(prev => prev ? {
                ...prev,
                statusText: 'Falha no processamento da planilha.'
            } : null);
            message.error(`Falha no upload: ${err?.message || 'Erro desconhecido'}`);
        }
    };

    // Upload de arquivo Excel/CSV via input file
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
        e.target.value = '';
    };

    // Download do CSV Google Ads Editor
    const handleDownloadGoogleEditor = () => {
        const csvContent = exportarGoogleAdsEditorCsv(
            auditResult,
            activeCompany?.name ? `STAG_${activeCompany.name.replace(/\s+/g, '_')}` : "Campanha_STAG_Quadrante"
        );
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `google_ads_editor_stag_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success("Arquivo CSV para Google Ads Editor gerado com sucesso!");
    };

    // Componente InfoTag para Tooltip Interativo
    const InfoTag = ({ termKey, label, className = "" }: { termKey: string; label?: string; className?: string }) => (
        <span
            className={`inline-flex items-center gap-1 cursor-help group select-none ${className}`}
            onMouseEnter={(e) => showTooltip(termKey, e.currentTarget)}
            onMouseLeave={() => hideTooltip(200)}
        >
            <span className="underline decoration-dotted decoration-cyan-500/80 underline-offset-4 group-hover:text-amber-400 transition-colors">
                {label || termKey}
            </span>
            <span className="w-3.5 h-3.5 rounded-full bg-cyan-600/30 text-cyan-400 border border-cyan-500/40 text-[9px] font-bold inline-flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-900 transition-all">
                ?
            </span>
        </span>
    );

    const activeTooltipData = tooltip.termKey ? UPPER_GLOSSARY[tooltip.termKey] : null;
    const currentSim = auditResult.simulationSetups[selectedSimRegion] || Object.values(auditResult.simulationSetups)[0];

    return (
        <div 
            className="w-full text-slate-100 font-sans pb-16 relative"
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(true);
            }}
            onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.currentTarget === e.target) {
                    setIsDragOver(false);
                }
            }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                    processFile(file);
                }
            }}
        >
            
            {/* BARRA SUPERIOR DE CONTROLE E FONTE DE DADOS */}
            <div className="mb-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                            <Search className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Upper Script</span>
                            <span className="text-xs font-bold text-white">Método Quadrante Googlar</span>
                        </div>
                    </div>

                    {/* SELETOR DE FONTE DE DADOS */}
                    <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                        {/* 1º - Upload Planilha (Destaque Principal) */}
                        <button
                            onClick={() => {
                                if (uploadedData && uploadedData.length > 0) {
                                    setDataSourceMode('upload');
                                } else {
                                    fileInputRef.current?.click();
                                }
                            }}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                dataSourceMode === 'upload'
                                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md font-black'
                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 font-bold'
                            }`}
                            title="Carregar planilha de termos de pesquisa (.xlsx, .xls, .csv)"
                        >
                            <Upload className={`w-3.5 h-3.5 ${dataSourceMode === 'upload' ? 'text-slate-950' : 'text-amber-400'}`} />
                            <span>{uploadedFileName ? (uploadedFileName.length > 18 ? uploadedFileName.slice(0, 18) + '...' : uploadedFileName) : 'Upload Planilha'}</span>
                        </button>

                        {uploadedData && uploadedData.length > 0 && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                title="Carregar outro arquivo"
                                className="px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <Upload className="w-3 h-3 text-amber-400" />
                                <span className="hidden sm:inline text-[11px]">Trocar</span>
                            </button>
                        )}

                        {/* 2º - Caso Demonstrativo */}
                        <button
                            onClick={() => setDataSourceMode('demo')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                dataSourceMode === 'demo'
                                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50 shadow-md font-bold'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span>📊</span>
                            <span>Caso Demonstrativo</span>
                        </button>

                        {/* 3º - Empresa Ativa */}
                        <button
                            onClick={() => {
                                if (campaignTerms && campaignTerms.length > 0) {
                                    setDataSourceMode('company');
                                } else {
                                    message.warning("Nenhum termo de pesquisa encontrado para a empresa selecionada.");
                                }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                dataSourceMode === 'company'
                                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50 shadow-md font-bold'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                            disabled={!campaignTerms || campaignTerms.length === 0}
                        >
                            <span>🏢</span>
                            <span>Empresa Ativa ({campaignTerms?.length || 0})</span>
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </div>

                    {/* SELETOR DE PERFIL GEOGRÁFICO */}
                    <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
                        <span className="text-[10px] text-slate-500 font-bold px-2">PERFIL:</span>
                        <button
                            onClick={() => setGeoProfile('internacional')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                                geoProfile === 'internacional' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'
                            }`}
                        >
                            🌍 Internacional
                        </button>
                        <button
                            onClick={() => setGeoProfile('brasil')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                                geoProfile === 'brasil' ? 'bg-slate-800 text-emerald-300' : 'text-slate-400'
                            }`}
                        >
                            🇧🇷 Brasil
                        </button>
                        <button
                            onClick={() => setGeoProfile('auto')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                                geoProfile === 'auto' ? 'bg-slate-800 text-amber-300' : 'text-slate-400'
                            }`}
                        >
                            ⚡ Universal
                        </button>
                    </div>
                </div>

                {/* BOTÕES DE AÇÃO RÁPIDA */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowManualModal(true)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 transition-all flex items-center gap-1.5 shadow-lg cursor-pointer"
                        title="Manual de Instruções e Guia de Uso do Upper Script"
                    >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Manual / Como Usar</span>
                    </button>

                    <button
                        onClick={handleDownloadGoogleEditor}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-all flex items-center gap-1.5 shadow-lg cursor-pointer"
                        title="Exportar CSV formatado para o Google Ads Editor"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar Editor (STAG)</span>
                    </button>

                    <button
                        onClick={() => setShowGlossaryModal(true)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all flex items-center gap-1.5 shadow-lg cursor-pointer"
                    >
                        <span>📖</span>
                        <span>Glossário Geral</span>
                    </button>
                </div>
            </div>

            {/* BANNER / STATUS DA PLANILHA CARREGADA */}
            {dataSourceMode === 'upload' && uploadedData && uploadedData.length > 0 && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/40 shadow-xl flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white font-mono">{uploadedFileName}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Auditado com Sucesso
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                                <span className="text-slate-300 font-semibold">{uploadedData.length.toLocaleString('pt-BR')} linhas analisadas</span>
                                <span>•</span>
                                <span className="text-amber-400 font-semibold">{auditResult.macroMetrics.linhasGap} termos no GAP</span>
                                <span>•</span>
                                <span>{auditResult.allRegions.length} regiões identificadas</span>
                                <span>•</span>
                                <span>Perfil: <strong className="text-cyan-300 uppercase">{geoProfile}</strong></span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 shadow-lg cursor-pointer"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Trocar Planilha</span>
                        </button>
                        <button
                            onClick={() => setDataSourceMode('demo')}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>Voltar ao Caso Demo</span>
                        </button>
                    </div>
                </div>
            )}

            {/* DROPZONE QUANDO EM MODO UPLOAD MAS NENHUMA PLANILHA FOI CARREGADA */}
            {dataSourceMode === 'upload' && (!uploadedData || uploadedData.length === 0) && (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-6 p-10 rounded-2xl bg-slate-900/90 border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 transition-all cursor-pointer text-center group shadow-2xl backdrop-blur-md"
                >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all">
                        <FileUp className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                        Nenhuma planilha carregada ainda
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
                        Arraste e solte o arquivo exportado do Google Ads (<strong className="text-slate-200">.xlsx, .xls ou .csv</strong>) aqui ou clique no botão abaixo para selecionar do computador.
                    </p>
                    <button
                        type="button"
                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg inline-flex items-center gap-2 pointer-events-none"
                    >
                        <Upload className="w-4 h-4" />
                        <span>Selecionar Planilha do Google Ads</span>
                    </button>
                </div>
            )}

            {/* HEADER PRINCIPAL EXECUTIVO */}
            <header className="rounded-2xl p-6 sm:p-8 mb-6 relative bg-slate-900/90 border border-slate-800 border-t-4 border-t-cyan-500 shadow-2xl backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Método Quadrante Googlar
                            </span>
                            <span className="text-xs text-slate-400">
                                Campanha: <span className="text-slate-200 font-mono font-bold">
                                    {dataSourceMode === 'company' 
                                        ? (activeCompany?.name || 'Conta Conectada') 
                                        : dataSourceMode === 'upload' 
                                            ? (uploadedFileName || 'Planilha Importada') 
                                            : '020_PQ_BRASIL_FRASE_ROAS'}
                                </span>
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            Painel Executivo: <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-amber-400 to-emerald-400">Custo, Receita & Eficiência</span>
                        </h1>
                        <p className="mt-1 text-xs sm:text-sm text-slate-300">
                            Diagnóstico de desempenho comercial focado nas métricas estratégicas de conversão e aquisição granular.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-right">
                            <span className="text-[10px] text-slate-400 block font-mono">STATUS DO QUADRANTE</span>
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-1 justify-end">
                                <AlertTriangle className="w-3.5 h-3.5" /> {auditResult.macroMetrics.linhasGap} Desvios de Demanda
                            </span>
                        </div>
                    </div>
                </div>

                {/* AS 5 MÉTRICAS FAVORITAS DO CLIENTE (CORES DISTINTAS) */}
                <div className="mt-6 pt-6 border-t border-slate-800">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span>🎯</span>
                        <span>Métricas Principais de Negócio (Visão Consolidada):</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                        {/* 1. ROAS (VALOR CONV. / CUSTO) - DOURADO / ÂMBAR */}
                        <div className="p-4 rounded-xl bg-amber-950/30 border-2 border-amber-500/70 shadow-lg shadow-amber-950/20 relative overflow-hidden">
                            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wide flex items-center justify-between">
                                <InfoTag termKey="ROAS" label="Valor Conv. / Custo" />
                                <span>🏆</span>
                            </div>
                            <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-300">
                                {auditResult.macroMetrics.roasConsolidado.toFixed(2)}x
                            </div>
                            <span className="text-[10px] text-amber-200/80 font-mono mt-0.5 block">Retorno Geral da Mídia</span>
                        </div>

                        {/* 2. CONVERSÕES - VERDE ESMERALDA */}
                        <div className="p-4 rounded-xl bg-emerald-950/30 border-2 border-emerald-500/70 shadow-lg shadow-emerald-950/20 relative overflow-hidden">
                            <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide flex items-center justify-between">
                                <InfoTag termKey="Conversões" label="Conversões" />
                                <span>🛒</span>
                            </div>
                            <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-300">
                                {auditResult.macroMetrics.totalConv.toFixed(1)}
                            </div>
                            <span className="text-[10px] text-emerald-200/80 font-mono mt-0.5 block">Vendas / Leads Validados</span>
                        </div>

                        {/* 3. CPA MÉDIO - CIANO / SAFIRA */}
                        <div className="p-4 rounded-xl bg-cyan-950/30 border-2 border-cyan-500/70 shadow-lg shadow-cyan-950/20 relative overflow-hidden">
                            <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wide flex items-center justify-between">
                                <InfoTag termKey="CPA" label="Custo / Aquisição" />
                                <span>🎯</span>
                            </div>
                            <div className="mt-2 text-2xl sm:text-3xl font-black text-cyan-300">
                                R$ {auditResult.macroMetrics.cpaMedioConsolidado.toFixed(2)}
                            </div>
                            <span className="text-[10px] text-cyan-200/80 font-mono mt-0.5 block">Custo Médio p/ Venda</span>
                        </div>

                        {/* 4. IMPRESSÕES - ROXO / VIOLETA */}
                        <div className="p-4 rounded-xl bg-purple-950/30 border-2 border-purple-500/70 shadow-lg shadow-purple-950/20 relative overflow-hidden">
                            <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wide flex items-center justify-between">
                                <InfoTag termKey="Impressões" label="Impressões" />
                                <span>👁️</span>
                            </div>
                            <div className="mt-2 text-2xl sm:text-3xl font-black text-purple-300 font-mono">
                                {auditResult.macroMetrics.totalImpr.toLocaleString('pt-BR')}
                            </div>
                            <span className="text-[10px] text-purple-200/80 font-mono mt-0.5 block">Exibições no Google</span>
                        </div>

                        {/* 5. CLIQUES - LARANJA / CORAL */}
                        <div className="p-4 rounded-xl bg-orange-950/30 border-2 border-orange-500/70 shadow-lg shadow-orange-950/20 relative overflow-hidden col-span-2 sm:col-span-1">
                            <div className="text-[11px] font-bold text-orange-400 uppercase tracking-wide flex items-center justify-between">
                                <InfoTag termKey="Cliques" label="Cliques" />
                                <span>🖱️</span>
                            </div>
                            <div className="mt-2 text-2xl sm:text-3xl font-black text-orange-300 font-mono">
                                {auditResult.macroMetrics.totalCliques.toLocaleString('pt-BR')}
                            </div>
                            <span className="text-[10px] text-orange-200/80 font-mono mt-0.5 block">Visitas qualificadas</span>
                        </div>
                    </div>
                </div>

                {/* ABAS DE NAVEGAÇÃO DO DASHBOARD */}
                <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-slate-800">
                    <button
                        onClick={() => setActiveTab("tab1")}
                        className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                            activeTab === "tab1"
                                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-500"
                                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                    >
                        <span>📊</span>
                        <span>Modelo 1: P&L de Mídia por Região</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("tab2")}
                        className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                            activeTab === "tab2"
                                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-500"
                                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                    >
                        <span>⭐</span>
                        <span>Modelo 2: Classificação por Nota (0 a 10)</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("tab3")}
                        className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                            activeTab === "tab3"
                                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-bold border border-amber-400"
                                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                    >
                        <span>🚀</span>
                        <span>Modelo 3: Setup Google Editor ➔ Link ➔ Landing Page</span>
                    </button>
                </div>
            </header>

            {/* ========================================================================= */}
            {/* TAB 1: MODELO 1 - BALANÇO P&L DE MÍDIA COM COLUNAS COLORIDAS */}
            {/* ========================================================================= */}
            {activeTab === "tab1" && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="rounded-2xl p-6 sm:p-8 bg-slate-900/80 border border-slate-800 shadow-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    Alocação de Custo e Receita por Cluster de Destino
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    Destaque nas métricas de conversão e custo de aquisição. O grupo genérico absorve a maior parte do investimento com menor eficiência.
                                </p>
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                                Base: <InfoTag termKey="Status Nenhum" label="Status = Nenhum" />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-700 text-xs uppercase tracking-wider">
                                        <th className="py-3 px-3 text-slate-400 font-semibold min-w-[240px]">
                                            <div className="flex items-center gap-1.5">
                                                <span>Cluster Semântico</span>
                                                <span className="text-[10px] font-normal normal-case text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
                                                    Drill-Down ▾
                                                </span>
                                            </div>
                                        </th>
                                        <th className="py-3 px-3 text-purple-400 font-bold bg-purple-950/20"><InfoTag termKey="Impressões" label="Impressões" /></th>
                                        <th className="py-3 px-3 text-orange-400 font-bold bg-orange-950/20"><InfoTag termKey="Cliques" label="Cliques" /></th>
                                        <th className="py-3 px-3 text-slate-300 font-semibold">Custo Investido</th>
                                        <th className="py-3 px-3 text-emerald-400 font-bold bg-emerald-950/20"><InfoTag termKey="Conversões" label="Conversões" /></th>
                                        <th className="py-3 px-3 text-cyan-400 font-bold bg-cyan-950/20"><InfoTag termKey="CPA" label="CPA Médio" /></th>
                                        <th className="py-3 px-3 text-amber-400 font-bold bg-amber-950/20"><InfoTag termKey="ROAS" label="Valor Conv./Custo" /></th>
                                        <th className="py-3 px-3 text-emerald-300 font-bold">Receita Gerada</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-sm">
                                    {auditResult.plRows.map((row, idx) => {
                                        const isGeneric = row.regiao.toLowerCase().includes("genérico");
                                        const isExpanded = !!expandedClusterRows[row.regiao];
                                        const subClusters = row.subClusters || [];

                                        return (
                                            <React.Fragment key={idx}>
                                                <tr
                                                    onClick={() => toggleClusterRow(row.regiao)}
                                                    className={`hover:bg-slate-800/50 transition-colors cursor-pointer border-b border-slate-800/60 ${
                                                        isExpanded ? "bg-slate-800/30" : ""
                                                    } ${isGeneric ? "bg-red-950/15" : ""}`}
                                                >
                                                    <td className="py-3.5 px-3 font-semibold text-white">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all shrink-0"
                                                                title={isExpanded ? "Recolher detalhes" : "Expandir composição semântica"}
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-4 h-4 text-cyan-400" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4" />
                                                                )}
                                                            </button>

                                                            <span
                                                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                                                                style={{ backgroundColor: row.color }}
                                                            />

                                                            <div className="flex flex-col min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-white font-bold">{row.regiao}</span>
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 shadow-sm">
                                                                        {subClusters.length} âncoras
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            showClusterTooltip(row, e.currentTarget);
                                                                        }}
                                                                        onMouseEnter={(e) => showClusterTooltip(row, e.currentTarget)}
                                                                        onMouseLeave={hideClusterTooltip}
                                                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                                                                        title="Ver Nuvem de Chips e Barra de Proporção"
                                                                    >
                                                                        <PieChart className="w-3 h-3 text-cyan-400" />
                                                                        <span>Nuvem & Barra</span>
                                                                    </button>
                                                                </div>

                                                                {/* Mini Stacked Bar Visual Embutida */}
                                                                {subClusters.length > 0 && (
                                                                    <div
                                                                        className="w-44 h-1.5 rounded-full bg-slate-950 overflow-hidden flex mt-1.5 border border-slate-800/80"
                                                                        title="Composição proporcional de impressões deste cluster"
                                                                    >
                                                                        {subClusters.slice(0, 5).map((sub, sIdx) => {
                                                                            const barColors = ["#38bdf8", "#f59e0b", "#10b981", "#a855f7", "#ec4899"];
                                                                            return (
                                                                                <div
                                                                                    key={sIdx}
                                                                                    style={{
                                                                                        width: `${Math.max(4, sub.percentImpr)}%`,
                                                                                        backgroundColor: barColors[sIdx % barColors.length]
                                                                                    }}
                                                                                />
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-3 font-mono text-purple-300 bg-purple-950/10 font-bold">
                                                        {row.impressoes.toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="py-3.5 px-3 font-mono text-orange-300 bg-orange-950/10 font-semibold">
                                                        {row.cliques.toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="py-3.5 px-3 font-mono text-slate-200 font-semibold">
                                                        R$ {row.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3.5 px-3 font-mono font-bold text-emerald-400 bg-emerald-950/10">
                                                        {row.conversoes.toFixed(2)}
                                                    </td>
                                                    <td className="py-3.5 px-3 font-mono font-bold text-cyan-300 bg-cyan-950/10">
                                                        <span className={isGeneric ? "text-red-400 font-extrabold" : ""}>
                                                            R$ {row.cpa.toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-3 font-mono font-extrabold text-amber-400 bg-amber-950/10">
                                                        {row.roas.toFixed(2)}x
                                                    </td>
                                                    <td className="py-3.5 px-3 font-mono font-bold text-emerald-400">
                                                        R$ {row.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>

                                                {/* ========================================================= */}
                                                {/* LINHA EXPANSÍVEL: DRILL-DOWN SEMÂNTICO (ITEM 2) */}
                                                {/* ========================================================= */}
                                                {isExpanded && (
                                                    <tr className="bg-slate-950/80 border-b border-slate-800 animate-fadeIn">
                                                        <td colSpan={8} className="p-4 sm:p-6">
                                                            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 shadow-inner">
                                                                {/* Cabeçalho do Drill-Down */}
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider flex items-center gap-1">
                                                                                <Layers className="w-3 h-3" /> Drill-Down Semântico
                                                                            </span>
                                                                            <h3 className="text-sm font-bold text-white m-0">
                                                                                Decomposição das Buscas: {row.regiao}
                                                                            </h3>
                                                                        </div>
                                                                        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                                                                            Exibindo a partição entre o <strong>termo literal do eixo</strong> e os <strong>destinos derivados</strong> que compõem este campo semântico.
                                                                        </p>
                                                                    </div>

                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveTab("tab2");
                                                                            setSelectedRegions([row.regiao]);
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm w-fit"
                                                                    >
                                                                        <span>Ver buscas brutas no Modelo 2</span>
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </button>
                                                                </div>

                                                                {/* Sub-Tabela de Âncoras do Cluster */}
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left text-xs border-collapse">
                                                                        <thead>
                                                                            <tr className="text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                                                                                <th className="py-2.5 px-3">Âncora / Sub-Destino</th>
                                                                                <th className="py-2.5 px-3">Tipo</th>
                                                                                <th className="py-2.5 px-3 text-purple-400 font-bold bg-purple-950/20">Impr. & % Cluster</th>
                                                                                <th className="py-2.5 px-3 text-orange-400 font-bold bg-orange-950/20">Cliques & CTR</th>
                                                                                <th className="py-2.5 px-3">Custo (R$)</th>
                                                                                <th className="py-2.5 px-3 text-emerald-400 font-bold bg-emerald-950/20">Conversões</th>
                                                                                <th className="py-2.5 px-3 text-cyan-400 font-bold bg-cyan-950/20">CPA Médio</th>
                                                                                <th className="py-2.5 px-3 text-amber-400 font-bold bg-amber-950/20">ROAS</th>
                                                                                <th className="py-2.5 px-3">Status do Quadrante</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-800/60">
                                                                            {subClusters.map((sub, sIdx) => {
                                                                                const isRalo = sub.status.includes("Ralo") || (sub.custo > 100 && sub.conversoes === 0);
                                                                                const isAltaConv = sub.conversoes >= 2 || sub.roas >= 4;

                                                                                return (
                                                                                    <tr
                                                                                        key={sIdx}
                                                                                        className={`hover:bg-slate-800/40 transition-colors ${
                                                                                            sub.isEixoPrincipal ? "bg-cyan-950/20 font-medium" : ""
                                                                                        }`}
                                                                                    >
                                                                                        <td className="py-2.5 px-3">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className="text-sm">{sub.icone}</span>
                                                                                                <div>
                                                                                                    <div className="font-bold text-white flex items-center gap-1.5">
                                                                                                        <span>{sub.label}</span>
                                                                                                        {sub.isEixoPrincipal && (
                                                                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                                                                                EIXO
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <div className="text-[10px] text-slate-500 font-mono">
                                                                                                        termo: "{sub.termoChave}" • {sub.quantidadeTermos} variações
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="py-2.5 px-3">
                                                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                                                                                                {sub.tipo}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-2.5 px-3 font-mono bg-purple-950/10">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className="font-bold text-purple-300">
                                                                                                    {sub.impressoes.toLocaleString('pt-BR')}
                                                                                                </span>
                                                                                                <span className="text-[10px] text-slate-400">
                                                                                                    ({sub.percentImpr}%)
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="w-20 h-1 bg-slate-950 rounded-full overflow-hidden mt-1">
                                                                                                <div
                                                                                                    className="h-full bg-purple-500"
                                                                                                    style={{ width: `${Math.min(100, sub.percentImpr)}%` }}
                                                                                                />
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="py-2.5 px-3 font-mono bg-orange-950/10">
                                                                                            <span className="text-orange-300 font-semibold">{sub.cliques.toLocaleString('pt-BR')}</span>
                                                                                            <span className="text-[10px] text-slate-400 ml-1">({sub.ctr.toFixed(1)}%)</span>
                                                                                        </td>
                                                                                        <td className="py-2.5 px-3 font-mono text-slate-300">
                                                                                            R$ {sub.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                                        </td>
                                                                                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400 bg-emerald-950/10">
                                                                                            {sub.conversoes.toFixed(2)}
                                                                                        </td>
                                                                                        <td className="py-2.5 px-3 font-mono font-bold bg-cyan-950/10">
                                                                                            <span className={isRalo ? "text-red-400 font-extrabold" : "text-cyan-300"}>
                                                                                                R$ {sub.cpa.toFixed(2)}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-2.5 px-3 font-mono font-extrabold text-amber-400 bg-amber-950/10">
                                                                                            {sub.roas.toFixed(2)}x
                                                                                        </td>
                                                                                        <td className="py-2.5 px-3">
                                                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                                                                                                isAltaConv
                                                                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                                                                    : isRalo
                                                                                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                                                                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                                                            }`}>
                                                                                                <span>{isAltaConv ? '🔥' : isRalo ? '⚠️' : '⚡'}</span>
                                                                                                <span>{sub.status}</span>
                                                                                            </span>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>

                                                                {/* Box de Insight Pedagógico do Drill-Down */}
                                                                <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                                                                    <span className="text-base">💡</span>
                                                                    <div className="leading-relaxed">
                                                                        <strong>Insight do Quadrante para {row.regiao}:</strong>{" "}
                                                                        {(() => {
                                                                            const eixoSub = subClusters.find(s => s.isEixoPrincipal);
                                                                            const outrosPct = 100 - (eixoSub ? eixoSub.percentImpr : 0);
                                                                            const outrosImpr = row.impressoes - (eixoSub ? eixoSub.impressoes : 0);
                                                                            return (
                                                                                <span>
                                                                                    A busca literal pelo eixo{" "}
                                                                                    <code className="text-cyan-300 px-1 py-0.5 bg-slate-800 rounded font-mono">
                                                                                        "{eixoSub?.termoChave || row.regiao.toLowerCase()}"
                                                                                    </code>{" "}
                                                                                    representou <strong>{eixoSub?.percentImpr || 0}%</strong> ({eixoSub?.impressoes.toLocaleString('pt-BR') || 0} imp.). Os restantes{" "}
                                                                                    <strong className="text-amber-300">{outrosPct.toFixed(1)}%</strong> ({outrosImpr.toLocaleString('pt-BR')} imp.) foram distribuídos em países e cidades específicos. Ao criar grupos <strong>STAG</strong> para esses destinos derivados, o anúncio e a página passam a responder exatamente ao país desejado, reduzindo o CPA e eliminando o desperdício de verba.
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* CONCLUSÃO EXECUTIVA */}
                        <div className="mt-5 p-4 rounded-xl bg-slate-950/60 border border-slate-700 text-xs text-slate-300 flex items-start gap-3">
                            <span className="text-xl">💡</span>
                            <div>
                                <strong>Conclusão Executiva:</strong> O grupo Genérico absorve a maior parte da verba (
                                <span className="text-red-400 font-bold">
                                    R$ {auditResult.macroMetrics.custoDesperdicadoGap.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                ) operando com CPA significativamente maior. Ao reestruturar em STAG e DTR, os clusters específicos atingem retorno financeiro superior sem necessidade de orçamento adicional.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: MODELO 2 - NOTA DE 0 A 10 E DIAGNÓSTICO DO GAP */}
            {/* ========================================================================= */}
            {activeTab === "tab2" && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="rounded-2xl p-6 sm:p-8 bg-slate-900/80 border border-slate-800 shadow-xl">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wider">
                                        Diagnóstico do GAP
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        Termos específicos ativados por palavras-chave genéricas
                                    </span>
                                </div>
                                <h3 className="text-lg sm:text-xl font-bold text-white">
                                    Classificação de Prioridade dos Termos do GAP (Notas de 0 a 10)
                                </h3>
                                <p className="text-xs text-slate-400 max-w-2xl mt-1">
                                    Mostrando <strong>exclusivamente as buscas com intenção específica (Demanda)</strong> que foram acionadas por <strong>palavras-chave genéricas (Oferta sem destino)</strong>. É aqui que o orçamento vaza por falta de alinhamento no Quadrante Googlar.
                                </p>
                            </div>

                            {/* FILTRO INTERATIVO DE MULTI-SELEÇÃO DE REGIÕES */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-950/90 p-2 rounded-2xl border border-slate-800 shadow-lg">
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => toggleRegion("Todos")}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            selectedRegions.length === auditResult.allRegions.length
                                                ? "bg-amber-500 text-slate-950 font-black shadow-md"
                                                : "bg-slate-800 text-slate-400 hover:text-white"
                                        }`}
                                    >
                                        <span>{selectedRegions.length === auditResult.allRegions.length ? "✓" : "○"}</span>
                                        <span>Todas</span>
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {auditResult.allRegions.map((reg) => {
                                        const isSelected = selectedRegions.includes(reg);
                                        return (
                                            <button
                                                key={reg}
                                                onClick={() => toggleRegion(reg)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30 border border-cyan-500"
                                                        : "bg-slate-800/80 text-slate-400 border border-slate-700/80 hover:bg-slate-700 hover:text-white opacity-60"
                                                }`}
                                            >
                                                <span>{reg}</span>
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-cyan-800 text-white" : "bg-slate-700 text-slate-400"}`}>
                                                    {isSelected ? "✓" : "+"}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* INSTRUÇÃO DE INTERATIVIDADE / ORDENAÇÃO E NAVEGAÇÃO */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 mb-2 gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1">
                                    <span>💡</span>
                                    <span><strong>Dica:</strong> Clique nos títulos para ordenar.</span>
                                </span>
                                <span className="text-slate-600 hidden sm:inline">|</span>
                                <span className="flex items-center gap-1 text-cyan-400 font-medium">
                                    <span>↔️</span>
                                    <span><strong>Navegação:</strong> Clique com o botão esquerdo e arraste para os lados para navegar pelas colunas.</span>
                                </span>
                            </div>
                            <span className="font-mono text-xs text-amber-400 font-bold">
                                Ordenado por: <strong className="uppercase">{sortConfig.key}</strong> ({sortConfig.direction === 'asc' ? 'Crescente ▲' : 'Decrescente ▼'})
                            </span>
                        </div>

                        {/* BARRA DE ROLAGEM HORIZONTAL SUPERIOR */}
                        <div
                            ref={topScrollRef}
                            onScroll={handleTopScroll}
                            className="overflow-x-auto overflow-y-hidden rounded-t-xl border border-b-0 border-slate-800 bg-slate-950/90 custom-horizontal-scrollbar"
                            style={{ height: '14px' }}
                            title="Barra de rolagem horizontal superior"
                        >
                            <div style={{ width: `${tableScrollWidth || 1200}px`, height: '1px' }} />
                        </div>

                        <div
                            ref={tableScrollRef}
                            onScroll={handleTableScroll}
                            onMouseDown={handleMouseDown}
                            className={`overflow-x-auto rounded-b-xl border border-slate-800 custom-horizontal-scrollbar transition-colors ${
                                isDraggingTable ? 'cursor-grabbing select-none [&_*]:cursor-grabbing' : 'cursor-grab'
                            }`}
                        >
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-700 text-xs uppercase tracking-wider bg-slate-950/90">
                                        <th
                                            onClick={() => handleSort('termo')}
                                            className="py-3.5 px-3 text-slate-300 font-semibold cursor-pointer select-none hover:bg-slate-800 transition-colors group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>Termo de Pesquisa</span>
                                                <span className="ml-1 text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'termo' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('palavras_chave')}
                                            className="py-3.5 px-3 text-cyan-300 font-bold cursor-pointer select-none hover:bg-slate-800 transition-colors group bg-cyan-950/20"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>Palavra-chave</span>
                                                <span className="ml-1 text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'palavras_chave' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('grupos_anuncio')}
                                            className="py-3.5 px-3 text-purple-300 font-bold cursor-pointer select-none hover:bg-slate-800 transition-colors group bg-purple-950/20"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>Grupo de Anúncios</span>
                                                <span className="ml-1 text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'grupos_anuncio' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('impr')}
                                            className="py-3.5 px-3 text-purple-400 font-bold bg-purple-950/20 cursor-pointer select-none hover:bg-purple-900/30 transition-colors group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <InfoTag termKey="Impressões" label="Impr." />
                                                <span className="ml-1 text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'impr' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('cliques')}
                                            className="py-3.5 px-3 text-orange-400 font-bold bg-orange-950/20 cursor-pointer select-none hover:bg-orange-900/30 transition-colors group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <InfoTag termKey="Cliques" label="Cliques" />
                                                <span className="ml-1 text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'cliques' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('custo')}
                                            className="py-3.5 px-3 text-slate-300 font-semibold cursor-pointer select-none hover:bg-slate-800 transition-colors group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>Custo</span>
                                                <span className="ml-1 text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'custo' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('conv')}
                                            className="py-3.5 px-3 text-emerald-400 font-bold bg-emerald-950/20 cursor-pointer select-none hover:bg-emerald-900/30 transition-colors group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <InfoTag termKey="Conversões" label="Total de Conversão" />
                                                <span className="ml-1 text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'conv' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('cpa')}
                                            className="py-3.5 px-3 text-cyan-400 font-bold bg-cyan-950/20 cursor-pointer select-none hover:bg-cyan-900/30 transition-colors group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <InfoTag termKey="CPA" label="CPA" />
                                                <span className="ml-1 text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'cpa' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('roas')}
                                            className="py-3.5 px-3 text-amber-400 font-bold bg-amber-950/20 cursor-pointer select-none hover:bg-amber-900/30 transition-colors group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <InfoTag termKey="ROAS" label="Valor/Custo" />
                                                <span className="ml-1 text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'roas' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>

                                        <th
                                            onClick={() => handleSort('nota')}
                                            className="py-3.5 px-3 text-center text-amber-400 font-bold cursor-pointer select-none hover:bg-slate-800 transition-colors group"
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                <span>Nota</span>
                                                <span className="text-slate-500 font-mono text-[10px] group-hover:text-white">
                                                    {sortConfig.key === 'nota' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-800 text-sm">
                                    {filteredTerms.map((t, idx) => {
                                        let badgeBg = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
                                        if (t.nota < 8.0) badgeBg = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                                        if (t.nota >= 9.5) badgeBg = "bg-gradient-to-r from-emerald-500/30 to-amber-500/30 text-amber-300 border-amber-400";

                                        return (
                                            <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3 px-3 font-mono font-semibold text-slate-100 min-w-[200px]">
                                                    <div className="text-xs sm:text-sm text-white font-bold">
                                                        🔍 "{t.termo}"
                                                    </div>
                                                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                                        {t.regiao}
                                                    </span>
                                                </td>

                                                <td className="py-3 px-3 font-mono text-xs min-w-[210px] bg-cyan-950/5">
                                                    <div className="flex flex-col gap-1">
                                                        {t.palavras_chave.map((kw, kIdx) => (
                                                            <span
                                                                key={kIdx}
                                                                className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 text-[11px] leading-tight block truncate max-w-[230px]"
                                                                title={kw}
                                                            >
                                                                {kw}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                <td className="py-3 px-3 font-mono text-xs min-w-[190px] bg-purple-950/5">
                                                    <div className="flex flex-col gap-1">
                                                        {t.grupos_anuncio.map((grp, gIdx) => (
                                                            <span
                                                                key={gIdx}
                                                                className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/60 text-[10px] font-bold block truncate max-w-[200px]"
                                                                title={grp}
                                                            >
                                                                {grp}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                <td className="py-3 px-3 font-mono text-purple-300 bg-purple-950/10 font-bold">
                                                    {t.impr}
                                                </td>

                                                <td className="py-3 px-3 font-mono text-orange-300 bg-orange-950/10 font-bold">
                                                    {t.cliques}
                                                </td>

                                                <td className="py-3 px-3 font-mono text-slate-200 font-semibold whitespace-nowrap">
                                                    R$ {t.custo.toFixed(2)}
                                                </td>

                                                <td className="py-3 px-3 font-mono font-bold text-emerald-400 bg-emerald-950/10">
                                                    {t.conv.toFixed(2)}
                                                </td>

                                                <td className="py-3 px-3 font-mono font-bold text-cyan-300 bg-cyan-950/10 whitespace-nowrap">
                                                    R$ {t.cpa.toFixed(2)}
                                                </td>

                                                <td className="py-3 px-3 font-mono font-extrabold text-amber-400 bg-amber-950/10 whitespace-nowrap">
                                                    {t.roas.toFixed(1)}x
                                                </td>

                                                <td className="py-3 px-3 text-center">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold border ${badgeBg} inline-flex items-center gap-1 shadow-sm`}>
                                                        <span>⭐</span>
                                                        <span>{t.nota.toFixed(1)}</span>
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>

                                <tfoot>
                                    <tr className="border-t-2 border-slate-700 bg-slate-950/90 text-xs font-bold text-slate-200">
                                        <td colSpan={3} className="py-3.5 px-3 text-slate-300">
                                            Total Consolidado ({filteredTerms.length} termos listados):
                                        </td>
                                        <td className="py-3.5 px-3 font-mono text-purple-300 bg-purple-950/20 font-black">
                                            {filteredTotals.impr.toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-3.5 px-3 font-mono text-orange-300 bg-orange-950/20 font-black">
                                            {filteredTotals.cliques.toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-3.5 px-3 font-mono text-slate-100 font-black whitespace-nowrap">
                                            R$ {filteredTotals.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3.5 px-3 font-mono text-emerald-400 bg-emerald-950/30 font-black">
                                            {filteredTotals.conv.toFixed(2)}
                                        </td>
                                        <td className="py-3.5 px-3 font-mono text-cyan-300 bg-cyan-950/20 font-black whitespace-nowrap">
                                            R$ {filteredTotals.cpa.toFixed(2)}
                                        </td>
                                        <td className="py-3.5 px-3 font-mono text-amber-400 bg-amber-950/20 font-black whitespace-nowrap">
                                            {filteredTotals.roas.toFixed(1)}x
                                        </td>
                                        <td className="py-3.5 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                Média ⭐ {filteredTotals.notaMedia.toFixed(1)}
                                            </span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: MODELO 3 - SETUP OPERACIONAL & SIMULADOR DE ESCALA */}
            {/* ========================================================================= */}
            {activeTab === "tab3" && currentSim && (
                <div className="space-y-8 animate-fadeIn">
                    {/* CABEÇALHO DA SIMULAÇÃO */}
                    <div className="rounded-2xl p-6 sm:p-8 bg-slate-900/80 border border-slate-800 border-t-4 border-t-amber-500 shadow-xl">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 uppercase tracking-wider">
                                        Simulação Operacional
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">
                                        Google Ads Editor ➔ Parâmetros de URL ➔ Landing Page DTR
                                    </span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                                    Como fica a Estrutura na Prática?
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                                    Veja o fluxo completo de como os termos específicos que hoje caem no grupo genérico <span className="text-red-400 font-mono">{currentSim.grupoAtual}</span> são agrupados no <strong>Google Ads Editor</strong>, recebem <strong>parâmetros no link</strong> e geram a <strong>mutação dinâmica na página</strong>.
                                </p>
                            </div>

                            {/* SELETOR INTERATIVO DE DESTINO */}
                            <div className="bg-slate-950/90 p-2 rounded-2xl border border-slate-800 flex flex-wrap gap-1.5 shrink-0 shadow-xl">
                                {Object.keys(auditResult.simulationSetups).map((regiaoKey) => {
                                    const item = auditResult.simulationSetups[regiaoKey];
                                    const isSelected = selectedSimRegion === regiaoKey;
                                    return (
                                        <button
                                            key={regiaoKey}
                                            onClick={() => setSelectedSimRegion(regiaoKey)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                                isSelected
                                                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-500"
                                                    : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white"
                                            }`}
                                        >
                                            <span>{item.icone}</span>
                                            <span>{regiaoKey}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* FLUXO EM 3 PILARES: GOOGLE ADS EDITOR -> LINK -> PÁGINA */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* PASSO 1: GOOGLE ADS EDITOR */}
                        <div className="rounded-2xl p-6 bg-slate-900/80 border border-slate-800 border-t-4 border-t-cyan-500 flex flex-col justify-between shadow-xl relative overflow-hidden">
                            <div>
                                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 uppercase font-bold border border-cyan-800">
                                        Passo 1
                                    </span>
                                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                                        <span>🖥️</span> Google Ads Editor
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                    <span>Reestruturação de Grupos (<InfoTag termKey="STAG" />)</span>
                                </h3>

                                <div className="space-y-3 text-xs">
                                    <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30">
                                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">❌ Como está hoje no Google Ads:</span>
                                        <span className="font-mono text-slate-300 mt-1 block">
                                            Grupo Genérico: <strong className="text-red-300">{currentSim.grupoAtual}</strong>
                                        </span>
                                        <span className="text-[11px] text-slate-400 mt-1 block">
                                            Os termos {currentSim.nome} aparecem com status <InfoTag termKey="Status Nenhum" label="'Nenhum'" /> e pagam CPA elevado.
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/40">
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">✅ Novo Grupo Criado no Google Editor:</span>
                                        <span className="font-mono text-emerald-300 font-bold text-sm mt-0.5 block">
                                            {currentSim.novoGrupoEditor}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                            ➕ Palavras-Chave no Novo Grupo:
                                        </span>
                                        <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                                            {currentSim.keywordsAdd.map((kw, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
                                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                            <span>⛔</span>
                                            <span>Negativas no Grupo Antigo (<InfoTag termKey="Traffic Sculpting" />):</span>
                                        </span>
                                        <p className="text-[11px] text-slate-300">
                                            Adicionar como negativas no grupo internacional/genérico:
                                        </p>
                                        <div className="flex flex-wrap gap-1 font-mono text-[10px] mt-1.5 text-amber-300">
                                            {currentSim.negativasGrupoAntigo.map((neg, i) => (
                                                <span key={i} className="px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800">
                                                    {neg}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                                Resultado: O leilão não mistura mais intenções e o Índice de Qualidade sobe para o topo.
                            </div>
                        </div>

                        {/* PASSO 2: MUDANÇA NO LINK (PARÂMETROS / VALUETRACK) */}
                        <div className="rounded-2xl p-6 bg-slate-900/80 border border-slate-800 border-t-4 border-t-cyan-400 flex flex-col justify-between shadow-xl relative overflow-hidden">
                            <div>
                                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 uppercase font-bold border border-cyan-800">
                                        Passo 2
                                    </span>
                                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                                        <span>🔗</span> Parâmetros de URL
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                    <span>Sufixo de URL (<InfoTag termKey="ValueTrack" />)</span>
                                </h3>

                                <div className="space-y-3.5 text-xs">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">URL Final da Landing Page:</span>
                                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-300 text-[11px] mt-1 break-all">
                                            https://seusite.com.br/lp/
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Configuração no Google Ads Editor:</span>
                                        <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 font-mono text-cyan-200 text-xs mt-1 font-bold">
                                            Final URL Suffix: <span className="text-amber-400">{currentSim.sufixoUrl}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            Configurado 1 única vez no nível do grupo de anúncios.
                                        </span>
                                    </div>

                                    <div>
                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Link Gerado para o Usuário Clicar:</span>
                                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] mt-1 text-slate-200 break-all leading-relaxed">
                                            https://seusite.com.br/lp/<span className="text-amber-400 font-bold font-mono">?{currentSim.sufixoUrl}</span>
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                                            <span>⚙️</span> O que acontece na chegada (<InfoTag termKey="GTM" />):
                                        </span>
                                        <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                                            O GTM lê o parâmetro <code className="text-amber-400 font-mono font-bold">{currentSim.sufixoUrl}</code> na URL em menos de 50 milissegundos e envia a instrução para o site alterar os elementos visualmente.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                                Vantagem: Sem criar dezenas de páginas no CMS; 1 única URL atende todas as variações.
                            </div>
                        </div>

                        {/* PASSO 3: MUTAÇÃO VISUAL DA LANDING PAGE (DTR) */}
                        <div className="rounded-2xl p-6 bg-slate-900/80 border border-slate-800 border-t-4 border-t-emerald-500 flex flex-col justify-between shadow-xl relative overflow-hidden">
                            <div>
                                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 uppercase font-bold border border-emerald-800">
                                        Passo 3
                                    </span>
                                    <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                                        <span>🌐</span> Landing Page Adaptada
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                    <span>Mutação Visual Dinâmica (<InfoTag termKey="DTR" />)</span>
                                </h3>

                                {/* MOCKUP INTERATIVO DA LANDING PAGE */}
                                <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-950 shadow-inner">
                                    <div className="bg-slate-900 px-3 py-1.5 border-b border-slate-800 flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                                        <div className="ml-2 text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                                            lp/?{currentSim.sufixoUrl}
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        <div>
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                                                Título Principal (H1 Dinâmico):
                                            </span>
                                            <h4 className="text-sm font-black text-white leading-tight mt-0.5">
                                                {currentSim.h1Pagina}
                                            </h4>
                                        </div>

                                        <div>
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                Subtítulo & Proposta de Valor:
                                            </span>
                                            <p className="text-xs text-slate-300 leading-snug mt-0.5">
                                                {currentSim.subtituloPagina}
                                            </p>
                                        </div>

                                        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                                                Formulário de Cotação Pré-Preenchido:
                                            </span>
                                            <div className="flex items-center justify-between text-xs bg-slate-950 p-2 rounded border border-slate-700">
                                                <span className="text-slate-400">Destino Selecionado:</span>
                                                <span className="font-bold text-cyan-300 flex items-center gap-1">
                                                    <span>{currentSim.icone}</span> {currentSim.selectOpcao}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* IMPACTO FINANCEIRO PROJETADO */}
                                <div className="mt-3 p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex items-center justify-between text-xs">
                                    <div>
                                        <span className="text-[10px] text-emerald-400 font-bold uppercase block">Queda Estimada no CPA:</span>
                                        <span className="text-sm font-black text-emerald-300">{currentSim.economiaCpa}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-amber-400 font-bold uppercase block">Projeção de Escala:</span>
                                        <span className="text-sm font-black text-amber-300">{currentSim.apolicesExtras}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                                A experiência do lead se torna 100% alinhada com o que ele buscou no Google.
                            </div>
                        </div>
                    </div>

                    {/* SIMULADOR INTERATIVO DE ESCALA COM O MESMO ORÇAMENTO */}
                    <div className="rounded-2xl p-6 sm:p-8 bg-slate-900/90 border border-slate-800 border-t-4 border-t-emerald-500 shadow-2xl">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                            <div>
                                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                                    Simulador Interativo
                                </span>
                                <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                                    Escalar Vendas com o <span className="text-emerald-400">Mesmo Orçamento</span>
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                                    Arraste a barra para simular a migração de verba do grupo genérico ineficiente para as estruturas específicas STAG com Landing Pages DTR.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                                <span className="text-xs text-slate-400 font-bold">Verba Migrada:</span>
                                <span className="text-xl font-black text-emerald-400 font-mono">{migrationPercent}%</span>
                            </div>
                        </div>

                        {/* SLIDER INTERATIVO */}
                        <div className="space-y-3 mb-8">
                            <input
                                type="range"
                                min={10}
                                max={70}
                                step={5}
                                value={migrationPercent}
                                onChange={(e) => setMigrationPercent(Number(e.target.value))}
                                className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                            />
                            <div className="flex justify-between text-[11px] font-mono text-slate-400">
                                <span>10% (Migração Conservadora)</span>
                                <span className="text-emerald-400 font-bold">30% (Recomendado)</span>
                                <span>50% (Agressivo)</span>
                                <span>70% (Transformação Total)</span>
                            </div>
                        </div>

                        {/* RESULTADOS DA SIMULAÇÃO */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Verba Reallocada:
                                </span>
                                <div className="mt-1 text-xl font-black text-white font-mono">
                                    R$ {simulador.verbaMigrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 block">Retirada do ralo genérico</span>
                            </div>

                            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                                    Vendas Extras Projetadas:
                                </span>
                                <div className="mt-1 text-xl font-black text-emerald-300 font-mono">
                                    +{simulador.ganhoConversoes.toFixed(1)} vendas
                                </div>
                                <span className="text-[10px] text-emerald-200/80 mt-1 block">Sem pedir 1 real a mais</span>
                            </div>

                            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40">
                                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                                    Novo CPA Médio Projetado:
                                </span>
                                <div className="mt-1 text-xl font-black text-cyan-300 font-mono">
                                    R$ {simulador.novoCpaMedio.toFixed(2)}
                                </div>
                                <span className="text-[10px] text-cyan-200/80 mt-1 block">Custo menor por cliente</span>
                            </div>

                            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40">
                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                                    Ganho de Faturamento Bruto:
                                </span>
                                <div className="mt-1 text-xl font-black text-amber-300 font-mono">
                                    +R$ {simulador.ganhoReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                                <span className="text-[10px] text-amber-200/80 mt-1 block">Novo ROAS: {simulador.novoROAS.toFixed(2)}x</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DO GLOSSÁRIO GERAL */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-white font-bold text-lg">
                        <span>📖</span>
                        <span>Glossário Conceitual do Método Quadrante Googlar</span>
                    </div>
                }
                open={showGlossaryModal}
                onCancel={() => setShowGlossaryModal(false)}
                footer={null}
                width={700}
                className="custom-dark-modal"
            >
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-slate-200 text-xs">
                    {Object.entries(UPPER_GLOSSARY).map(([key, item]) => (
                        <div key={key} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                            <h4 className="text-sm font-bold text-cyan-300 mb-1">{item.term}</h4>
                            <p className="text-slate-300 mb-1 leading-relaxed">{item.meaning}</p>
                            <span className="text-amber-300/90 font-mono text-[11px] block">{item.purpose}</span>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* MODAL DO MANUAL DE INSTRUÇÕES / COMO USAR */}
            <Modal
                title={
                    <div className="flex items-center gap-2.5 text-white font-bold text-lg">
                        <div className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <span>Manual de Instruções: Método Quadrante Googlar</span>
                            <span className="text-xs font-normal text-slate-400 block font-mono">
                                Guia completo de auditoria autônoma, identificação de vazamento de verba e escala STAG/DTR
                            </span>
                        </div>
                    </div>
                }
                open={showManualModal}
                onCancel={() => setShowManualModal(false)}
                footer={null}
                width={880}
                className="custom-dark-modal"
            >
                <div className="space-y-6 max-h-[74vh] overflow-y-auto pr-2 text-slate-200 text-xs">
                    {/* ABAS DO MANUAL */}
                    <div className="flex flex-wrap gap-2 p-1.5 rounded-xl bg-slate-950 border border-slate-800 sticky top-0 z-20 backdrop-blur-md">
                        <button
                            onClick={() => setManualTab('pilares')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                                manualTab === 'pilares'
                                    ? 'bg-cyan-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span>🎯</span>
                            <span>Os 4 Pilares</span>
                        </button>

                        <button
                            onClick={() => setManualTab('gap')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                                manualTab === 'gap'
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span>⚠️</span>
                            <span>O GAP & Ralo Genérico</span>
                        </button>

                        <button
                            onClick={() => setManualTab('passo-a-passo')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                                manualTab === 'passo-a-passo'
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span>🚀</span>
                            <span>Passo a Passo de Uso</span>
                        </button>

                        <button
                            onClick={() => setManualTab('modelos')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                                manualTab === 'modelos'
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span>📊</span>
                            <span>Modelos & Escala</span>
                        </button>
                    </div>

                    {/* ABA 1: OS 4 PILARES E IMAGEM DO QUADRANTE */}
                    {manualTab === 'pilares' && (
                        <div className="space-y-4 animate-fadeIn">
                            {/* IMAGEM DO QUADRANTE GOOGLAR */}
                            <div className="rounded-2xl border border-slate-700 overflow-hidden bg-slate-950 p-2 shadow-2xl">
                                <img
                                    src="/quadrante_googlar.jpeg"
                                    alt="Diagrama dos 4 Pilares do Método Quadrante Googlar"
                                    className="w-full h-auto max-h-[360px] object-contain rounded-xl mx-auto"
                                    onError={(e) => {
                                        // Fallback se a imagem não carregar
                                        (e.target as HTMLElement).style.display = 'none';
                                    }}
                                />
                                <div className="text-center py-2 px-4">
                                    <span className="text-[11px] font-mono text-cyan-300 font-bold block">
                                        FIGURA 1: Arquitetura do Quadrante Googlar
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        Demanda ➔ Oferta ➔ Preço / Leilão ➔ Site / Conversão Hiper-Relevante
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                                        1. Demanda (Search Term Real)
                                    </span>
                                    <p className="text-slate-300 leading-relaxed text-[11px]">
                                        O que o usuário <strong>realmente digitou</strong> na barra de pesquisa (ex: <em>"seguro de viagem europa"</em> ou <em>"advogado pinheiros sp"</em>). Representa a dor ou necessidade exata.
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                                        2. Oferta (Anúncio e Palavra-chave)
                                    </span>
                                    <p className="text-slate-300 leading-relaxed text-[11px]">
                                        A promessa feita ao usuário. Se a oferta for genérica para uma demanda específica, o CTR cai e o custo por clique (CPC) sobe.
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                                        3. Preço / Leilão (CPA, CPC e Lances)
                                    </span>
                                    <p className="text-slate-300 leading-relaxed text-[11px]">
                                        A competitividade no leilão do Google Ads. Termos alinhados aumentam o Índice de Qualidade para 9 ou 10, reduzindo drasticamente o CPA.
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                                        4. Site / Conversão (Landing Page DTR)
                                    </span>
                                    <p className="text-slate-300 leading-relaxed text-[11px]">
                                        A página de destino dinâmica com <strong>DTR (Dynamic Text Replacement)</strong>. Troca o título e o formulário automaticamente pelo destino/cidade pesquisada.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ABA 2: O GAP E O RALO GENÉRICO */}
                    {manualTab === 'gap' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/40">
                                <h4 className="text-sm font-bold text-red-300 mb-1 flex items-center gap-1.5">
                                    <span>💥</span> O que é a "Quebra do Quadrante"?
                                </h4>
                                <p className="text-slate-300 leading-relaxed text-[11px]">
                                    A quebra acontece quando o gestor de tráfego agrupa pesquisas com intenções geográficas ou comerciais específicas sob um <strong>grupo genérico amplo</strong>.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/30 space-y-2">
                                    <span className="text-xs font-bold text-red-400 block uppercase">
                                        ❌ Cenário Atual (Com Ralo Genérico):
                                    </span>
                                    <div className="text-[11px] text-slate-300 space-y-1 font-mono">
                                        <div>1. Usuário busca: <span className="text-white">"seguro viagem europa"</span></div>
                                        <div>2. Grupo ativado: <span className="text-red-300">_seguro viagem internacional</span></div>
                                        <div>3. Anúncio: <span className="text-slate-400">"Seguro Internacional - Cotação"</span></div>
                                        <div>4. Landing Page: <span className="text-slate-400">Página genérica sem destaque para Europa</span></div>
                                        <div className="pt-2 text-red-400 font-bold">
                                            Resultado: CPA R$ 224,21 (Verba desperdiçada)
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-2">
                                    <span className="text-xs font-bold text-emerald-400 block uppercase">
                                        ✅ Cenário Corrigido com Upper Script (STAG):
                                    </span>
                                    <div className="text-[11px] text-slate-300 space-y-1 font-mono">
                                        <div>1. Usuário busca: <span className="text-white">"seguro viagem europa"</span></div>
                                        <div>2. Grupo novo: <span className="text-emerald-300">_seguro viagem europa (STAG)</span></div>
                                        <div>3. Anúncio: <span className="text-emerald-300">"Seguro Europa Tratado de Schengen"</span></div>
                                        <div>4. Landing Page: <span className="text-emerald-300">lp/?destino=Europa (H1 dinâmico)</span></div>
                                        <div className="pt-2 text-emerald-400 font-bold">
                                            Resultado: CPA cai para R$ 110,43 (-50,7%) e ROAS 4.41x
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                                <span className="text-base">💡</span>
                                <div>
                                    <strong>O Ralo Genérico:</strong> É o montante financeiro consumido por cliques sem especificidade. No caso real demonstrado, dos R$ 26.835 investidos, <strong>R$ 21.849,66</strong> estavam retidos no grupo genérico com o pior CPA da conta.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ABA 3: PASSO A PASSO DE USO NO POCKET GOOGLAR */}
                    {manualTab === 'passo-a-passo' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/40">
                                <h4 className="text-xs font-bold text-cyan-300 mb-1 flex items-center gap-1.5 uppercase">
                                    <span>✨</span> 3 Maneiras de Operar (Zero Fricção)
                                </h4>
                                <p className="text-[11px] text-slate-300">
                                    Você não precisa renomear arquivos nem preencher planilhas manuais. O sistema é 100% autônomo.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-white text-xs">Caso Demonstrativo (Pronto para Apresentações)</h5>
                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                            Clique em <strong>"Caso Demonstrativo"</strong> para carregar o case real de Seguro Viagem Internacional com os R$ 26k auditados, ideal para mostrar a metodologia para novos clientes em reuniões de pitch comercial.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-white text-xs">Empresa Ativa (1 Clique sem Upload)</h5>
                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                            Se você já sincronizou os termos da empresa no Pocket Googlar, clique em <strong>"Empresa Ativa"</strong>. O motor audita diretamente os dados cadastrados no banco sem exigir que você exporte ou envie nenhum arquivo.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-white text-xs">Upload Livre de Planilha (Qualquer Nome)</h5>
                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                            Clique em <strong>"Upload Planilha"</strong> e selecione qualquer arquivo <code>.xlsx</code>, <code>.xls</code> ou <code>.csv</code> exportado do Google Ads. O sistema identifica automaticamente colunas de pesquisa, custo, conversões e impressões, tanto em português quanto em inglês.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                                        4
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-white text-xs">Seleção do Perfil Geográfico</h5>
                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                            Use os botões de perfil para calibrar o dicionário:
                                            <br />• <strong>🌍 Internacional:</strong> Destinos mundiais (Europa, EUA, Canadá, América do Sul, Ásia).
                                            <br />• <strong>🇧🇷 Brasil:</strong> Estados, capitais e cidades polo (SP, RJ, MG, Sul, Nordeste, Centro-Oeste).
                                            <br />• <strong>⚡ Universal:</strong> Modo autônomo para qualquer nicho de mercado.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ABA 4: MODELOS, ESCALA E EXPORTAÇÃO */}
                    {manualTab === 'modelos' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="space-y-3">
                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                    <span className="text-xs font-bold text-cyan-300 block mb-1">
                                        📊 Modelo 1: Balanço P&L de Mídia por Região
                                    </span>
                                    <p className="text-[11px] text-slate-300 leading-relaxed">
                                        Apresenta a tabela financeira comparativa. A linha do grupo <strong>Genérico</strong> fica destacada em vermelho, evidenciando o alto CPA e o orçamento desperdiçado.
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                    <span className="text-xs font-bold text-amber-300 block mb-1">
                                        ⭐ Modelo 2: Classificação por Notas (0 a 10)
                                    </span>
                                    <p className="text-[11px] text-slate-300 leading-relaxed">
                                        Calcula o <strong>IPO (Índice de Prioridade de Otimização)</strong> para cada termo de pesquisa com base na fórmula matemática de ROAS, CPA e conversões. Termos com notas <strong>9.5 e 10.0</strong> são os candidatos mais urgentes para virar novos grupos STAG.
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                    <span className="text-xs font-bold text-emerald-300 block mb-1">
                                        🚀 Modelo 3: Setup Google Editor ➔ ValueTrack ➔ LP DTR
                                    </span>
                                    <p className="text-[11px] text-slate-300 leading-relaxed">
                                        Fornece a especificação operacional: novos nomes de grupos, palavras-chave em correspondência exata <code>[]</code> e frase <code>""</code>, negativas cruzadas, sufixo de URL e o preview ao vivo de como a Landing Page se adapta para o usuário.
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/40">
                                    <span className="text-xs font-bold text-purple-300 block mb-1">
                                        📈 Simulador de Escala (Slider de 10% a 70%)
                                    </span>
                                    <p className="text-[11px] text-slate-300 leading-relaxed">
                                        Demonstra matematicamente ao tomador de decisão como a realocação da verba do grupo ineficiente para os grupos STAG otimizados gera <strong>novas vendas e faturamento adicional com o mesmo orçamento</strong>.
                                    </p>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-white block">
                                            📥 Exportação para Google Ads Editor
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            Baixe a planilha CSV e importe no Google Ads Editor em <em>Conta ➔ Importar ➔ De arquivo CSV</em>.
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleDownloadGoogleEditor}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 cursor-pointer shadow-md"
                                    >
                                        Baixar CSV
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* TOOLTIP FLUTUANTE GLOBAL INTERATIVO */}
            {tooltip.visible && activeTooltipData && (
                <div
                    style={{
                        position: 'fixed',
                        left: `${tooltip.x}px`,
                        top: `${tooltip.y}px`,
                        transform: tooltip.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                        zIndex: 9999
                    }}
                    className="pointer-events-auto transition-all duration-150 py-1.5"
                    onMouseEnter={clearTooltipTimer}
                    onMouseLeave={() => hideTooltip(150)}
                >
                    <div className="bg-slate-950/95 border border-slate-700/90 p-3.5 rounded-xl shadow-2xl max-w-xs text-left backdrop-blur-md animate-fadeIn select-text relative">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-cyan-400 font-mono">{activeTooltipData.term}</span>
                            <button
                                onClick={immediateHideTooltip}
                                className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors text-[10px] cursor-pointer"
                                title="Fechar explicação"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-200 mb-1.5 leading-snug">{activeTooltipData.meaning}</p>
                        <div className="text-[10px] text-amber-300 font-mono border-t border-slate-800/80 pt-1.5 flex items-start gap-1">
                            <span className="text-amber-400 shrink-0">💡</span>
                            <span>{activeTooltipData.purpose}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* TOOLTIP / POPOVER RICO: NUVEM DE CHIPS E BARRA DE PROPORÇÃO (ITEM 3) */}
            {clusterTooltip.visible && clusterTooltip.clusterRow && (
                <div
                    style={{
                        position: 'fixed',
                        left: `${clusterTooltip.x}px`,
                        top: `${clusterTooltip.y}px`,
                        transform: clusterTooltip.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                        zIndex: 9999
                    }}
                    className="pointer-events-auto transition-all duration-150 py-2 animate-fadeIn"
                    onMouseEnter={() => {}}
                    onMouseLeave={hideClusterTooltip}
                >
                    <div className="bg-slate-950/95 border border-cyan-500/50 p-5 rounded-2xl shadow-2xl w-[440px] max-w-[92vw] text-left backdrop-blur-xl select-text relative">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: clusterTooltip.clusterRow.color }}></span>
                                <div>
                                    <h4 className="text-sm font-bold text-white m-0 flex items-center gap-1.5">
                                        <span>Campo Semântico:</span>
                                        <span className="text-cyan-300">{clusterTooltip.clusterRow.regiao}</span>
                                    </h4>
                                    <span className="text-[10px] text-slate-400">Guarda-chuva de Intenção de Destino</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/30">
                                    {clusterTooltip.clusterRow.impressoes.toLocaleString('pt-BR')} imp.
                                </span>
                                <button
                                    onClick={hideClusterTooltip}
                                    className="text-slate-500 hover:text-slate-300 p-1 rounded transition-colors text-xs cursor-pointer ml-1"
                                    title="Fechar"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Texto Didático */}
                        <p className="text-[11px] text-slate-300 mb-3.5 leading-relaxed">
                            O cluster agrupa todas as buscas cuja <strong>intenção de viagem</strong> é direcionada a este território. Isso diferencia a <em>intenção global</em> da <em>palavra literal individual</em>.
                        </p>

                        {/* BARRA DE PROPORÇÃO HORIZONTAL (STACKED BAR) */}
                        <div className="mb-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 font-bold uppercase tracking-wider">
                                <span>Distribuição das Âncoras</span>
                                <span className="text-cyan-400 font-mono">100% do Volume</span>
                            </div>

                            <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex border border-slate-800 shadow-inner">
                                {clusterTooltip.clusterRow.subClusters?.slice(0, 6).map((sub, sIdx) => {
                                    const barColors = ["#38bdf8", "#f59e0b", "#10b981", "#a855f7", "#ec4899", "#64748b"];
                                    return (
                                        <div
                                            key={sIdx}
                                            style={{ width: `${Math.max(3, sub.percentImpr)}%`, backgroundColor: barColors[sIdx % barColors.length] }}
                                            title={`${sub.label}: ${sub.impressoes.toLocaleString('pt-BR')} imp (${sub.percentImpr}%)`}
                                            className="h-full transition-all hover:opacity-90"
                                        />
                                    );
                                })}
                            </div>

                            {/* Legenda da Barra */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-[10px] text-slate-300">
                                {clusterTooltip.clusterRow.subClusters?.slice(0, 4).map((sub, sIdx) => {
                                    const barColors = ["#38bdf8", "#f59e0b", "#10b981", "#a855f7"];
                                    return (
                                        <span key={sIdx} className="flex items-center gap-1 font-medium">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: barColors[sIdx % barColors.length] }} />
                                            <span>{sub.icone} {sub.ancora}: <strong className="text-white font-mono">{sub.percentImpr}%</strong></span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* NUVEM DE CHIPS INTERATIVA */}
                        <div>
                            <div className="text-[10px] text-slate-400 mb-2 font-bold uppercase tracking-wider flex items-center justify-between">
                                <span>Nuvem de Âncoras Semânticas ({clusterTooltip.clusterRow.subClusters?.length || 0})</span>
                                <span className="text-cyan-400 text-[10px] font-mono">impr. por âncora</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                {clusterTooltip.clusterRow.subClusters?.map((sub, sIdx) => (
                                    <div
                                        key={sIdx}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] border flex items-center gap-1.5 transition-all shadow-sm ${
                                            sub.isEixoPrincipal
                                                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200 font-bold'
                                                : 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-700'
                                        }`}
                                    >
                                        <span>{sub.icone}</span>
                                        <span className="font-semibold">{sub.ancora}</span>
                                        <span className="text-[10px] font-mono text-purple-300 font-bold bg-purple-950/50 px-1 py-0.2 rounded">
                                            {sub.impressoes.toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rodapé Didático */}
                        <div className="mt-3.5 pt-2.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                            <span>💡 Clique na linha da tabela para abrir o Drill-Down com métricas completas.</span>
                        </div>
                    </div>
                </div>
            )}

            {/* OVERLAY VISUAL DE ARRASTAR E SOLTAR (DRAG & DROP) */}
            {isDragOver && (
                <div className="fixed inset-0 z-[9998] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6 border-4 border-dashed border-cyan-400 m-4 rounded-3xl animate-pulse pointer-events-none">
                    <div className="text-center max-w-md p-8 bg-slate-900/95 rounded-2xl border border-cyan-500/50 shadow-2xl">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400 flex items-center justify-center animate-bounce">
                            <Upload className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-white mb-2">Solte a Planilha Aqui</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Solte o arquivo <span className="font-mono text-cyan-300 font-bold">.xlsx</span>, <span className="font-mono text-cyan-300 font-bold">.xls</span> ou <span className="font-mono text-cyan-300 font-bold">.csv</span> do Google Ads para auditar automaticamente pelo Método Quadrante Googlar.
                        </p>
                    </div>
                </div>
            )}

            {/* MODAL DE PROCESSAMENTO / CARREGAMENTO DE PLANILHA */}
            {isProcessingFile && (
                <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden text-slate-100 animate-fadeIn">
                        {/* Ambient glowing background blur */}
                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/20 blur-3xl pointer-events-none rounded-full" />
                        
                        {/* Modal Header */}
                        <div className="flex items-center gap-3.5 mb-5 relative z-10">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                                processingError 
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                    : processingProgress === 100 
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                                        : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-lg shadow-cyan-950/50'
                            }`}>
                                {processingError ? (
                                    <AlertTriangle className="w-6 h-6" />
                                ) : processingProgress === 100 ? (
                                    <CheckCircle2 className="w-6 h-6" />
                                ) : (
                                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white leading-tight">
                                    {processingError 
                                        ? 'Falha ao Processar Planilha' 
                                        : processingProgress === 100 
                                            ? 'Auditoria Concluída com Sucesso!' 
                                            : 'Auditando Planilha Google Ads'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Motor Upper Script • Método Quadrante Googlar
                                </p>
                            </div>
                        </div>

                        {/* Informações do Arquivo Selecionado */}
                        {processingFileMeta && (
                            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3 mb-5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                        <FileSpreadsheet className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-white truncate" title={processingFileMeta.name}>
                                            {processingFileMeta.name}
                                        </div>
                                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                            <span>{processingFileMeta.size}</span>
                                            {processingFileMeta.rowCount > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-emerald-400 font-semibold font-mono">
                                                        {processingFileMeta.rowCount.toLocaleString('pt-BR')} linhas
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                        {processingFileMeta.name.split('.').pop()?.toUpperCase() || 'ARQUIVO'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Barra de Progresso Animada */}
                        <div className="space-y-1.5 mb-5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                                    {processingError ? (
                                        <span className="text-rose-400">Interrompido</span>
                                    ) : processingProgress === 100 ? (
                                        <span className="text-emerald-400 flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            100% Processado
                                        </span>
                                    ) : (
                                        <span className="text-cyan-300 flex items-center gap-1.5">
                                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                                            {processingFileMeta?.statusText || 'Processando...'}
                                        </span>
                                    )}
                                </span>
                                <span className="font-mono font-bold text-cyan-400">{processingProgress}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                                        processingError 
                                            ? 'bg-rose-500' 
                                            : 'bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-400'
                                    }`}
                                    style={{ width: `${processingProgress}%` }}
                                />
                            </div>
                        </div>

                        {/* Pipeline de Etapas */}
                        <div className="space-y-2 mb-6">
                            {PROCESSING_STAGES.map((stage, idx) => {
                                const isDone = idx < processingStepIndex || (idx === 4 && processingProgress === 100);
                                const isCurrent = idx === processingStepIndex && !processingError && processingProgress < 100;
                                const isErr = idx === processingStepIndex && !!processingError;

                                return (
                                    <div
                                        key={idx}
                                        className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 text-xs ${
                                            isDone 
                                                ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-200'
                                                : isCurrent
                                                    ? 'bg-cyan-950/40 border-cyan-500/60 text-white shadow-md shadow-cyan-950/40'
                                                    : isErr
                                                        ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                                                        : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                                        }`}
                                    >
                                        <div className="mt-0.5 shrink-0">
                                            {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                            {isCurrent && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
                                            {isErr && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                                            {!isDone && !isCurrent && !isErr && (
                                                <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[9px] font-mono text-slate-600">
                                                    {idx + 1}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className={`font-bold ${
                                                isDone ? 'text-emerald-300' : isCurrent ? 'text-cyan-300' : isErr ? 'text-rose-300' : 'text-slate-400'
                                            }`}>
                                                {stage.title}
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                                {stage.desc}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Mensagem de Erro ou Botão de Ação */}
                        {processingError ? (
                            <div className="space-y-3">
                                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs leading-relaxed">
                                    <strong>Motivo:</strong> {processingError}
                                    <div className="mt-1 text-[11px] text-slate-400">
                                        Certifique-se de que a planilha exportada do Google Ads possui colunas como "Termo de pesquisa", "Impressões", "Cliques" e "Custo".
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsProcessingFile(false);
                                        setProcessingError(null);
                                    }}
                                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer shadow-lg"
                                >
                                    Fechar e Tentar Novamente
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
export default UpperScript;
