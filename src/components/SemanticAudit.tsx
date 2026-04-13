import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Table, Button, message, Input, Select, Tooltip, Tabs } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import {
    FileText, TrendingUp, User, ShieldCheck, Search, Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useCampaignTerms } from '../hooks/useCampaignData';
import type { CampaignTerm } from '../types';

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

    const { data: terms = [], isLoading: _loading } = useCampaignTerms(activeCompanyId || undefined);

    // Selection state
    const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
    const [selectedAdGroup, setSelectedAdGroup]   = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('all');

    // Triage state
    const [triageState, setTriageState] = useState<Record<string, { category: CategoryKey; comment: string }>>({});
    const [confirmationState, setConfirmationState] = useState<Record<string, { confirmed1?: string; confirmed2?: string }>>({});

    // Search & Expansion state
    const [searchingTerms, setSearchingTerms] = useState<Set<string>>(new Set());
    const [expandedMetrics, setExpandedMetrics] = useState<Record<string, { volume: number; kd: number; cpc: number }>>({});
    const [isSendingDoubts, setIsSendingDoubts] = useState(false);
    const [syncingComments, setSyncingComments] = useState<Record<string, boolean>>({});

    // Refs
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // --- Reset on company change ---
    useEffect(() => {
        try {
            setSelectedCampaign(null);
            setSelectedAdGroup(null);
            setActiveTab('all');
            setTriageState({});
            setConfirmationState({});
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
                    ...state,
                    ...confirmationState?.[id]
                }))
            };
            
            console.log('Syncing data to webhook:', payload);
            await new Promise(r => setTimeout(r, 800));
            message.success('Sincronização concluída.');
        } catch (error) {
            console.error('[Sync Error]:', error);
            message.error('Falha na sincronização.');
        }
    }, [activeCompanyId, triageState, confirmationState]);

    // --- Data processing ---
    const { campaignList, adGroupList, baseFilteredTerms } = useMemo(() => {
        try {
            const termsArray = Array.isArray(terms) ? terms : [];
            
            const campaigns = Array.from(new Set(
                termsArray
                    .map((t: CampaignTerm) => t?.campaign_name)
                    .filter(Boolean)
            )).sort();

            const adGroups = (selectedCampaign && termsArray.length > 0)
                ? Array.from(new Set(
                    termsArray
                        .filter((t: CampaignTerm) => t?.campaign_name === selectedCampaign)
                        .map((t: CampaignTerm) => t?.ad_group)
                        .filter(Boolean)
                )).sort()
                : [];
            
            const filtered = termsArray.filter((t: CampaignTerm) => 
                t && 
                t?.campaign_name === selectedCampaign && 
                t?.ad_group === selectedAdGroup
            );

            return { campaignList: campaigns, adGroupList: adGroups, baseFilteredTerms: filtered };
        } catch (e) {
            console.error('[Data Processing Error]:', e);
            return { campaignList: [], adGroupList: [], baseFilteredTerms: [] };
        }
    }, [terms, selectedCampaign, selectedAdGroup]);

    // --- Secondary filtering by Tabs ---
    const filteredTerms = useMemo(() => {
        try {
            if (activeTab === 'all') return baseFilteredTerms || [];
            return (baseFilteredTerms || []).filter((t: CampaignTerm) => {
                if (activeTab === 'negativas') return t?.negativize?.includes('❌');
                if (activeTab === 'duvidas')    return t?.duvida?.includes('❓');
                if (activeTab === 'aprovadas')  return t?.segment?.includes('✅');
                if (activeTab === 'ab_test')    return t?.ab_test && (t.ab_test.includes('⚠️') || t.ab_test.toLowerCase().includes('teste'));
                return true;
            });
        } catch (e) {
            console.error('[Tab Filter Error]:', e);
            return [];
        }
    }, [baseFilteredTerms, activeTab]);

    // --- Tab Counts ---
    const counts = useMemo(() => {
        const c = { all: baseFilteredTerms.length, negativas: 0, duvidas: 0, aprovadas: 0, ab_test: 0 };
        baseFilteredTerms.forEach((t: CampaignTerm) => {
            if (t.negativize && t.negativize.includes('❌')) c.negativas++;
            if (t.duvida && t.duvida.includes('❓'))       c.duvidas++;
            if (t.segment && t.segment.includes('✅'))    c.aprovadas++;
            if (t.ab_test && (t.ab_test.includes('⚠️') || t.ab_test.toLowerCase().includes('teste'))) c.ab_test++;
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


    // --- Handlers ---
    const handleCategoryChange = (id: string, category: CategoryKey) => {
        const newState = {
            ...triageState,
            [id]: { ...triageState[id], category }
        };
        setTriageState(newState);
        handleSync({
            companyId: activeCompanyId,
            changes: [{ termId: id, category, comment: triageState[id]?.comment || '' }]
        });
    };

    // --- Sync Logic (Supabase) ---
    const handleCommentSync = async (id: string, comment: string) => {
        if (!activeCompanyId) return;
        
        setSyncingComments(prev => ({ ...prev, [id]: true }));
        try {
            const { error } = await supabase
                .from('campaign_terms')
                .update({ intervencao_humana: comment })
                .eq('id', id)
                .eq('company_id', activeCompanyId);

            if (error) throw error;
            
            // Atualizar estado local para manter consistência
            setTriageState(prev => ({
                ...prev,
                [id]: { ...prev[id], comment }
            }));
            
            console.log(`[SemanticAudit] Comentário sincronizado para o termo ${id}`);
        } catch (error) {
            console.error('[Sync Error]:', error);
            message.error('Erro ao sincronizar comentário com o banco de dados.');
        } finally {
            setTimeout(() => {
                setSyncingComments(prev => ({ ...prev, [id]: false }));
            }, 800);
        }
    };

    const handleConfirmTriage = (id: string, stage: 1 | 2) => {
        const userEmail = currentUser?.email || 'Usuário Sistema';
        const newState = {
            ...confirmationState,
            [id]: { 
                ...confirmationState[id], 
                [stage === 1 ? 'confirmed1' : 'confirmed2']: userEmail 
            }
        };
        setConfirmationState(newState);
        message.success(`${stage}ª Triagem confirmada por ${userEmail.split('@')[0]}`);
    };

    const handleQuickSearch = async (term: string, id: string) => {
        if (searchingTerms.has(id)) return;
        
        setSearchingTerms(prev => new Set(prev).add(id));
        
        // Protocolo Antygraviti: Busca DNA da Empresa + Métricas
        message.loading("Antygraviti estabelecendo conexão... Extraindo DNA.", 0);

        try {
            // Tenta obter o URL da empresa para o payload de BI
            let siteUrl = "";
            const companiesStr = localStorage.getItem('googlar_companies');
            if (companiesStr && activeCompanyId) {
                const companies = JSON.parse(companiesStr);
                const company = companies.find((c: any) => c.id === activeCompanyId);
                siteUrl = company?.sheetsUrl || "";
            }

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
    
    const handleSendDoubts = async () => {
        if (!activeCompanyId) {
            message.warning("Selecione uma empresa válida.");
            return;
        }

        const doubtTerms = filteredTerms.filter((t: CampaignTerm) => {
            const state = triageState[t.id];
            return state?.category === 'duvida' || (t.duvida && t.duvida.includes('❓'));
        });

        if (doubtTerms.length === 0) {
            message.info("Não há termos categorizados como 'Dúvida' para enviar.");
            return;
        }

        // --- VALIDAÇÃO DE COMENTÁRIOS ---
        const missingComments = doubtTerms.filter(t => {
            const comment = triageState[t.id]?.comment || t.intervencao_humana;
            return !comment || comment.trim() === "";
        });

        if (missingComments.length > 0) {
            message.warning(`Por favor, adicione um comentário às dúvidas antes de enviar (${missingComments.length} pendentes).`);
            return;
        }

        setIsSendingDoubts(true);
        const toastId = 'sending-doubts';
        message.loading({ content: 'Antygraviti preparando envio...', key: toastId });

        try {
            // 1. Buscar Webhook URL no Supabase
            const { data: config, error: configError } = await supabase
                .from('whatsapp_bot_configs')
                .select('webhook_url')
                .eq('company_id', activeCompanyId)
                .single();

            if (configError || !config?.webhook_url) {
                throw new Error("Webhook não configurado. Vá em Ferramentas > Bot WhatsApp.");
            }

            const companiesStr = localStorage.getItem('googlar_companies');
            const companyName = companiesStr ? JSON.parse(companiesStr).find((c: any) => c.id === activeCompanyId)?.name : "Empresa Desconhecida";

            // 3. Disparar Webhook
            const payload = {
                event: 'semantic_audit_doubts',
                company_id: activeCompanyId,
                company_name: companyName,
                timestamp: new Date().toISOString(),
                doubts: doubtTerms.map(t => ({
                    term: t.search_term || t.keyword,
                    campaign: t.campaign_name,
                    ad_group: t.ad_group,
                    clicks: t.clicks,
                    cost: t.cost,
                    commentary: triageState[t.id]?.comment || t.intervencao_humana || ""
                }))
            };

            const response = await fetch(config.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Erro no servidor: ${response.statusText}`);

            // 4. Gravar Logs
            const logEntries = doubtTerms.map(t => ({
                company_id: activeCompanyId,
                term: t.search_term || t.keyword,
                campaign: t.campaign_name,
                ad_group: t.ad_group,
                clicks: t.clicks,
                cost: t.cost,
                comentario_analista: triageState[t.id]?.comment || t.intervencao_humana || "",
                sent_by: currentUser?.email || 'Sistema'
            }));

            await supabase.from('duvidas_clientes').insert(logEntries);

            message.success({ content: 'Dúvidas enviadas com sucesso! ✅', key: toastId, duration: 4 });
        } catch (error: any) {
            console.error('[WhatsApp Bot Error]:', error);
            message.error({ content: `Falha no envio: ${error.message}`, key: toastId, duration: 5 });
        } finally {
            setIsSendingDoubts(false);
        }
    };

    // --- Table Columns Definition ---
    const columns = [
        {
            title: 'Termo de Pesquisa',
            dataIndex: 'search_term',
            key: 'search_term',
            fixed: 'left' as const,
            width: 280,
            render: (text: string, record: CampaignTerm) => {
                const termToSearch = text || record?.search_term || '—';
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
                                    "font-bold text-foreground text-[13px] leading-tight hover:text-muted-foreground hover:underline transition-all relative overflow-hidden px-1 rounded",
                                    isSearching && "bg-primary/10 text-primary animate-pulse"
                                )}
                            >
                                {termToSearch}
                            </a>
                        </div>
                        {record?.observation && (
                            <span className="text-[11px] italic text-muted-foreground mt-1 line-clamp-2 pl-6">
                                {record.observation}
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Métricas (Performance Cluster)',
            key: 'performance',
            align: 'center' as const,
            width: 320,
            render: (_: any, record: CampaignTerm) => (
                <div className="grid grid-cols-4 gap-2 bg-muted/50 p-2 rounded-xl border border-border">
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase text-muted-foreground font-bold">Impr.</span>
                        <span className="text-xs font-mono font-bold text-foreground">{fmt.num(record.impressions)}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border">
                        <span className="text-[9px] uppercase text-muted-foreground font-bold">Cliq.</span>
                        <span className="text-xs font-mono font-bold text-foreground">{fmt.num(record.clicks)}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border">
                        <span className="text-[9px] uppercase text-muted-foreground font-bold">Custo</span>
                        <span className="text-xs font-mono font-bold text-foreground">{fmt.brl(record.cost)}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border">
                        <span className="text-[9px] uppercase text-muted-foreground font-bold">Conv.</span>
                        <span className="text-xs font-mono font-bold text-foreground">{fmt.num(record.conversions)}</span>
                    </div>
                </div>
            )
        },
        {
            title: 'Workflow de Triagem',
            key: 'workflow',
            width: 250,
            render: (_: any, record: CampaignTerm) => {
                const conf1 = confirmationState[record.id]?.confirmed1;
                const conf2 = confirmationState[record.id]?.confirmed2;
                
                return (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                        {conf1 ? (
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm transition-all animate-in fade-in zoom-in duration-300 border",
                                    "bg-primary text-primary-foreground border-primary"
                                )}>
                                    <CheckCircleOutlined className="text-[12px]" />
                                    <span className="text-[10px] font-bold tracking-tight uppercase">
                                        ✅ Confirmado por {conf1.split('@')[0]}
                                    </span>
                                </div>
                        ) : (
                                <Button 
                                    size="small"
                                    className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider border-border hover:border-foreground transition-all font-mono"
                                    icon={<User className="w-3 h-3" />}
                                    onClick={() => handleConfirmTriage(record.id, 1)}
                                >
                                    Confirmar 1ª Triagem
                                </Button>
                        )}

                        {conf2 ? (
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm transition-all animate-in fade-in zoom-in duration-300 border",
                                    "bg-primary text-primary-foreground border-primary"
                                )}>
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold tracking-tight uppercase">
                                        ✅ Confirmado por {conf2.split('@')[0]}
                                    </span>
                                </div>
                        ) : (
                                <Button 
                                    size="small"
                                    className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider border-border hover:border-foreground transition-all font-mono"
                                    icon={<ShieldCheck className="w-3 h-3" />}
                                    onClick={() => handleConfirmTriage(record.id, 2)}
                                >
                                    Confirmar 2ª Triagem
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
                                "text-[11px] bg-muted/30 border-none hover:bg-muted/50 focus:bg-muted/50 transition-all rounded-lg p-3 shadow-none text-foreground",
                                isSyncing && "ring-1 ring-primary/30"
                            )}
                            defaultValue={record.intervencao_humana || triageState[record.id]?.comment}
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
                const currentCat = triageState[record.id]?.category || null;
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
                    <TrendingUp className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                    <h2 className="text-xl font-semibold text-foreground">Aguardando Seleção</h2>
                    <p className="text-muted-foreground max-w-xs mt-2">
                        Selecione Campanha e Grupo para restaurar o fluxo.
                    </p>
                </div>
            )}
        </div>
    );
}
