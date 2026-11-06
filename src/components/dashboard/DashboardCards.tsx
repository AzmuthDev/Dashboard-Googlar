import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CampaignTerm } from '../../types';
import { paraNumero, type ContagemStatus, type CustoCampanha } from '../../utils/dashboardMetrics';
import { AnimatedNumber } from './AnimatedNumber';
import { formatBRL, formatDec, formatInt } from './format';

/* ─────────────────────────── Cabeçalho de card ─────────────────────────── */
function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
    return (
        <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

/* ─────────────────────────────── KPI ─────────────────────────────── */
interface KpiCardProps {
    label: string;
    value: number;
    format: (n: number) => string;
    icon: LucideIcon;
    hint?: React.ReactNode;
    progress?: number;
    tone?: 'brand' | 'neutral';
    delay?: number;
}

export function KpiCard({ label, value, format, icon: Icon, hint, progress, tone = 'neutral', delay = 0 }: KpiCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
            className="pk-card group relative overflow-hidden p-5 transition-colors hover:border-input"
        >
            {tone === 'brand' && (
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent opacity-70" />
            )}
            <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
                <span className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg border border-border',
                    tone === 'brand' ? 'bg-brand-soft text-brand-strong' : 'bg-surface-2 text-muted-foreground',
                )}>
                    <Icon className="h-4 w-4" />
                </span>
            </div>
            <p className="mt-3 font-display text-[26px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                <AnimatedNumber value={value} format={format} />
            </p>
            {typeof progress === 'number' && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                        className="h-full rounded-full bg-brand"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                        transition={{ duration: 0.9, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
                    />
                </div>
            )}
            {hint && <p className={cn('text-xs text-muted-foreground', typeof progress === 'number' ? 'mt-2.5' : 'mt-3')}>{hint}</p>}
        </motion.div>
    );
}

