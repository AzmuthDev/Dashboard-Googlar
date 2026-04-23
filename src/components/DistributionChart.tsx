import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
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

    const isAprovada = (row: CampaignTerm) => {
        return row.segmentar === true || String(row.segmentar || '').includes('✅');
    }

    const isTesteAB = (row: CampaignTerm) => {
        return row.teste_ab === true || String(row.teste_ab || '').includes('⚠️');
    }

    const isRespostaCliente = (row: CampaignTerm) => {
        return String(row.status_granularidade || '').includes('Resposta') ||
               String(row.comentario_analista || '').toLowerCase().includes('resposta cliente');
    }

    const negativarCount = data.filter(isNegativar).length
    const duvidasCount = data.filter(isDuvida).length
    const aprovadasCount = data.filter(isAprovada).length
    const testeABCount = data.filter(isTesteAB).length
    const respostasCount = data.filter(isRespostaCliente).length
    const geralCount = Math.max(
        0,
        data.length - negativarCount - duvidasCount - aprovadasCount - testeABCount - respostasCount
    )

    const chartData = [
        { name: 'Negativas',         value: negativarCount,  color: '#d00018' },
        { name: 'Dúvidas',           value: duvidasCount,    color: '#960DF2' },
        { name: 'Aprovadas',         value: aprovadasCount,  color: '#2B730D' },
        { name: 'Teste A/B',         value: testeABCount,    color: '#F88F22' },
        { name: 'Respostas Cliente', value: respostasCount,  color: '#AB3DF5' },
        { name: 'Geral',             value: geralCount,      color: '#475569' },
    ]

    const pieData = chartData.filter(item => item.value > 0)
    const displayData = pieData.length > 0 ? pieData : [{ name: 'Sem dados', value: 1, color: '#27272a' }]

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="p-3 rounded-xl border shadow-2xl text-xs backdrop-blur-md bg-slate-900 border-slate-700 text-white">
                    <p className="font-bold mb-1 uppercase tracking-tighter">{payload[0].name}</p>
                    <p className="text-slate-400">Total: <span className="font-extrabold text-white">{payload[0].value}</span> termos</p>
                </div>
            )
        }
        return null
    }

    return (
        <div className={`w-full h-full p-6 flex flex-col transition-all duration-500 ${isDark ? 'rounded-[20px] bg-black border border-white/10 shadow-2xl' : 'rounded-[24px] bg-white border border-zinc-100 shadow-sm'}`}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                    Distribuição de Termos
                </h3>
            </div>

            <div className="flex-1 min-h-0 relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none z-10">
                    <span className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{data.length}</span>
                    <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Total</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                            data={displayData}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={90}
                            paddingAngle={displayData.length > 1 ? 3 : 0}
                            dataKey="value"
                            stroke="none"
                        >
                            {displayData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
