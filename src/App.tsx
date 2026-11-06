import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfigProvider, message, theme as antdTheme, type ThemeConfig } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import { AppSidebar } from './components/shell/AppSidebar'
import { AppTopbar } from './components/shell/AppTopbar'
import { CommandPalette } from './components/shell/CommandPalette'
import { isViewLocked, type AppView } from './components/shell/navigation'
import { DashboardView } from './components/dashboard/DashboardView'
import { UserManager } from './components/UserManager'
import { CompanyManager } from './components/CompanyManager'
import { LabABPage } from './components/LabABPage'
import { AuditoriaLSAPage } from './components/AuditoriaLSAPage'
import { SemanticAudit, type AuditNavParams } from './components/SemanticAudit'
import { KeywordPlanner } from './components/KeywordPlanner'
import { UpperScript } from './components/UpperScript'
import ErrorBoundary from './components/ErrorBoundary'
import { AnimatedBackground, LoginForm } from './components/ui/gaming-login'
import { useCampaignTerms, useCompanies } from './hooks/useCampaignData'
import { useAuth } from './contexts/AuthContext'
import { contarStatus } from './utils/dashboardMetrics'
import type { CampaignTerm } from './types'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"

// Cores da marca aplicadas ao Ant Design (selects, tabelas, modais, checkboxes).
const darkTheme: ThemeConfig = {
    algorithm: antdTheme.darkAlgorithm,
    token: {
        colorPrimary: '#3df2a0',
        colorSuccess: '#3df2a0',
        colorWarning: '#f5c451',
        colorError: '#f2706b',
        colorInfo: '#7fb8ff',
        colorLink: '#3df2a0',
        colorBgBase: '#0e0f12',
        colorBgLayout: '#0e0f12',
        colorBgContainer: '#15161a',
        colorBgElevated: '#1b1d22',
        colorBgSpotlight: '#26282f',
        colorBorder: '#2c2e35',
        colorBorderSecondary: '#26282f',
        colorText: '#f4f4f5',
        colorTextSecondary: '#a9acb5',
        colorTextTertiary: '#8b8e98',
        colorTextPlaceholder: '#6e717c',
        fontFamily: FONT,
        borderRadius: 10,
        controlHeight: 36,
    },
    components: {
        Button: { primaryColor: '#06281a', primaryShadow: 'none', defaultShadow: 'none' },
        Checkbox: { colorWhite: '#06281a' },
        Select: { optionSelectedBg: 'rgba(61, 242, 160, 0.14)', optionSelectedColor: '#f4f4f5', optionActiveBg: '#26282f' },
        Table: { headerBg: '#1b1d22', rowHoverBg: '#1b1d22', borderColor: '#26282f', headerSplitColor: 'transparent' },
        Tabs: { inkBarColor: '#3df2a0', itemSelectedColor: '#f4f4f5', itemHoverColor: '#f4f4f5' },
        Modal: { contentBg: '#15161a', headerBg: '#15161a', footerBg: '#15161a' },
        Tooltip: { colorTextLightSolid: '#f4f4f5' },
    },
}

const lightTheme: ThemeConfig = {
    algorithm: antdTheme.defaultAlgorithm,
    token: {
        colorPrimary: '#0b8a55',
        colorSuccess: '#0b8a55',
        colorWarning: '#b7780a',
        colorError: '#d4413b',
        colorInfo: '#2367c9',
        colorLink: '#0b8a55',
        colorBgLayout: '#f5f6f8',
        colorBorder: '#dcdfe5',
        colorBorderSecondary: '#e3e5ea',
        colorText: '#15161a',
        colorTextSecondary: '#5f6370',
        fontFamily: FONT,
        borderRadius: 10,
        controlHeight: 36,
    },
    components: {
        Button: { primaryShadow: 'none', defaultShadow: 'none' },
        Table: { headerBg: '#f1f2f5', rowHoverBg: '#f1f2f5', headerSplitColor: 'transparent' },
        Tabs: { inkBarColor: '#0b8a55' },
    },
}

function readTheme(): boolean {
    try {
        const saved = localStorage.getItem('googlar_theme')
        return saved === null ? true : saved === 'dark' // padrão: tema escuro
    } catch {
        return true
    }
}

