import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ArrowUpRight } from 'lucide-react'
import type { CampaignTerm } from '../types'

interface TermsChartProps {
    data: CampaignTerm[]
    isDark?: boolean
}

export function TermsChart({ data, isDark }: TermsChartProps) {
    const topTerms = useMemo(() => {
        if (!data || data.length === 0) return []
        return [...data]
            .sort((a, b) => (parseFloat(String(b.custo || '0')) || 0) - (parseFloat(String(a.custo || '0')) || 0))
            .slice(0, 7)
            .map(term => ({
                name: term.termo_de_pesquisa,
                cost: parseFloat(String(term.custo || '0')) || 0,
                clicks: parseFloat(String(term.cliques || '0')) || 0,
            }))
    }, [data])

    if (!data || data.length === 0) return null

    const bgClass = isDark
        ? 'bg-gradient-to-br from-zinc-800 to-black border-zinc-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-[20px]'
        : 'bg-white border-transparent shadow-[0_4px_16px_rgba(0,0,0,0.04)] rounded-[24px]';

    return (
        <div className={`p-6 border h-full transition-colors duration-300 w-full flex flex-col ${bgClass}`}>
            <div className="flex justify-between items-start mb-8">
                <h2 className={`text-lg font-semibold tracking-tight text-zinc-900 dark:text-white`}>
                    Termos de Maior Custo
                </h2>
                <button className="w-8 h-8 rounded-full bg-slate-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors text-zinc-600 dark:text-zinc-300">
                    <ArrowUpRight className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topTerms} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#71717a', fontSize: 12 }}
                            dy={10}
                            tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#71717a', fontSize: 12 }}
                            tickFormatter={(value) => `R$${value}`}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(113, 113, 122, 0.1)' }}
                            contentStyle={{
                                backgroundColor: isDark ? '#18181b' : '#ffffff',
                                borderRadius: '12px',
                                border: `1px solid ${isDark ? '#27272a' : '#e5e7eb'}`,
                                color: isDark ? '#ffffff' : '#09090b',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                            }}
                            itemStyle={{ fontWeight: 500 }}
                            formatter={(value: any, name: any) => {
                                const numValue = typeof value === 'number' ? value : 0;
                                const strName = String(name || '');
                                if (strName === 'cost') return [`R$ ${numValue.toFixed(2)}`, 'Custo']
                                return [numValue, strName]
                            }}
                        />
                        <Bar
                            dataKey="cost"
                            radius={[6, 6, 0, 0]}
                            barSize={36}
                            fill="url(#silverGradient)"
                        >
                            {topTerms.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    className="transition-all duration-500 hover:opacity-80"
                                    opacity={1 - (index * 0.1)}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
