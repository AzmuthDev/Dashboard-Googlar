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
            "p-8 rounded-[32px] border backdrop-blur-md transition-all duration-500",
            isDark 
                ? "bg-black metal-border shadow-2xl" 
                : "bg-white border-zinc-100 shadow-xl"
        )}>
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-10 bg-zinc-800 rounded-full" />
                    <div>
                        <h3 className={cn("text-xl font-black uppercase tracking-tighter flex items-center gap-2", isDark ? "text-white" : "text-zinc-900")}>
                            Análise de Desempenho
                            <ChartExplicationTooltip 
                                content="Analisa o desempenho dos termos sem conversão, comparando o Custo (R$) com o Volume (Cliques/Impressões)."
                            />
                        </h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Visibilidade de Investimento vs. Relevância</p>
                    </div>
                </div>
                <div className="flex gap-6">
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

            <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 15, bottom: 5 }}
                        barSize={24}
                    >
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
                            width={150}
                            tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value}
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
                                    fill={entry.isCritical ? '#ef4444' : (isDark ? 'url(#silverGradient)' : '#52525b')} 
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
