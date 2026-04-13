import { Layout, Button, Input, Select, Typography, Tooltip } from 'antd'
import { SyncOutlined, BellOutlined, SearchOutlined, DatabaseOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import type { Company, CampaignTerm } from '../types'
import { Sparkles, Bot } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet'
import { SemanticCopilot } from './SemanticCopilot'

const { Header: AntHeader } = Layout

interface HeaderProps {
    onRefresh: () => void
    isConfigured: boolean
    isLoading: boolean
    activeCompanyId?: string | null
    onSelectCompany: (companyId: string) => void
    currentView: string
    data: CampaignTerm[]
}

export function Header({ onRefresh, isConfigured, isLoading, activeCompanyId, onSelectCompany, currentView, data }: HeaderProps) {
    const [linkedCompanies, setLinkedCompanies] = useState<Company[]>([])

    useEffect(() => {
        const updateLinkedCompanies = () => {
            const stored = JSON.parse(localStorage.getItem('googlar_companies') || '[]')
            const linked = stored.filter((c: Company) => c.dataSourceType === 'sheets' || c.dataSourceType === 'local' || c.sheetsUrl)
            setLinkedCompanies(linked)
        };

        updateLinkedCompanies();

        window.addEventListener('googlar_companies_updated', updateLinkedCompanies);
        return () => window.removeEventListener('googlar_companies_updated', updateLinkedCompanies);
    }, [activeCompanyId, isConfigured])

    return (
        <AntHeader style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            padding: '0 32px',
            background: 'transparent',
            height: '80px' // Slightly taller for premium feel
        }}>
            <div className="flex items-center gap-4">
                <h1 className="text-[26px] font-black uppercase tracking-tighter text-foreground m-0 leading-none">
                    {currentView === 'laboratorio-ab' ? 'Laboratório A/B' : 
                     currentView === 'semantic-audit' ? 'Auditoria Semântica' :
                     currentView === 'ferramenta' ? 'Ferramenta' :
                     currentView === 'users' ? 'Usuários' : 
                     currentView === 'companies' ? 'Empresas' : 'Dashboard'}
                </h1>
            </div>

            <div className="flex items-center gap-6">
                <Input
                    placeholder="Search..."
                    prefix={<SearchOutlined className="text-zinc-400" />}
                    className="w-64 rounded-full border-border bg-muted shadow-sm px-4 py-1.5 focus:border-primary hover:border-primary/50"
                />

                <div className="relative cursor-pointer hover:bg-muted p-2 rounded-full transition-colors flex items-center justify-center">
                    <BellOutlined className="text-[18px] text-foreground/70" />
                    {isConfigured && <div className="absolute top-1 right-2 w-2 h-2 bg-primary rounded-full border border-background"></div>}
                </div>

                {/* SEMANTIC COPILOT TRIGGER */}
                <Sheet>
                    <SheetTrigger asChild>
                        <div className="relative group cursor-pointer p-2 rounded-full hover:bg-muted transition-all active:scale-95 flex items-center justify-center">
                            <div className="absolute inset-0 bg-blue-500/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                            <Sparkles className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-all relative z-10" />
                            <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-[0_0_12px_rgba(0,0,0,0.5)] border border-background z-20" />
                        </div>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[450px] sm:max-w-[500px] border-l border-border p-0 overflow-hidden flex flex-col bg-card">
                        <SheetHeader className="p-6 border-b border-border space-y-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary text-primary-foreground rounded-xl shadow-lg">
                                    <Bot size={20} />
                                </div>
                                <div>
                                    <SheetTitle className="text-xl font-black uppercase tracking-tighter dark:text-white">Semantic Copilot</SheetTitle>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Powered by Google Gemini IA</p>
                                </div>
                            </div>
                        </SheetHeader>
                        <div className="flex-1 overflow-hidden p-6">
                            <SemanticCopilot data={data} isDark={document.documentElement.classList.contains('dark')} />
                        </div>
                    </SheetContent>
                </Sheet>

                <div className="flex items-center gap-2 btn-bw-inverse p-1.5 rounded-xl border border-border shadow-md transition-all">
                    <DatabaseOutlined className="text-inherit ml-2" />
                    <Select
                        placeholder="Vincular Empresas"
                        value={activeCompanyId || undefined}
                        onChange={onSelectCompany}
                        style={{ width: 220 }}
                        bordered={false}
                        className="font-medium"
                        options={linkedCompanies.map(c => ({
                            value: c.id,
                            label: (
                                <div className="flex items-center gap-2">
                                    <span className="truncate">{c.name}</span>
                                    {c.dataSourceType === 'local' && <span className="text-[10px] border border-current px-1.5 py-0.5 rounded">Local</span>}
                                </div>
                            )
                        }))}
                        notFoundContent={<Typography.Text type="secondary" className="p-2 block text-sm">Nenhuma base vinculada.</Typography.Text>}
                    />
                    
                    <Tooltip title="Sincronizar dados">
                        <Button
                            disabled={!activeCompanyId || isLoading}
                            loading={isLoading}
                            onClick={onRefresh}
                            type="text"
                            icon={<SyncOutlined className="text-inherit" />}
                            className="text-inherit hover:opacity-80 flex items-center justify-center p-2"
                        />
                    </Tooltip>
                </div>

            </div>
        </AntHeader>
    )
}
