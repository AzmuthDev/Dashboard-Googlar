import { useMemo, useState } from 'react';
import { Upload } from 'antd';
import { toast } from 'sonner';
import { ArrowRight, Building2, CheckCheck, CloudUpload, FileSpreadsheet, ListChecks, PiggyBank, RefreshCw, Target } from 'lucide-react';
import type { CampaignTerm, Company } from '../../types';
import { carregarDados } from '../../utils/dataIngestion';
import { insertCampaignTermsBatch } from '../../lib/supabaseProvider';
import { calcularMetricas, contarStatus, custoPorCampanha, maioresCustosSemConversao } from '../../utils/dashboardMetrics';
import { CampaignCostCard, KpiCard, TriageQueueCard, WasteListCard } from './DashboardCards';
import { formatBRL, formatDec, formatInt, formatPct } from './format';

interface DashboardViewProps {
    company: Company | undefined;
    companyId: string | null;
    terms: CampaignTerm[];
    localData: CampaignTerm[] | null;
    onLocalData: (data: CampaignTerm[] | null) => void;
    isLoading: boolean;
    updatedAt: number;
    onRefetch: () => void;
    onReviewTerm: (term: CampaignTerm) => void;
    onOpenTriagem: (tab: 'duvidas' | 'all') => void;
    onGoCompanies: () => void;
}

const horaFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function DashboardView({
    company, companyId, terms, localData, onLocalData, isLoading, updatedAt, onRefetch, onReviewTerm, onOpenTriagem, onGoCompanies,
}: DashboardViewProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const lista = useMemo(() => (Array.isArray(terms) ? terms : []), [terms]);
    const metricas = useMemo(() => calcularMetricas(lista), [lista]);
    const status = useMemo(() => contarStatus(lista), [lista]);
    const desperdicio = useMemo(() => maioresCustosSemConversao(lista, 6), [lista]);
    const campanhas = useMemo(() => custoPorCampanha(lista, 8), [lista]);

    const enviarParaBase = async () => {
        if (!companyId || !localData) return;
        setIsSyncing(true);
        const id = toast.loading('Enviando a planilha para a base...');
        try {
            const result = await insertCampaignTermsBatch(companyId, localData, company?.tableName);
            if (!result.success) throw new Error(result.error);
            toast.success(`${result.count} termos enviados para a base.`, { id });
            onLocalData(null);
            onRefetch();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Não foi possível enviar a planilha.', { id });
        } finally {
            setIsSyncing(false);
        }
    };

    /* ── Sem empresa ── */
    if (!companyId) {
        return (
            <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title="Escolha uma empresa para ver o painel"
                text="O Dashboard mostra custo, conversões e a fila de triagem da empresa ativa."
                action={<button type="button" onClick={onGoCompanies} className="btn-brand h-10 px-4 text-sm">Ver empresas <ArrowRight className="h-4 w-4" /></button>}
                footnote={<>ou aperte <span className="kbd">Ctrl K</span> e digite o nome da empresa</>}
            />
        );
    }

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-6">
            {/* Cabeçalho da página */}
            <div className="pk-rise flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-strong">Visão geral</p>
                    <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Dashboard</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {company?.name ?? 'Empresa'}
                        {localData
                            ? ' · planilha local, ainda não enviada'
                            : updatedAt ? ` · atualizado às ${horaFmt.format(updatedAt)}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {localData ? (
                        <>
                            <button type="button" onClick={() => onLocalData(null)} className="btn-bw-secondary flex h-10 items-center gap-2 px-4 text-sm">
                                <FileSpreadsheet className="h-4 w-4" /> Descartar planilha
                            </button>
                            <button type="button" onClick={enviarParaBase} disabled={isSyncing} className="btn-brand h-10 px-4 text-sm">
                                <CloudUpload className="h-4 w-4" /> Enviar {formatInt(localData.length)} termos
                            </button>
                        </>
                    ) : (
                        <button type="button" onClick={onRefetch} disabled={isLoading} className="btn-bw-secondary flex h-10 items-center gap-2 px-4 text-sm">
                            <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Atualizar dados
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <DashboardSkeleton />
            ) : lista.length === 0 ? (
                <div className="pk-card pk-rise mx-auto max-w-2xl p-6 sm:p-10 text-center">
                    <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand-strong"><CloudUpload className="h-6 w-6" /></span>
                    <h2 className="font-display text-xl font-semibold text-foreground">Nenhum termo nesta empresa ainda</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Envie o relatório de termos de pesquisa do Google Ads. Ele é lido aqui no navegador e só vai para a base quando você confirmar.</p>
                    <Upload.Dragger
                        multiple={false}
                        showUploadList={false}
                        accept=".csv,.xlsx,.xls"
                        disabled={isUploading}
                        customRequest={async ({ file, onSuccess, onError }) => {
                            setIsUploading(true);
                            try {
                                const d = await carregarDados(file as File, 'local', companyId);
                                onLocalData(d);
                                toast.success(`${d.length} termos lidos da planilha.`);
                                onSuccess?.('ok');
                            } catch (e) {
                                toast.error(e instanceof Error ? e.message : 'Não foi possível ler a planilha.');
                                onError?.(e as Error);
                            } finally {
                                setIsUploading(false);
                            }
                        }}
                        className="mt-6 block [&_.ant-upload-drag]:!rounded-2xl [&_.ant-upload-drag]:!border-dashed [&_.ant-upload-drag]:!bg-surface-2"
                    >
                        <div className="py-4">
                            <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-3 text-sm font-medium text-foreground">{isUploading ? 'Lendo a planilha...' : 'Arraste o CSV ou XLSX aqui, ou clique para escolher'}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Relatório de termos de pesquisa (.csv, .xlsx, .xls)</p>
                        </div>
                    </Upload.Dragger>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <KpiCard
                            label="Economia"
                            value={metricas.economia}
                            format={formatBRL}
                            icon={PiggyBank}
                            tone="brand"
                            hint="Custo dos termos negativados"
                        />
                        <KpiCard
                            label="Termos auditados"
                            value={metricas.totalTermos}
                            format={formatInt}
                            icon={ListChecks}
                            hint={`${formatInt(metricas.campanhas)} ${metricas.campanhas === 1 ? 'campanha' : 'campanhas'} · ${formatBRL(metricas.custoTotal)} em custo`}
                            delay={0.05}
                        />
                        <KpiCard
                            label="Conversões"
                            value={metricas.conversoes}
                            format={formatDec}
                            icon={Target}
                            hint={metricas.conversoes > 0 ? `${formatBRL(metricas.custoTotal / metricas.conversoes)} por conversão` : 'Nenhuma conversão na base'}
                            delay={0.1}
                        />
                        <KpiCard
                            label="Decididos"
                            value={metricas.percentualDecidido}
                            format={formatPct}
                            icon={CheckCheck}
                            progress={metricas.percentualDecidido}
                            hint={[
                                metricas.duvidasPendentes > 0
                                    ? `${formatInt(metricas.duvidasPendentes)} ${metricas.duvidasPendentes === 1 ? 'dúvida para triar' : 'dúvidas para triar'}`
                                    : 'Nenhuma dúvida para triar',
                                metricas.aguardandoCliente > 0 ? `${formatInt(metricas.aguardandoCliente)} com o cliente` : null,
                            ].filter(Boolean).join(' · ')}
                            delay={0.15}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        <div className="lg:col-span-7"><WasteListCard terms={desperdicio} onReview={onReviewTerm} /></div>
                        <div className="lg:col-span-5"><TriageQueueCard counts={status} onOpen={onOpenTriagem} /></div>
                    </div>

                    <CampaignCostCard campaigns={campanhas} />
                </>
            )}
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-4" aria-busy="true" aria-label="Carregando dados">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map(i => <div key={i} className="pk-card h-[132px] animate-pulse" />)}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="pk-card h-[340px] animate-pulse lg:col-span-7" />
                <div className="pk-card h-[340px] animate-pulse lg:col-span-5" />
            </div>
        </div>
    );
}

export function EmptyState({ icon, title, text, action, footnote }: {
    icon: React.ReactNode; title: string; text: string; action?: React.ReactNode; footnote?: React.ReactNode;
}) {
    return (
        <div className="pk-card pk-rise relative mx-auto mt-6 max-w-xl overflow-hidden p-8 text-center sm:p-12">
            <div className="pk-aurora pointer-events-none absolute inset-0" />
            <div className="relative">
                <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-brand-strong">{icon}</span>
                <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{title}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{text}</p>
                {action && <div className="mt-6 flex justify-center">{action}</div>}
                {footnote && <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">{footnote}</p>}
            </div>
        </div>
    );
}
