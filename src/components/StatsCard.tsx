import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

interface StatsCardProps {
    label: string
    value: React.ReactNode
    trend?: 'up' | 'down' | 'neutral'
    trendValue?: string
    isPrimary?: boolean // The dark floating Hero Card
    isDark?: boolean // Global dark mode state
    accentColor?: string
}

export function StatsCard({ label, value, trend, trendValue, isDark, isPrimary, accentColor }: StatsCardProps) {
    let bgClass = '';
    let labelColor = '';
    let valueColor = '';
    let borderShadowClass = '';

    if (isDark) {
        // DARK MODE: Luxury Metallic style
        bgClass = 'bg-black text-white';
        labelColor = 'text-zinc-500';
        valueColor = 'text-white';
        borderShadowClass = 'metal-border shadow-2xl';
    } else {
        // LIGHT MODE: Skillset style
        if (isPrimary) {
            bgClass = 'bg-zinc-900 text-white';
            labelColor = 'text-zinc-400';
            valueColor = 'text-white';
            borderShadowClass = 'border-transparent shadow-[0_4px_24px_rgba(0,0,0,0.08)]';
        } else {
            bgClass = 'bg-white text-zinc-900';
            labelColor = 'text-zinc-500';
            valueColor = 'text-zinc-900';
            borderShadowClass = 'border-transparent shadow-[0_4px_16px_rgba(0,0,0,0.04)]';
        }
    }

    // Using inline style for dynamic accentColor on border if provided (optional)
    const customStyle = accentColor && isDark ? { borderColor: accentColor } : {}

    return (
        <div
            className={`p-6 rounded-[20px] shadow-sm flex flex-col justify-between h-full border transition-colors duration-300 ${bgClass} ${borderShadowClass}`}
            style={customStyle}
        >
            <p className={`text-[13px] font-medium tracking-wide mb-1 flex items-center gap-2 ${labelColor}`}>
                {label}
            </p>
            <h3 className={`text-[32px] font-semibold tracking-tight ${valueColor}`}>
                {value}
            </h3>

            {trend && trendValue && (
                <div className="flex items-center gap-1.5 mt-2">
                    {trend === 'up' && <ArrowUpOutlined className="text-emerald-500 text-xs" />}
                    {trend === 'down' && <ArrowDownOutlined className="text-red-500 text-xs" />}
                    <span className={`text-xs font-bold ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-zinc-400'}`}>
                        {trendValue}
                    </span>
                    <span className={`text-xs ${labelColor} font-medium`}>
                        do período analizado
                    </span>
                </div>
            )}
        </div>
    )
}