/* ──────────────────── Maior custo sem conversão ──────────────────── */
export function WasteListCard({ terms, onReview }: { terms: CampaignTerm[]; onReview: (t: CampaignTerm) => void }) {
    const max = Math.max(1, ...terms.map(t => paraNumero(t.custo)));
    return (
        <section className="pk-card flex h-full flex-col p-5">
            <CardHeader title="Maior custo sem conversão" subtitle="Termos que gastaram e não converteram. Revise na Triagem antes de negativar." />
            {terms.length === 0 ? (
                <p className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">Nenhum termo com custo e sem conversão.</p>
            ) : (
                <ol className="space-y-1">
                    {terms.map((t, i) => {
                        const custo = paraNumero(t.custo);
                        return (
                            <li key={t.id ?? i} className="group grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
                                <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                                <div className="min-w-0">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <p className="truncate text-sm font-medium text-foreground" title={t.termo_de_pesquisa}>{t.termo_de_pesquisa || '—'}</p>
                                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatBRL(custo)}</span>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                                            <motion.div
                                                className="h-full rounded-full bg-status-neg"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(custo / max) * 100}%` }}
                                                transition={{ duration: 0.7, delay: i * 0.05 }}
                                            />
                                        </div>
                                        <span className="hidden max-w-[45%] truncate text-[11px] text-muted-foreground sm:inline" title={t.campanha}>{t.campanha}</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onReview(t)}
                                    className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-all hover:border-input hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                                    aria-label={`Revisar "${t.termo_de_pesquisa}" na Triagem`}
                                >
                                    Revisar <ArrowUpRight className="h-3.5 w-3.5" />
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

/* ─────────────────────────── Fila de triagem ─────────────────────────── */
const SEGMENTS: { key: keyof ContagemStatus; label: string; bar: string; dot: string }[] = [
    { key: 'aprovadas', label: 'Aprovadas', bar: 'bg-status-seg', dot: 'bg-status-seg' },
    { key: 'negativas', label: 'Negativas', bar: 'bg-status-neg', dot: 'bg-status-neg' },
    { key: 'duvidas', label: 'Dúvidas', bar: 'bg-status-duv', dot: 'bg-status-duv' },
    { key: 'ab_test', label: 'Teste A/B', bar: 'bg-status-ab', dot: 'bg-status-ab' },
    { key: 'respostas', label: 'Respostas do cliente', bar: 'bg-status-resp', dot: 'bg-status-resp' },
    { key: 'semCategoria', label: 'Sem categoria', bar: 'bg-muted-foreground/40', dot: 'bg-muted-foreground/50' },
];

export function TriageQueueCard({ counts, onOpen }: { counts: ContagemStatus; onOpen: (tab: 'duvidas' | 'all') => void }) {
    const total = Math.max(1, SEGMENTS.reduce((acc, s) => acc + (counts[s.key] as number), 0));
    return (
        <section className="pk-card flex h-full flex-col p-5">
            <CardHeader title="Fila de triagem" subtitle="Mesma contagem das abas da Triagem." />
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-2">
                {SEGMENTS.map((s, i) => {
                    const v = counts[s.key] as number;
                    if (!v) return null;
                    return (
                        <motion.div
                            key={s.key}
                            className={cn('h-full first:rounded-l-full last:rounded-r-full', s.bar)}
                            initial={{ width: 0 }}
                            animate={{ width: `${(v / total) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                            title={`${s.label}: ${v}`}
                        />
                    );
                })}
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                {SEGMENTS.map(s => {
                    const v = counts[s.key] as number;
                    return (
                        <li key={s.key} className="flex items-center gap-2 text-sm">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', s.dot)} />
                            <span className="truncate text-muted-foreground">{s.label}</span>
                            <span className="ml-auto font-medium tabular-nums text-foreground">{formatInt(v)}</span>
                        </li>
                    );
                })}
            </ul>
            <div className="mt-auto pt-5">
                {counts.duvidas > 0 ? (
                    <button type="button" onClick={() => onOpen('duvidas')} className="btn-bw-inverse flex h-10 w-full items-center justify-center gap-2 text-sm">
                        Revisar {formatInt(counts.duvidas)} {counts.duvidas === 1 ? 'dúvida' : 'dúvidas'} <ArrowRight className="h-4 w-4" />
                    </button>
                ) : (
                    <button type="button" onClick={() => onOpen('all')} className="btn-bw-secondary flex h-10 w-full items-center justify-center gap-2 text-sm">
                        Abrir Triagem <ArrowRight className="h-4 w-4" />
                    </button>
                )}
            </div>
        </section>
    );
}

/* ─────────────────────────── Custo por campanha ─────────────────────────── */
export function CampaignCostCard({ campaigns }: { campaigns: CustoCampanha[] }) {
    const max = Math.max(1, ...campaigns.map(c => c.custo));
    return (
        <section className="pk-card p-5">
            <CardHeader title="Custo por campanha" subtitle="Soma do custo dos termos de pesquisa auditados em cada campanha." />
            {campaigns.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem campanhas na base.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                                <th className="pb-2 font-medium">Campanha</th>
                                <th className="w-[38%] pb-2 font-medium">Custo</th>
                                <th className="pb-2 text-right font-medium">Conv.</th>
                                <th className="pb-2 text-right font-medium">Termos</th>
                                <th className="pb-2 text-right font-medium">Negativados</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map((c, i) => (
                                <tr key={c.campanha} className="border-t border-border">
                                    <td className="max-w-[240px] truncate py-2.5 pr-4 font-medium text-foreground" title={c.campanha}>{c.campanha}</td>
                                    <td className="py-2.5 pr-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                                                <motion.div
                                                    className="h-full rounded-full bg-brand"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(c.custo / max) * 100}%` }}
                                                    transition={{ duration: 0.7, delay: i * 0.04 }}
                                                />
                                            </div>
                                            <span className="w-[86px] shrink-0 text-right tabular-nums text-foreground">{formatBRL(c.custo)}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatDec(c.conversoes)}</td>
                                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatInt(c.termos)}</td>
                                    <td className="py-2.5 text-right">
                                        {c.negativados > 0 ? (
                                            <span className="rounded-full bg-status-neg-soft px-2 py-0.5 text-xs font-medium tabular-nums text-status-neg">{c.negativados}</span>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
