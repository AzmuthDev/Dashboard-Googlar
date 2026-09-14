import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase do Seven Workspace
const SEVEN_SUPABASE_URL = 'https://nrrqyauummqzyagwsuwl.supabase.co';
const SEVEN_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycnF5YXV1bW1xenlhZ3dzdXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDg3ODcsImV4cCI6MjA5MTI4NDc4N30.UNQVtbCUj3l87UBxaFOxUITv63yhUeAtd5hOw1Ex3HE';

const sevenClient = createClient(SEVEN_SUPABASE_URL, SEVEN_SUPABASE_ANON_KEY);

// ID do Tânios Acácio no Seven
export const TANIOS_SEVEN_USER_ID = '4847737a-24ae-4c01-a971-982fbe005d81';

interface NotificationPayload {
    auditorName: string;
    auditorEmail?: string;
    companyId: string;
    companyName: string;
    termCount: number;
}

// Fila e timer para Agrupamento Inteligente (Debounce)
// Evita que 30 cliques do analista gerem 30 notificações para o Tanios
let debounceTimer: any = null;
let pendingCount = 0;
let lastAuditor = '';
let lastCompanyId = '';
let lastCompanyName = '';

/**
 * Envia imediatamente a notificação consolidada para o Seven
 */
async function flushNotification() {
    if (pendingCount <= 0) return;

    const count = pendingCount;
    const auditorName = lastAuditor || 'Analista';
    const companyId = lastCompanyId;
    const companyName = lastCompanyName || 'Empresa';

    // Resetar buffer
    pendingCount = 0;
    lastAuditor = '';
    lastCompanyId = '';
    lastCompanyName = '';

    const title = 'Nova 2ª Triagem Realizada';
    const message = `${auditorName} realizou a 2ª triagem de ${count} termo${count > 1 ? 's' : ''} na empresa ${companyName}.`;

    console.log(`[Seven Notifier] 🚀 Disparando notificação para o Seven (Tânios): ${message}`);

    try {
        // 1. Inserir na tabela 'notifications' do Supabase do Seven
        const { error: insertError } = await sevenClient
            .from('notifications')
            .insert({
                user_id: TANIOS_SEVEN_USER_ID,
                title,
                message,
                type: 'segunda_triagem',
                metadata: {
                    empresa_id: companyId,
                    empresa_nome: companyName,
                    autor_nome: auditorName,
                    quantidade_termos: count,
                    origem: 'Pocket Googlar',
                    url: `https://pocket.googlar.com.br/?company=${companyId}&view=semantic-audit&tab=duvidas`,
                    timestamp: new Date().toISOString()
                },
                is_read: false
            });

        if (insertError) {
            console.warn('[Seven Notifier] Aviso ao inserir direto no Supabase do Seven:', insertError.message);
        } else {
            console.log('[Seven Notifier] ✅ Notificação entregue no Seven com sucesso!');
        }

        // 2. Disparo secundário via webhook/API se o Seven local ou web estiver rodando
        const endpoints = [
            'http://localhost:3000/api/notifications',
            'https://seven.googlar.com.br/api/notifications'
        ];

        for (const ep of endpoints) {
            try {
                fetch(ep, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        destinatario: 'tanios',
                        userId: TANIOS_SEVEN_USER_ID,
                        title,
                        message,
                        companyId,
                        companyName,
                        auditorName,
                        termCount: count
                    })
                }).catch(() => {});
            } catch (e) {}
        }
    } catch (err) {
        console.error('[Seven Notifier] Erro ao enviar notificação para o Seven:', err);
    }
}

/**
 * Enfileira uma ação de 2ª triagem com agrupamento (debounce de 3.5 segundos).
 * Se o analista marcar 20 termos rapidamente, gera apenas 1 notificação consolidada!
 */
export function queueSevenNotification(payload: NotificationPayload) {
    pendingCount += payload.termCount || 1;
    lastAuditor = payload.auditorName;
    lastCompanyId = payload.companyId;
    lastCompanyName = payload.companyName;

    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
        flushNotification();
    }, 3500);
}
