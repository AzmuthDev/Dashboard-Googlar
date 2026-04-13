import { useState, useEffect } from 'react';
import { Typography, Input, Button, List, message, Card } from 'antd';
import { SaveOutlined, BellOutlined, LoadingOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import type { Company } from '../types';
import { motion } from 'framer-motion';

const { Title, Text } = Typography;

export function WhatsAppBotConfig() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [webhooks, setWebhooks] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const storedCompanies = JSON.parse(localStorage.getItem('googlar_companies') || '[]');
                setCompanies(storedCompanies);

                const localWebhooks = JSON.parse(localStorage.getItem('googlar_whatsapp_webhooks') || '{}');
                setWebhooks(localWebhooks);

                const fetchSupabase = async () => {
                    const { data, error } = await supabase
                        .from('whatsapp_bot_configs')
                        .select('company_id, webhook_url');

                    if (error) throw error;
                    return data;
                };

                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('TIMEOUT')), 5000)
                );

                try {
                    const data = await Promise.race([fetchSupabase(), timeout]) as any[];
                    if (data) {
                        const supabaseMap = data.reduce((acc: any, cur: any) => {
                            acc[cur.company_id] = cur.webhook_url;
                            return acc;
                        }, {});

                        const merged = { ...localWebhooks, ...supabaseMap };
                        setWebhooks(merged);
                        localStorage.setItem('googlar_whatsapp_webhooks', JSON.stringify(merged));
                        console.log('✅ Webhooks do Supabase sincronizados.');
                    }
                } catch (supErr: any) {
                    if (supErr.message === 'TIMEOUT') {
                        console.warn('⚠️ Supabase demorou muito. Usando cache local.');
                    } else if (supErr.code === '42P01') {
                        console.warn('⚠️ Tabela whatsapp_bot_configs não encontrada no Supabase. Usando apenas LocalStorage.');
                    } else {
                        console.error('Erro Supabase:', supErr);
                    }
                }
            } catch (err) {
                console.error('Falha crítica ao carregar configurações:', err);
                message.error('Erro ao carregar configurações do bot.');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    const handleSaveWebhook = async (companyId: string) => {
        const url = webhooks[companyId];
        if (!url) {
            message.warning('Insira uma URL válida antes de salvar.');
            return;
        }

        setIsSaving(companyId);
        try {
            const localWebhooks = JSON.parse(localStorage.getItem('googlar_whatsapp_webhooks') || '{}');
            localWebhooks[companyId] = url;
            localStorage.setItem('googlar_whatsapp_webhooks', JSON.stringify(localWebhooks));

            const { error } = await supabase
                .from('whatsapp_bot_configs')
                .upsert({ 
                    company_id: companyId, 
                    webhook_url: url,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'company_id' });

            if (error) {
                if (error.code === '42P01') {
                    message.info('Salvo localmente (Tabela do Supabase ausente).');
                } else {
                    throw error;
                }
            } else {
                message.success('Webhook salvo na nuvem com sucesso!');
            }
        } catch (err: any) {
            console.error('Erro ao salvar webhook:', err);
            message.warning('Salvo apenas localmente devido a erro de conexão.');
        } finally {
            setIsSaving(null);
        }
    };

    const handleUrlChange = (companyId: string, url: string) => {
        setWebhooks(prev => ({ ...prev, [companyId]: url }));
    };

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-muted border border-border">
                    <BellOutlined className="text-2xl text-foreground" />
                </div>
                <div>
                    <Title level={2} className="!m-0 tracking-tight text-foreground">
                        Configuração Bot WhatsApp
                    </Title>
                    <Text className="text-muted-foreground">
                        Defina webhooks dinâmicos para envio de dúvidas para cada empresa.
                    </Text>
                </div>
            </div>

            <Card className="rounded-3xl border border-border shadow-xl overflow-hidden transition-all duration-300 bg-card">
                {isLoading ? (
                    <div className="py-20 flex flex-col items-center gap-4">
                        <LoadingOutlined className="text-3xl text-zinc-500" />
                        <Text className="text-zinc-500 font-mono">CARREGANDO CONFIGURAÇÕES...</Text>
                    </div>
                ) : (
                    <List
                        dataSource={companies}
                        renderItem={company => (
                            <List.Item className="px-8 py-6 border-border hover:bg-muted/40 transition-colors">
                                <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
                                    <div className="flex items-center gap-4">
                                        {company.logoUrl ? (
                                            <img src={company.logoUrl} alt={company.name} className="w-12 h-12 rounded-xl object-cover border border-border" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground font-bold">
                                                {company.name.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <Text strong className="block text-base text-foreground">{company.name}</Text>
                                            <Text className="text-xs text-muted-foreground font-mono uppercase tracking-wider">ID: {company.id}</Text>
                                        </div>
                                    </div>

                                    <div className="flex-1 max-w-xl flex gap-3">
                                        <Input
                                            placeholder="https://seu-webhook.com/..."
                                            value={webhooks[company.id] || ''}
                                            onChange={e => handleUrlChange(company.id, e.target.value)}
                                            className="bg-muted border-border rounded-xl text-foreground"
                                        />
                                        <Button
                                            type="primary"
                                            icon={isSaving === company.id ? <LoadingOutlined /> : <SaveOutlined />}
                                            onClick={() => handleSaveWebhook(company.id)}
                                            disabled={isSaving !== null}
                                            className="h-10 rounded-xl font-bold border-none bg-primary text-primary-foreground hover:opacity-90"
                                        >
                                            {isSaving === company.id ? 'Salvando...' : 'Salvar'}
                                        </Button>
                                    </div>
                                </div>
                            </List.Item>
                        )}
                        locale={{ emptyText: <div className="py-12 text-zinc-500">Nenhuma empresa encontrada.</div> }}
                    />
                )}
            </Card>

            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl"
            >
                <div className="flex gap-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <BellOutlined className="text-blue-500" />
                    </div>
                    <div>
                        <h4 className="text-blue-600 dark:text-blue-400 font-bold mb-1">Como funciona a integração?</h4>
                        <p className="text-sm text-blue-600/70 dark:text-blue-400/70 leading-relaxed">
                            O Dashboard enviará um <b>POST</b> para a URL configurada acima sempre que você clicar em "Enviar Dúvidas" na Auditoria Semântica. 
                            O payload conterá o nome da empresa e a lista de termos marcados como dúvida com seus respectivos comentários.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
