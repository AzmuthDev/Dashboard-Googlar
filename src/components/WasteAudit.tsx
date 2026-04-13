import { useMemo } from 'react'
import type { CampaignTerm } from '../types'
import { Ban, TrendingDown } from 'lucide-react'
import { ChartExplicationTooltip } from './ChartExplicationTooltip'
import { motion } from 'framer-motion'

interface WasteAuditProps {
    data: CampaignTerm[]
    onNegativar: (id: string) => void
}

export function WasteAudit({ data, onNegativar }: WasteAuditProps) {
    const topWaste = useMemo(() => {
        return data
            .filter(item => (item.conversions === 0 || !item.conversions))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 5)
    }, [data])

    if (topWaste.length === 0) return null

    // Max cost for the progress bar calculation
    const maxCost = Math.max(...topWaste.map(item => item.cost), 1);

    return (
        <div className="mb-16 p-8 rounded-[32px] border backdrop-blur-md transition-all duration-500 bg-card border-border shadow-xl">
            <div className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-10 bg-[#ef4444] rounded-full shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-foreground">
                            Termos de Baixa Eficiência (Custo Crítico)
                            <ChartExplicationTooltip 
                                content="Lista os 5 principais termos de pesquisa com o maior volume de custo associado e zero conversão, ordenados pelo valor desperdiçado."
                            />
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Auditoria de Desperdício - Impacto Financeiro Direto</p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-[#ef4444]">
                    <TrendingDown size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Atenção Crítica</span>
                </div>
            </div>

            <div className="space-y-4">
                {topWaste.map((item, index) => (
                    <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group grid grid-cols-1 md:grid-cols-[1fr,200px,180px] gap-6 items-center p-4 py-3 rounded-2xl transition-all hover:bg-muted/50 border border-transparent hover:border-border"
                    >
                        {/* Term Name - Flex 1 */}
                        <div className="flex flex-col min-w-0">
                            <span className="text-[12px] font-black uppercase tracking-tighter truncate leading-tight mb-1 text-foreground" title={item.search_term}>
                                {item.search_term}
                            </span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{item.campaign_name}</span>
                        </div>

                        {/* Progress Bar & Numeric Data */}
                        <div className="flex flex-col gap-2">
                             <div className="flex justify-between items-end mb-1">
                                <span className="text-[13px] font-black text-foreground uppercase">
                                    R$ {item.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Custo</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(item.cost / maxCost) * 100}%` }}
                                    className="h-full bg-gradient-to-r from-[#ef4444] to-[#ef4444]/60 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                                />
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="flex justify-end">
                            <button 
                                onClick={() => onNegativar(item.id)}
                                className="btn-bw-inverse flex-shrink-0 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300"
                            >
                                <Ban size={12} /> Aplicar Negativação
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
