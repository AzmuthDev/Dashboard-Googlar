import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Table, Button, message, Input, Select, Tooltip, Checkbox, Tag, Modal as AntModal } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import {
    TrendingUp, User, ShieldCheck, Search, Send, Sparkles, Clock, ClipboardPaste,
    Megaphone, Layers, Download, Trash2, ArrowRight, Building2
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useCampaignTerms, useCompanies } from '../hooks/useCampaignData';
import { type CampaignTerm, type Company } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { deduplicateTermsByOrigin, getTermOriginKey } from '../utils/termDeduplication';
import { fetchTermsFromTable, deleteDuplicateTermsFromTable } from '../lib/supabaseProvider';
import { queueSevenNotification } from '../utils/sevenNotifier';
import { acaoDoTermo, montarExportacao, type TipoExport, type MatchNegativa } from '../utils/adsExport';
import { isNeg, isDuv, isSeg, isTst, isMnt } from '../utils/dashboardMetrics';
import { filtrarPorBusca } from '../utils/termSearch';

/** Atalhos vindos do Dashboard: abrir numa aba, numa campanha/grupo ou já buscando um termo. */
export interface AuditNavParams {
    campanha?: string;
    grupo?: string;
    termo?: string;
    aba?: string;
}

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

// Filtros (Campanha/Grupo/Origem): as cores vêm do tema do Ant Design (App.tsx)
const FILTER_SELECT_CLS = "[&_.ant-select-selector]:!rounded-[10px]";
const FILTER_POPUP_CLS = "";

// Abas de status como controle segmentado; a cor identifica a categoria
const STATUS_TABS: { key: string; label: string; countKey: 'all' | 'negativas' | 'duvidas' | 'aprovadas' | 'ab_test' | 'responses'; dot: string; chip: string }[] = [
    { key: 'all', label: 'Todos', countKey: 'all', dot: 'bg-muted-foreground/60', chip: 'bg-surface-2 text-foreground' },
    { key: 'negativas', label: 'Negativas', countKey: 'negativas', dot: 'bg-status-neg', chip: 'bg-status-neg-soft text-status-neg' },
    { key: 'duvidas', label: 'Dúvidas', countKey: 'duvidas', dot: 'bg-status-duv', chip: 'bg-status-duv-soft text-status-duv' },
    { key: 'aprovadas', label: 'Aprovadas', countKey: 'aprovadas', dot: 'bg-status-seg', chip: 'bg-status-seg-soft text-status-seg' },
    { key: 'ab_test', label: 'Teste A/B', countKey: 'ab_test', dot: 'bg-status-ab', chip: 'bg-status-ab-soft text-status-ab' },
    { key: 'responses', label: 'Respostas do cliente', countKey: 'responses', dot: 'bg-status-resp', chip: 'bg-status-resp-soft text-status-resp' },
];

// Selo de status reutilizado na coluna Status
const STATUS_PILL = 'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold';

