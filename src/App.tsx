import { useState, useEffect, useRef } from 'react'
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
import LoginPage from './components/ui/gaming-login'
import { useCampaignTerms } from './hooks/useCampaignData'
import { type CampaignTerm } from './types'
import { RefreshCw, FileSpreadsheet } from 'lucide-react'
import { carregarDados } from './utils/dataIngestion'
import { syncCampaignTermsToSupabase } from './utils/supabaseSync'
import { FeaturesDetail } from './components/ui/features-detail'
import { SemanticAudit } from './components/SemanticAudit'
import { EvervaultCard } from './components/ui/evervault-card'
import { Toaster, toast } from 'sonner'
import { KeywordPlanner } from './components/KeywordPlanner'
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

    const { data: campaignTerms, isLoading: isTermsLoading, refetch } = useCampaignTerms(activeCompanyId || undefined);

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
        if (!activeCompanyId) return;
        const companies = JSON.parse(localStorage.getItem('googlar_companies') || '[]');
        const company = companies.find((c: Company) => c.id === activeCompanyId);
        if (company?.sheetsUrl) {
            carregarDados(company.sheetsUrl, 'sheets', activeCompanyId)
                .then(parsedData => syncCampaignTermsToSupabase(activeCompanyId, parsedData))
                .then(() => refetch())
                .catch(err => console.warn(`[Auto-Sync] Error: ${err.message}`));
        }
    }, [activeCompanyId])

    useEffect(() => {
        const savedCompanyId = localStorage.getItem('googlar_active_company')
        if (savedCompanyId) {
            setActiveCompanyId(savedCompanyId)
            setCurrentView('dashboard')
        }
    }, [isAuthenticated])

    const handleAccessCompany = (companyId: string) => {
        const companies: Company[] = JSON.parse(localStorage.getItem('googlar_companies') || '[]')
        const comp = companies.find(c => c.id === companyId)
        if (!comp?.sheetsUrl && comp?.dataSourceType !== 'local') {
            message.warning("Dados não disponíveis para esta empresa.");
            return;
        }
        setActiveCompanyId(companyId)
        localStorage.setItem('googlar_active_company', companyId)
        setCurrentView('dashboard')
    }

    const effectiveData = localData || campaignTerms;
    const isValidArray = Array.isArray(effectiveData) && effectiveData.length > 0;
    const totalTerms = isValidArray ? effectiveData.length : 0;
    const totalEconomy = isValidArray ? effectiveData.reduce((acc, row) => {
        if (row.negativize === 'TRUE' || (row.status_granularity || '').includes('Irrelevante')) return acc + (row.cost || 0);
        return acc;
    }, 0) : 0;
    const newLeads = Math.floor(totalTerms * 0.15);
    const correctTerms = isValidArray ? effectiveData.filter(r => (r.status_granularity || '').includes('OK')).length : 0;
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
                                                if (!activeCompanyId) return;
                                                const comp = JSON.parse(localStorage.getItem('googlar_companies') || '[]').find((c:any)=>c.id===activeCompanyId);
                                                if (!comp?.sheetsUrl) return refetch();
                                                setIsSyncing(true);
                                                const tId = toast.loading('Sincronizando...');
                                                try {
                                                    const d = await carregarDados(comp.sheetsUrl, 'sheets', activeCompanyId);
                                                    await syncCampaignTermsToSupabase(activeCompanyId, d);
                                                    toast.success('Sincronizado!', { id: tId });
                                                    refetch();
                                                } catch(e:any) { toast.error(e.message, { id: tId }); } finally { setIsSyncing(false); }
                                            }}
                                            disabled={isSyncing || isTermsLoading || !activeCompanyId}
                                            className="btn-bw-inverse flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> <span>SINCRONIZAR</span>
                                        </button>
                                    </div>

                                    <div ref={dashboardGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 w-full">
                                        <EvervaultCard label="ECONOMIA GERADA" text={!isValidArray ? "R$ --" : <><span className="text-xl opacity-70 font-normal">R$</span> {totalEconomy.toFixed(2).replace('.', ',')}</>} trend="up" trendValue="+5.2%" />
                                        <EvervaultCard label="TERMOS AUDITADOS" text={!isValidArray ? "0" : totalTerms.toString()} trend="up" trendValue="+12.5%" />
                                        <EvervaultCard label="NOVOS LEADS B2B" text={!isValidArray ? "0" : newLeads.toString()} trend="up" trendValue="+18.1%" />
                                        <StatsCard label="ACURÁCIA IA" value={!isValidArray ? "--.-%" : `${accuracy}%`} trend="neutral" trendValue="0.0%" />
                                    </div>

                                    {isValidArray && (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 w-full min-h-[380px]">
                                            <div className="lg:col-span-2 h-full"><TermsChart data={effectiveData as any || []} /></div>
                                            <div className="h-full"><DistributionChart data={effectiveData as any || []} /></div>
                                        </div>
                                    )}

                                    {!isValidArray && !isTermsLoading && (
                                        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-3xl mb-8 animate-in fade-in zoom-in">
                                            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6 shadow-lg"><CloudUploadOutlined className="text-2xl text-white" /></div>
                                            <h2 className="text-2xl font-black uppercase text-foreground mb-4">Ingestão de Dados</h2>
                                            <div className="w-full max-w-lg space-y-6">
                                                <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                                                    <div className="flex gap-3">
                                                        <Input value={temporaryUrl} onChange={e=>setTemporaryUrl(e.target.value)} placeholder="URL da Planilha" className="bg-muted border-border rounded-xl" />
                                                        <Button type="primary" loading={isLocalLoading} className="rounded-xl font-bold h-11" onClick={async()=>{
                                                            if(!temporaryUrl) return; setIsLocalLoading(true);
                                                            try { const d = await carregarDados(temporaryUrl, "sheets", activeCompanyId!); setLocalData(d); message.success("Sucesso!"); } catch(e:any){ message.error(e.message); } finally { setIsLocalLoading(false); }
                                                        }}>CARREGAR</Button>
                                                    </div>
                                                </div>
                                                <Divider><span className="text-[10px] font-black uppercase text-muted-foreground">OU</span></Divider>
                                                <div className="bg-muted/30 p-6 rounded-2xl border border-border text-center">
                                                    <Upload.Dragger multiple={false} showUploadList={false} customRequest={async({file, onSuccess}:any)=>{
                                                        setIsLocalLoading(true);
                                                        try { const d = await carregarDados(file, "local", activeCompanyId!); setLocalData(d); message.success("Sucesso!"); onSuccess("ok"); } catch(e:any){ message.error(e.message); } finally { setIsLocalLoading(false); }
                                                    }} className="bg-transparent border-dashed">
                                                        <InboxOutlined className="text-3xl text-primary mb-2" /><p className="text-foreground font-bold">Arraste seu CSV/XLSX</p>
                                                    </Upload.Dragger>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {isValidArray && (
                                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                            <div className="mb-6"><Input.Search placeholder="Buscar termo..." size="large" className="custom-search" /></div>
                                            <DashboardTable data={effectiveData as any || []} isEmpty={!isValidArray} isLoading={isTermsLoading || isLocalLoading} activeTab={activeTab} setActiveTab={setActiveTab} />
                                        </div>
                                    )}
                                    <FeaturesDetail />
                                </>
                            )}
                            {currentView === 'ferramenta' && <AutomationConsole isAdmin={currentUser?.isAdmin ?? false} activeCompanyId={activeCompanyId} isDarkMode={isDarkMode} onSelectCompany={setActiveCompanyId} />}
                            {currentView === 'semantic-audit' && <SemanticAudit activeCompanyId={activeCompanyId} currentUser={currentUser} />}
                            {currentView === 'keyword-planner' && <KeywordPlanner activeCompanyId={activeCompanyId} />}
                            {currentView === 'users' && <UserManager currentUser={profile} />}
                            {currentView === 'companies' && <CompanyManager currentUser={profile} onAccessCompany={handleAccessCompany} onSelectCompany={setActiveCompanyId} />}
                            {currentView === 'laboratorio-ab' && <LabABPage data={campaignTerms || []} isLoading={isTermsLoading} />}
                        </Content>
                    </Layout>
                </div>
            ) : (
                <div className="relative min-h-screen w-full flex items-center justify-center">
                    <LoginPage.AnimatedBackground />
                    <div className="relative z-20 w-full max-w-md animate-fadeIn"><LoginPage.LoginForm /></div>
                    <footer className="absolute bottom-4 left-0 right-0 text-center text-white/40 text-[10px] uppercase font-black tracking-widest z-20">© 2025 GOOGLAR — ANTYGRAVITI OS</footer>
                </div>
            )}
        </ConfigProvider>
    )
}
export default App
