"use client";
import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard, Users, FileText, Bell, ChevronLeft, ChevronRight, Sun, Moon, Briefcase, Menu, X, Zap, Lock, FlaskConical, Wand2
} from 'lucide-react';
import { ProfileDropdown } from './profile-dropdown';
import { Switch } from './switch-button';
import { GlowingEffect } from './glowing-effect';
import { message } from 'antd';
import { useAuth } from '../../contexts/AuthContext';

interface NavigationItem {
    id: string;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    isClickable?: boolean;
}

interface SidebarProps {
    className?: string;
    currentUser: import('../../types').AuthorizedUser | null;
    currentView: 'dashboard' | 'users' | 'companies' | 'ferramenta' | 'semantic-audit' | 'laboratorio-ab' | 'keyword-planner';
    onViewChange: (view: 'dashboard' | 'users' | 'companies' | 'ferramenta' | 'semantic-audit' | 'laboratorio-ab' | 'keyword-planner') => void;
    onLogout: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
}

export function ModernSidebar({ className = "", currentUser, currentView, onViewChange, onLogout, isDarkMode, onToggleTheme }: SidebarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { user } = useAuth(); // Fallback para dados do Supabase Auth

    const isAdmin = currentUser?.isAdmin;

    // Custom Navigation list matching the Ant Design one roughly
    const navigationItems: NavigationItem[] = [
        { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, isClickable: true },
        { id: "companies", name: "Empresas", icon: Briefcase, isClickable: true },
        { id: "semantic-audit", name: "Auditoria Semântica", icon: FileText, isClickable: true },
        { id: "keyword-planner", name: "Planejador", icon: Wand2, isClickable: true },
        { id: "ferramenta", name: "Ferramenta", icon: Zap, isClickable: true },
        { id: "laboratorio-ab", name: "Laboratório A/B", icon: FlaskConical, isClickable: true },
        { id: "relatorios", name: "Relatórios", icon: FileText, isClickable: false },
        { id: "anuncios", name: "Anúncios", icon: Bell, isClickable: false },
        { id: "users", name: isAdmin ? "Gerenciar Acessos" : "Meu Perfil", icon: Users, isClickable: true },
    ];

    // Auto-open sidebar on desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsOpen(true);
            } else {
                setIsOpen(false);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => setIsOpen(!isOpen);
    const toggleCollapse = () => setIsCollapsed(!isCollapsed);

    const handleItemClick = (item: NavigationItem) => {
        if (!item.isClickable) return;

        const isLockedView = (item.id === 'ferramenta' || item.id === 'semantic-audit' || item.id === 'keyword-planner') && currentUser?.role !== 'admin';

        if (isLockedView) {
            message.warning('Acesso restrito ao administrador.');
            return;
        }

        if (item.id === 'dashboard' || item.id === 'users' || item.id === 'companies' || item.id === 'ferramenta' || item.id === 'semantic-audit' || item.id === 'laboratorio-ab' || item.id === 'keyword-planner') {
            onViewChange(item.id as any);
        }

        if (window.innerWidth < 768) {
            setIsOpen(false);
        }
    };

    // Dados do perfil com fallback para o user do Supabase Auth
    const storedUsers = (() => {
        try {
            return JSON.parse(localStorage.getItem('googlar_authorized_users') || '[]');
        } catch {
            return [];
        }
    })();
    const matchingUser = storedUsers.find((u: any) => u.email.toLowerCase() === currentUser?.email?.toLowerCase());

    // Usa profile do Supabase ou dados brutos do Auth como fallback
    const fallbackEmail = currentUser?.email || user?.email || 'usuario@googlar.com';
    const fallbackName = matchingUser?.name || currentUser?.name || fallbackEmail.split('@')[0] || 'Usuário';

    const currentUserDetails = {
        name: fallbackName,
        email: fallbackEmail,
        avatarUrl: matchingUser?.avatarUrl || "/owl-fallback.png",
        subscription: isAdmin ? "PRO" : "TEAM"
    };

    // Dados para o ProfileDropdown — sempre existe se o usuário estiver autenticado
    const profileData = currentUser ?? {
        name: fallbackName,
        email: fallbackEmail,
        role: 'standard' as const,
        isAdmin: false,
        addedAt: '',
    };
    return (
        <>
            {/* Mobile hamburger button */}
            <button
                onClick={toggleSidebar}
                className="fixed top-6 left-6 z-50 p-3 rounded-lg bg-card shadow-md border border-border md:hidden hover:bg-accent transition-all duration-200"
                aria-label="Toggle sidebar"
            >
                {isOpen ?
                    <X className="h-5 w-5 text-muted-foreground" /> :
                    <Menu className="h-5 w-5 text-muted-foreground" />
                }
            </button>

            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
          fixed top-0 left-0 h-full z-40 transition-all duration-500 ease-in-out flex flex-col 
          bg-background border-r border-white/10
          ${isDarkMode ? 'shadow-2xl' : 'shadow-[4px_0_24px_rgba(0,0,0,0.02)]'}
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "w-20" : "w-64"}
          md:translate-x-0 md:static md:z-auto
          ${className}
        `}
            >
                {/* Header with logo and collapse button */}
                <div className="flex items-center justify-between p-6 bg-transparent">
                    {!isCollapsed && (
                        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onViewChange('dashboard')}>
                            <img src="/logo.png?v=2" alt="Googlar" className="w-20 h-20 object-contain drop-shadow-sm" />
                            <div className="flex flex-col">
                                <span translate="no" className="font-extrabold tracking-tight text-3xl text-foreground">Googlar</span>
                            </div>
                        </div>
                    )}

                    {isCollapsed && (
                        <div
                            className="flex items-center justify-center mx-auto cursor-pointer"
                            onClick={() => onViewChange('dashboard')}
                        >
                            <img src="/logo.png?v=2" alt="Googlar" className="w-20 h-20 object-contain drop-shadow-sm" />
                        </div>
                    )}

                    {/* Desktop collapse button */}
                    <button
                        onClick={toggleCollapse}
                        className="hidden md:flex p-1.5 rounded-md hover:bg-accent transition-all duration-200"
                        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-6 overflow-y-auto">
                    <ul className="space-y-2">
                        {navigationItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = currentView === item.id;
                            const isBrief = !item.isClickable;
                            const isLocked = (item.id === 'ferramenta' || item.id === 'semantic-audit') && currentUser?.role !== 'admin';

                            return (
                                <li key={item.id} className="relative">
                                    {/* GlowingEffect: subtle on light, colorful on dark */}
                                    {isDarkMode ? (
                                        <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} variant="default" />
                                    ) : (
                                        <GlowingEffect spread={30} glow={false} disabled={isActive} proximity={48} inactiveZone={0.01} borderWidth={1.5} variant="default" />
                                    )}
                                    <button
                                        onClick={() => handleItemClick(item)}
                                        title={isCollapsed ? item.name : undefined}
                                        className={[
                                            'w-full flex items-center space-x-3 px-3 py-3 rounded-2xl text-left transition-all duration-500 group relative z-10 overflow-hidden outline-none',
                                            isActive
                                                ? 'bg-primary text-primary-foreground font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-[1.02] border-none'
                                                : (isLocked || isBrief)
                                                    ? 'text-muted-foreground cursor-not-allowed opacity-40 grayscale blur-[0.2px]'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5 hover:translate-x-0.5 hover:pl-4',
                                            isCollapsed ? 'justify-center px-2' : '',
                                        ].join(' ')}
                                    >
                                        {/* Icon */}
                                        <div className="flex items-center justify-center min-w-[24px] relative">
                                            <Icon className={[
                                                'h-5 w-5 flex-shrink-0 transition-all duration-300 group-hover:scale-110',
                                                isActive
                                                    ? 'text-primary-foreground'
                                                    : 'text-muted-foreground group-hover:text-foreground',
                                            ].join(' ')} />
                                            {isLocked && (
                                                <div className="absolute -top-1 -right-2 transform scale-75 opacity-80">
                                                    <Lock className="h-3 w-3 text-zinc-500" />
                                                </div>
                                            )}
                                        </div>


                                        {/* Label + badge */}
                                        {!isCollapsed && (
                                            <div className="flex items-center justify-between w-full">
                                                <span className={`text-sm ${isActive ? 'font-medium' : 'font-normal'}`}>
                                                    {item.name}
                                                </span>
                                                {item.badge && (
                                                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                                {isBrief && (
                                                    <span className="text-[10px] bg-muted border border-border px-2 py-0.5 rounded-full text-muted-foreground uppercase opacity-50">Breve</span>
                                                )}
                                                {isLocked && (
                                                    <span className="text-[10px] bg-red-900/10 border border-red-900/20 px-2 py-0.5 rounded-full text-red-500/80 font-bold uppercase transition-all group-hover:bg-red-900/20">Locked</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Tooltip for collapsed state */}
                                        {isCollapsed && (
                                            <div className="absolute left-full ml-4 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl border border-border">
                                                {item.name} {isLocked && '(Breve)'}
                                                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-popover rotate-45 border-l border-b border-border" />
                                            </div>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>




                {/* Bottom section with profile and logout */}
                <div className={`mt-auto ${isDarkMode ? 'bg-transparent' : 'bg-transparent'}`}>
                    {/* Theme Toggle Section */}
                    <div className={`border-b border-border ${isCollapsed ? 'py-4 px-2 flex justify-center' : 'px-4 py-4 flex items-center justify-between'}`}
                        title={isCollapsed ? "Alternar Tema" : undefined}>
                        {!isCollapsed && (
                            <div className="flex items-center text-muted-foreground space-x-3 font-medium text-sm">
                                {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                                <span>Tema {isDarkMode ? 'Escuro' : 'Claro'}</span>
                            </div>
                        )}
                        <Switch
                            value={isDarkMode}
                            onToggle={onToggleTheme}
                            iconOn={<Moon className="size-3 text-blue-400" />}
                            iconOff={<Sun className="size-3 text-yellow-500" />}
                        />
                    </div>

                    {/* Profile Section via Kokonut Dropdown */}
                    <div className={`p-3 ${isCollapsed ? '' : ''}`}>
                        {(currentUser || user) && (
                            <ProfileDropdown
                                data={{
                                    ...profileData,
                                    name: currentUserDetails.name,
                                    avatar: currentUserDetails.avatarUrl,
                                    subscription: isAdmin ? "PRO" : "TEAM"
                                }}
                                onLogout={onLogout}
                                isCollapsed={isCollapsed}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
