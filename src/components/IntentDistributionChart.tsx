import { useMemo } from 'react'
import { 
    PieChart, 
    Pie, 
    Cell, 
    ResponsiveContainer, 
    Tooltip,
    Legend
} from 'recharts'
import type { CampaignTerm } from '../types'
import { cn } from '../lib/utils'
import { ChartExplicationTooltip } from './ChartExplicationTooltip'

interface IntentDistributionChartProps {
    data: CampaignTerm[]
    isDark?: boolean
}

const COLORS = {
    validated: '#00ffbc', // Verde Googlar
    review: '#FAAD14',   // Amarelo Alerta
    irrelevant: '#ef4444' // Vermelho Destrutivo
}

const CustomTooltip = ({ active, payload, isDark }: any) => {
    if (active && payload && payload.length) {
        const item = payload[0];
        return (
            <div className={cn(
                "p-4 rounded-xl border shadow-2xl backdrop-blur-md",
                isDark ? "bg-black/90 border-zinc-800" : "bg-white/90 border-zinc-200"
            )}>
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.payload.fill }} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                        {item.name}
                    </p>
                </div>
                <p className={cn("text-xl font-black", isDark ? "text-white" : "text-zinc-900")}>
                    {item.value} <span className="text-[10px] font-bold text-zinc-500">TERMOS</span>
                </p>
                <p className="text-[10px] font-bold text-zinc-400 mt-1">
                    {((item.value / item.payload.total) * 100).toFixed(1)}% do Total
                </p>
            </div>
        )
    }
    return null
}

export function IntentDistributionChart({ data, isDark }: IntentDistributionChartProps) {
    const chartData = useMemo(() => {
        const stats = {
            validated: 0,
            review: 0,
            irrelevant: 0
        }

        data.forEach(item => {
            if (item.negativize?.includes('❌')) {
                stats.irrelevant++
            } else if (item.duvida?.trim() !== '' || item.status_granularity?.includes('⚠️')) {
                stats.review++
            } else {
                stats.validated++
            }
        })

        const total = data.length

        return [
            { name: 'Validados', value: stats.validated, fill: COLORS.validated, total },
            { name: 'Revisão Necessária', value: stats.review, fill: COLORS.review, total },
            { name: 'Irrelevantes', value: stats.irrelevant, fill: COLORS.irrelevant, total }
        ].filter(item => item.value > 0)
    }, [data])

    return (
        <div className={cn(
            "p-8 rounded-[32px] border backdrop-blur-md transition-all duration-500 h-full",
            isDark 
                ? "bg-zinc-950/80 border-zinc-800/50 shadow-[0_0_40px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.02)]" 
                : "bg-white border-zinc-100 shadow-xl"
        )}>
            <div className="flex flex-col gap-1 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-2 bg-zinc-800 rounded-full" />
                    <h3 className={cn("text-xl font-black uppercase tracking-tighter flex items-center gap-2", isDark ? "text-white" : "text-zinc-900")}>
                        Distribuição de Desperdício
                        <ChartExplicationTooltip 
                            content="Exibe a porcentagem do custo desperdiçado dividida por intenção de busca (Negativar, Dúvida, Testar)."
                        />
                    </h3>
                </div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] ml-11">Saúde Semântica da Conta</p>
            </div>

            <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                            animationBegin={0}
                            animationDuration={1500}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} className="drop-shadow-lg" />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip isDark={isDark} />} />
                        <Legend 
                            verticalAlign="bottom" 
                            align="center"
                            iconType="circle"
                            iconSize={8}
                            formatter={(value) => (
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest ml-1",
                                    isDark ? "text-zinc-500" : "text-zinc-400"
                                )}>
                                    {value}
                                </span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
                
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-[-10px]">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total</span>
                    <span className={cn("text-3xl font-black tracking-tighter", isDark ? "text-white" : "text-zinc-900")}>
                        {data.length}
                    </span>
                </div>
            </div>
        </div>
    )
}
