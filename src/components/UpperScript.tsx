import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Sparkles, Upload, Download, RefreshCw, FileSpreadsheet,
    HelpCircle, Layers, CheckCircle, ArrowUpDown, ChevronRight,
    Search, Check, Globe, ShieldAlert, TrendingUp, AlertTriangle, X,
    BookOpen, Info, FileText
} from 'lucide-react';
import { message, Modal } from 'antd';
import * as XLSX from 'xlsx';
import {
    DEMO_INTERNATIONAL_RESULT,
    UPPER_GLOSSARY,
    executarAuditoriaUpperScript,
    exportarGoogleAdsEditorCsv,
    type UpperScriptAuditResult
} from '../lib/upperScriptEngine';
import type { CampaignTerm, Company } from '../types';

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

    // Handlers do Tooltip Flutuante
    const showTooltip = (termKey: string, targetEl: HTMLElement) => {
        if (!targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const placement = rect.top > 140 ? 'top' : 'bottom';
        setTooltip({
            visible: true,
            termKey,
            x: rect.left + rect.width / 2,
            y: placement === 'top' ? rect.top - 8 : rect.bottom + 8,
            placement
        });
    };

    const hideTooltip = () => {
        setTooltip(prev => ({ ...prev, visible: false }));
    };

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

    // Upload de arquivo Excel/CSV
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingFile(true);
        setUploadedFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

                if (json.length === 0) {
                    message.error("Planilha vazia ou com formato inválido.");
                    setIsProcessingFile(false);
                    return;
                }

                setUploadedData(json);
                setDataSourceMode('upload');
                message.success(`Arquivo "${file.name}" carregado com ${json.length} linhas!`);
            } catch (err: any) {
                message.error(`Erro ao ler arquivo: ${err.message}`);
            } finally {
                setIsProcessingFile(false);
            }
        };

        reader.readAsBinaryString(file);
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
            onMouseLeave={hideTooltip}
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
        <div className="w-full text-slate-100 font-sans pb-16">
            
            {/* BARRA SUPERIOR DE CONTROLE E FONTE DE DADOS */}
            <div className="mb-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Upper Script</span>
                            <span className="text-xs font-bold text-white">Método Quadrante Googlar</span>
                        </div>
                    </div>

                    {/* SELETOR DE FONTE DE DADOS */}
                    <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                        <button
                            onClick={() => setDataSourceMode('demo')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                dataSourceMode === 'demo'
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span>📊</span>
                            <span>Caso Demonstrativo</span>
                        </button>

                        <button
                            onClick={() => {
                                if (campaignTerms && campaignTerms.length > 0) {
                                    setDataSourceMode('company');
                                } else {
                                    message.warning("Nenhum termo de pesquisa encontrado para a empresa selecionada.");
                                }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                dataSourceMode === 'company'
                                    ? 'bg-cyan-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                            disabled={!campaignTerms || campaignTerms.length === 0}
                        >
                            <span>🏢</span>
                            <span>Empresa Ativa ({campaignTerms?.length || 0})</span>
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                dataSourceMode === 'upload'
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span>📁</span>
                            <span>{uploadedFileName ? uploadedFileName.slice(0, 18) + '...' : 'Upload Planilha'}</span>
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
                                    {dataSourceMode === 'company' ? (activeCompany?.name || 'Conta Conectada') : '020_PQ_BRASIL_FRASE_ROAS'}
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
                                        <th className="py-3 px-3 text-slate-400 font-semibold">Cluster</th>
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
                                        return (
                                            <tr key={idx} className={`hover:bg-slate-800/40 transition-colors ${isGeneric ? "bg-red-950/15" : ""}`}>
                                                <td className="py-3.5 px-3 font-semibold text-white flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }}></span>
                                                    <span>{row.regiao}</span>
                                                </td>
                                                <td className="py-3.5 px-3 font-mono text-purple-300 bg-purple-950/10">
                                                    {row.impressoes.toLocaleString('pt-BR')}
                                                </td>
                                                <td className="py-3.5 px-3 font-mono text-orange-300 bg-orange-950/10">
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

                        {/* INSTRUÇÃO DE INTERATIVIDADE / ORDENAÇÃO */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                            <span className="flex items-center gap-1">
                                <span>💡</span>
                                <span><strong>Dica:</strong> Clique nos títulos das colunas para ordenar (ascendente/descendente).</span>
                            </span>
                            <span className="font-mono text-xs text-amber-400 font-bold">
                                Ordenado por: <strong className="uppercase">{sortConfig.key}</strong> ({sortConfig.direction === 'asc' ? 'Crescente ▲' : 'Decrescente ▼'})
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-700 text-xs uppercase tracking-wider bg-slate-950/90">
                                        <th
                                            onClick={() => handleSort('termo')}
                                            className="py-3.5 px-3 text-slate-300 font-semibold cursor-pointer select-none hover:bg-slate-800 transition-colors group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>Termo Real Digitado</span>
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
                                                <span>Palavra-Chave Ativação</span>
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
                                                <InfoTag termKey="Conversões" label="Conv." />
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

                                                <td className="py-3 px-3 text-center">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold border ${badgeBg} inline-flex items-center gap-1 shadow-sm`}>
                                                        <span>⭐</span>
                                                        <span>{t.nota.toFixed(1)}</span>
                                                    </span>
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
                                            </tr>
                                        );
                                    })}
                                </tbody>
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

            {/* TOOLTIP FLUTUANTE GLOBAL */}
            {tooltip.visible && activeTooltipData && (
                <div
                    style={{
                        position: 'fixed',
                        left: `${tooltip.x}px`,
                        top: `${tooltip.y}px`,
                        transform: tooltip.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
                        zIndex: 9999
                    }}
                    className="pointer-events-none transition-all duration-150"
                >
                    <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-2xl max-w-xs text-left animate-fadeIn">
                        <div className="text-[11px] font-bold text-cyan-400 mb-0.5">{activeTooltipData.term}</div>
                        <p className="text-[10px] text-slate-200 mb-1 leading-snug">{activeTooltipData.meaning}</p>
                        <span className="text-[9px] text-amber-300 font-mono block border-t border-slate-800 pt-1">
                            {activeTooltipData.purpose}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
export default UpperScript;
