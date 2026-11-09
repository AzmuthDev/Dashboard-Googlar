import { VIEW_TITLES, type AppView } from '../components/shell/navigation.ts';

/** URL do conector MCP que o usuário cola no Claude. O segredo só existe no navegador e nessa URL. */
export function urlConector(supabaseUrl: string, segredo: string): string {
    return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/pocket-mcp/${segredo}`;
}

/** Aceita "123-456-7890" e devolve "1234567890"; `null` se não tiver exatamente 10 dígitos. */
export function limparIdConta(s: string): string | null {
    const limpo = s.replace(/[\s-]/g, '');
    return /^\d{10}$/.test(limpo) ? limpo : null;
}

export interface RetornoGoogle {
    view?: AppView;
    googleAds?: 'ok' | 'erro' | 'confirmar';
    motivo?: string;
    /** Código de uso único da volta do Google. Nunca registrar nem enviar para outro lugar. */
    confirmacao?: string;
}

/** Lê a query de volta do fluxo do Google (e `?view=` válido). Valores inesperados são ignorados. */
export function lerRetornoGoogle(search: string): RetornoGoogle {
    const p = new URLSearchParams(search);
    const r: RetornoGoogle = {};
    const view = p.get('view');
    if (view && Object.prototype.hasOwnProperty.call(VIEW_TITLES, view)) r.view = view as AppView;
    const g = p.get('google_ads');
    if (g === 'ok' || g === 'erro' || g === 'confirmar') r.googleAds = g;
    const motivo = p.get('motivo');
    if (motivo) r.motivo = motivo;
    const confirmacao = p.get('confirmacao');
    if (confirmacao) r.confirmacao = confirmacao;
    return r;
}
