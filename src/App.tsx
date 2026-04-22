import { useState, useEffect, useRef, useMemo } from 'react'
import { RefreshCw, FileSpreadsheet } from 'lucide-react'
import { gsap } from 'gsap'
import { ConfigProvider, Layout, message, Input, Upload, Button, Divider } from 'antd'
import { InboxOutlined, LinkOutlined, CloudUploadOutlined } from '@ant-design/icons'
import { ModernSidebar } from './components/ui/modern-side-bar'
import { Header } from './components/Header'
import { StatsCard } from './components/StatsCard'
import { DashboardTable } from './components/DashboardTable'
import { TermsChart } from './components/TermsChart'
import { DistributionChart } from './components/DistributionChart'
import { UserManager } from './components/UserManager'
import { CompanyManager } from './components/CompanyManager'
import { AutomationConsole } from './components/AutomationConsole'
import { LabABPage } from './components/LabABPage'
import type { Company } from './types'
import LoginPage, { AnimatedBackground, LoginForm } from './components/ui/gaming-login'
import { useCampaignTerms, useCompanies } from './hooks/useCampaignData'
import { type CampaignTerm } from './types'
import { carregarDados } from './utils/dataIngestion'
import { fetchTermsFromTable, insertCampaignTermsBatch, provisionCompanyTable } from './lib/supabaseProvider'
import { FeaturesDetail } from './components/ui/features-detail'
import { SemanticAudit } from './components/SemanticAudit'
import { EvervaultCard } from './components/ui/evervault-card'
import { Toaster, toast } from 'sonner'
import { KeywordPlanner } from './components/KeywordPlanner'
import { MetallicGradients } from './components/ui/MetallicGradients'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuth } from './contexts/AuthContext'

const { Content } = Layout