function App() {
    const { user, profile, isLoading, signOut } = useAuth()
    const isAuthenticated = !!user
    const queryClient = useQueryClient()

    const [currentView, setCurrentView] = useState<AppView>('companies')
    const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
    const [auditNavParams, setAuditNavParams] = useState<AuditNavParams | null>(null)
    const [isDarkMode, setIsDarkMode] = useState<boolean>(readTheme)
    const [localData, setLocalData] = useState<CampaignTerm[] | null>(null)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [commandOpen, setCommandOpen] = useState(false)

    // Cada página abre do topo (a área de conteúdo é um único container com rolagem)
    const mainRef = useRef<HTMLElement>(null)
    useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [currentView])

    const { data: companies = [] } = useCompanies()
    const activeCompany = companies.find(c => c.id === activeCompanyId)
    const {
        data: campaignTerms, isLoading: isTermsLoading, isFetching, refetch, dataUpdatedAt,
    } = useCampaignTerms(activeCompanyId || undefined, activeCompany?.tableName)

    const effectiveData = localData || campaignTerms || []
    const duvidasPendentes = useMemo(() => contarStatus(effectiveData).duvidas, [effectiveData])

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode)
        try {
            localStorage.setItem('googlar_theme', isDarkMode ? 'dark' : 'light')
        } catch { /* sem storage: o tema vale só nesta aba */ }
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDarkMode ? '#0e0f12' : '#f5f6f8')
    }, [isDarkMode])

    // Planilha local pertence à empresa em que foi carregada
    useEffect(() => { setLocalData(null) }, [activeCompanyId])

    useEffect(() => {
        const saved = localStorage.getItem('googlar_active_company')
        if (saved) {
            setActiveCompanyId(saved)
            setCurrentView('dashboard')
        }
    }, [isAuthenticated])

    // A tela de Empresas avisa quando cria/edita uma empresa
    useEffect(() => {
        const refresh = () => queryClient.invalidateQueries({ queryKey: ['companies'] })
        window.addEventListener('googlar_companies_updated', refresh)
        return () => window.removeEventListener('googlar_companies_updated', refresh)
    }, [queryClient])

    // Ctrl+K / Cmd+K abre a busca rápida de qualquer tela
    useEffect(() => {
        if (!isAuthenticated) return
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setCommandOpen(o => !o)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isAuthenticated])

    const navigate = useCallback((view: AppView) => {
        if (isViewLocked(view, profile?.isAdmin)) {
            message.warning('Acesso restrito ao administrador.')
            return
        }
        setCurrentView(view)
        setMobileNavOpen(false)
    }, [profile?.isAdmin])

    // Troca de empresa vale para a próxima visita também
    const selectCompany = useCallback((companyId: string | null) => {
        setActiveCompanyId(companyId)
        if (companyId) localStorage.setItem('googlar_active_company', companyId)
        else localStorage.removeItem('googlar_active_company')
    }, [])

    const handleAccessCompany = (companyId: string) => {
        selectCompany(companyId)
        setCurrentView('dashboard')
    }

    const refreshData = useCallback(() => {
        if (!activeCompanyId) {
            toast.info('Escolha uma empresa primeiro.')
            return
        }
        refetch()
        toast.success('Atualizando dados da empresa...')
    }, [activeCompanyId, refetch])

    const toggleTheme = useCallback(() => setIsDarkMode(d => !d), [])

    if (isLoading) return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="loader" />
        </div>
    )

    return (
        <ConfigProvider theme={isDarkMode ? darkTheme : lightTheme}>
            <Toaster position="top-right" richColors expand theme={isDarkMode ? 'dark' : 'light'} closeButton />
            {isAuthenticated ? (
                <div className="flex h-[100dvh] overflow-hidden bg-background font-sans text-foreground">
                    <AppSidebar
                        currentView={currentView}
                        onViewChange={navigate}
                        currentUser={profile}
                        fallbackEmail={user?.email}
                        isDarkMode={isDarkMode}
                        onToggleTheme={toggleTheme}
                        onLogout={async () => { await signOut(); setCurrentView('companies'); setActiveCompanyId(null) }}
                        onOpenCommand={() => setCommandOpen(true)}
                        duvidasPendentes={duvidasPendentes}
                        mobileOpen={mobileNavOpen}
                        onMobileClose={() => setMobileNavOpen(false)}
                    />

                    <div className="flex min-w-0 flex-1 flex-col">
                        <AppTopbar
                            currentView={currentView}
                            companies={companies}
                            activeCompanyId={activeCompanyId}
                            onSelectCompany={selectCompany}
                            onRefresh={refreshData}
                            isRefreshing={isFetching}
                            onOpenMenu={() => setMobileNavOpen(true)}
                            onOpenCommand={() => setCommandOpen(true)}
                        />

                        <main ref={mainRef} className="relative min-w-0 flex-1 overflow-y-auto overflow-x-clip">
                            <div className="pk-aurora pointer-events-none absolute inset-x-0 top-0 h-72" aria-hidden="true" />
                            <div className="relative px-4 py-6 md:px-8 md:py-8">
                                <ErrorBoundary>
                                    {currentView === 'dashboard' && (
                                        <DashboardView
                                            company={activeCompany}
                                            companyId={activeCompanyId}
                                            terms={effectiveData}
                                            localData={localData}
                                            onLocalData={setLocalData}
                                            isLoading={isTermsLoading}
                                            updatedAt={dataUpdatedAt}
                                            onRefetch={() => refetch()}
                                            onReviewTerm={t => {
                                                setAuditNavParams({ campanha: t.campanha, grupo: t.grupo_de_anuncios, termo: t.termo_de_pesquisa })
                                                navigate('semantic-audit')
                                            }}
                                            onOpenTriagem={aba => {
                                                setAuditNavParams({ aba })
                                                navigate('semantic-audit')
                                            }}
                                            onGoCompanies={() => navigate('companies')}
                                        />
                                    )}
                                    {(currentView === 'upperscript' || currentView === 'ferramenta') && (
                                        <UpperScript
                                            activeCompanyId={activeCompanyId}
                                            activeCompany={activeCompany}
                                            campaignTerms={effectiveData}
                                            isTermsLoading={isTermsLoading}
                                            isDarkMode={isDarkMode}
                                        />
                                    )}
                                    {currentView === 'semantic-audit' && (
                                        <SemanticAudit
                                            activeCompanyId={activeCompanyId}
                                            currentUser={profile}
                                            auditNavParams={auditNavParams}
                                            clearNavParams={() => setAuditNavParams(null)}
                                            onGoCompanies={() => navigate('companies')}
                                        />
                                    )}
                                    {currentView === 'keyword-planner' && <KeywordPlanner activeCompanyId={activeCompanyId} />}
                                    {currentView === 'users' && <UserManager currentUser={profile} />}
                                    {currentView === 'companies' && (
                                        <CompanyManager currentUser={profile} onAccessCompany={handleAccessCompany} onSelectCompany={selectCompany} />
                                    )}
                                    {currentView === 'laboratorio-ab' && <LabABPage data={campaignTerms || []} isLoading={isTermsLoading} />}
                                    {currentView === 'auditoria-lsa' && <AuditoriaLSAPage activeCompanyId={activeCompanyId} />}
                                </ErrorBoundary>
                            </div>
                        </main>
                    </div>

                    <CommandPalette
                        open={commandOpen}
                        onClose={() => setCommandOpen(false)}
                        isAdmin={profile?.isAdmin}
                        companies={companies}
                        activeCompanyId={activeCompanyId}
                        isDarkMode={isDarkMode}
                        onNavigate={navigate}
                        onSelectCompany={companyId => {
                            selectCompany(companyId)
                            if (currentView === 'companies') setCurrentView('dashboard')
                        }}
                        onToggleTheme={toggleTheme}
                        onRefresh={refreshData}
                    />
                </div>
            ) : (
                <div className="relative flex min-h-[100dvh] w-full items-center justify-center px-4 py-10 pb-14">
                    <AnimatedBackground />
                    <div className="relative z-20 w-full max-w-md animate-fadeIn"><LoginForm /></div>
                    <footer className="absolute bottom-4 left-0 right-0 z-20 px-4 text-center text-[10px] font-semibold uppercase tracking-widest text-white/40">
                        © {new Date().getFullYear()} Googlar · Pocket
                    </footer>
                </div>
            )}
        </ConfigProvider>
    )
}

export default App
