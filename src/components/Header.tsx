import { Layout, Button, Input, Select, Typography, Tooltip } from 'antd'
import { SyncOutlined, BellOutlined, SearchOutlined, DatabaseOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import type { Company, CampaignTerm } from '../types'
import { Sparkles, Bot } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet'
import { SemanticCopilot } from './SemanticCopilot'
import { fetchCompanies } from '../lib/supabaseProvider'

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
        const updateLinkedCompanies = async () => {
            // 1. Fetch from Supabase (New Standard V4)
            const supabaseCompanies = await fetchCompanies();
            
            // Garantimos que apenas empresas válidas do banco apareçam
            // Ordenamos por nome para facilitar a busca
            const linked = supabaseCompanies
                .filter(c => c && c.id && c.name)
                .sort((a, b) => a.name.localeCompare(b.name));
            
            setLinkedCompanies(linked);
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
                    placeholder="Buscar Termo..."
                    prefix={<SearchOutlined className="text-white" />}
                    className="w-64 rounded-xl border-zinc-800 bg-[#111111] text-white placeholder-zinc-500 hover:border-white focus:border-white shadow-xl px-4 py-2 transition-all"
                />

                <div className="relative cursor-pointer hover:bg-muted dark:hover:bg-white/10 p-2 rounded-full transition-colors flex items-center justify-center">
                    <BellOutlined className="text-[18px] text-foreground/70 dark:text-white" />
                    {isConfigured && <div className="absolute top-1 right-2 w-2 h-2 bg-primary rounded-full border border-background"></div>}
                </div>

                {/* SEMANTIC COPILOT TRIGGER */}
                <Sheet>
                    <SheetTrigger asChild>
                        <div className="relative group cursor-pointer p-2 rounded-full hover:bg-muted dark:hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center">
                            <div className="absolute inset-0 bg-blue-500/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                            <Sparkles className="w-5 h-5 text-muted-foreground dark:text-white/80 group-hover:text-primary dark:group-hover:text-white transition-all relative z-10" />
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

                <div className="flex items-center gap-2 bg-[#111111] p-1.5 rounded-xl border border-zinc-800 shadow-xl transition-all hover:border-zinc-700">
                    <DatabaseOutlined className="text-white ml-2 opacity-70" />
                    <Select
                        placeholder={(<span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Selecionar Empresa</span>)}
                        value={activeCompanyId || undefined}
                        onChange={onSelectCompany}
                        style={{ width: 220 }}
                        variant="borderless"
                        className="font-bold dark-selector luxury-select"
                        options={linkedCompanies.map(c => ({
                            value: c.id,
                            label: (
                                <div className="flex items-center gap-2 text-white">
                                    <span className="truncate uppercase text-[11px] tracking-tight">{c.name}</span>
                                    {c.dataSourceType === 'local' && <span className="text-[9px] border border-white/20 px-1.5 py-0.5 rounded uppercase font-black">CSV</span>}
                                </div>
                            )
                        }))}
                        notFoundContent={<Typography.Text className="p-2 block text-xs text-zinc-500 uppercase font-black">Nenhuma base vinculada.</Typography.Text>}
                        popupClassName="dark-dropdown luxury-dropdown"
                    />
                    
                    <Tooltip title="Sincronizar dados">
                        <Button
                            disabled={!activeCompanyId || isLoading}
                            loading={isLoading}
                            onClick={onRefresh}
                            type="text"
                            icon={<SyncOutlined className="text-inherit dark:text-white" />}
                            className="text-inherit hover:opacity-80 flex items-center justify-center p-2"
                        />
                    </Tooltip>
                </div>

            </div>
        </AntHeader>
    )
}
