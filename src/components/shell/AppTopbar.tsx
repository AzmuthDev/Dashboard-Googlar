import { Select, Tooltip } from 'antd';
import { ChevronRight, Menu, RefreshCw, Search, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Company } from '../../types';
import { VIEW_TITLES, type AppView } from './navigation';

interface AppTopbarProps {
    currentView: AppView;
    companies: Company[];
    activeCompanyId: string | null;
    onSelectCompany: (companyId: string) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    onOpenMenu: () => void;
    onOpenCommand: () => void;
}

/**
 * Barra superior em uma linha só (altura fixa, nunca quebra):
 * caminho Empresa / Página, seletor de empresa e sincronizar.
 */
export function AppTopbar({
    currentView, companies, activeCompanyId, onSelectCompany, onRefresh, isRefreshing, onOpenMenu, onOpenCommand,
}: AppTopbarProps) {
    const activeCompany = companies.find(c => c.id === activeCompanyId);
    const isUpperScript = currentView === 'upperscript' || currentView === 'ferramenta';
    const sorted = [...companies].filter(c => c?.id && c?.name).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md md:gap-3 md:px-6">
            <button
                type="button"
                onClick={onOpenMenu}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground md:hidden"
                aria-label="Abrir menu"
            >
                <Menu className="h-4 w-4" />
            </button>

            <nav aria-label="Você está em" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
                <span className="hidden max-w-[180px] truncate text-muted-foreground sm:inline">{activeCompany?.name ?? 'Nenhuma empresa'}</span>
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 sm:block" />
                <span className="truncate font-medium text-foreground">{VIEW_TITLES[currentView]}</span>
            </nav>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {isUpperScript && (
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('upperscript_trigger_upload'))}
                        className="btn-brand h-9 shrink-0 px-3 text-xs"
                        title="Fazer upload de planilha (.xlsx, .xls, .csv)"
                    >
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Upload planilha</span>
                    </button>
                )}

                {!isUpperScript && (
                    <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-border bg-card pl-2.5 transition-colors hover:border-input sm:flex-none">
                        <span
                            className={cn('h-2 w-2 shrink-0 rounded-full', activeCompany ? 'bg-brand shadow-[0_0_0_3px_var(--brand-soft)]' : 'bg-muted-foreground/50')}
                            aria-hidden="true"
                        />
                        <Select
                            showSearch
                            variant="borderless"
                            placeholder="Selecionar empresa"
                            value={activeCompanyId || undefined}
                            onChange={onSelectCompany}
                            optionFilterProp="label"
                            popupMatchSelectWidth={260}
                            className="min-w-0 flex-1 sm:w-[200px] sm:flex-none [&_.ant-select-selection-item]:!font-medium"
                            notFoundContent={<span className="block p-2 text-xs text-muted-foreground">Nenhuma empresa cadastrada.</span>}
                            options={sorted.map(c => ({ value: c.id, label: c.name }))}
                            aria-label="Empresa ativa"
                        />
                        <Tooltip title="Sincronizar dados">
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={!activeCompanyId || isRefreshing}
                                className="flex h-full w-9 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                                aria-label="Sincronizar dados"
                            >
                                <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                            </button>
                        </Tooltip>
                    </div>
                )}

                <button
                    type="button"
                    onClick={onOpenCommand}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground md:hidden"
                    aria-label="Buscar"
                >
                    <Search className="h-4 w-4" />
                </button>
            </div>
        </header>
    );
}
