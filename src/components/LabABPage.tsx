import { useState } from 'react'
import { DashboardTable } from './DashboardTable'
import { Card } from './ui/card'
import { Info, FlaskConical, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import type { CampaignTerm } from '../types'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface LabABPageProps {
    data: CampaignTerm[]
    isLoading: boolean
}

export function LabABPage({ data, isLoading }: LabABPageProps) {
    const [activeTab, setActiveTab] = useState('all')
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncData, setSyncData] = useState<CampaignTerm[] | null>(null)

    const handleSyncGoogleAds = async () => {
        setIsSyncing(true)
        try {
            const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://n8n-n8n-start.hup4p9.easypanel.host/webhook/sync-google-ads'
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: "fetch_ab_data", 
                    target: "google_ads", 
                    status_filter: "⚠️" 
                })
            })

            if (!response.ok) throw new Error('Falha na resposta do servidor')

            const result = await response.json()
            
            if (result && Array.isArray(result.data)) {
                setSyncData(result.data)
                toast.success('Sincronização concluída!', { 
                    description: 'Os dados do Google Ads foram atualizados com sucesso.' 
                })
            } else {
                toast.success('Sincronização concluída!', { 
                    description: 'Fluxo simulado com sucesso.' 
                })
            }
        } catch (error) {
            console.error('Sync error:', error)
            toast.error('Erro na sincronização', { 
                description: 'Não foi possível buscar os dados do Google Ads.' 
            })
        } finally {
            setIsSyncing(false)
        }
    }

    const displayData = syncData || data

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl shadow-glow bg-primary text-primary-foreground">
                        <FlaskConical size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">
                            Laboratório A/B
                        </h1>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
                            Acompanhe e valide o desempenho de termos experimentais.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSyncGoogleAds}
                    disabled={isSyncing || isLoading}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg",
                        "bg-blue-600 hover:bg-blue-700 text-white",
                        isSyncing && "animate-pulse"
                    )}
                >
                    {isSyncing ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <RefreshCw size={18} />
                    )}
                    <span>{isSyncing ? 'Sincronizando...' : 'Puxar Dados Ads'}</span>
                </button>
            </div>

            <Card className="p-6 border-2 border-border bg-card flex items-start gap-4 transition-all duration-300 hover:border-primary/20 shadow-sm text-foreground">
                <div className="p-2 rounded-xl bg-muted text-amber-500 shrink-0">
                    <Info size={20} />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-black uppercase tracking-[0.2em]">
                        Instruções Estratégicas
                    </span>
                    <p className="text-sm leading-relaxed font-medium opacity-80 text-muted-foreground">
                        Os termos listados aqui foram identificados como oportunidades (⚠️) fora do padrão. 
                        Este ambiente serve para validar se o time comercial consegue converter esses leads antes de escalar o orçamento.
                    </p>
                </div>
            </Card>

            <div className="mt-4">
                <DashboardTable 
                    data={displayData}
                    isLoading={isLoading || isSyncing}
                    isEmpty={displayData.length === 0 && !isSyncing}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isLabMode={true}
                />
            </div>
        </motion.div>
    )
}
