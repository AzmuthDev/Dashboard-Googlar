// Configurações Globais das Empresas no Painel V2
export interface Activity {
    id: string
    type: 'success' | 'warning' | 'error' | 'info'
    user: string
    action: string
    time: string
}

export interface Automation {
    id: string;
    name: string;
    webhookUrl: string;
    description: string;
    lastRun?: string;
}

export interface Company {
    id: string
    name: string
    sheetsUrl?: string
    dataSourceType?: 'sheets' | 'local'
    localFileName?: string
    users: { email: string; role: 'admin' | 'editor' | 'viewer' }[]
    logoUrl?: string
    coverUrl?: string
    isActive?: boolean
}

export type UserRole = 'admin' | 'standard';

export interface AuthorizedUser {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    isAdmin: boolean;
    addedAt: string;
    assignedCompanyIds?: string[]; // Suporte para múltiplos clientes
    avatarUrl?: string;
    jobTitle?: string;
}

export interface CampaignTerm {
    id: string;
    campaign_id: string;
    company_id: string;
    campaign_name: string;
    ad_group: string;
    keyword: string;
    search_term: string;
    observation: string;
    duvida: string;
    suggestion_group: string;
    segment: string;
    negativize: string;
    ab_test: string;
    status_granularity: string;
    clicks: number;
    impressions: number;
    ctr: number;
    avg_cpc: number;
    cost: number;
    conversions: number;
    cost_per_conversion: number;
    conversion_rate: number;
    match_type: string;
    added_excluded: string;
    intervencao_humana: string;
}
