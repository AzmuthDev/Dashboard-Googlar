import { Typography } from 'antd'
import { 
    PackageOpen, 
    Ban, 
    HelpCircle, 
    CheckCircle2, 
    Trash2,
    ChevronRight, 
    ChevronDown, 
} from 'lucide-react'
import type { CampaignTerm } from '../types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import Loader from './ui/loader-15'
import { useEffect, useState, useMemo, useRef } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { gsap } from 'gsap'
import { motion, AnimatePresence } from 'framer-motion'
import { Checkbox } from './ui/checkbox'
import { HoverCard } from './ui/hover-card'
import { toast } from 'sonner'
import { cn } from '../lib/utils'
import { WasteAudit } from './WasteAudit'
import { CriticalCostBarChart } from './CriticalCostBarChart'
import { IntentDistributionChart } from './IntentDistributionChart'
import { ChartExplicationTooltip } from './ChartExplicationTooltip'

const { Title, Text } = Typography

interface DashboardTableProps {
    data: CampaignTerm[]
    isEmpty: boolean
    isLoading: boolean
    activeTab: string
    setActiveTab: (tab: string) => void
    isLabMode?: boolean
}

export function DashboardTable({ data, isEmpty, isLoading, activeTab, setActiveTab, isLabMode }: DashboardTableProps) {
    const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set())
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const [searchTerm, setSearchTerm] = useState('')
    const tableRef = useRef<HTMLDivElement>(null)

    const visibleData = data.filter(item => !hiddenRows.has(item.id))
    const visibleDataCount = visibleData.length

    useEffect(() => {
        const timer = setTimeout(() => {
            ScrollTrigger.refresh()
            if (tableRef.current) {
                const rows = tableRef.current.querySelectorAll('.table-row-item')
                gsap.fromTo(rows, 
                    { opacity: 0, x: -10 }, 
                    { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: "power2.out", overwrite: true }
                )
            }
        }, 150)
        return () => clearTimeout(timer)
    }, [activeTab, visibleDataCount, expandedGroups.size, hiddenRows.size])

    const isNegativar = (row: CampaignTerm) => {
        const val = (row.negativize || '').toLowerCase()
        return val.includes('❌') || val.includes('sim') || val.includes('true') || val === 'x'
    }

    const isDuvida = (row: CampaignTerm) => {
        const val = (row.observation || '').trim()
        const duvColumn = (row.duvida || '').trim()
        return (duvColumn !== '' || val !== '') && !isNegativar(row)
    }

    const isSegmentarAtiva = (val: string) => val.includes('✅')
    const isSegmentarAlerta = (val: string) => val.includes('⚠️') || val.includes('❓')

    const isSegmentado = (row: CampaignTerm) => {
        const val = (row.segment || '').trim()
        return isSegmentarAtiva(val) || isSegmentarAlerta(val)
    }

    const isTesteAB = (row: CampaignTerm) => {
        const val = (row.ab_test || '').toLowerCase()
        return val === 'true' || val === 'sim' || val.includes('✅') || val.includes('⚠️')
    }

    const filteredData = useMemo(() => {
        let base = visibleData;
        if (isLabMode) base = base.filter(r => (r.ab_test || '').includes('⚠️') || (r.status_granularity || '').includes('⚠️'))
        if (searchTerm) base = base.filter(r => r.search_term.toLowerCase().includes(searchTerm.toLowerCase()))

        switch (activeTab) {
            case 'negative': return base.filter(isNegativar)
            case 'doubts': return base.filter(isDuvida)
            case 'segmented': return base.filter(isSegmentado)
            case 'ab_test': return base.filter(isTesteAB)
            default: return base
        }
    }, [visibleData, activeTab, searchTerm, isLabMode])

    const counts = useMemo(() => ({
        negative: visibleData.filter(isNegativar).length,
        doubts: visibleData.filter(isDuvida).length,
        segmented: visibleData.filter(isSegmentado).length,
        ab_test: visibleData.filter(isTesteAB).length
    }), [visibleData])

    const toggleSelectRow = (id: string) => {
        const next = new Set(selectedRows)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedRows(next)
    }

    const handleBulkAction = (action: 'approve' | 'reject') => {
        const count = selectedRows.size
        if (count === 0) return
        toast.promise(new Promise(resolve => setTimeout(resolve, 800)), {
            loading: action === 'approve' ? 'Aprovando itens...' : 'Rejeitando itens...',
            success: () => {
                setHiddenRows(prev => {
                    const next = new Set(prev)
                    selectedRows.forEach(id => next.add(id))
                    return next
                })
                setSelectedRows(new Set())
                return `${count} itens processados.`
            },
            error: 'Erro no processamento.'
        })
    }

    const segmentedGroups = useMemo(() => {
        const groups: Record<string, CampaignTerm[]> = {}
        filteredData.filter(isSegmentado).forEach(item => {
            const groupName = item.suggestion_group || 'Sem Grupo Sugerido'
            if (!groups[groupName]) groups[groupName] = []
            groups[groupName].push(item)
        })
        return groups
    }, [filteredData])

    const toggleGroup = (group: string) => {
        const next = new Set(expandedGroups)
        if (next.has(group)) next.delete(group)
        else next.add(group)
        setExpandedGroups(next)
    }

    const renderEmpty = (message: string) => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-muted-foreground rounded-[24px] border border-dashed border-border bg-muted/20">
            <PackageOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-base">{message}</p>
        </motion.div>
    )

    const renderRow = (item: CampaignTerm, isSelected: boolean) => {
        const isNeg = isNegativar(item)
        const isDuv = isDuvida(item)
        const statusVal = (item.status_granularity || '').trim() || 'Pendente'
        
        let statusGlow = "bg-muted text-muted-foreground"
        if (statusVal.includes('OK') || isSegmentarAtiva(item.segment)) statusGlow = "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm"
        if (isDuv || isSegmentarAlerta(item.segment)) statusGlow = "bg-amber-500/10 text-amber-500 border border-amber-500/20"
        if (isNeg) statusGlow = "bg-red-500/10 text-red-500 border border-red-500/20"

        return (
            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key={item.id}
                className={cn(
                    "group relative flex items-center gap-4 py-4 px-4 transition-all border-b border-border hover:bg-muted/50 table-row-item",
                    isSelected && "bg-muted/60"
                )}
            >
                <div className="flex items-center">
                    <Checkbox checked={isSelected} onChange={() => toggleSelectRow(item.id)} className="border-border" />
                </div>

                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div className="col-span-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold truncate text-foreground">{item.search_term}</h3>
                            <HoverCard content={item.observation || "IA: Nenhuma observação adicional."}>
                                <div className="cursor-help">
                                    {isNeg && <Ban className="w-3.5 h-3.5 text-red-500" />}
                                    {isDuv && <HelpCircle className="w-3.5 h-3.5 text-amber-500" />}
                                    {!isNeg && !isDuv && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                </div>
                            </HoverCard>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.campaign_name}</p>
                    </div>
                    <div className="hidden md:block col-span-1 text-muted-foreground text-xs leading-none">{item.ad_group || '—'}</div>
                    <div className="col-span-1 md:text-center">
                        <span className="text-sm font-semibold text-foreground">R$ {item.cost.toFixed(2).replace('.', ',')}</span>
                        <p className="text-[10px] text-muted-foreground">{item.clicks} cli</p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full", statusGlow)}>
                            {statusVal}
                        </span>
                    </div>
                </div>
            </motion.div>
        )
    }

    if (isEmpty && !isLoading) {
        return (
            <div className="rounded-[24px] border border-border bg-card p-20 text-center shadow-sm">
                <PackageOpen size={48} className="mx-auto text-muted-foreground opacity-20 mb-4" />
                <Title level={4}>Sem dados no Funil</Title>
                <Text className="text-muted-foreground">Conecte uma planilha para iniciar a triagem tripartite.</Text>
            </div>
        )
    }

    if (isLoading) return <div className="py-20 flex justify-center"><Loader /></div>

    return (
        <div className="relative w-full">
            <div className="mb-20">
                <WasteAudit data={data} onNegativar={(id) => setHiddenRows(prev => new Set(prev).add(id))} />
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                    <div className="xl:col-span-8"><CriticalCostBarChart data={data} /></div>
                    <div className="xl:col-span-4"><IntentDistributionChart data={data} /></div>
                </div>
            </div>

            <AnimatePresence>
                {selectedRows.size > 0 && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-6 px-6 py-4 bg-primary text-primary-foreground rounded-2xl shadow-2xl border border-border">
                        <div className="flex items-center gap-2 pr-4 border-r border-primary-foreground/20">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-foreground/10 text-xs font-bold">{selectedRows.size}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => handleBulkAction('approve')} className="px-4 py-2 bg-primary-foreground text-primary rounded-xl text-sm font-bold">Aprovar</button>
                            <button onClick={() => handleBulkAction('reject')} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold">Negativar</button>
                            <button onClick={() => setSelectedRows(new Set())} className="p-2 text-primary-foreground/50 hover:text-primary-foreground"><Trash2 size={20} /></button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="w-full rounded-[24px] transition-all duration-500 ease-in-out border border-border bg-card shadow-xl overflow-hidden backdrop-blur-md">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="p-6 pb-0">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                            <div className="flex items-center gap-3">
                                <Title level={4} className="!m-0 !text-foreground">Triagem Tripartite</Title>
                                <ChartExplicationTooltip content="Visão detalhada de todos os termos triados." />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="relative">
                                    <input type="text" placeholder="Pesquisar termo..." className="w-full bg-muted border border-border rounded-xl py-2 px-4 text-sm focus:outline-none text-foreground" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                            <TabsList className="bg-muted p-1 rounded-xl h-auto w-full max-w-sm">
                                <TabsTrigger value="all" className="rounded-lg text-xs py-1.5 flex-1">Todos</TabsTrigger>
                                <TabsTrigger value="negative" className="rounded-lg text-xs py-1.5 flex-1 flex gap-2">🚫 {counts.negative}</TabsTrigger>
                                <TabsTrigger value="doubts" className="rounded-lg text-xs py-1.5 flex-1 flex gap-2 text-amber-500">❓ {counts.doubts}</TabsTrigger>
                                <TabsTrigger value="segmented" className="rounded-lg text-xs py-1.5 flex-1 flex gap-2 text-emerald-500">🎯 {counts.segmented}</TabsTrigger>
                                <TabsTrigger value="ab_test" className="rounded-lg text-xs py-1.5 flex-1 flex gap-2 text-blue-500">🔬 {counts.ab_test}</TabsTrigger>
                            </TabsList>
                        </div>
                    </div>

                    <div className="min-h-[400px] overflow-x-hidden" ref={tableRef}>
                        <TabsContent value="segmented" className="m-0 outline-none">
                            {Object.entries(segmentedGroups).length > 0 ? Object.entries(segmentedGroups).map(([group, terms]) => (
                                <div key={group} className="border-b last:border-0 border-border">
                                    <button onClick={() => toggleGroup(group)} className="w-full flex items-center justify-between p-4 hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            {expandedGroups.has(group) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            <span className="text-xs font-black uppercase text-muted-foreground">{group}</span>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">{terms.length}</span>
                                        </div>
                                    </button>
                                    <AnimatePresence>{expandedGroups.has(group) && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-muted/10">
                                            {terms.map((item) => renderRow(item, selectedRows.has(item.id)))}
                                        </motion.div>
                                    )}</AnimatePresence>
                                </div>
                            )) : renderEmpty("Nenhuma segmentação encontrada.")}
                        </TabsContent>
                        {['all', 'negative', 'doubts', 'ab_test'].map(tab => (
                            <TabsContent key={tab} value={tab} className="m-0 outline-none">
                                {filteredData.length > 0 ? (
                                    filteredData.map((item) => renderRow(item, selectedRows.has(item.id)))
                                ) : renderEmpty("Nenhum dado encontrado.")}
                            </TabsContent>
                        ))}
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
