import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CampaignTerm } from '../hooks/useCampaignData'

interface DistributionChartProps {
    data: CampaignTerm[]
    isDark?: boolean
}

export function DistributionChart({ data, isDark = false }: DistributionChartProps) {
    const isNegativar = (row: CampaignTerm) => {
        return row.negativar === true || String(row.negativar || '').includes('❌');
    }

    const isDuvida = (row: CampaignTerm) => {
        return row.duvida === true || String(row.duvida || '').includes('❓');
    }

    const isSegmentado = (row: CampaignTerm) => {
        return row.segmentar === true || String(row.segmentar || '').includes('✅');
    }

    const isTesteAB = (row: CampaignTerm) => {
        return row.teste_ab === true || String(row.teste_ab || '').includes('⚠️');
    }

    const negativarCount = data.filter(isNegativar).length
    const duvidasCount = data.filter(isDuvida).length
    const segmentadoCount = data.filter(isSegmentado).length
    const testeABCount = data.filter(isTesteAB).length
    const geralCount = data.length - negativarCount - duvidasCount - segmentadoCount - testeABCount

    const chartData = [
        { name: 'Geral', value: geralCount > 0 ? geralCount : 0, color: 'url(#titaniumGradient)' },
        { name: 'Segmentar', value: segmentadoCount, color: 'url(#silverGradient)' },
        { name: 'Teste A/B', value: testeABCount, color: 'url(#steelGradient)' },
        { name: 'Dúvidas', value: duvidasCount, color: '#f59e0b' }, // Metallic Orange
        { name: 'Negativar', value: negativarCount, color: '#ef4444' } // Metallic Red
    ].filter(item => item.value > 0)

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className={`
                    p-3 rounded-xl border shadow-2xl text-xs backdrop-blur-md
                    ${isDark ? 'bg-black/80 border-white/10 text-white' : 'bg-white/80 border-zinc-200 text-zinc-900'}
                `}>
                    <p className="font-bold mb-1 uppercase tracking-tighter">{payload[0].name}</p>
                    <p className="text-zinc-500">Total: <span className="font-extrabold text-foreground">{payload[0].value}</span> termos</p>
                </div>
            )
        }
        return null
    }

    return (
        <div className={`w-full h-full p-6 flex flex-col transition-all duration-500 ${isDark ? 'rounded-[20px] bg-black border border-white/10 shadow-2xl' : 'rounded-[24px] bg-white border border-zinc-100 shadow-sm'}`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className={`text-sm font-bold uppercase tracking-widest text-zinc-500`}>
                    Distribuição de Termos
                </h3>
            </div>

            <div className="flex-1 min-h-0 relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{data.length}</span>
                    <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Total</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={95}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value) => <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
