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
    owner_id?: string
    created_at?: string
    tableName?: string
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
    id: string; // ID da tupla (concatenação de company_id e indice)
    company_id?: string;
    
    // Identificadores
    usuario?: string;
    id_enquete?: string;
    folhas_url?: string;
    tipo_fonte_de_dados?: string;
    nome_do_arquivo_local?: string;
    campanha: string;
    grupo_de_anuncios: string;
    
    // Dados Semânticos
    palavra_chave: string;
    termo_de_pesquisa: string;
    
    // Sinalizadores de Agente
    segmentar: boolean;
    negativar: boolean;
    teste_ab: boolean;
    duvida: boolean;
    manter: boolean;
    
    // Análise & Logs
    observacao: string;
    auditor_comment: string;
    sugestao_grupo: string;
    status_granularidade: string;
    
    // Métricas de Performance (Podem vir como string do Supabase)
    cliques: number | string;
    impressoes: number | string;
    ctr: number | string;
    cpc_medio: number | string;
    custo: number | string;
    conversoes: number | string;
    custo_conv: number | string;
    taxa_conv: number | string;
    
    // Metadados
    tipo_corresp: string;
    adicionada_excluida: string;
    synced_at?: string;
    created_at?: string;
    pode_enviar: boolean;
    
    // Triagem QC
    triagem1: boolean;
    triagem2: boolean;
    
    // Ciclo de Resposta Cliente (V4.2 Bot)
    enviado_para_grupo?: boolean;
    respondido_cliente?: boolean;
    acao?: string;
    comentario?: string;
    descricao?: string;
    sugestao_grupo_v4?: string;
}