function App() {
    const { user, profile, isLoading, signOut } = useAuth()
    const isAuthenticated = !!user
    const currentUser = profile
    const [currentView, setCurrentView] = useState<'dashboard' | 'users' | 'companies' | 'ferramenta' | 'semantic-audit' | 'laboratorio-ab' | 'keyword-planner'>('companies')
    const [activeTab, setActiveTab] = useState('all')
    const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
    const [isDarkMode, setIsDarkMode] = useState(false)
    const dashboardGridRef = useRef<HTMLDivElement>(null)

    const [localData, setLocalData] = useState<CampaignTerm[] | null>(null)
    const [isLocalLoading, setIsLocalLoading] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [temporaryUrl, setTemporaryUrl] = useState('')

    const { data: companies = [] } = useCompanies();
    const activeCompany = companies.find(c => c.id === activeCompanyId);

    const { data: campaignTerms, isLoading: isTermsLoading, refetch } = useCampaignTerms(activeCompanyId || undefined, activeCompany?.tableName);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [isDarkMode])

    useEffect(() => {
        setLocalData(null);
        if (dashboardGridRef.current) {
            gsap.fromTo(dashboardGridRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', delay: 0.1 });
        }
        // Auto-sync legada (Sheets) removida em favor da V4/Agentes. 
        // Se houver dados locais no localStorage, o useCampaignTerms já tenta subir.
    }, [activeCompanyId])

    useEffect(() => {
        const savedCompanyId = localStorage.getItem('googlar_active_company')
        if (savedCompanyId) {
            setActiveCompanyId(savedCompanyId)
            setCurrentView('dashboard')
        }
    }, [isAuthenticated])

    const handleAccessCompany = (companyId: string) => {
        // Na V4, confiamos no activeCompanyId e no useCampaignTerms para carregar os dados do Supabase.
        setActiveCompanyId(companyId)
        localStorage.setItem('googlar_active_company', companyId)
        setCurrentView('dashboard')
    }

    const effectiveData = localData || campaignTerms;
    const isValidArray = Array.isArray(effectiveData) && effectiveData.length > 0;
    const totalTerms = isValidArray ? effectiveData.length : 0;
    const totalEconomy = isValidArray ? effectiveData.reduce((acc, row) => {
        const isIrrelevant = (row.negativar && (String(row.negativar).includes('❌') || row.negativar === true)) || 
                            (row.status_granularidade || '').includes('Irrelevante');
        if (isIrrelevant) return acc + (parseFloat(String(row.custo || '0')) || 0);
        return acc;
    }, 0) : 0;
    const newLeads = Math.floor(totalTerms * 0.15);
    const correctTerms = isValidArray ? effectiveData.filter(r => (r.status_granularidade || '').includes('OK')).length : 0;
    const accuracy = totalTerms > 0 ? ((correctTerms / totalTerms) * 100).toFixed(1) : '--.-';

    const lightTheme = {
        token: { colorPrimary: '#18181b', colorBgBase: '#ffffff', fontFamily: 'Geist, sans-serif' },
        components: { Layout: { siderBg: '#ffffff', headerBg: 'transparent' } }
    }
    const darkTheme = {
        token: { colorPrimary: '#fafafa', colorBgBase: '#09090b', fontFamily: 'Geist, sans-serif' },
        components: { Layout: { siderBg: '#09090b', headerBg: 'transparent' } }
    }

    if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>

    return (
        <ConfigProvider theme={isDarkMode ? darkTheme : lightTheme}>
            <>
                <MetallicGradients />
                <Toaster position="top-right" richColors expand={true} theme={isDarkMode ? 'dark' : 'light'} closeButton />
                {isAuthenticated ? (
                <div className="flex min-h-screen bg-background overflow-hidden font-geist">
                    <ModernSidebar
                        currentUser={currentUser}
                        onViewChange={(view: any) => setCurrentView(view)}
                        currentView={currentView}
                        isDarkMode={isDarkMode}
                        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
                        onLogout={async () => { await signOut(); setCurrentView('companies'); setActiveCompanyId(null); }}
                    />
                    <Layout className="flex-1 bg-background h-screen overflow-y-auto w-full border-l border-border">
                        <Header
                            onRefresh={() => { if (activeCompanyId) { refetch(); message.success("Atualizando..."); } }}
                            isConfigured={isValidArray} isLoading={isTermsLoading || isLocalLoading}
                            activeCompanyId={activeCompanyId} onSelectCompany={setActiveCompanyId}
                            currentView={currentView} data={campaignTerms || []}
                        />
                        <Content className="px-4 py-8 md:px-8 min-h-full bg-background transition-colors duration-500">
                            <ErrorBoundary>
                                {currentView === 'dashboard' && (
                                <>
                                    <div className="flex justify-end gap-3 mb-8">
                                        {localData && (
                                            <button onClick={() => setLocalData(null)} className="btn-bw-secondary flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold border border-border">
                                                <FileSpreadsheet className="w-4 h-4" /> <span>LIMPAR DADOS</span>
                                            </button>
                                        )}
                                        <button 
                                            onClick={async () => {
                                                if (!activeCompanyId || !localData) return refetch();
                                                setIsSyncing(true);
                                                const tId = toast.loading('Sincronizando dados locais com Supabase...');
                                                try {
                                                    const result = await insertCampaignTermsBatch(activeCompanyId, localData, activeCompany?.tableName);
                                                    if (result.success) {
                                                        toast.success(`Sucesso! ${result.count} termos sincronizados.`, { id: tId });
                                                        setLocalData(null);
                                                        refetch();
                                                    } else {
                                                        throw new Error(result.error);
                                                    }
                                                } catch(e:any) { toast.error(e.message, { id: tId }); } finally { setIsSyncing(false); }
                                            }}
                                            disabled={isSyncing || isTermsLoading || !activeCompanyId}
                                            className="btn-bw-inverse flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> <span>SINCRONIZAR</span>
                                        </button>
                                    </div>

                                    {isTermsLoading ? (
                                        <div className="flex flex-col items-center justify-center py-40 gap-4">
                                            <RefreshCw className="animate-spin text-primary" size={40} />
                                            <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Acessando Mesa Isolada...</p>
                                        </div>
                                    ) : !isValidArray ? (
                                        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-3xl mb-8 animate-in fade-in zoom-in">
                                            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                                                <CloudUploadOutlined className="text-2xl text-white" />
                                            </div>
                                            <h2 className="text-2xl font-black uppercase text-foreground mb-4">Ingestão de Dados</h2>
                                            <div className="w-full max-w-lg space-y-6">
                                                <div className="bg-muted/30 p-6 rounded-2xl border border-border text-center">
                                                    <Upload.Dragger multiple={false} showUploadList={false} customRequest={async({file, onSuccess}:any)=>{
                                                        setIsLocalLoading(true);
                                                        try { const d = await carregarDados(file, "local", activeCompanyId!); setLocalData(d); message.success("Sucesso!"); onSuccess("ok"); } catch(e:any){ message.error(e.message); } finally { setIsLocalLoading(false); }
                                                    }} className="bg-transparent border-dashed">
                                                        <InboxOutlined className="text-3xl text-primary mb-2" />
                                                        <p className="text-foreground font-bold">Arraste seu CSV/XLSX ou clique para upload</p>
                                                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest mt-2">Os dados serão processados localmente antes da sincronização</p>
                                                    </Upload.Dragger>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                            <div ref={dashboardGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 w-full">
                                                <EvervaultCard label="ECONOMIA GERADA" text={<><span className="text-xl opacity-70 font-normal">R$</span> {(Number(totalEconomy) || 0).toFixed(2).replace('.', ',')}</>} trend="up" trendValue="+5.2%" isDark={isDarkMode} />
                                                <EvervaultCard label="TERMOS AUDITADOS" text={totalTerms.toString()} trend="up" trendValue="+12.5%" isDark={isDarkMode} />
                                                <EvervaultCard label="NOVOS LEADS B2B" text={newLeads.toString()} trend="up" trendValue="+18.1%" isDark={isDarkMode} />
                                                <StatsCard label="ACURÁCIA IA" value={`${accuracy}%`} trend="neutral" trendValue="0.0%" isDark={isDarkMode} />
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 w-full min-h-[380px]">
                                                <div className="lg:col-span-2 h-full">
                                                    <TermsChart data={effectiveData as any} isDark={isDarkMode} />
                                                </div>
                                                <div className="h-full">
                                                    <DistributionChart data={effectiveData as any} isDark={isDarkMode} />
                                                </div>
                                            </div>

                                            <div className="mb-6">
                                                <Input.Search placeholder="Buscar termo específico nas campanhas..." size="large" className="custom-search shadow-2xl" />
                                            </div>
                                            
                                            <DashboardTable 
                                                data={effectiveData as any} 
                                                isEmpty={false} 
                                                isLoading={isTermsLoading || isLocalLoading} 
                                                activeTab={activeTab} 
                                                setActiveTab={setActiveTab} 
                                            />
                                        </div>
                                    )}
                                    <FeaturesDetail />
                                </>
                            )}
                            {currentView === 'ferramenta' && <AutomationConsole isAdmin={profile?.isAdmin ?? false} activeCompanyId={activeCompanyId} isDarkMode={isDarkMode} onSelectCompany={setActiveCompanyId} />}
                            {currentView === 'semantic-audit' && <SemanticAudit activeCompanyId={activeCompanyId} currentUser={profile} />}
                            {currentView === 'keyword-planner' && <KeywordPlanner activeCompanyId={activeCompanyId} />}
                            {currentView === 'users' && <UserManager currentUser={profile} />}
                            {currentView === 'companies' && <CompanyManager currentUser={profile} onAccessCompany={handleAccessCompany} onSelectCompany={setActiveCompanyId} />}
                            {currentView === 'laboratorio-ab' && <LabABPage data={campaignTerms || []} isLoading={isTermsLoading} />}
                            </ErrorBoundary>
                        </Content>
                    </Layout>
                </div>
            ) : (
                <div className="relative min-h-screen w-full flex items-center justify-center">
                    <AnimatedBackground />
                    <div className="relative z-20 w-full max-w-md animate-fadeIn"><LoginForm /></div>
                    <footer className="absolute bottom-4 left-0 right-0 text-center text-white/40 text-[10px] uppercase font-black tracking-widest z-20">© 2025 GOOGLAR — ANTYGRAVITI OS V4.1 REFRESHED</footer>
                </div>
            )}
            </>
        </ConfigProvider>
    )
}
export default App
