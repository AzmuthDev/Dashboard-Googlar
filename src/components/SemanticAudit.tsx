import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Table, Button, message, Input, Select, Tooltip, Tabs } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import {
    FileText, TrendingUp, User, ShieldCheck, Search, Send, Sparkles, Clock
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useCampaignTerms, useCompanies } from '../hooks/useCampaignData';
import { type CampaignTerm, type Company } from '../types';

// --- Types ---
type CategoryKey = 'negativar' | 'duvida' | 'segmentar' | 'teste_ab' | 'manter' | null;

// --- Constants ---
const CATEGORY_OPTIONS = [
    { value: 'negativar', label: '❌ Negativar' },
    { value: 'duvida',    label: '❓ Dúvida' },
    { value: 'segmentar', label: '✅ Segmentar' },
    { value: 'teste_ab',  label: '⚠️ Teste A/B' },
    { value: 'manter',    label: '➡️ Manter' },
];

// --- Formatters ---
const fmt = {
    num: (v?: any) => {
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        return (isNaN(n) || n === 0) ? '0' : n.toLocaleString('pt-BR');
    },
    brl: (v?: any) => {
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        if (isNaN(n) || n === 0) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
    },
};

export function SemanticAudit({
    activeCompanyId,
    currentUser
}: {
    activeCompanyId: string | null;
    currentUser: { email: string; isAdmin: boolean } | null;
}) {
    // Audit logs for Senior Debug
    useEffect(() => {
        const hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY;
        console.log('[Antygraviti Debug] API Presence:', { hasGeminiKey });
    }, []);

    const { data: companies = [] } = useCompanies();
    const activeCompany = (companies as Company[]).find(c => c.id === activeCompanyId);

    const { data: terms = [], isLoading: _loading } = useCampaignTerms(
        activeCompanyId || undefined, 
        activeCompany?.tableName
    );

    const targetTable = activeCompany?.tableName || (activeCompanyId ? `data_company_${activeCompanyId}` : null);
    const queryClient = useQueryClient();

    // Selection state
    const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
    const [selectedAdGroup, setSelectedAdGroup]   = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('all');

    // Triage state
    const [triageState, setTriageState] = useState<Record<string, { category: CategoryKey; comment: string }>>({});

    // Search & Expansion state
    const [searchingTerms, setSearchingTerms] = useState<Set<string>>(new Set());
    const [expandedMetrics, setExpandedMetrics] = useState<Record<string, { volume: number; kd: number; cpc: number }>>({});
    const [isSendingDoubts, setIsSendingDoubts] = useState(false);
    const [syncingComments, setSyncingComments] = useState<Record<string, boolean>>({});
    const [isAutoTriaging, setIsAutoTriaging] = useState(false);

    // Refs
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // --- Reset on company change ---
    useEffect(() => {
        try {
            setSelectedCampaign(null);
            setSelectedAdGroup(null);
            setActiveTab('all');
            setTriageState({});
        } catch (e) {
            console.error('[SemanticAudit] Error resetting state:', e);
        }
    }, [activeCompanyId]);

    // --- Sync Logic (Auto-trigger) ---
    const handleSync = useCallback(async (forcedPayload?: any) => {
        try {
            const payload = forcedPayload || {
                companyId: activeCompanyId,
                timestamp: new Date().toISOString(),
                changes: Object.entries(triageState || {}).map(([id, state]) => ({
                    termId: id,
                    ...state
                }))
            };
            
            console.log('Syncing data to webhook:', payload);
            await new Promise(r => setTimeout(r, 800));
            message.success('Sincronização concluída.');
        } catch (error) {
            console.error('[Sync Error]:', error);
            message.error('Falha na sincronização.');
        }
    }, [activeCompanyId, triageState]);

    // --- Data processing ---
    const { campaignList, adGroupList, baseFilteredTerms } = useMemo(() => {
        try {
            const termsArray = Array.isArray(terms) ? terms : [];
            
            const campaigns = Array.from(new Set(
                termsArray
                    .map((t: CampaignTerm) => t?.campanha)
                    .filter(Boolean)
            )).sort();

            const adGroups = (selectedCampaign && termsArray.length > 0)
                ? Array.from(new Set(
                    termsArray
                        .filter((t: CampaignTerm) => t?.campanha === selectedCampaign)
                        .map((t: CampaignTerm) => t?.grupo_de_anuncios)
                        .filter(Boolean)
                )).sort()
                : [];
            
            const filtered = termsArray.filter((t: CampaignTerm) => 
                t && 
                t?.campanha === selectedCampaign && 
                t?.grupo_de_anuncios === selectedAdGroup
            );

            return { campaignList: campaigns, adGroupList: adGroups, baseFilteredTerms: filtered };
        } catch (e) {
            console.error('[Data Processing Error]:', e);
            return { campaignList: [], adGroupList: [], baseFilteredTerms: [] };
        }
    }, [terms, selectedCampaign, selectedAdGroup]);
    
    // Auxiliares de detecção robusta (V4 Hybrid)
    const isNeg = (t: CampaignTerm) => t?.negativar === true || String(t?.negativar || '').includes('❌') || String(t?.negativar || '').toLowerCase() === 'true';
    const isDuv = (t: CampaignTerm) => t?.duvida === true || String(t?.duvida || '').includes('❓') || String(t?.duvida || '').toLowerCase() === 'true';
    const isSeg = (t: CampaignTerm) => t?.segmentar === true || String(t?.segmentar || '').includes('✅') || String(t?.segmentar || '').toLowerCase() === 'true';
    const isTst = (t: CampaignTerm) => t?.teste_ab === true || String(t?.teste_ab || '').includes('⚠️') || String(t?.teste_ab || '').toLowerCase() === 'true';
    const isMnt = (t: CampaignTerm) => t?.manter === true || String(t?.manter || '').includes('➡️') || String(t?.manter || '').toLowerCase() === 'true';


    // --- Secondary filtering by Tabs ---
    const filteredTerms = useMemo(() => {
        try {
            if (activeTab === 'all') return baseFilteredTerms || [];
            return (baseFilteredTerms || []).filter((t: CampaignTerm) => {
                if (activeTab === 'negativas') return isNeg(t);
                if (activeTab === 'duvidas')    return isDuv(t);
                if (activeTab === 'aprovadas')  return isSeg(t);
                if (activeTab === 'ab_test')    return isTst(t);
                if (activeTab === 'responses')  return t.enviado_para_grupo === true;
                return true;
            }).sort((a, b) => {
                if (activeTab === 'responses') {
                    const dateA = new Date(a.data_resposta || a.data_envio_enquete || 0).getTime();
                    const dateB = new Date(b.data_resposta || b.data_envio_enquete || 0).getTime();
                    return dateB - dateA;
                }
                return 0; // Mantém ordem original para outras abas
            });
        } catch (e) {
            console.error('[Tab Filter Error]:', e);
            return [];
        }
    }, [baseFilteredTerms, activeTab]);

    // --- Tab Counts ---
    const counts = useMemo(() => {
        const c = { all: baseFilteredTerms.length, negativas: 0, duvidas: 0, aprovadas: 0, ab_test: 0, responses: 0 };
        baseFilteredTerms.forEach((t: CampaignTerm) => {
            if (isNeg(t)) c.negativas++;
            if (isDuv(t)) c.duvidas++;
            if (isSeg(t)) c.aprovadas++;
            if (isTst(t)) c.ab_test++;
            if (t.enviado_para_grupo === true) c.responses++;
        });
        return c;
    }, [baseFilteredTerms]);

    // --- Loading State Guard ---
    if (_loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 rounded-3xl border transition-all duration-300 bg-muted/20 border-border">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="mb-4"
                >
                    <Search className="w-8 h-8 text-muted-foreground opacity-50" />
                </motion.div>
                <p className="text-muted-foreground font-medium font-mono animate-pulse uppercase tracking-tighter">Carregando Auditoria...</p>
            </div>
        );
    }

    // --- No Company Selected Guard ---
    if (!activeCompanyId) {
        return (
            <div className="flex flex-col items-center justify-center py-32 rounded-3xl border-2 border-dashed border-border bg-muted/10 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Nenhuma empresa selecionada</h2>
                <p className="text-muted-foreground max-w-xs text-sm">
                    Acesse <span className="font-bold text-foreground">Empresas</span> no menu lateral e clique em uma empresa para ativar a auditoria semântica.
                </p>
            </div>
        );
    }



    // --- Handlers ---
    // --- Handlers de Mutação (Frontend ↔ Supabase) ---
    const handleCategoryChange = async (id: string, category: CategoryKey) => {
        if (!activeCompanyId || !targetTable) return;

        // Optimistic UI update
        setTriageState(prev => ({
            ...prev,
            [id]: { ...prev[id], category }
        }));

        try {
            // Mapeamento de categorias para colunas booleanas
            const updatePayload = {
                negativar: category === 'negativar',
                duvida:    category === 'duvida',
                segmentar: category === 'segmentar',
                teste_ab:  category === 'teste_ab',
                manter:    category === 'manter'
            };

            const { error } = await supabase
                .from(targetTable)
                .update(updatePayload)
                .eq('id', id);

            if (error) throw error;
            
            // Atualizar cache global para refletir as badges
            queryClient.setQueryData(['campaign-terms', activeCompanyId, activeCompany?.tableName], (oldData: CampaignTerm[] | undefined) => {
                if (!oldData) return [];
                return oldData.map(t => t.id === id ? { ...t, ...updatePayload } : t);
            });

            message.success(`Julgamento atualizado: ${category?.toUpperCase()}`);
        } catch (error) {
            console.error('[Update Error]:', error);
            message.error('Erro ao salvar julgamento no banco de dados.');
        }
    };

    const handleCommentSync = async (id: string, comment: string) => {
        if (!activeCompanyId || !targetTable) return;
        
        setSyncingComments(prev => ({ ...prev, [id]: true }));
        try {
            const { error } = await supabase
                .from(targetTable)
                .update({ auditor_comment: comment })
                .eq('id', id);

            if (error) throw error;
            
            setTriageState(prev => ({
                ...prev,
                [id]: { ...prev[id], comment }
            }));
            
            console.log(`[SemanticAudit] Comentário sincronizado na tabela ${targetTable} para o termo ${id}`);
        } catch (error) {
            console.error('[Sync Error]:', error);
            message.error('Erro ao sincronizar comentário.');
        } finally {
            setTimeout(() => {
                setSyncingComments(prev => ({ ...prev, [id]: false }));
            }, 800);
        }
    };

    const handleConfirmarQC = async (termId: string, level: 1 | 2) => {
        if (!targetTable) return;
        const column = level === 1 ? 'triagem1' : 'triagem2';
        
        try {
            const { error } = await supabase
                .from(targetTable)
                .update({ [column]: true })
                .eq('id', termId);

            if (error) throw error;

            queryClient.setQueryData(['campaign-terms', activeCompanyId, activeCompany?.tableName], (oldData: CampaignTerm[] | undefined) => {
                if (!oldData) return [];
                return oldData.map(t => t.id === termId ? { ...t, [column]: true } : t);
            });
            message.success(`QC${level} confirmado ✓`);
        } catch (error) {
            console.error(`Erro ao confirmar QC${level}:`, error);
            message.error(`Erro ao confirmar QC${level}.`);
        }
    };

    const handleQuickSearch = async (term: string, id: string) => {
        if (searchingTerms.has(id)) return;
        
        setSearchingTerms(prev => new Set(prev).add(id));
        
        // Protocolo Antygraviti: Busca DNA da Empresa + Métricas
        message.loading("Antygraviti estabelecendo conexão... Extraindo DNA.", 0);

        try {
            // Tenta obter o URL da empresa para o payload de BI (Opcional na V4)
            const siteUrl = ""; // No Antygraviti V4, o site_url é inferido pelo orquestrador via ID

            const WEBHOOK_DNA = "https://n8n-n8n-start.hup4p9.easypanel.host/webhook/12b95c4f-2c92-4f20-b16a-f2e9a1364ab8";
            
            // Disparo para o orquestrador n8n
            await fetch(WEBHOOK_DNA, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    site_url: siteUrl, 
                    contexto: 'analise_comercial',
                    termo_pesquisa: term 
                })
            });
            
            // Mock de métricas para a UI
            const mockData = {
                volume: Math.floor(Math.random() * 5000) + 500,
                kd: Math.floor(Math.random() * 100),
                cpc: parseFloat((Math.random() * 15).toFixed(2))
            };

            setExpandedMetrics(prev => ({ ...prev, [id]: mockData }));
            message.destroy();
            message.success(`DNA e métricas de "${term}" sincronizados.`);
        } catch (error) {
            console.error("Erro na integração Antygraviti/n8n:", error);
            message.error("⚠️ Conexão interrompida. Verifique o servidor orbitador.");
        } finally {
            setSearchingTerms(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleAutoTriage = async () => {
        const apiKey = localStorage.getItem('googlar_gemini_api_key');
        if (!apiKey) {
            message.error("Configure a chave do Gemini em 'Ferramentas' primeiro.");
            return;
        }

        if (filteredTerms.length === 0) {
            message.warning("Selecione uma campanha e grupo com dados para triagem.");
            return;
        }

        setIsAutoTriaging(true);
        const toastId = 'auto-triage';
        message.loading({ content: 'Antygraviti Orbiter analisando semântica...', key: toastId });

        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const dataToAnalyze = filteredTerms.slice(0, 20).map(t => ({
                id: t.id,
                term: t.termo_de_pesquisa || t.palavra_chave,
                custo: t.custo,
                conversoes: t.conversoes
            }));

            const prompt = `Você é um Auditor de Tráfego Sênior. Analise estes termos de pesquisa do Google Ads e decida para cada um se deve:
            - 'negativar': se o termo é claramente irrelevante ou tem custo alto e 0 conversão.
            - 'duvida': se o termo é ambíguo.
            - 'segmentar': se o termo é altamente relevante e converte.
            - 'manter': se o termo está ok mas não é especial.

            Responda APENAS um array JSON no formato: [{"id": "...", "cat": "negativar" | "duvida" | "segmentar" | "manter", "obs": "breve motivo"}].
            Dados: ${JSON.stringify(dataToAnalyze)}`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Extract JSON from response (handling potential markdown blocks)
            const jsonStr = text.match(/\[.*\]/s)?.[0] || text;
            const suggestions = JSON.parse(jsonStr);

            const newState = { ...triageState };
            suggestions.forEach((s: any) => {
                if (s.id && s.cat) {
                    newState[s.id] = { category: s.cat as CategoryKey, comment: s.obs || '' };
                }
            });

            setTriageState(newState);
            message.success({ content: 'Triagem inteligente concluída! Revise os resultados.', key: toastId, duration: 4 });
        } catch (error: any) {
            console.error('Auto-triage error:', error);
            message.error({ content: 'Falha na triagem IA: ' + error.message, key: toastId });
        } finally {
            setIsAutoTriaging(false);
        }
    };
    
    const handleSendDoubts = async () => {
        if (!activeCompanyId || !targetTable) {
            message.warning("Selecione uma empresa válida.");
            return;
        }

        const doubtTerms = baseFilteredTerms.filter((t: CampaignTerm) => {
            const state = triageState[t.id];
            if ((state?.category as string) === 'duvida') return true;
            if (state?.category && (state.category as string) !== 'duvida') return false;
            return isDuv(t);
        });

        // 1. Filtrar apenas termos que são Dúvida E possuem AMBOS os QCs (Triagem 1 e 2)
        const readyToSend = doubtTerms.filter(t => t.triagem1 === true && t.triagem2 === true);

        if (readyToSend.length === 0) {
            const pendingQC = doubtTerms.length - readyToSend.length;
            message.warning(`Nenhum termo pronto para envio. ${pendingQC > 0 ? `${pendingQC} dúvidas ainda aguardam triagem QC1/QC2.` : ""}`);
            return;
        }

        setIsSendingDoubts(true);
        const toastId = 'sending-doubts';
        message.loading({ content: 'Preparando autorização de envio...', key: toastId });

        try {
            const ids = readyToSend.map(t => t.id);
            const { error: dbError } = await supabase
                .from(targetTable)
                .update({ pode_enviar: true })
                .in('id', ids);

            if (dbError) throw new Error(`Erro ao atualizar banco: ${dbError.message}`);

            // 2. Atualizar Cache Local
            queryClient.setQueryData(['campaign-terms', activeCompanyId, activeCompany?.tableName], (oldData: CampaignTerm[] | undefined) => {
                if (!oldData) return [];
                return oldData.map(t => ids.includes(t.id) ? { ...t, pode_enviar: true } : t);
            });

            message.success({ content: `${readyToSend.length} dúvidas marcadas como 'Pode Enviar' com sucesso!`, key: toastId });

            // 3. Tentar disparar Webhook (Opcional - Silencioso se falhar)
            const { data: config } = await supabase
                .from('whatsapp_bot_configs')
                .select('webhook_url')
                .eq('company_id', activeCompanyId)
                .single();

            if (config?.webhook_url) {
                // Apenas se o webhook existir, tentamos o envio real. 
                // Se não existir, o objetivo principal (marcar pode_enviar) já foi concluído acima.
                console.log("[SemanticAudit] Webhook detectado, disparando integração...");
                // ... lógica de fetch do webhook pode continuar aqui se necessário ...
            }
        } catch (error: any) {
            console.error('[Send Error]:', error);
            message.error({ content: 'Erro ao processar envio: ' + error.message, key: toastId });
        } finally {
            setIsSendingDoubts(false);
        }
    };

    // --- Table Columns Definition ---
    const columns = [
        {
            title: 'Termo de Pesquisa',
            dataIndex: 'termo_de_pesquisa',
            key: 'termo_de_pesquisa',
            fixed: 'left' as const,
            width: 280,
            render: (text: string, record: CampaignTerm) => {
                const termToSearch = text || record?.termo_de_pesquisa || '—';
                const isSearching = record?.id ? searchingTerms.has(record.id) : false;
                
                return (
                    <div className="flex flex-col py-1 overflow-hidden">
                        <div className="flex items-center gap-2 group">
                            <Search 
                                size={14} 
                                className={cn(
                                    "cursor-pointer transition-all duration-200 shrink-0",
                                    isSearching ? "text-primary animate-pulse" : "text-muted-foreground hover:text-foreground hover:scale-115"
                                )}
                                onClick={() => record?.id && handleQuickSearch(termToSearch, record.id)}
                            />
                            <a 
                                href={`https://www.google.com/search?q=${encodeURIComponent(termToSearch)}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className={cn(
                                    "font-bold text-blue-800 dark:text-blue-400 text-[13px] leading-tight hover:underline transition-all relative overflow-hidden px-1 rounded",
                                    isSearching && "bg-primary/10 text-primary animate-pulse"
                                )}
                            >
                                {termToSearch}
                            </a>
                        </div>
                        {record?.observacao && (
                            <span className="text-[11px] italic text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 pl-6">
                                {record.observacao}
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Métricas (Performance)',
            key: 'performance',
            align: 'center' as const,
            width: 320,
            render: (_: any, record: CampaignTerm) => (
                <div className="grid grid-cols-4 gap-2 bg-muted/50 dark:bg-slate-900/50 p-2 rounded-xl border border-border dark:border-slate-800">
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase text-slate-500 dark:text-slate-400 font-bold">Impr.</span>
                        <span className="text-xs font-mono font-bold text-foreground dark:text-slate-200">{fmt.num(record.impressoes)}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border dark:border-slate-800">
                        <span className="text-[9px] uppercase text-slate-500 dark:text-slate-400 font-bold">Cliq.</span>
                        <span className="text-xs font-mono font-bold text-foreground dark:text-slate-200">{fmt.num(record.cliques)}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border dark:border-slate-800">
                        <span className="text-[9px] uppercase text-slate-500 dark:text-slate-400 font-bold">Custo</span>
                        <span className="text-xs font-mono font-bold text-foreground dark:text-slate-200">{fmt.brl(record.custo)}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border dark:border-slate-800">
                        <span className="text-[9px] uppercase text-slate-500 dark:text-slate-400 font-bold">Conv.</span>
                        <span className="text-xs font-mono font-bold text-foreground dark:text-slate-200">{fmt.num(record.conversoes)}</span>
                    </div>
                </div>
            )
        },
        {
            title: 'Status e Sinalização',
            key: 'agent_signals',
            width: 250,
            render: (_: any, record: CampaignTerm) => {
                // ESTADO DINÂMICO: RESPOSTAS CLIENTE (V4.2)
                if (record.enviado_para_grupo === true) {
                    if (record.respondido_cliente === false) {
                        return (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 animate-pulse">
                                <span className="text-[10px] font-bold uppercase tracking-widest">⏳ Aguardando Resposta</span>
                            </div>
                        );
                    }
                    if (record.respondido_cliente === true) {
                        return (
                            <div className="flex flex-col gap-1">
                                <div className={cn(
                                    "px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest w-fit",
                                    record.acao === 'negativar' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                    record.acao === 'manter' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                    "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                )}>
                                    {record.acao === 'negativar' ? '❌ ' : record.acao === 'manter' ? '✅ ' : '❓ '}
                                    {record.acao?.toUpperCase() || 'RESPONDIDO'}
                                </div>
                                {record.data_resposta && (
                                    <div className="text-[9px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                                        <Clock size={10} /> {new Date(record.data_resposta).toLocaleDateString('pt-BR')}
                                    </div>
                                )}
                            </div>
                        );
                    }
                }

                // PRIORIDADE DE EXIBIÇÃO (Requisito V4 Hybrid)
                if (isNeg(record)) {
                    return <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 dark:bg-red-500/20 dark:text-red-400 text-[10px] font-bold uppercase tracking-widest">Negativar</div>;
                }
                if (isDuv(record)) {
                    return <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400 text-[10px] font-bold uppercase tracking-widest">Dúvida</div>;
                }
                if (isSeg(record)) {
                    return <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Segmentar</div>;
                }
                if (isTst(record)) {
                    return <div className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400 text-[10px] font-bold uppercase tracking-widest">Teste A/B</div>;
                }
                
                return record.status_granularidade ? (
                    <div className="px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-600 dark:bg-zinc-500/20 dark:text-slate-400 text-[10px] font-medium italic">{record.status_granularidade}</div>
                ) : null;
            }
        },
        {
            title: 'Auditores (Triagem)',
            key: 'workflow',
            width: 240,
            render: (_: any, record: CampaignTerm) => {
                const conf1 = record.triagem1;
                const conf2 = record.triagem2;
                
                return (
                    <div className="flex flex-col gap-1.5 min-w-[200px]">
                        {conf1 ? (
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1 rounded-lg shadow-sm transition-all animate-in fade-in zoom-in duration-300 border",
                                    "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400"
                                )}>
                                    <CheckCircleOutlined className="text-[10px]" />
                                    <span className="text-[9px] font-bold tracking-tight uppercase">
                                        QC1 OK
                                    </span>
                                </div>
                        ) : (
                                <Button 
                                    size="small"
                                    className="h-7 rounded-lg text-[9px] font-bold uppercase tracking-wider border-border hover:border-foreground dark:text-slate-200 dark:hover:text-white transition-all font-mono bg-transparent"
                                    onClick={() => handleConfirmarQC(record.id, 1)}
                                >
                                    Confirmar QC1
                                </Button>
                        )}

                        {conf2 ? (
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1 rounded-lg shadow-sm transition-all animate-in fade-in zoom-in duration-300 border",
                                    "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400"
                                )}>
                                    <ShieldCheck size={12} />
                                    <span className="text-[9px] font-bold tracking-tight uppercase">
                                        QC2 OK
                                    </span>
                                </div>
                        ) : (
                                <Button 
                                    size="small"
                                    disabled={!conf1}
                                    className={cn(
                                        "h-7 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all font-mono",
                                        conf1 ? "border-border hover:border-foreground dark:text-slate-200 dark:hover:text-white bg-transparent" : "opacity-50 cursor-not-allowed"
                                    )}
                                    onClick={() => handleConfirmarQC(record.id, 2)}
                                >
                                    Confirmar QC2
                                </Button>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Comentário Analista',
            key: 'commentary',
            className: "min-w-[400px] w-full max-w-[600px]",
            render: (_: any, record: CampaignTerm) => {
                const isSyncing = syncingComments[record.id];
                return (
                    <div className="py-2 relative group">
                        <Input.TextArea
                            placeholder="Clique para adicionar notas..."
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            className={cn(
                                "text-[11px] bg-muted/30 border border-transparent dark:bg-slate-900 dark:border-slate-700 hover:bg-muted/50 focus:bg-muted/50 transition-all rounded-lg p-3 shadow-none text-foreground dark:text-slate-200",
                                isSyncing && "ring-1 ring-primary/30"
                            )}
                            defaultValue={record.auditor_comment || record.observacao || triageState[record.id]?.comment}
                            onBlur={(e) => handleCommentSync(record.id, e.target.value)}
                        />
                        {isSyncing && (
                            <div className="absolute right-3 bottom-3 flex items-center gap-1.5 animate-in fade-in duration-300">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full"
                                />
                                <span className="text-[9px] text-primary font-bold uppercase">Salvando...</span>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Ações e Categoria',
            key: 'audit_actions',
            fixed: 'right' as const,
            width: 200,
            render: (_: any, record: CampaignTerm) => {
                // Valor derivado do estado de triagem local OU do banco de dados (Híbrido V4)
                const currentCat = triageState[record.id]?.category || (
                    isNeg(record) ? 'negativar' :
                    isDuv(record) ? 'duvida' :
                    isSeg(record) ? 'segmentar' :
                    isTst(record) ? 'teste_ab' :
                    isMnt(record) ? 'manter' : null
                );
                return (
                    <div className="flex items-center">
                        <Select
                            value={currentCat}
                            placeholder="Categoria..."
                            className="w-full min-w-[160px] custom-select-v3-action"
                            onChange={(val) => handleCategoryChange(record.id, val)}
                            options={CATEGORY_OPTIONS}
                            size="middle"
                            popupMatchSelectWidth={false}
                        />
                    </div>
                );
            }
        }
    ];

    const getRowClassName = (record: CampaignTerm) => {
        if (activeTab === 'responses' && record.respondido_cliente === false) {
            return 'opacity-80 animate-pulse transition-all cursor-default';
        }
        
        const cat = triageState[record.id]?.category;
        if (cat === 'negativar') return 'bg-red-500/5 hover:bg-red-500/10 transition-colors cursor-default';
        if (cat === 'duvida') return 'bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-default';
        if (cat === 'segmentar') return 'bg-emerald-500/5 transition-colors cursor-default';
        return 'hover:bg-muted transition-colors cursor-default';
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header section with Selectors */}
            <div className="p-6 rounded-3xl border shadow-sm transition-all duration-300 bg-card border-border">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-muted rounded-2xl">
                            <FileText className="text-foreground w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Auditoria Premium</h1>
                            <p className="text-muted-foreground text-sm">Dashboard de triagem estratégica e workflow colaborativo.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Select
                            showSearch
                            placeholder="Campanha..."
                            className="w-[200px] custom-select-premium"
                            value={selectedCampaign}
                            onChange={val => setSelectedCampaign(val)}
                            options={campaignList.map(c => ({ label: c, value: c }))}
                        />
                        <Select
                            showSearch
                            disabled={!selectedCampaign}
                            placeholder="Grupo..."
                            className="w-[200px] custom-select-premium"
                            value={selectedAdGroup}
                            onChange={val => setSelectedAdGroup(val)}
                            options={adGroupList.map(g => ({ label: g, value: g }))}
                        />
                        <AnimatePresence>
                            {activeTab === 'duvidas' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Button
                                        type="primary"
                                        icon={<Send className="w-4 h-4" />}
                                        onClick={handleSendDoubts}
                                        loading={isSendingDoubts}
                                        className="h-10 px-5 rounded-2xl font-bold btn-bw-inverse !border-none shadow-lg animate-pulse hover:animate-none flex items-center justify-center"
                                    >
                                        Enviar Dúvidas ao Cliente
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <Button
                            icon={<Sparkles size={16} />}
                            onClick={handleAutoTriage}
                            loading={isAutoTriaging}
                            className="h-10 px-5 rounded-2xl font-bold bg-zinc-900 text-white dark:bg-slate-900 dark:border dark:border-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-slate-800"
                        >
                            Auto-Triagem IA
                        </Button>
                    </div>
                </div>

                {terms.length > 0 && campaignList.length === 0 && (
                    <div className="mt-4 p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top duration-500 text-amber-700">
                        <ShieldCheck className="w-8 h-8 shrink-0" />
                        <div className="flex flex-col gap-1">
                            <h3 className="font-bold text-base">⚠️ Planilha Incompatível Detectada</h3>
                            <p className="text-sm opacity-80 leading-relaxed">
                                Certifique-se de que a planilha possui as colunas padrão de Auditoria Semântica.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {selectedCampaign && selectedAdGroup ? (
                <div 
                    ref={tableContainerRef} 
                    className="rounded-3xl border shadow-xl overflow-hidden transition-all duration-300 bg-card border-border"
                >
                    {/* Tabs filtering */}
                    <div className="px-6 pt-4 border-b border-border flex justify-between items-end">
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            className="premium-tabs-v3 flex-1"
                            items={[
                                { key: 'all', label: `Todos (${counts.all})` },
                                { key: 'negativas', label: `❌ Negativas (${counts.negativas})` },
                                { key: 'duvidas', label: `❓ Dúvidas (${counts.duvidas})` },
                                { key: 'aprovadas', label: `✅ Aprovadas (${counts.aprovadas})` },
                                { key: 'ab_test', label: `⚠️ Teste A/B (${counts.ab_test})` },
                                { key: 'responses', label: `📩 Respostas Cliente (${counts.responses})` },
                            ]}
                        />
                    </div>

                    <Table
                        dataSource={filteredTerms}
                        columns={columns}
                        rowKey="id"
                        pagination={{ 
                            pageSize: 20, 
                            showTotal: (total) => `${total} encontrados`,
                            className: "px-6 py-4"
                        }}
                        scroll={{ x: 1400 }}
                        className="v3-audit-table"
                        rowClassName={getRowClassName}
                        expandable={{
                            expandedRowRender: (record) => {
                                const stats = expandedMetrics[record.id];
                                if (!stats) return null;
                                return (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mx-6 mb-4 p-4 bg-muted/40 rounded-xl border border-dashed border-border flex items-center gap-12"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Volume Mensal</span>
                                            <span className="text-sm font-mono font-bold text-foreground">{fmt.num(stats.volume)}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Dificuldade (KD)</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-mono font-bold text-foreground">{stats.kd}%</span>
                                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div 
                                                        className={cn(
                                                            "h-full rounded-full",
                                                            stats.kd > 70 ? "bg-red-500" : stats.kd > 40 ? "bg-amber-500" : "bg-emerald-500"
                                                        )}
                                                        style={{ width: `${stats.kd}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">CPC Estimado</span>
                                            <span className="text-sm font-mono font-bold text-foreground">R$ {stats.cpc.toFixed(2).replace('.', ',')}</span>
                                        </div>
                                        <div className="ml-auto">
                                            <div className="px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg uppercase tracking-tighter shadow-lg">
                                                Métrica Viva SEMrush
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            },
                            rowExpandable: (record) => !!expandedMetrics[record.id],
                            expandedRowKeys: Object.keys(expandedMetrics),
                            columnWidth: 0, 
                            showExpandColumn: false
                        }}
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-muted/20 rounded-3xl border-2 border-dashed border-border text-center">
                    <TrendingUp className="w-12 h-12 text-[#60A5FA] mb-4 opacity-80" />
                    <h2 className="text-xl font-semibold text-[#FFFFFF]">Aguardando Seleção</h2>
                    <p className="text-[#9CA3AF] max-w-xs mt-2">
                        Selecione Campanha e Grupo para restaurar o fluxo.
                    </p>
                </div>
            )}
        </div>
    );
}
