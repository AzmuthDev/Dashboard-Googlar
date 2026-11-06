import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, Lock, LogOut, Moon, Search, Sun, X } from 'lucide-react';
import { message } from 'antd';
import { cn } from '../../lib/utils';
import type { AuthorizedUser } from '../../types';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { getNavSections, isViewLocked, type AppView, type NavItem } from './navigation';

const COLLAPSE_KEY = 'googlar_sidebar_collapsed';

interface AppSidebarProps {
    currentView: AppView;
    onViewChange: (view: AppView) => void;
    currentUser: AuthorizedUser | null;
    fallbackEmail?: string;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    onLogout: () => void;
    onOpenCommand: () => void;
    duvidasPendentes: number;
    mobileOpen: boolean;
    onMobileClose: () => void;
}

function readCollapsed(): boolean {
    try {
        return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
        return false;
    }
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'G';
}

export function AppSidebar({
    currentView, onViewChange, currentUser, fallbackEmail, isDarkMode, onToggleTheme, onLogout,
    onOpenCommand, duvidasPendentes, mobileOpen, onMobileClose,
}: AppSidebarProps) {
    const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
    const isAdmin = currentUser?.isAdmin;
    const sections = getNavSections(isAdmin);

    useEffect(() => {
        try {
            localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
        } catch {
            /* navegador sem storage: só não lembra a preferência */
        }
    }, [collapsed]);

    // No celular o menu é uma gaveta: nunca aparece recolhido.
    const isCollapsed = collapsed && !mobileOpen;

    const handleSelect = (item: NavItem) => {
        if (isViewLocked(item.id, isAdmin)) {
            message.warning('Acesso restrito ao administrador.');
            return;
        }
        onViewChange(item.id);
        onMobileClose();
    };

    const name = currentUser?.name || fallbackEmail?.split('@')[0] || 'Usuário';
    const email = currentUser?.email || fallbackEmail || '';

    return (
        <>
            {mobileOpen && (
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={onMobileClose} aria-hidden="true" />
            )}

            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex h-[100dvh] flex-col border-r border-border bg-sidebar-bg transition-[width,transform] duration-300 ease-out',
                    'md:static md:z-auto md:translate-x-0',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    isCollapsed ? 'w-[72px]' : 'w-[276px] max-w-[85vw]',
                )}
                aria-label="Menu principal"
            >
                {/* Marca */}
                <div className={cn('flex h-16 shrink-0 items-center gap-2 px-4', isCollapsed && 'justify-center px-0')}>
                    <button type="button" onClick={() => { onViewChange('dashboard'); onMobileClose(); }} className="flex min-w-0 items-center rounded-lg" aria-label="Ir para o Dashboard">
                        {isCollapsed ? (
                            <img src="/googlar-icone.svg" alt="Googlar" className="h-9 w-9" />
                        ) : (
                            <img src={isDarkMode ? '/googlar-horizontal-escuro.svg' : '/googlar-horizontal-claro.svg'} alt="Googlar" className="h-8 w-auto" />
                        )}
                    </button>
                    {!isCollapsed && (
                        <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pocket</span>
                    )}
                    <button type="button" onClick={onMobileClose} className="ml-1 rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground md:hidden" aria-label="Fechar menu">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Busca rápida */}
                <div className={cn('px-3 pb-2', isCollapsed && 'px-2')}>
                    <button
                        type="button"
                        onClick={onOpenCommand}
                        title={isCollapsed ? 'Buscar (Ctrl+K)' : undefined}
                        className={cn(
                            'flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground',
                            isCollapsed && 'justify-center px-0',
                        )}
                    >
                        <Search className="h-4 w-4 shrink-0" />
                        {!isCollapsed && (
                            <>
                                <span className="flex-1 text-left">Buscar</span>
                                <span className="kbd">Ctrl K</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Navegação */}
                <nav className="flex-1 overflow-y-auto px-3 pb-4">
                    {sections.map(section => (
                        <div key={section.label} className="mt-4 first:mt-2">
                            {isCollapsed ? (
                                <div className="mx-auto mb-2 h-px w-6 bg-border" />
                            ) : (
                                <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">{section.label}</p>
                            )}
                            <ul className="space-y-0.5">
                                {section.items.map(item => {
                                    const Icon = item.icon;
                                    const active = currentView === item.id || (item.id === 'upperscript' && currentView === 'ferramenta');
                                    const locked = isViewLocked(item.id, isAdmin);
                                    const badge = item.id === 'semantic-audit' && duvidasPendentes > 0 ? duvidasPendentes : null;
                                    return (
                                        <li key={item.id} className="relative">
                                            {active && (
                                                <motion.span
                                                    layoutId="pk-nav-active"
                                                    className="absolute inset-0 rounded-lg bg-surface-2 ring-1 ring-border"
                                                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                                />
                                            )}
                                            {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brand" />}
                                            <button
                                                type="button"
                                                onClick={() => handleSelect(item)}
                                                aria-current={active ? 'page' : undefined}
                                                title={isCollapsed ? item.name + (locked ? ' (restrito)' : '') : undefined}
                                                className={cn(
                                                    'group relative flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[13px] transition-colors',
                                                    active ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-surface-2/60 hover:text-foreground',
                                                    locked && 'opacity-55',
                                                    isCollapsed && 'justify-center px-0',
                                                )}
                                            >
                                                <span className="relative flex shrink-0 items-center">
                                                    <Icon className={cn('h-[18px] w-[18px]', active && 'text-brand-strong')} />
                                                    {isCollapsed && badge && <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-status-duv" />}
                                                </span>
                                                {!isCollapsed && (
                                                    <>
                                                        <span className="flex-1 truncate text-left">{item.name}</span>
                                                        {locked && <Lock className="h-3.5 w-3.5" aria-label="Restrito ao administrador" />}
                                                        {badge && (
                                                            <span className="min-w-[22px] rounded-full bg-status-duv-soft px-1.5 py-px text-center text-[11px] font-semibold tabular-nums text-status-duv" title="Dúvidas pendentes">
                                                                {badge}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Rodapé: tema, recolher e usuário */}
                <div className="space-y-2 border-t border-border p-3">
                    <div className={cn('flex items-center gap-2', isCollapsed && 'flex-col')}>
                        <div role="radiogroup" aria-label="Tema" className={cn('relative grid flex-1 grid-cols-2 rounded-lg border border-border bg-card p-0.5', isCollapsed && 'w-full grid-cols-1')}>
                            {([
                                { value: false, label: 'Claro', Icon: Sun },
                                { value: true, label: 'Escuro', Icon: Moon },
                            ] as const).filter(o => !isCollapsed || o.value !== isDarkMode).map(o => {
                                const checked = o.value === isDarkMode;
                                return (
                                    <button
                                        key={o.label}
                                        type="button"
                                        role="radio"
                                        aria-checked={checked}
                                        title={isCollapsed ? `Mudar para tema ${o.label.toLowerCase()}` : undefined}
                                        onClick={() => { if (!checked || isCollapsed) onToggleTheme(); }}
                                        className={cn(
                                            'relative flex h-7 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors',
                                            checked && !isCollapsed ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {checked && !isCollapsed && (
                                            <motion.span layoutId="pk-theme-pill" className="absolute inset-0 rounded-md bg-surface-2 ring-1 ring-border" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                                        )}
                                        <o.Icon className={cn('relative h-3.5 w-3.5', checked && !isCollapsed && (o.value ? 'text-brand-strong' : 'text-status-duv'))} />
                                        {!isCollapsed && <span className="relative">{o.label}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => setCollapsed(c => !c)}
                            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground md:flex"
                            aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                        >
                            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                        </button>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className={cn('flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-surface-2', isCollapsed && 'justify-center')}
                                aria-label="Menu do usuário"
                            >
                                <span className="relative shrink-0">
                                    {currentUser?.avatarUrl ? (
                                        <img src={currentUser.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-border" />
                                    ) : (
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong ring-1 ring-border">{initials(name)}</span>
                                    )}
                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar-bg bg-brand" />
                                </span>
                                {!isCollapsed && (
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-foreground">{name}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{isAdmin ? 'Administrador' : email}</span>
                                    </span>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-60 rounded-xl p-1.5">
                            <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
                                <span className="text-sm font-medium">{name}</span>
                                <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => onViewChange('users')} className="cursor-pointer rounded-md">
                                {isAdmin ? 'Gerenciar acessos' : 'Meu perfil'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={onLogout} className="cursor-pointer gap-2 rounded-md text-status-neg focus:text-status-neg">
                                <LogOut className="h-4 w-4" /> Sair
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </aside>
        </>
    );
}