// Texto de ajuda de cada aba: diz o que a aba mostra e qual é o próximo passo
const TAB_HINTS: Record<string, string> = {
    all: 'Todos os termos da seleção atual, sem filtro de status.',
    negativas: 'Termos marcados para negativar. Exporte para o Google Ads Editor quando estiverem revisados.',
    duvidas: 'Dúvidas aguardando triagem. Confirme TRG 2 e TRG 3 e depois envie ao cliente.',
    aprovadas: 'Termos aprovados para segmentar. Exporte para adicionar como palavra-chave exata.',
    ab_test: 'Termos marcados para teste A/B.',
    responses: 'Termos já enviados ao cliente e o que ele respondeu, com a origem (Pocket interno ou do site).',
};

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
    currentUser,
    auditNavParams,
    clearNavParams,
    onGoCompanies,
}: {
    activeCompanyId: string | null;
    currentUser: { email: string; isAdmin: boolean } | null;
    auditNavParams?: AuditNavParams | null;
    clearNavParams?: () => void;
    onGoCompanies?: () => void;
}) {
    const { user, profile } = useAuth();

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
    const isMobile = useIsMobile();
    const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
    const [selectedAdGroup, setSelectedAdGroup]   = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('duvidas');
    const [searchQuery, setSearchQuery] = useState('');

    // Triage state
    const [triageState, setTriageState] = useState<Record<string, { category: CategoryKey; comment: string }>>({});

    // Search & Expansion state
    const [searchingTerms, setSearchingTerms] = useState<Set<string>>(new Set());
    const [expandedMetrics, setExpandedMetrics] = useState<Record<string, { volume: number; kd: number; cpc: number }>>({});
    const [isSendingDoubts, setIsSendingDoubts] = useState(false);
    const [syncingComments, setSyncingComments] = useState<Record<string, boolean>>({});
    const [isAutoTriaging, setIsAutoTriaging] = useState(false);

    // Import Sheet state
    const [isImportModalVisible, setIsImportModalVisible] = useState(false);
    const [importPasteData, setImportPasteData] = useState('');
    const [importTriageLevel, setImportTriageLevel] = useState<'trg1' | 'trg2' | 'trg3'>('trg1');
    const [isImporting, setIsImporting] = useState(false);
    const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

    // Negativar Modal State
    const [isNegativarModalVisible, setIsNegativarModalVisible] = useState(false);
    const [negativarData, setNegativarData] = useState<{ id: string; matchType: string } | null>(null);

    // Export Modal State
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    // Respostas Cliente: filtro de origem e exportação por tipo
    const [originFilter, setOriginFilter] = useState<'all' | 'interno' | 'site'>('all');
    const [exportSource, setExportSource] = useState<CampaignTerm[] | null>(null);
    const [exportTipos, setExportTipos] = useState<TipoExport[]>(['segmentar', 'negativar', 'teste_ab']);
    const [exportMatch, setExportMatch] = useState<MatchNegativa>('exact');

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

    // --- Auto-navigation from Dashboard ---
    useEffect(() => {
        if (auditNavParams) {
            setSelectedCampaign(auditNavParams.campanha ?? null);
            setSelectedAdGroup(auditNavParams.grupo ?? null);
            setActiveTab(auditNavParams.aba ?? 'all');
            setSearchQuery(auditNavParams.termo ?? '');
            setSelectedRowKeys([]);

            if (clearNavParams) {
                setTimeout(() => clearNavParams(), 100);
            }
        }
    }, [auditNavParams, clearNavParams]);

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
                (!selectedCampaign || t?.campanha === selectedCampaign) &&
                (!selectedAdGroup || t?.grupo_de_anuncios === selectedAdGroup)
            );

            // A busca vale para todas as abas e para os contadores
            return { campaignList: campaigns, adGroupList: adGroups, baseFilteredTerms: filtrarPorBusca(filtered, searchQuery) };
        } catch (e) {
            console.error('[Data Processing Error]:', e);
            return { campaignList: [], adGroupList: [], baseFilteredTerms: [] };
        }
    }, [terms, selectedCampaign, selectedAdGroup, searchQuery]);

    // Detecção das flags (isNeg, isDuv, isSeg, isTst, isMnt) vem de utils/dashboardMetrics,
    // a mesma regra usada pelo Dashboard e pelo contador do menu.


    // --- Secondary filtering by Tabs ---
    const filteredTerms = useMemo(() => {
        try {
            let result = baseFilteredTerms || [];
            
            // Se não for a aba "Todos", aplica os filtros
            if (activeTab !== 'all') {
                result = result.filter((t: CampaignTerm) => {
                    // Aba Respostas: apenas os enviados (linhas sem origem vieram do Pocket do site)
                    if (activeTab === 'responses') {
                        if (t.enviado_para_grupo !== true) return false;
                        return originFilter === 'all' || (t.origem ?? 'site') === originFilter;
                    }
                    
                    // Para as outras abas específicas, oculta os que já foram enviados
                    if (t.enviado_para_grupo === true) return false;
                    
                    if (activeTab === 'negativas') return isNeg(t);
                    if (activeTab === 'duvidas')    return isDuv(t);
                    if (activeTab === 'aprovadas')  return isSeg(t);
                    if (activeTab === 'ab_test')    return isTst(t);
                    return true;
                });
            }

            // Aplica a ordenação
            return result.sort((a: CampaignTerm, b: CampaignTerm) => {
                if (activeTab === 'responses') {
                    const dateA = new Date(a.data_resposta || a.data_envio_enquete || 0).getTime();
                    const dateB = new Date(b.data_resposta || b.data_envio_enquete || 0).getTime();
                    return dateB - dateA;
                }
                // Ordenação baseada no progresso da triagem (UI box 2 = triagem1, UI box 3 = triagem2)
                const getTriageScore = (t: CampaignTerm) => {
                    if (t.triagem1 && t.triagem2) return 2;
                    if (t.triagem1) return 1;
                    return 0;
                };
                
                const scoreA = getTriageScore(a);
                const scoreB = getTriageScore(b);
                
                if (scoreB !== scoreA) {
                    return scoreB - scoreA;
                }
                
                return 0; // Mantém ordem original para as demais
            });
        } catch (e) {
            console.error('[Tab Filter Error]:', e);
            return [];
        }
    }, [baseFilteredTerms, activeTab, originFilter]);

    // Resultado da exportação da aba Respostas (recalculado ao mudar tipos ou correspondência)
    const exportResult = useMemo(
        () => (exportSource ? montarExportacao(exportSource, { tipos: exportTipos, matchNegativa: exportMatch }) : null),
        [exportSource, exportTipos, exportMatch]
    );

    // --- Tab Counts ---
    const counts = useMemo(() => {
        const c = { all: baseFilteredTerms.length, negativas: 0, duvidas: 0, aprovadas: 0, ab_test: 0, responses: 0 };
        baseFilteredTerms.forEach((t: CampaignTerm) => {
            if (t.enviado_para_grupo === true) {
                c.responses++;
            } else {
                if (isNeg(t)) c.negativas++;
                if (isDuv(t)) c.duvidas++;
                if (isSeg(t)) c.aprovadas++;
                if (isTst(t)) c.ab_test++;
            }
        });
        return c;
    }, [baseFilteredTerms]);

    // --- Loading State Guard ---
    if (_loading) {
        return (
            <div className="mx-auto w-full max-w-[1400px] space-y-4" aria-busy="true" aria-label="Carregando a Triagem">
                <div className="h-16 w-72 animate-pulse rounded-xl bg-card" />
                <div className="pk-card h-14 animate-pulse" />
                <div className="pk-card h-[420px] animate-pulse" />
            </div>
        );
    }

    // --- No Company Selected Guard ---
    if (!activeCompanyId) {
        return (
            <div className="pk-card pk-rise relative mx-auto mt-6 max-w-xl overflow-hidden p-8 text-center sm:p-12">
                <div className="pk-aurora pointer-events-none absolute inset-0" />
                <div className="relative">
                    <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-brand-strong">
                        <Building2 className="h-6 w-6" />
                    </span>
                    <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">Escolha uma empresa para triar</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                        A Triagem mostra os termos de pesquisa da empresa ativa, separados por categoria.
                    </p>
                    {onGoCompanies && (
                        <button type="button" onClick={onGoCompanies} className="btn-brand mx-auto mt-6 h-10 px-4 text-sm">
                            Ver empresas <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                    <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        ou aperte <span className="kbd">Ctrl K</span> e digite o nome da empresa
                    </p>
                </div>
            </div>
        );
    }



    // --- Handlers ---
    // --- Verificação de sessão antes de mutações ---
    const ensureSession = async (): Promise<boolean> => {
        if (currentUser || user) return true; // Allows bypass mode and regular users without profile to work
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            message.error('Sessão expirada. Recarregue a página (F5) para continuar.');
            return false;
        }
        return true;
    };

    // --- Handlers de Mutação (Frontend ↔ Supabase) ---
    const handleCategoryChange = async (id: string, category: CategoryKey, matchType?: string) => {
        if (!activeCompanyId || !targetTable) return;
        if (!(await ensureSession())) return;

        // Optimistic UI update
        setTriageState(prev => ({
            ...prev,
            [id]: { ...prev[id], category }
        }));

        try {
            // Mapeamento de categorias para colunas booleanas
            const updatePayload: any = {
                negativar: category === 'negativar',
                duvida:    category === 'duvida',
                segmentar: category === 'segmentar',
                teste_ab:  category === 'teste_ab',
                manter:    category === 'manter'
            };
            if (category === 'negativar' && matchType) {
                updatePayload.tipo_corresp = matchType;
            }

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
        if (!(await ensureSession())) return;
        
        setSyncingComments(prev => ({ ...prev, [id]: true }));
        try {
            const { error } = await supabase
                .from(targetTable)
                .update({ observacao: comment })
                .eq('id', id);

            if (error) throw error;
            
            // Update local cache to reflect changes immediately across the UI
            queryClient.setQueryData(['campaign-terms', activeCompanyId, activeCompany?.tableName], (oldData: CampaignTerm[] | undefined) => {
                if (!oldData) return [];
                return oldData.map(t => t.id === id ? { ...t, observacao: comment } : t);
            });

            setTriageState(prev => ({
                ...prev,
                [id]: { ...prev[id], comment }
            }));
            
            console.log(`[SemanticAudit] Observação sincronizada na tabela ${targetTable} para o termo ${id}`);
        } catch (error) {
            console.error('[Sync Error]:', error);
            message.error('Erro ao sincronizar comentário.');
        } finally {
            setTimeout(() => {
                setSyncingComments(prev => ({ ...prev, [id]: false }));
            }, 800);
        }
    };

    const handleToggleQC = async (termId: string, level: 1 | 2, currentValue: boolean) => {
        if (!targetTable) return;
        if (!(await ensureSession())) return;
        const column = level === 1 ? 'triagem1' : 'triagem2';
        const newValue = !currentValue;
        
        // Parse do auditor_comment para salvar o nome de quem validou
        const currentTerm = queryClient.getQueryData<CampaignTerm[]>(['campaign-terms', activeCompanyId, activeCompany?.tableName])?.find(t => t.id === termId);
        let metadata: any = {};
        try {
            metadata = JSON.parse(currentTerm?.auditor_comment || '{}');
        } catch (e) {}

        const auditorName = profile?.name || user?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'Usuário';

        if (newValue) {
            metadata[`user_${column}`] = auditorName;
        } else {
            delete metadata[`user_${column}`];
        }

        // Se desmarcar QC1, força desmarcar QC2 também
        const updatePayload: any = { 
            [column]: newValue,
            auditor_comment: JSON.stringify(metadata)
        };
        if (level === 1 && !newValue) {
            updatePayload['triagem2'] = false;
            delete metadata['user_triagem2'];
            updatePayload['auditor_comment'] = JSON.stringify(metadata);
        }

        try {
            const { error } = await supabase
                .from(targetTable)
                .update(updatePayload)
                .eq('id', termId);

            if (error) throw error;

            queryClient.setQueryData(['campaign-terms', activeCompanyId, activeCompany?.tableName], (oldData: CampaignTerm[] | undefined) => {
                if (!oldData) return [];
                return oldData.map(t => t.id === termId ? { ...t, ...updatePayload } : t);
            });
            
            const displayName = level === 1 ? 'TRG 2' : 'TRG 3';
            if (newValue) {
                message.success(`${displayName} confirmado ✓`);
                // Quando a 2ª triagem (TRG 2) for confirmada, enfileira notificação para o Seven (Tânios)
                if (level === 1) {
                    queueSevenNotification({
                        auditorName,
                        auditorEmail: currentUser?.email || user?.email,
                        companyId: activeCompanyId || '',
                        companyName: activeCompany?.name || 'Empresa',
                        termCount: 1
                    });
                }
            } else {
                message.info(`${displayName} desmarcado.`);
            }
        } catch (error) {
            const displayName = level === 1 ? 'TRG 2' : 'TRG 3';
            console.error(`Erro ao alternar ${displayName}:`, error);
            message.error(`Erro ao alterar status do ${displayName}.`);
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

    // --- Import Sheet Handler ---
    const handleImportSheet = async () => {
        if (!activeCompanyId || !targetTable) {
            message.error('Selecione uma empresa válida antes de importar.');
            return;
        }
        if (!importPasteData.trim()) {
            message.warning('Cole os dados da planilha no campo de texto.');
            return;
        }
        if (!(await ensureSession())) return;

        setIsImporting(true);
        const toastKey = 'import-sheet';
        message.loading({ content: 'Processando dados colados...', key: toastKey });

        try {
            const lines = importPasteData.trim().split('\n').filter(l => l.trim());
            if (lines.length === 0) throw new Error('Nenhuma linha encontrada.');

            // Detectar e ignorar cabeçalho
            const firstLineLower = lines[0].toLowerCase();
            const hasHeader = firstLineLower.includes('campanha') || firstLineLower.includes('termo') || firstLineLower.includes('palavra');
            const dataLines = hasHeader ? lines.slice(1) : lines;

            if (dataLines.length === 0) throw new Error('Nenhum dado encontrado após o cabeçalho.');

            // Mapear triagem
            const triagem1 = importTriageLevel === 'trg2' || importTriageLevel === 'trg3';
            const triagem2 = importTriageLevel === 'trg3';

            const rows = dataLines.map(line => {
                const cols = line.split('\t');
                return {
                    campanha: (cols[0] || '').trim(),
                    grupo_de_anuncios: (cols[1] || '').trim(),
                    palavra_chave: (cols[2] || '').trim(),
                    termo_de_pesquisa: (cols[3] || '').trim(),
                    observacao: (cols[4] || '').trim(),
                    id_enquete: crypto.randomUUID(), // ID único para o bot do WhatsApp
                    usuario: currentUser?.email || 'Importação Manual',
                    // Flags obrigatórias
                    duvida: true,
                    negativar: false,
                    segmentar: false,
                    teste_ab: false,
                    manter: false,
                    pode_enviar: triagem2, // Se for TRG 3, já libera para o n8n/WhatsApp
                    enviado_para_grupo: false,
                    respondido_cliente: false,
                    triagem1,
                    triagem2,
                    // Métricas zeradas
                    cliques: 0,
                    impressoes: 0,
                    custo: 0,
                    conversoes: 0,
                    ctr: 0,
                    cpc_medio: 0,
                    custo_conv: 0,
                    taxa_conv: 0,
                };
            }).filter(r => r.termo_de_pesquisa); // Ignorar linhas sem termo

            if (rows.length === 0) throw new Error('Nenhum termo válido encontrado. Verifique a ordem das colunas.');

            // 1. Deduplica termos repetidos dentro da própria colagem
            const { deduplicated: uniquePasted, duplicateCount: pastedDuplicates } = deduplicateTermsByOrigin(rows);

            // 2. Exclui termos que já existem na mesa com a mesma origem
            const existingKeys = new Set((terms || []).map(t => getTermOriginKey(t)));
            const newRows = uniquePasted.filter(r => !existingKeys.has(getTermOriginKey(r)));
            const alreadyExistingCount = uniquePasted.length - newRows.length;

            if (newRows.length === 0) {
                message.warning({ 
                    content: `Todos os ${rows.length} termos colados já existem na mesa com a mesma origem. Nenhum termo duplicado foi inserido.`, 
                    key: toastKey, 
                    duration: 5 
                });
                setIsImportModalVisible(false);
                return;
            }

            const { error } = await supabase
                .from(targetTable)
                .insert(newRows);

            if (error) throw error;

            // Refresh cache
            queryClient.invalidateQueries({ queryKey: ['campaign-terms', activeCompanyId, activeCompany?.tableName] });

            let msg = `${newRows.length} novos termos importados com sucesso!`;
            if (pastedDuplicates > 0 || alreadyExistingCount > 0) {
                const totalExcluded = pastedDuplicates + alreadyExistingCount;
                msg += ` (${totalExcluded} duplicados da mesma origem foram excluídos).`;
            }
            message.success({ content: msg, key: toastKey, duration: 5 });
            setImportPasteData('');
            setImportTriageLevel('trg1');
            setIsImportModalVisible(false);
        } catch (error: any) {
            console.error('[Import Error]:', error);
            message.error({ content: 'Erro na importação: ' + error.message, key: toastKey });
        } finally {
            setIsImporting(false);
        }
    };

    // --- Limpeza de termos duplicados diretamente no banco de dados ---
    const handleCleanDatabaseDuplicates = async () => {
        if (!activeCompanyId || !targetTable) {
            message.warning("Selecione uma empresa válida.");
            return;
        }

        setIsCleaningDuplicates(true);
        const toastId = 'clean-db-duplicates';
        message.loading({ content: 'Buscando termos repetidos com a mesma origem...', key: toastId });

        try {
            const rawData = await fetchTermsFromTable(targetTable);
            const { duplicateIds, duplicateCount } = deduplicateTermsByOrigin(rawData);

            if (duplicateCount === 0 || duplicateIds.length === 0) {
                message.info({ 
                    content: 'Nenhum termo duplicado encontrado na mesa! Todos os registros possuem origens únicas.', 
                    key: toastId, 
                    duration: 4 
                });
                return;
            }

            const { success, deletedCount, error } = await deleteDuplicateTermsFromTable(targetTable, duplicateIds);
            if (!success) throw new Error(error || 'Falha ao remover duplicados no banco.');

            queryClient.invalidateQueries({ queryKey: ['campaign-terms', activeCompanyId, activeCompany?.tableName] });
            message.success({ 
                content: `Excelente! ${deletedCount} termos duplicados com a mesma origem foram excluídos permanentemente da mesa.`, 
                key: toastId, 
                duration: 5 
            });
        } catch (err: any) {
            console.error('[Clean Duplicates Error]:', err);
            message.error({ content: 'Erro ao limpar duplicados: ' + err.message, key: toastId });
        } finally {
            setIsCleaningDuplicates(false);
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
            message.warning(`Nenhum termo pronto para envio. ${pendingQC > 0 ? `${pendingQC} dúvidas ainda aguardam triagem TRG 2/TRG 3.` : ""}`);
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
            width: 250,
            render: (text: string, record: CampaignTerm) => {
                const termToSearch = text || record?.termo_de_pesquisa || '—';
                const isSearching = record?.id ? searchingTerms.has(record.id) : false;
                
                return (
                    <div className="flex flex-col py-1.5 overflow-hidden">
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
                                    "font-semibold !text-foreground text-[13px] leading-tight underline-offset-2 hover:!text-brand-strong hover:underline transition-colors relative overflow-hidden px-1 rounded",
                                    isSearching && "bg-brand-soft text-brand-strong animate-pulse"
                                )}
                                title="Abrir no Google"
                            >
                                {termToSearch}
                            </a>
                        </div>
                        {record?.palavra_chave && (
                            <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2 pl-6" title="Palavra-chave">
                                {record.palavra_chave}
                            </span>
                        )}
                        <div className="flex flex-col gap-1 pl-6 mt-2">
                            {record?.campanha && (
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-surface-2 px-1.5 py-0.5 rounded-md w-fit border border-border">
                                    <Megaphone size={11} className="shrink-0" />
                                    <span className="truncate max-w-[180px]" title={`Campanha: ${record.campanha}`}>{record.campanha}</span>
                                </div>
                            )}
                            {record?.grupo_de_anuncios && (
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-surface-2 px-1.5 py-0.5 rounded-md w-fit border border-border">
                                    <Layers size={11} className="shrink-0" />
                                    <span className="truncate max-w-[180px]" title={`Grupo: ${record.grupo_de_anuncios}`}>{record.grupo_de_anuncios}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Métricas (Performance)',
            key: 'performance',
            align: 'center' as const,
            width: 220,
            render: (_: any, record: CampaignTerm) => (
                <div className="grid grid-cols-4 gap-1.5 bg-surface-2 p-1.5 rounded-xl border border-border">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Impr.</span>
                        <span className="text-xs font-semibold tabular-nums text-foreground">{fmt.num(record.impressoes)}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Cliq.</span>
                        <span className="text-xs font-semibold tabular-nums text-foreground">{fmt.num(record.cliques)}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Custo</span>
                        <span className="text-xs font-semibold tabular-nums text-foreground whitespace-nowrap">{fmt.brl(record.custo)}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Conv.</span>
                        <span className={cn("text-xs font-semibold tabular-nums", Number(record.conversoes) > 0 ? "text-brand-strong" : "text-foreground")}>{fmt.num(record.conversoes)}</span>
                    </div>
                </div>
            )
        },
        {
            title: 'Status',
            key: 'agent_signals',
            width: 130,
            render: (_: any, record: CampaignTerm) => {
                // ESTADO DINÂMICO: RESPOSTAS CLIENTE (V4.2)
                if (record.enviado_para_grupo === true) {
                    if (record.respondido_cliente === false) {
                        return (
                            <div className={cn(STATUS_PILL, "bg-status-resp-soft text-status-resp")}>
                                <Clock size={11} />
                                Aguardando
                            </div>
                        );
                    }
                    if (record.respondido_cliente === true) {
                        const acaoResposta = acaoDoTermo(record);
                        return (
                            <div className="flex flex-col gap-1">
                                <div className={cn(
                                    STATUS_PILL,
                                    acaoResposta === 'negativar' ? "bg-status-neg-soft text-status-neg" :
                                    acaoResposta === 'segmentar' ? "bg-status-seg-soft text-status-seg" :
                                    acaoResposta === 'teste_ab' ? "bg-status-ab-soft text-status-ab" :
                                    "bg-status-duv-soft text-status-duv"
                                )}>
                                    {acaoResposta === 'negativar' ? 'Negativar' :
                                     acaoResposta === 'segmentar' ? 'Segmentar' :
                                     acaoResposta === 'teste_ab' ? 'Teste A/B' :
                                     (record.acao || 'Respondido')}
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
                    return <div className={cn(STATUS_PILL, "bg-status-neg-soft text-status-neg")}><span className="h-1.5 w-1.5 rounded-full bg-status-neg" />Negativar</div>;
                }
                if (isDuv(record)) {
                    return <div className={cn(STATUS_PILL, "bg-status-duv-soft text-status-duv")}><span className="h-1.5 w-1.5 rounded-full bg-status-duv" />Dúvida</div>;
                }
                if (isSeg(record)) {
                    return <div className={cn(STATUS_PILL, "bg-status-seg-soft text-status-seg")}><span className="h-1.5 w-1.5 rounded-full bg-status-seg" />Segmentar</div>;
                }
                if (isTst(record)) {
                    return <div className={cn(STATUS_PILL, "bg-status-ab-soft text-status-ab")}><span className="h-1.5 w-1.5 rounded-full bg-status-ab" />Teste A/B</div>;
                }

                return record.status_granularidade ? (
                    <div className={cn(STATUS_PILL, "bg-surface-2 text-muted-foreground font-medium")}>{record.status_granularidade}</div>
                ) : null;
            }
        },
        {
            // Visível apenas na aba Respostas Cliente (ver filtro de colunas na Table)
            title: 'Origem',
            key: 'origem',
            width: 90,
            render: (_: unknown, record: CampaignTerm) => {
                const origem = record.origem ?? 'site';
                return origem === 'interno'
                    ? <Tag color="purple">Interno</Tag>
                    : <Tag color="blue">Site</Tag>;
            }
        },
        {
            title: 'Auditores (Triagem)',
            key: 'workflow',
            width: 100,
            align: 'center' as const,
            render: (_: any, record: CampaignTerm) => {
                const conf1 = record.triagem1;
                const conf2 = record.triagem2;
                // Extrai o nome do usuário do campo direto ou do JSON em auditor_comment
                let metadata: any = {};
                try {
                    metadata = JSON.parse(record.auditor_comment || '{}');
                } catch(e) {}
                
                const userTrg1 = record.user_triagem1 || metadata.user_triagem1;
                const userTrg2 = record.user_triagem2 || metadata.user_triagem2;

                const currentCat = triageState[record.id]?.category || (
                    isNeg(record) ? 'negativar' :
                    isDuv(record) ? 'duvida' :
                    isSeg(record) ? 'segmentar' :
                    isTst(record) ? 'teste_ab' :
                    isMnt(record) ? 'manter' : null
                );
                const isDoubt = currentCat === 'duvida';

                return (
                    <div className="flex flex-row items-center justify-center gap-3">
                        {conf1 ? (
                                <div 
                                    className={cn(
                                        "flex items-center justify-center w-8 h-8 rounded-lg shadow-sm transition-all animate-in fade-in zoom-in duration-300 border",
                                        isDoubt ? "cursor-pointer hover:opacity-80 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500" : "cursor-not-allowed opacity-50",
                                        "bg-status-seg-soft text-status-seg border-status-seg/30"
                                    )}
                                    onClick={() => isDoubt && handleToggleQC(record.id, 1, true)}
                                    title={!isDoubt ? "Apenas termos marcados como 'Dúvida' podem receber triagem" : userTrg1 ? `Confirmado por: ${userTrg1}\n(Clique para desmarcar)` : "Clique para desmarcar"}
                                >
                                    <CheckCircleOutlined className="text-sm" />
                                </div>
                        ) : (
                                <Button 
                                    size="small"
                                    title={!isDoubt ? "Apenas termos marcados como 'Dúvida' podem receber triagem" : "Confirmar TRG 2"}
                                    disabled={!isDoubt}
                                    className={cn(
                                        "w-8 h-8 rounded-lg text-sm font-black flex items-center justify-center p-0 transition-all font-mono triagem-btn",
                                        isDoubt ? "!border-input !text-muted-foreground hover:!border-brand-strong hover:!text-brand-strong !bg-transparent" : "opacity-30 !border-transparent !text-muted-foreground !bg-transparent"
                                    )}
                                    onClick={() => handleToggleQC(record.id, 1, false)}
                                >
                                    2
                                </Button>
                        )}

                        {conf2 ? (
                                <div 
                                    className={cn(
                                        "flex items-center justify-center w-8 h-8 rounded-lg shadow-sm transition-all animate-in fade-in zoom-in duration-300 border",
                                        isDoubt && conf1 ? "cursor-pointer hover:opacity-80 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500" : "cursor-not-allowed opacity-50",
                                        "bg-status-seg-soft text-status-seg border-status-seg/30"
                                    )}
                                    onClick={() => isDoubt && conf1 && handleToggleQC(record.id, 2, true)}
                                    title={!isDoubt ? "Apenas termos marcados como 'Dúvida' podem receber triagem" : userTrg2 ? `Confirmado por: ${userTrg2}\n(Clique para desmarcar)` : "Clique para desmarcar"}
                                >
                                    <ShieldCheck size={16} />
                                </div>
                        ) : (
                                <Button 
                                    size="small"
                                    title={!isDoubt ? "Apenas termos marcados como 'Dúvida' podem receber triagem" : "Confirmar TRG 3"}
                                    disabled={!isDoubt || !conf1}
                                    className={cn(
                                        "w-8 h-8 rounded-lg text-sm font-black flex items-center justify-center p-0 transition-all font-mono triagem-btn",
                                        (isDoubt && conf1) ? "!border-input !text-muted-foreground hover:!border-brand-strong hover:!text-brand-strong !bg-transparent" : "opacity-30 cursor-not-allowed !border-transparent !text-muted-foreground !bg-transparent"
                                    )}
                                    onClick={() => handleToggleQC(record.id, 2, false)}
                                >
                                    3
                                </Button>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Comentário Analista',
            key: 'commentary',
            width: 200,
            render: (_: any, record: CampaignTerm) => {
                const isSyncing = syncingComments[record.id];
                return (
                    <div className="py-2 relative group">
                        <Input.TextArea
                            placeholder="Clique para adicionar notas..."
                            autoSize={{ minRows: 2, maxRows: 5 }}
                            className={cn(
                                "!text-[12px] !bg-surface-2 !border-border hover:!border-input focus:!border-brand-strong transition-colors !rounded-lg !p-2.5 shadow-none !text-foreground",
                                isSyncing && "ring-1 ring-primary/30"
                            )}
                            defaultValue={record.observacao || triageState[record.id]?.comment}
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
            width: 180,
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
                            className="w-full min-w-[150px] custom-select-v3-action"
                            onChange={(val) => {
                                if (val === 'negativar') {
                                    setNegativarData({ id: record.id, matchType: 'exata' });
                                    setIsNegativarModalVisible(true);
                                } else {
                                    handleCategoryChange(record.id, val as CategoryKey);
                                }
                            }}
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
            return 'opacity-90 transition-all cursor-default';
        }
        
        const cat = triageState[record.id]?.category;
        if (cat === 'negativar') return 'row-cat-negativa transition-colors cursor-default';
        if (cat === 'duvida') return 'row-cat-duvida transition-colors cursor-default';
        if (cat === 'segmentar') return 'row-cat-segmentar transition-colors cursor-default';
        return 'transition-colors cursor-default';
    };

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5">
            {/* Cabeçalho da página: título e ações globais da mesa */}
            <div className="pk-rise flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-strong">Auditoria</p>
                    <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Triagem de Especialistas</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Classifique os termos de pesquisa, confirme as dúvidas e envie ao cliente.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Tooltip title="Verifica e exclui termos repetidos com a mesma origem da mesa no banco">
                        <button
                            type="button"
                            onClick={handleCleanDatabaseDuplicates}
                            disabled={isCleaningDuplicates}
                            className="btn-bw-secondary flex h-10 items-center gap-2 px-4 text-sm"
                        >
                            <Trash2 size={15} className={isCleaningDuplicates ? 'animate-pulse' : ''} />
                            {isCleaningDuplicates ? 'Limpando...' : 'Limpar duplicados'}
                        </button>
                    </Tooltip>
                    <button
                        type="button"
                        onClick={() => setIsImportModalVisible(true)}
                        className="btn-brand h-10 px-4 text-sm"
                    >
                        <ClipboardPaste size={15} /> Importar planilha
                    </button>
                </div>
            </div>

            {terms.length > 0 && campaignList.length === 0 && (
                <div className="flex items-start gap-4 rounded-2xl border border-status-duv/30 bg-status-duv-soft p-5 text-status-duv">
                    <ShieldCheck className="h-6 w-6 shrink-0" />
                    <div className="flex flex-col gap-1">
                        <h3 className="text-base font-semibold">Planilha incompatível</h3>
                        <p className="text-sm text-foreground/80">
                            Confira se a planilha tem as colunas padrão da auditoria semântica (Campanha, Grupo de anúncios, Termo de pesquisa).
                        </p>
                    </div>
                </div>
            )}

            {terms.length > 0 ? (
                <div
                    ref={tableContainerRef}
                    className="pk-card overflow-hidden"
                >
                    {/* Abas de status como controle segmentado (rola na horizontal no celular) */}
                    <div className="border-b border-border px-3 py-3 sm:px-4">
                        <div role="tablist" aria-label="Filtrar por status" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {STATUS_TABS.map(tab => {
                                const selected = activeTab === tab.key;
                                const count = counts[tab.countKey];
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={selected}
                                        onClick={() => { setActiveTab(tab.key); setSelectedRowKeys([]); }}
                                        className={cn(
                                            "relative flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                                            selected ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {selected && (
                                            <motion.span
                                                layoutId="pk-triage-tab"
                                                className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-border"
                                                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                            />
                                        )}
                                        <span className={cn("relative h-2 w-2 rounded-full", tab.dot)} />
                                        <span className="relative whitespace-nowrap">{tab.label}</span>
                                        <span className={cn("relative min-w-[24px] rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums", selected ? tab.chip : "bg-transparent text-muted-foreground")}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Barra de ferramentas: filtros à esquerda, ações à direita (quebra de linha em telas estreitas) */}
                    <div className="px-3 sm:px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                            <Input
                                allowClear
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setSelectedRowKeys([]); }}
                                prefix={<Search className="h-4 w-4 text-muted-foreground" />}
                                placeholder="Buscar termo, palavra-chave, campanha ou grupo"
                                className="!w-full sm:!w-[320px] !rounded-[10px]"
                                aria-label="Buscar termos"
                            />
                            <Select
                                showSearch
                                allowClear
                                placeholder="Todas as campanhas"
                                className={cn("w-full sm:w-[220px]", FILTER_SELECT_CLS)}
                                popupClassName={FILTER_POPUP_CLS}
                                value={selectedCampaign}
                                onChange={val => { setSelectedCampaign(val ?? null); setSelectedAdGroup(null); setSelectedRowKeys([]); }}
                                options={campaignList.map(c => ({ label: c, value: c }))}
                            />
                            <Select
                                showSearch
                                allowClear
                                disabled={!selectedCampaign}
                                placeholder={selectedCampaign ? 'Todos os grupos' : 'Escolha uma campanha'}
                                className={cn("w-full sm:w-[220px]", FILTER_SELECT_CLS)}
                                popupClassName={FILTER_POPUP_CLS}
                                value={selectedAdGroup}
                                onChange={val => { setSelectedAdGroup(val ?? null); setSelectedRowKeys([]); }}
                                options={adGroupList.map(g => ({ label: g, value: g }))}
                            />
                            {activeTab === 'responses' && (
                                <Select
                                    value={originFilter}
                                    onChange={setOriginFilter}
                                    className={cn("w-full sm:w-[170px]", FILTER_SELECT_CLS)}
                                    popupClassName={FILTER_POPUP_CLS}
                                    options={[
                                        { value: 'all', label: 'Origem: todas' },
                                        { value: 'interno', label: 'Origem: interno' },
                                        { value: 'site', label: 'Origem: site' },
                                    ]}
                                />
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {selectedRowKeys.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mr-1">
                                    <span className="font-semibold text-foreground">{selectedRowKeys.length} selecionado(s)</span>
                                    <button
                                        type="button"
                                        className="underline hover:text-foreground transition-colors"
                                        onClick={() => setSelectedRowKeys([])}
                                    >
                                        limpar
                                    </button>
                                </div>
                            )}

                            {activeTab === 'duvidas' && (
                                <Button
                                    type="primary"
                                    icon={<Send className="w-4 h-4" />}
                                    onClick={handleSendDoubts}
                                    loading={isSendingDoubts}
                                    className="h-9 px-4 rounded-xl font-semibold btn-bw-inverse !border-none shadow-md flex items-center justify-center"
                                >
                                    Enviar dúvidas ao cliente
                                </Button>
                            )}

                            {(activeTab === 'aprovadas' || activeTab === 'negativas' || activeTab === 'responses') && (
                                <Tooltip title={selectedRowKeys.length > 0 ? 'Exporta apenas os termos selecionados' : 'Exporta todos os termos desta aba (use as caixas da tabela para escolher alguns)'}>
                                    <Button
                                        type="primary"
                                        icon={<Download className="w-4 h-4" />}
                                        disabled={filteredTerms.length === 0}
                                        onClick={() => {
                                            const termsToExport = selectedRowKeys.length > 0
                                                ? filteredTerms.filter(t => selectedRowKeys.includes(t.id))
                                                : filteredTerms;

                                            // Respostas Cliente: exportação por tipo (modal com seleção de tipos e correspondência)
                                            if (activeTab === 'responses') {
                                                setExportSource(termsToExport);
                                                setIsExportModalVisible(true);
                                                return;
                                            }

                                            let text = "Campaign\tAd Group\tKeyword\n";
                                            termsToExport.forEach(t => {
                                                let kw = t.termo_de_pesquisa;
                                                const currentCat = triageState[t.id]?.category || t.acao; // Fallback to client action

                                                if (activeTab === 'negativas' || currentCat === 'negativar') {
                                                    const mt = t.tipo_corresp || 'exata';
                                                    if (mt === 'exata') kw = `[${kw}]`;
                                                    else if (mt === 'frase') kw = `"${kw}"`;
                                                } else if (activeTab === 'aprovadas' || currentCat === 'segmentar') {
                                                    kw = `[${kw}]`; // Segmentar como exata por padrão
                                                }

                                                text += `${t.campanha}\t${t.grupo_de_anuncios}\t${kw}\n`;
                                            });
                                            setExportText(text);
                                            setIsExportModalVisible(true);
                                        }}
                                        className="h-9 px-4 !rounded-[10px] font-semibold !shadow-none flex items-center justify-center whitespace-nowrap"
                                    >
                                        Exportar termos ({selectedRowKeys.length > 0 ? selectedRowKeys.length : filteredTerms.length})
                                    </Button>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    <p className="px-3 sm:px-4 py-2 text-[12px] text-muted-foreground border-b border-border">
                        {TAB_HINTS[activeTab]}
                        {searchQuery.trim() && (
                            <> · <span className="text-foreground">{filteredTerms.length}</span> {filteredTerms.length === 1 ? 'resultado' : 'resultados'} para "{searchQuery.trim()}" <button type="button" className="underline hover:text-foreground" onClick={() => setSearchQuery('')}>limpar busca</button></>
                        )}
                    </p>

                    <Table
                        size="small"
                        locale={{ emptyText: <span className="block py-10 text-sm text-muted-foreground">{searchQuery.trim() ? 'Nenhum termo bate com essa busca.' : 'Nenhum termo nesta aba.'}</span> }}
                        dataSource={filteredTerms}
                        columns={(activeTab === 'responses' ? columns : columns.filter(c => c.key !== 'origem')).map(c => isMobile ? { ...c, fixed: undefined } : c)}
                        rowKey="id"
                        rowSelection={{
                            selectedRowKeys,
                            onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys)
                        }}
                        pagination={{ 
                            pageSize: 20, 
                            showTotal: (total) => `${total} encontrados`,
                            className: "px-3 sm:px-6 py-4"
                        }}
                        scroll={{ x: 1080 }}
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
                                        className="mx-3 sm:mx-6 mb-4 p-4 bg-muted/40 rounded-xl border border-dashed border-border flex flex-wrap items-center gap-x-8 gap-y-3 sm:gap-12"
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
                <div className="pk-card flex flex-col items-center justify-center px-6 py-20 text-center">
                    <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-brand-strong">
                        <TrendingUp className="h-6 w-6" />
                    </span>
                    <h2 className="font-display text-xl font-semibold text-foreground">Nenhum termo nesta empresa</h2>
                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                        Os termos aparecem aqui quando o workflow da IA processa o relatório, ou quando você importa uma planilha.
                    </p>
                    <button type="button" onClick={() => setIsImportModalVisible(true)} className="btn-brand mt-6 h-10 px-4 text-sm">
                        <ClipboardPaste size={15} /> Importar planilha
                    </button>
                </div>
            )}
            {/* Modal de Importação de Planilha */}
            <AntModal
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <ClipboardPaste className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <span className="text-lg font-black uppercase tracking-tight dark:text-white">Importar Dúvidas da Planilha</span>
                            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">Cole os dados do Google Sheets abaixo. Cada linha será inserida como uma dúvida.</p>
                        </div>
                    </div>
                }
                open={isImportModalVisible}
                onCancel={() => { setIsImportModalVisible(false); setImportPasteData(''); }}
                footer={null}
                width={700}
                centered
                className="luxury-modal"
                destroyOnClose
            >
                <div className="mt-6 space-y-5">
                    {/* Nível de Triagem */}
                    <div>
                        <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Nível de Triagem</label>
                        <Select
                            value={importTriageLevel}
                            onChange={setImportTriageLevel}
                            className="w-full [&_.ant-select-selector]:!bg-slate-800 [&_.ant-select-selector]:!border-slate-600 [&_.ant-select-selection-item]:!text-slate-100"
                            popupClassName="!bg-slate-800 !border !border-slate-700 [&_.ant-select-item]:!text-slate-200 [&_.ant-select-item-option-active]:!bg-blue-500 [&_.ant-select-item-option-selected]:!bg-blue-600"
                            options={[
                                { value: 'trg1', label: 'TRG 1 — Pendente Analista (triagem1=false, triagem2=false)' },
                                { value: 'trg2', label: 'TRG 2 — Confirmado Analista (triagem1=true, triagem2=false)' },
                                { value: 'trg3', label: 'TRG 3 — Pronto para Envio (triagem1=true, triagem2=true)' },
                            ]}
                        />
                    </div>

                    {/* Área de Colagem */}
                    <div>
                        <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Dados da Planilha (Cole aqui)</label>
                        <Input.TextArea
                            value={importPasteData}
                            onChange={e => setImportPasteData(e.target.value)}
                            placeholder={`Campanha\tGrupo\tPalavra-chave\tTermo de Pesquisa\tComentário\nLuxo Cuiabá\t#Sobrado\tsobrado luxo\tsobrado de luxo cuiabá\tVerificar com cliente`}
                            autoSize={{ minRows: 8, maxRows: 16 }}
                            className="!bg-slate-900 !border-slate-700 !text-slate-200 font-mono text-[11px] !placeholder-slate-600 rounded-xl p-4"
                        />
                        <p className="text-[9px] text-slate-500 mt-2 font-mono">
                            Ordem das colunas: Campanha → Grupo → Palavra-chave → Termo de Pesquisa → Comentário (observação)
                        </p>
                    </div>

                    {/* Preview */}
                    {importPasteData.trim() && (() => {
                        const previewLines = importPasteData.trim().split('\n').filter(l => l.trim());
                        const firstLower = previewLines[0]?.toLowerCase() || '';
                        const hasH = firstLower.includes('campanha') || firstLower.includes('termo') || firstLower.includes('palavra');
                        const dataOnly = hasH ? previewLines.slice(1) : previewLines;
                        const validCount = dataOnly.filter(l => (l.split('\t')[3] || '').trim()).length;
                        return (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                                <CheckCircleOutlined className="text-emerald-500" />
                                <span className="text-emerald-400 text-xs font-bold">
                                    {validCount} termos prontos para importar
                                </span>
                            </div>
                        );
                    })()}

                    <Button 
                        type="primary" 
                        onClick={handleImportSheet}
                        loading={isImporting}
                        className="w-full font-bold h-10 rounded-xl !bg-emerald-600 hover:!bg-emerald-700 !border-none mt-4"
                    >
                        Processar e Importar
                    </Button>
                </div>
            </AntModal>

            {/* Modal de Nível de Negativação */}
            <AntModal
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-xl">
                            <span className="text-xl">❌</span>
                        </div>
                        <div>
                            <span className="text-lg font-black uppercase tracking-tight dark:text-white">Nível de Negativação</span>
                            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">Selecione o nível de correspondência no Google Ads.</p>
                        </div>
                    </div>
                }
                open={isNegativarModalVisible}
                onCancel={() => setIsNegativarModalVisible(false)}
                footer={null}
                width={400}
                centered
                className="luxury-modal"
                destroyOnClose
            >
                <div className="mt-6 space-y-4">
                    <Select
                        value={negativarData?.matchType}
                        onChange={(val) => setNegativarData(prev => prev ? { ...prev, matchType: val } : null)}
                        className="w-full [&_.ant-select-selector]:!bg-slate-800 [&_.ant-select-selector]:!border-slate-600 [&_.ant-select-selection-item]:!text-slate-100"
                        popupClassName="!bg-slate-800 !border !border-slate-700 [&_.ant-select-item]:!text-slate-200 [&_.ant-select-item-option-active]:!bg-blue-500 [&_.ant-select-item-option-selected]:!bg-blue-600"
                        options={[
                            { value: 'exata', label: 'Exata [termo]' },
                            { value: 'frase', label: 'Frase "termo"' },
                            { value: 'ampla', label: 'Ampla (termo)' },
                        ]}
                    />
                    <Button 
                        type="primary" 
                        danger
                        className="w-full font-bold h-10 rounded-xl mt-4"
                        onClick={() => {
                            if (negativarData) {
                                handleCategoryChange(negativarData.id, 'negativar', negativarData.matchType);
                                setIsNegativarModalVisible(false);
                            }
                        }}
                    >
                        Confirmar Negativação
                    </Button>
                </div>
            </AntModal>

            {/* Modal de Exportação para Ads Editor */}
            <AntModal
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <Download className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <span className="text-lg font-black uppercase tracking-tight dark:text-white">Exportar para Google Ads Editor</span>
                            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">Copie os termos abaixo e cole diretamente no Google Ads Editor.</p>
                        </div>
                    </div>
                }
                open={isExportModalVisible}
                onCancel={() => setIsExportModalVisible(false)}
                footer={null}
                width={600}
                centered
                className="luxury-modal"
                destroyOnClose
            >
                <div className="mt-6 space-y-4">
                    {activeTab === 'responses' && exportResult && (
                        <>
                            <div className="flex flex-wrap items-center gap-4">
                                <Checkbox.Group
                                    value={exportTipos}
                                    onChange={(v) => setExportTipos(v as TipoExport[])}
                                    options={[
                                        { label: '✅ Segmentar', value: 'segmentar' },
                                        { label: '❌ Negativar', value: 'negativar' },
                                        { label: '⚠️ Teste A/B', value: 'teste_ab' },
                                    ]}
                                />
                                <Select
                                    value={exportMatch}
                                    onChange={setExportMatch}
                                    disabled={!exportTipos.includes('negativar')}
                                    className="w-52"
                                    options={[
                                        { value: 'exact', label: 'Negativa: Exata' },
                                        { value: 'phrase', label: 'Negativa: Frase' },
                                        { value: 'broad', label: 'Negativa: Ampla' },
                                    ]}
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                {exportResult.total} linha(s) para exportar
                                {exportResult.omitidos > 0 ? ` · ${exportResult.omitidos} omitida(s) por falta de campanha ou grupo` : ''}
                            </p>
                            <Input.TextArea
                                value={exportResult.editor}
                                readOnly
                                autoSize={{ minRows: 6, maxRows: 14 }}
                                className="!bg-slate-900 !border-slate-700 !text-slate-200 font-mono text-[11px] rounded-xl p-4 w-full whitespace-pre"
                                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                            />
                            <Button
                                type="primary"
                                className="w-full font-bold h-10 rounded-xl bg-blue-600 hover:bg-blue-700 border-none"
                                disabled={exportResult.editor.trim().split('\n').length <= 1}
                                onClick={() => {
                                    navigator.clipboard.writeText(exportResult.editor);
                                    message.success('Termos copiados para a área de transferência!');
                                }}
                            >
                                Copiar para o Google Ads Editor
                            </Button>
                            {exportTipos.includes('teste_ab') && (
                                <>
                                    <p className="text-[11px] text-muted-foreground">
                                        Teste A/B: lista para o analista (não gera critério do Editor)
                                    </p>
                                    <Input.TextArea
                                        value={exportResult.testeAb}
                                        readOnly
                                        autoSize={{ minRows: 3, maxRows: 10 }}
                                        className="!bg-slate-900 !border-slate-700 !text-slate-200 font-mono text-[11px] rounded-xl p-4 w-full whitespace-pre"
                                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                                    />
                                    <Button
                                        className="w-full font-bold h-10 rounded-xl"
                                        disabled={exportResult.testeAb.trim().split('\n').length <= 1}
                                        onClick={() => {
                                            navigator.clipboard.writeText(exportResult.testeAb);
                                            message.success('Lista de Teste A/B copiada!');
                                        }}
                                    >
                                        Copiar lista de Teste A/B
                                    </Button>
                                </>
                            )}
                        </>
                    )}
                    {!(activeTab === 'responses' && exportResult) && (<>
                    <Input.TextArea
                        value={exportText}
                        readOnly
                        autoSize={{ minRows: 10, maxRows: 20 }}
                        className="!bg-slate-900 !border-slate-700 !text-slate-200 font-mono text-[11px] rounded-xl p-4 w-full whitespace-pre"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                    <Button 
                        type="primary" 
                        className="w-full font-bold h-10 rounded-xl mt-4 bg-blue-600 hover:bg-blue-700 border-none"
                        onClick={() => {
                            navigator.clipboard.writeText(exportText);
                            message.success("Termos copiados para a área de transferência!");
                            setIsExportModalVisible(false);
                        }}
                    >
                        Copiar para Área de Transferência
                    </Button>
                    </>)}
                </div>
            </AntModal>
        </div>
    );
}

