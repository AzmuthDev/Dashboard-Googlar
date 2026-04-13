import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CampaignTerm } from '../hooks/useCampaignData'

interface DistributionChartProps {
    data: CampaignTerm[]
    isDark?: boolean
}

export function DistributionChart({ data, isDark = false }: DistributionChartProps) {
    const isNegativar = (row: CampaignTerm) => {
        const val = (row.negativize || '').toLowerCase()
        return val.includes('❌') || val.includes('sim') || val.includes('true') || val === 'x'
    }

    const isDuvida = (row: CampaignTerm) => {
        const val = (row.observation || '').trim()
        return val !== '' && !isNegativar(row)
    }

    const isSegmentarAtiva = (val: string) => val.includes('✅')
    const isSegmentarAlerta = (val: string) => val.includes('⚠️') || val.includes('❓')

    const isSegmentado = (row: CampaignTerm) => {
        const val = (row.segment || '').trim()
        return isSegmentarAtiva(val) || isSegmentarAlerta(val)
    }

    const isTesteAB = (row: CampaignTerm) => {
        const val = (row.ab_test || '').toLowerCase()
        return val === 'true' || val === 'sim' || val.includes('✅')
    }

    const negativarCount = data.filter(isNegativar).length
    const duvidasCount = data.filter(isDuvida).length
    const segmentadoCount = data.filter(isSegmentado).length
    const testeABCount = data.filter(isTesteAB).length
    const geralCount = data.length - negativarCount - duvidasCount - segmentadoCount - testeABCount

    const chartData = [
        { name: 'Geral', value: geralCount > 0 ? geralCount : 0, color: '#9CA3AF' },
        { name: 'Segmentar', value: segmentadoCount, color: '#00FF85' }, // Ultra Neon Green
        { name: 'Teste A/B', value: testeABCount, color: '#00C2FF' }, // Ultra Neon Cyan/Blue
        { name: 'Dúvidas', value: duvidasCount, color: '#FFB800' }, // Ultra Bright Gold
        { name: 'Negativar', value: negativarCount, color: '#FF003D' } // Intense Neon Red
    ].filter(item => item.value > 0)

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className={`
                    p-3 rounded-lg border shadow-lg text-xs
                    ${isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'}
                `}>
                    <p className="font-semibold mb-1">{payload[0].name}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">Total: <span className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{payload[0].value}</span> termos</p>
                </div>
            )
        }
        return null
    }

    return (
        <div className={`w-full h-full p-6 flex flex-col transition-colors ${isDark ? 'rounded-[20px] bg-gradient-to-br from-zinc-800 to-black border border-zinc-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)]' : 'rounded-[24px] bg-white border border-transparent shadow-[0_4px_16px_rgba(0,0,0,0.04)]'}`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className={`text-base font-semibold text-zinc-900 dark:text-white`}>
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
