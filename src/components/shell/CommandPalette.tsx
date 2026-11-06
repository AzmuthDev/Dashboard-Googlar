import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, CornerDownLeft, Lock, Moon, RefreshCw, Search, Sun } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Company } from '../../types';
import { normalizarBusca } from '../../utils/termSearch';
import { getNavSections, isViewLocked, type AppView } from './navigation';

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
    isAdmin: boolean | undefined;
    companies: Company[];
    activeCompanyId: string | null;
    isDarkMode: boolean;
    onNavigate: (view: AppView) => void;
    onSelectCompany: (companyId: string) => void;
    onToggleTheme: () => void;
    onRefresh: () => void;
}

interface Command {
    id: string;
    group: 'Páginas' | 'Empresas' | 'Ações';
    label: string;
    hint?: string;
    icon: React.ReactNode;
    search: string;
    locked?: boolean;
    run: () => void;
}

export function CommandPalette({
    open, onClose, isAdmin, companies, activeCompanyId, isDarkMode, onNavigate, onSelectCompany, onToggleTheme, onRefresh,
}: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const commands = useMemo<Command[]>(() => {
        const pages: Command[] = getNavSections(isAdmin).flatMap(section => section.items.map(item => {
            const Icon = item.icon;
            return {
                id: `page:${item.id}`,
                group: 'Páginas' as const,
                label: item.name,
                hint: section.label,
                icon: <Icon className="h-4 w-4" />,
                search: `${item.name} ${item.keywords ?? ''}`,
                locked: isViewLocked(item.id, isAdmin),
                run: () => onNavigate(item.id),
            };
        }));
        const empresas: Command[] = [...companies]
            .filter(c => c?.id && c?.name)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => ({
                id: `company:${c.id}`,
                group: 'Empresas' as const,
                label: c.name,
                hint: c.id === activeCompanyId ? 'Ativa' : 'Trocar para esta empresa',
                icon: <Building2 className="h-4 w-4" />,
                search: `${c.name} empresa cliente`,
                run: () => onSelectCompany(c.id),
            }));
        const acoes: Command[] = [
            {
                id: 'action:theme',
                group: 'Ações',
                label: isDarkMode ? 'Usar tema claro' : 'Usar tema escuro',
                icon: isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
                search: 'tema claro escuro dark light aparencia',
                run: onToggleTheme,
            },
            {
                id: 'action:refresh',
                group: 'Ações',
                label: 'Sincronizar dados da empresa',
                icon: <RefreshCw className="h-4 w-4" />,
                search: 'sincronizar atualizar recarregar dados',
                run: onRefresh,
            },
        ];
        return [...pages, ...empresas, ...acoes];
    }, [isAdmin, companies, activeCompanyId, isDarkMode, onNavigate, onSelectCompany, onToggleTheme, onRefresh]);

    const results = useMemo(() => {
        const palavras = normalizarBusca(query).split(/\s+/).filter(Boolean);
        if (!palavras.length) return commands;
        return commands.filter(c => {
            const alvo = normalizarBusca(c.search);
            return palavras.every(p => alvo.includes(p));
        });
    }, [commands, query]);

    useEffect(() => {
        if (open) {
            setQuery('');
            setIndex(0);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    useEffect(() => setIndex(0), [query]);

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [index]);

    const execute = (cmd: Command | undefined) => {
        if (!cmd) return;
        onClose();
        cmd.run();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex(i => (results.length ? (i + 1) % results.length : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex(i => (results.length ? (i - 1 + results.length) % results.length : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            execute(results[index]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    let lastGroup = '';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[1100] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Busca rápida"
                        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                        onKeyDown={onKeyDown}
                    >
                        <div className="flex items-center gap-3 border-b border-border px-4">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Ir para página, trocar de empresa ou executar ação"
                                className="h-12 w-full !border-0 !bg-transparent text-sm !text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none"
                                aria-label="Buscar comando"
                            />
                            <span className="kbd">Esc</span>
                        </div>

                        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
                            {results.length === 0 && (
                                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nada encontrado para "{query}".</p>
                            )}
                            {results.map((cmd, i) => {
                                const header = cmd.group !== lastGroup ? cmd.group : null;
                                lastGroup = cmd.group;
                                const selected = i === index;
                                return (
                                    <div key={cmd.id}>
                                        {header && <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground first:pt-1">{header}</p>}
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={selected}
                                            data-index={i}
                                            onMouseMove={() => setIndex(i)}
                                            onClick={() => execute(cmd)}
                                            className={cn(
                                                'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors',
                                                selected ? 'bg-surface-2 text-foreground' : 'text-muted-foreground',
                                            )}
                                        >
                                            <span className={cn('flex h-7 w-7 items-center justify-center rounded-md border border-border', selected && 'border-brand-strong/40 text-brand-strong')}>{cmd.icon}</span>
                                            <span className="flex-1 truncate">{cmd.label}</span>
                                            {cmd.locked && <Lock className="h-3.5 w-3.5" aria-label="Restrito ao administrador" />}
                                            {cmd.hint && <span className="hidden text-xs text-muted-foreground sm:inline">{cmd.hint}</span>}
                                            {selected && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="kbd">↑</span><span className="kbd">↓</span> navegar</span>
                            <span className="flex items-center gap-1.5"><span className="kbd">Enter</span> abrir</span>
                            <span className="ml-auto flex items-center gap-1.5"><span className="kbd">Ctrl K</span> abre de qualquer tela</span>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
