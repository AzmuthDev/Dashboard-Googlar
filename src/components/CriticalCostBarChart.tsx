import { useMemo } from 'react'
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    Cell,
    LabelList
} from 'recharts'
import type { CampaignTerm } from '../types'
import { cn } from '../lib/utils'
import { ChartExplicationTooltip } from './ChartExplicationTooltip'
import { useIsMobile } from '../hooks/useIsMobile'

interface CriticalCostBarChartProps {
    data: CampaignTerm[]
    isDark?: boolean
}

const CustomTooltip = ({ active, payload, isDark }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload
        return (
            <div className={cn(
                "p-4 rounded-xl border shadow-2xl backdrop-blur-md",
                isDark ? "bg-black/90 border-zinc-800" : "bg-white/90 border-zinc-200"
            )}>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 max-w-[200px] leading-tight">
                    {data.name}
                </p>
                <div className="flex flex-col gap-1">
                    <p className={cn("text-lg font-black", isDark ? "text-white" : "text-zinc-900")}>
                        R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-zinc-500">
                        Investimento Acumulado
                    </p>
                </div>
            </div>
        )
    }
    return null
}

export function CriticalCostBarChart({ data, isDark }: CriticalCostBarChartProps) {
    const isMobile = useIsMobile()
    // Top 10 terms by cost for visibility
    const chartData = useMemo(() => {
        return data
            .sort((a, b) => (parseFloat(String(b.custo || '0')) || 0) - (parseFloat(String(a.custo || '0')) || 0))
            .slice(0, 10)
            .map(item => ({
                name: item.termo_de_pesquisa,
                value: parseFloat(String(item.custo || '0')) || 0,
                isCritical: (item.negativar && String(item.negativar).includes('❌')) || (parseFloat(String(item.conversoes || '0')) || 0) === 0
            }))
    }, [data])

    return (
        <div className={cn(
            "p-4 sm:p-8 rounded-[24px] sm:rounded-[32px] border backdrop-blur-md transition-all duration-500",
            isDark 
                ? "bg-black metal-border shadow-2xl" 
                : "bg-white border-zinc-100 shadow-xl"
        )}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-10 bg-zinc-800 rounded-full" />
                    <div>
                        <h3 className={cn("text-base sm:text-xl font-black uppercase tracking-tighter flex items-center gap-2", isDark ? "text-white" : "text-zinc-900")}>
                            Análise de Desempenho
                            <ChartExplicationTooltip 
                                content="Analisa o desempenho dos termos sem conversão, comparando o Custo (R$) com o Volume (Cliques/Impressões)."
                            />
                        </h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Visibilidade de Investimento vs. Relevância</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-zinc-800" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 whitespace-nowrap">Em Análise</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#ef4444] whitespace-nowrap">Risco de Perda</span>
                    </div>
                </div>
            </div>

            <div className="h-[360px] sm:h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: isMobile ? 60 : 30, left: isMobile ? 0 : 15, bottom: 5 }}
                        barSize={24}
                    >
                        <defs>
                            <linearGradient id="metallicBlackGradientLocal" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#18181b" stopOpacity={1} />
                                <stop offset="50%" stopColor="#3f3f46" stopOpacity={1} />
                                <stop offset="100%" stopColor="#000000" stopOpacity={1} />
                            </linearGradient>
                            <linearGradient id="silverGradientLocal" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#E5E7EB" stopOpacity={1} />
                                <stop offset="50%" stopColor="#F9FAFB" stopOpacity={1} />
                                <stop offset="100%" stopColor="#D1D5DB" stopOpacity={1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid 
                            strokeDasharray="3 3" 
                            stroke={isDark ? "#27272a" : "#f4f4f5"} 
                            horizontal={false}
                        />
                        <XAxis 
                            type="number" 
                            stroke={isDark ? "#52525b" : "#a1a1aa"}
                            fontSize={10}
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `R$ ${value}`}
                        />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            stroke={isDark ? "#52525b" : "#a1a1aa"}
                            fontSize={9}
                            fontWeight="black"
                            tickLine={false}
                            axisLine={false}
                            width={isMobile ? 90 : 150}
                            tickFormatter={(value) => { const max = isMobile ? 13 : 20; return value.length > max ? `${value.substring(0, max)}...` : value }}
                        />
                        <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: isDark ? '#18181b' : '#f4f4f5', opacity: 0.5 }} />
                        <Bar 
                            dataKey="value" 
                            radius={[0, 4, 4, 0]}
                            animationDuration={1500}
                        >
                            {chartData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.isCritical ? '#ef4444' : (isDark ? 'url(#silverGradientLocal)' : 'url(#metallicBlackGradientLocal)')} 
                                />
                            ))}
                            <LabelList 
                                dataKey="value" 
                                position="right" 
                                formatter={(value: any) => value ? `R$ ${Number(value).toFixed(2)}` : ''}
                                style={{ fontSize: '9px', fontWeight: 'bold', fill: isDark ? '#a1a1aa' : '#52525b' }}
                                offset={10}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
