import {
    LayoutDashboard, Building2, ListChecks, Wand2, ScrollText, Mic, Users, type LucideIcon,
} from 'lucide-react';

export type AppView =
    | 'dashboard'
    | 'users'
    | 'companies'
    | 'ferramenta'
    | 'upperscript'
    | 'semantic-audit'
    | 'laboratorio-ab'
    | 'keyword-planner'
    | 'auditoria-lsa';

export interface NavItem {
    id: AppView;
    name: string;
    icon: LucideIcon;
    /** Palavras extras para a busca rápida (Ctrl+K). */
    keywords?: string;
}

export interface NavSection {
    label: string;
    items: NavItem[];
}

/** Páginas que só o administrador abre. É a mesma regra para o menu e para a busca rápida. */
const ADMIN_ONLY: AppView[] = ['upperscript', 'ferramenta', 'semantic-audit', 'keyword-planner'];

export function isViewLocked(view: AppView, isAdmin: boolean | undefined): boolean {
    return !isAdmin && ADMIN_ONLY.includes(view);
}

export function getNavSections(isAdmin: boolean | undefined): NavSection[] {
    return [
        {
            label: 'Visão geral',
            items: [
                { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, keywords: 'inicio metricas resumo' },
                { id: 'companies', name: 'Empresas', icon: Building2, keywords: 'clientes contas' },
            ],
        },
        {
            label: 'Auditoria',
            items: [
                { id: 'semantic-audit', name: 'Triagem de Especialistas', icon: ListChecks, keywords: 'termos duvidas negativar segmentar' },
                { id: 'keyword-planner', name: 'Planejador', icon: Wand2, keywords: 'palavras chave keyword' },
                { id: 'upperscript', name: 'Upper Script', icon: ScrollText, keywords: 'script planilha' },
                { id: 'auditoria-lsa', name: 'Áudios LSA', icon: Mic, keywords: 'audio leads lsa' },
            ],
        },
        {
            label: 'Admin',
            items: [
                { id: 'users', name: isAdmin ? 'Gerenciar Acessos' : 'Meu Perfil', icon: Users, keywords: 'usuarios acessos perfil' },
            ],
        },
    ];
}

export const VIEW_TITLES: Record<AppView, string> = {
    dashboard: 'Dashboard',
    companies: 'Empresas',
    'semantic-audit': 'Triagem de Especialistas',
    'keyword-planner': 'Planejador',
    upperscript: 'Upper Script',
    ferramenta: 'Upper Script',
    'auditoria-lsa': 'Áudios LSA',
    users: 'Acessos',
    'laboratorio-ab': 'Laboratório A/B',
};
