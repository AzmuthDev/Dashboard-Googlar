import { Layout, Button, Input, Select, Typography, Tooltip } from 'antd'
import { SyncOutlined, BellOutlined, SearchOutlined, DatabaseOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import type { Company, CampaignTerm } from '../types'
import { Sparkles, Bot, Upload } from 'lucide-react'
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
        <AntHeader
            className="!flex !flex-wrap !items-center !justify-between gap-x-4 gap-y-3 !h-auto md:!h-20 !leading-normal !py-3 md:!py-0 !px-4 md:!px-8"
            style={{
                borderBottom: '1px solid var(--border)',
                background: 'transparent',
            }}>
            <div className="flex items-center gap-4 min-w-0 flex-1 md:flex-none pl-14 md:pl-0 min-h-11">
                <h1 className="text-lg sm:text-2xl md:text-[26px] font-black uppercase tracking-tighter text-foreground m-0 leading-tight truncate">
                    {currentView === 'laboratorio-ab' ? 'Laboratório A/B' : 
                     currentView === 'semantic-audit' ? 'Triagem de Especialistas' :
                     (currentView === 'upperscript' || currentView === 'ferramenta') ? 'Upper Script' :
                     currentView === 'keyword-planner' ? 'Planejador' :
                     currentView === 'auditoria-lsa' ? 'Áudios LSA' :
                     currentView === 'users' ? 'Usuários' : 
                     currentView === 'companies' ? 'Empresas' : 'Dashboard'}
                </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full md:w-auto">
                {currentView === 'semantic-audit' && (
                    <Input
                        placeholder="Buscar Termo..."
                        prefix={<SearchOutlined className="text-white" />}
                        className="w-full md:w-64 rounded-xl border-zinc-800 bg-[#111111] text-white placeholder-zinc-300 hover:border-white focus:border-white shadow-xl px-4 py-2 transition-all"
                    />
                )}

                {(currentView === 'upperscript' || currentView === 'ferramenta') && (
                    <button
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('upperscript_trigger_upload'));
                        }}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all duration-200 bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 border border-amber-400 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        title="Fazer Upload de Planilha (.xlsx, .xls, .csv)"
                    >
                        <Upload className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                        <span>Upload Planilha</span>
                    </button>
                )}

                {currentView !== 'upperscript' && currentView !== 'ferramenta' && (
                    <div className="flex items-center gap-2 bg-[#111111] p-1.5 rounded-xl w-full md:w-auto min-w-0 border border-zinc-800 shadow-xl transition-all hover:border-zinc-700">
                        <DatabaseOutlined className="text-white ml-2 opacity-70" />
                        <Select
                            placeholder={(<span className="text-zinc-300 font-bold uppercase text-[10px] tracking-widest">Selecionar Empresa</span>)}
                            value={activeCompanyId || undefined}
                            onChange={onSelectCompany}
                            style={{ minWidth: 0 }}
                            variant="borderless"
                            className="font-bold dark-selector luxury-select flex-1 min-w-0 md:!w-[220px] md:flex-none"
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
                )}
            </div>
        </AntHeader>
    )
}
