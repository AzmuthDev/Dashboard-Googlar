import { ShieldAlert, Activity, FileSearch, ShieldCheck, FileText, AlertCircle, AlertTriangle } from "lucide-react"

import { TracingBeam } from "@/components/ui/tracing-beam"
import { BorderBeam } from "@/components/ui/border-beam"

// Simulated data structure for the Dashboard
interface AuditItem {
    id: string
    campaign: string
    term: string
    impressions: number
    cost: number
    status: 'CORRETO' | 'GENÉRICO' | 'DESLOCADO' | 'ERRO' | string
    action: string
}

const mockData: AuditItem[] = [
    { id: "1", campaign: "Campanha Institucional", term: "googlar login", impressions: 1250, cost: 45.50, status: "CORRETO", action: "Manter" },
    { id: "2", campaign: "Produtos Software", term: "software gratuito", impressions: 800, cost: 120.00, status: "DESLOCADO", action: "Pausar" },
    { id: "3", campaign: "Serviços Consultoria", term: "consultoria empresarial", impressions: 450, cost: 310.20, status: "CORRETO", action: "Manter" },
    { id: "4", campaign: "Produtos Software", term: "como fazer download", impressions: 2200, cost: 85.00, status: "GENÉRICO", action: "Analisar" },
    { id: "5", campaign: "Serviços Consultoria", term: "consultorio medico", impressions: 150, cost: 12.00, status: "ERRO", action: "Sinalizar" },
]

export function Hero195({ data = mockData }: { data?: AuditItem[] }) {
    // We'll map the statuses to visual elements
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'CORRETO': return <ShieldCheck className="h-4 w-4 text-emerald-500" />
            case 'GENÉRICO': return <AlertCircle className="h-4 w-4 text-amber-500" />
            case 'DESLOCADO': return <AlertTriangle className="h-4 w-4 text-orange-500" />
            case 'ERRO': return <ShieldAlert className="h-4 w-4 text-red-500" />
            default: return <Activity className="h-4 w-4 text-slate-500" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'CORRETO': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
            case 'GENÉRICO': return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
            case 'DESLOCADO': return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
            case 'ERRO': return 'text-red-500 bg-red-500/10 border-red-500/20'
            default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20'
        }
    }

    return (
        <TracingBeam className="px-6">
            <div className="max-w-4xl mx-auto antialiased pt-4 relative border border-border bg-card rounded-xl overflow-hidden shadow-sm">
                {/* Glow effect at the top */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-30"></div>

                <div className="p-8">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
                            <FileSearch className="h-6 w-6 text-primary" />
                            Auditoria Semântica
                        </h2>
                        <p className="text-muted-foreground mt-2 text-sm">
                            Análise inteligente de termos de busca e economia projetada.
                        </p>
                    </div>

                    <div className="space-y-6 relative">
                        {data.map((item, index) => (
                            <div
                                key={item.id || index}
                                className="relative group rounded-lg border border-border bg-card p-5 transition-all hover:bg-accent hover:border-border/80 shadow-xs"
                            >
                                {/* Status indicator line on the left */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${item.status === 'CORRETO' ? 'bg-emerald-500' :
                                    item.status === 'ERRO' ? 'bg-red-500' :
                                        item.status === 'DESLOCADO' ? 'bg-orange-500' : 'bg-amber-500'
                                    } opacity-0 group-hover:opacity-100 transition-opacity`}>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs text-primary font-mono tracking-wider uppercase">{item.campaign}</span>
                                        </div>
                                        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                                            {item.term}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground mb-1">Métricas</p>
                                            <p className="text-sm font-medium text-foreground">
                                                {item.impressions.toLocaleString('pt-BR')} imp. / <span className="text-red-500">R$ {item.cost.toFixed(2).replace('.', ',')}</span>
                                            </p>
                                        </div>

                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${getStatusColor(item.status)}`}>
                                            {getStatusIcon(item.status)}
                                            <span className="text-xs font-semibold">{item.status}</span>
                                        </div>

                                        <div className="text-right min-w-[100px]">
                                            <span className="text-xs text-muted-foreground block mb-1">Ação Sugerida</span>
                                            <span className="text-sm text-foreground font-medium">{item.action}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {data.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Nenhum dado de auditoria encontrado.</p>
                        </div>
                    )}

                </div>
                <BorderBeam size={250} duration={12} delay={9} />
            </div>
        </TracingBeam>
    );
}
