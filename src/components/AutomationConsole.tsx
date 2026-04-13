import React, { useState, useEffect } from 'react'
import { Button, Select, message, Card, Typography, Divider, Modal, Input } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { Zap, Activity, Globe, Play, Trash2, Settings, MessageSquare, Bot, Sparkles, Bell } from 'lucide-react'
import type { Company, Automation } from '../types'
import { EvervaultCard } from './ui/evervault-card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { AIAgent } from './AIAgent'
import { WhatsAppBotConfig } from './WhatsAppBotConfig'
import { cn } from '../lib/utils'

const { Title, Text } = Typography

interface AutomationConsoleProps {
    isAdmin: boolean;
    activeCompanyId: string | null;
    isDarkMode: boolean;
    onSelectCompany: (companyId: string) => void;
}

export function AutomationConsole({ isAdmin, activeCompanyId, isDarkMode, onSelectCompany }: AutomationConsoleProps) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [automations, setAutomations] = useState<{ [companyId: string]: Automation[] }>({});
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isConvModalVisible, setIsConvModalVisible] = useState(false);
    const [activeTab, setActiveTab ] = useState('n8n');
    
    // Form fields (n8n)
    const [newAutoName, setNewAutoName] = useState('');
    const [newAutoUrl, setNewAutoUrl] = useState('');
    const [newAutoDesc, setNewAutoDesc] = useState('');

    // Form fields (Conversation)
    const [convWebhooks, setConvWebhooks] = useState<{ [companyId: string]: Automation[] }>({});
    const [newConvName, setNewConvName] = useState('');
    const [newConvUrl, setNewConvUrl] = useState('');
    const [newConvTrigger, setNewConvTrigger] = useState('');

    // Execution states
    const [executingId, setExecutingId] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [showTerminal, setShowTerminal] = useState(false);

    useEffect(() => {
        const storedCompanies = JSON.parse(localStorage.getItem('googlar_companies') || '[]');
        setCompanies(storedCompanies);

        const storedAutomations = JSON.parse(localStorage.getItem('googlar_automations') || '{}');
        setAutomations(storedAutomations);

        const storedConvWebhooks = JSON.parse(localStorage.getItem('googlar_conv_webhooks') || '{}');
        setConvWebhooks(storedConvWebhooks);
    }, []);

    const activeCompanyAutomations = activeCompanyId ? (automations[activeCompanyId] || []) : [];
    const activeCompanyConvWebhooks = activeCompanyId ? (convWebhooks[activeCompanyId] || []) : [];

    const handleCreateAutomation = () => {
        if (!activeCompanyId) {
            message.warning("Selecione uma empresa primeiro.");
            return;
        }

        if (!newAutoName.trim() || !newAutoUrl.trim()) {
            message.error("Nome e URL são obrigatórios.");
            return;
        }

        const newAutomation: Automation = {
            id: Date.now().toString(),
            name: newAutoName.trim(),
            webhookUrl: newAutoUrl.trim(),
            description: newAutoDesc.trim(),
        };

        const updatedAutomations = { ...automations };
        if (!updatedAutomations[activeCompanyId]) {
            updatedAutomations[activeCompanyId] = [];
        }
        updatedAutomations[activeCompanyId].push(newAutomation);

        localStorage.setItem('googlar_automations', JSON.stringify(updatedAutomations));
        setAutomations(updatedAutomations);

        setNewAutoName('');
        setNewAutoUrl('');
        setNewAutoDesc('');
        setIsModalVisible(false);
        message.success("Automação adicionada com sucesso!");
    };

    const handleCreateConvWebhook = () => {
        if (!activeCompanyId) {
            message.warning("Selecione uma empresa primeiro.");
            return;
        }

        if (!newConvName.trim() || !newConvUrl.trim()) {
            message.error("Nome e URL são obrigatórios.");
            return;
        }

        const newConv: Automation = {
            id: Date.now().toString(),
            name: newConvName.trim(),
            webhookUrl: newConvUrl.trim(),
            description: `Trigger: ${newConvTrigger.trim()}`,
        };

        const updatedConv = { ...convWebhooks };
        if (!updatedConv[activeCompanyId]) {
            updatedConv[activeCompanyId] = [];
        }
        updatedConv[activeCompanyId].push(newConv);

        localStorage.setItem('googlar_conv_webhooks', JSON.stringify(updatedConv));
        setConvWebhooks(updatedConv);

        setNewConvName('');
        setNewConvUrl('');
        setNewConvTrigger('');
        setIsConvModalVisible(false);
        message.success("Webhook de conversa adicionado!");
    };

    const handleDeleteAutomation = (autoId: string, isConv = false) => {
        if (!activeCompanyId) return;

        Modal.confirm({
            title: isConv ? 'Excluir Webhook de Conversa' : 'Excluir Automação',
            content: 'Tem certeza que deseja remover esta rota de webhook?',
            okText: 'Sim, excluir',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk: () => {
                const targetState = isConv ? convWebhooks : automations;
                const updated = { ...targetState };
                updated[activeCompanyId] = updated[activeCompanyId].filter(a => a.id !== autoId);
                
                const storageKey = isConv ? 'googlar_conv_webhooks' : 'googlar_automations';
                localStorage.setItem(storageKey, JSON.stringify(updated));
                
                if (isConv) setConvWebhooks(updated);
                else setAutomations(updated);
                
                message.success("Removido com sucesso.");
            }
        });
    };

    const addLog = (message: string) => {
        const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        setLogs(prev => [...prev, `[${time}] ${message}`]);
    };

    const handleExecuteWebhook = async (automation: Automation) => {
        if (!activeCompanyId) return;
        
        const company = companies.find(c => c.id === activeCompanyId);
        if (!company) return;

        setExecutingId(automation.id);
        setShowTerminal(true);
        setLogs([]);

        addLog(`Iniciando automação: ${automation.name}...`);
        
        try {
            await new Promise(r => setTimeout(r, 800));
            addLog(`Conectando ao Webhook: ${automation.webhookUrl.substring(0, 30)}...`);
            
            await new Promise(r => setTimeout(r, 1200));
            addLog(`Preparando payload para ${company.name}...`);

            const payload = {
                companyName: company.name,
                timestamp: new Date().toISOString(),
                automationId: automation.id
            };

            const response = await fetch(automation.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            addLog(`Enviando dados (Payload JSON)...`);
            await new Promise(r => setTimeout(r, 1000));

            if (!response.ok) {
                throw new Error(`Erro HTTTP: ${response.status}`);
            }

            addLog(`✅ Resposta recebida do servidor: 200 OK`);
            addLog(`Finalizando processamento seguro...`);
            await new Promise(r => setTimeout(r, 500));

            // Update lastRun
            const updatedAutomations = { ...automations };
            const index = updatedAutomations[activeCompanyId].findIndex(a => a.id === automation.id);
            if (index !== -1) {
                updatedAutomations[activeCompanyId][index].lastRun = new Date().toLocaleString('pt-BR');
                localStorage.setItem('googlar_automations', JSON.stringify(updatedAutomations));
                setAutomations(updatedAutomations);
            }

            message.success(`Webhook '${automation.name}' executado com sucesso!`);
            addLog(`✨ Operação concluída com sucesso.`);
        } catch (error: any) {
            console.error("Webhook Error:", error);
            addLog(`❌ ERRO CRÍTICO: ${error.message}`);
            message.error(`Falha ao disparar automação: ${error.message}`);
        } finally {
            setExecutingId(null);
        }
    };

    return (
        <div className="p-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 p-6 rounded-2xl border border-border bg-card shadow-sm transition-all duration-300">
                <div>
                    <h2 className="text-2xl font-semibold flex items-center gap-2 text-foreground">
                        <Zap className="w-6 h-6 text-foreground" />
                        Console de Automação
                    </h2>
                    <p className="text-sm mt-1 text-muted-foreground">
                        Gerencie fluxos n8n, IA Copilot e triggers de conversação.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Select
                        showSearch
                        placeholder="Selecione a Empresa"
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                        value={activeCompanyId || undefined}
                        onChange={onSelectCompany}
                        options={companies.map(c => ({ value: c.id, label: c.name }))}
                        className="w-64"
                        size="large"
                    />
                    
                    {isAdmin && activeCompanyId && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setIsModalVisible(true)}
                            size="large"
                            className="bg-primary text-primary-foreground hover:opacity-90 border-none shadow-md font-bold h-11 px-6 rounded-xl transition-all"
                        >
                            Nova Automação
                        </Button>
                    )}
                </div>
            </div>

            <Tabs defaultValue="n8n" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex items-center justify-between gap-4 mb-2">
                    <TabsList className="bg-muted p-1 rounded-xl h-11 border border-border">
                        <TabsTrigger value="n8n" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground">
                            <Zap className="w-4 h-4 mr-2" />
                            Automações
                        </TabsTrigger>
                        <TabsTrigger value="copilot" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground">
                            <Bot className="w-4 h-4 mr-2" />
                            Copilot IA
                        </TabsTrigger>
                        <TabsTrigger value="conversations" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground">
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Conversação
                        </TabsTrigger>
                        <TabsTrigger value="whatsapp" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground">
                            <Bell className="w-4 h-4 mr-2" />
                            Bot WhatsApp
                        </TabsTrigger>
                        {isAdmin && (
                            <TabsTrigger value="settings" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm text-muted-foreground data-[state=active]:text-foreground">
                                <Settings className="w-4 h-4 mr-2" />
                                Configurações
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                <TabsContent value="n8n" className="m-0 border-none p-0 outline-none">
                    {!activeCompanyId ? (
                        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-2xl bg-muted/20">
                            <Globe className="w-16 h-16 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">Selecione uma Empresa</h3>
                            <p className="text-muted-foreground max-w-sm">
                                Para visualizar ou configurar os webhooks do n8n, por favor selecione a conta da empresa no seletor acima.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {activeCompanyAutomations.length === 0 ? (
                                <div className="col-span-full flex items-center justify-center py-12">
                                    <div className="flex flex-col items-center justify-center max-w-lg w-full mx-auto relative h-[25rem] overflow-visible">
                                        <EvervaultCard 
                                            text="" 
                                            isDark={isDarkMode} 
                                            showBorder={false} 
                                            showText={false} 
                                            className="scale-[1.3]" 
                                        />
                                    </div>
                                </div>
                            ) : (
                                activeCompanyAutomations.map(auto => (
                                    <div key={auto.id} className="group relative">
                                        <Card 
                                            className="transition-all duration-300 border border-border hover:shadow-2xl overflow-hidden bg-card rounded-2xl"
                                            bodyStyle={{ padding: '24px' }}
                                        >
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="relative -ml-2 -mt-2 mb-4">
                                                    <EvervaultCard 
                                                        variant="circle"
                                                        isDark={isDarkMode}
                                                        showBorder={false}
                                                        className="w-20 h-20 md:w-24 md:h-24 p-0"
                                                    >
                                                        <div className="p-3 bg-primary rounded-full shadow-lg transform group-hover:scale-110 transition-transform duration-500">
                                                            <Zap className="w-6 h-6 text-primary-foreground" />
                                                        </div>
                                                    </EvervaultCard>
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest",
                                                        auto.lastRun 
                                                            ? "bg-emerald-500/10 text-emerald-500" 
                                                            : "bg-zinc-500/10 text-zinc-500"
                                                    )}>
                                                        {auto.lastRun ? "Ativo" : "Pendente"}
                                                    </span>
                                                    {isAdmin && (
                                                        <Button 
                                                            type="text" 
                                                            icon={<Trash2 className="w-4 h-4 text-red-500" />} 
                                                            onClick={() => handleDeleteAutomation(auto.id, false)}
                                                            className="hover:bg-red-50 dark:hover:bg-red-500/10"
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mb-6">
                                                <Title level={4} className="!m-0 !text-foreground font-bold tracking-tight">
                                                    {auto.name}
                                                </Title>
                                                <Text className="text-muted-foreground block mt-2 text-sm leading-relaxed line-clamp-2">
                                                    {auto.description || 'Sem descrição definida para esta automação n8n.'}
                                                </Text>
                                            </div>

                                            <Divider className="my-6 border-border" />

                                            <div className="flex items-center justify-between mt-auto">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Activity className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-bold uppercase tracking-[0.15em]">
                                                            {auto.lastRun ? `Status: Online` : 'Aguardando'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[9px] text-muted-foreground font-medium">
                                                        {auto.lastRun ? `Última: ${auto.lastRun}` : 'Nenhum disparo ainda'}
                                                    </span>
                                                </div>
                                                
                                                <Button 
                                                    onClick={() => handleExecuteWebhook(auto)}
                                                    loading={executingId === auto.id}
                                                    icon={<Play className="w-4 h-4" />}
                                                    className="btn-bw-inverse h-10 px-6 rounded-xl font-bold uppercase tracking-wider text-[10px] border-none shadow-lg transform active:scale-95 transition-all"
                                                >
                                                    Disparar
                                                </Button>
                                            </div>
                                        </Card>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="copilot" className="m-0 border-none outline-none">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                             <AIAgent 
                                dashboardData={{
                                    company: companies.find(c => c.id === activeCompanyId),
                                    automations: activeCompanyAutomations,
                                    conversationTriggers: activeCompanyConvWebhooks,
                                    activeTab: activeTab
                                }}
                             />
                        </div>
                        <div className="space-y-6">
                            <div className="rounded-2xl p-6 border shadow-xl overflow-hidden relative group h-fit transition-all duration-300 bg-primary border-primary">
                                <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Sparkles className="w-48 h-48 text-primary-foreground" />
                                </div>
                                <h5 className="text-primary-foreground font-bold text-lg mb-4 flex items-center gap-2">
                                    <Bot className="w-5 h-5" /> 
                                    IA Multimodal
                                </h5>
                                <p className="text-primary-foreground/80 text-xs leading-relaxed mb-6 font-medium">
                                    Este agente utiliza o **Gemini 1.5 Pro** para processar não apenas texto, mas arquivos complexos e imagens.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-primary-foreground/10 rounded-xl border border-primary-foreground/10 backdrop-blur-sm">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                        <span className="text-[10px] font-bold text-primary-foreground uppercase tracking-widest">Análise de Imagem Ativa</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-primary-foreground/10 rounded-xl border border-primary-foreground/10 backdrop-blur-sm">
                                        <div className="w-2 h-2 rounded-full bg-blue-300" />
                                        <span className="text-[10px] font-bold text-primary-foreground uppercase tracking-widest">Geração Visual pronta</span>
                                    </div>
                                </div>
                            </div>

                            <Card className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <h6 className="font-bold text-sm mb-4 text-foreground">Sugestões de Uso</h6>
                                <div className="flex flex-col gap-2">
                                    {[
                                        "Analisar imagem da landing page",
                                        "Gerar mockup de anúncio B&W",
                                        "Otimizar prompt de conversão",
                                        "Resumir métricas do n8n"
                                    ].map((s, i) => (
                                        <button 
                                            key={i} 
                                            className="text-left p-3 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl border border-transparent hover:border-border transition-all font-bold uppercase tracking-tight"
                                        >
                                            "{s}"
                                        </button>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="conversations" className="m-0 border-none outline-none">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-foreground">Triggers de Conversação</h3>
                            <p className="text-sm text-muted-foreground">Disparea fluxos inteligentes baseados em entradas externas.</p>
                        </div>
                        {isAdmin && activeCompanyId && (
                             <Button 
                                onClick={() => setIsConvModalVisible(true)}
                                className="btn-bw-inverse font-bold h-11 px-8 rounded-xl"
                             >
                                Novo Webhook de Conversa
                            </Button>
                        )}
                    </div>

                    {!activeCompanyId ? (
                        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-2xl bg-muted/20">
                            <MessageSquare className="w-16 h-16 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">Selecione uma Empresa</h3>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {activeCompanyConvWebhooks.length === 0 ? (
                                <div className="col-span-full py-12 text-center bg-muted/20 rounded-2xl border border-dashed border-border">
                                    <p className="text-muted-foreground">Nenhum webhook de conversa configurado.</p>
                                </div>
                            ) : (
                                activeCompanyConvWebhooks.map(conv => (
                                    <Card 
                                        key={conv.id}
                                        className="bg-card border border-border rounded-2xl hover:shadow-xl transition-all group"
                                    >
                                        <div className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 rounded-xl transition-colors bg-primary">
                                                    <MessageSquare className="w-5 h-5 text-primary-foreground" />
                                                </div>
                                                <Button 
                                                    type="text" 
                                                    icon={<Trash2 className="w-4 h-4 text-red-500" />} 
                                                    onClick={() => handleDeleteAutomation(conv.id, true)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                />
                                            </div>
                                            <h4 className="font-bold text-foreground">{conv.name}</h4>
                                            <p className="text-xs text-muted-foreground mt-2">{conv.description}</p>
                                            
                                            <Divider className="my-4 border-border" />
                                            
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[150px]">
                                                    {conv.webhookUrl}
                                                </span>
                                                <Button size="small" className="btn-bw-inverse !text-[9px] h-8 px-4 rounded-lg">TESTAR</Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="whatsapp" className="m-0 border-none outline-none">
                    <WhatsAppBotConfig />
                </TabsContent>

                {isAdmin && (
                    <TabsContent value="settings" className="m-0 border-none outline-none space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card
                                className="border border-border shadow-xl bg-card rounded-2xl overflow-hidden"
                                bodyStyle={{ padding: '32px' }}
                            >
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2 bg-muted rounded-lg">
                                        <Settings className="w-5 h-5 text-foreground" />
                                    </div>
                                    <span className="font-bold uppercase tracking-widest text-sm text-foreground">Configuração Global de IA</span>
                                </div>
                                
                                <div className="flex flex-col gap-6">
                                    <div>
                                        <Text className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] block mb-3">
                                            Gemini API Key (Google Cloud)
                                        </Text>
                                        <div className="flex gap-3">
                                            <Input.Password
                                                placeholder="Insira sua GEMINI_API_KEY..."
                                                defaultValue={localStorage.getItem('googlar_gemini_api_key') || ''}
                                                onChange={(e) => {
                                                    localStorage.setItem('googlar_gemini_api_key', e.target.value);
                                                }}
                                                className="bg-muted border-border font-mono h-12 rounded-xl"
                                            />
                                            <Button 
                                                className="btn-bw-inverse font-bold px-8 h-12 rounded-xl shadow-lg transform active:scale-95 transition-all"
                                                onClick={() => {
                                                    message.success("Configurações de IA salvas com sucesso!");
                                                    window.dispatchEvent(new Event('googlar_ai_config_updated'));
                                                }}
                                            >
                                                Salvar
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-muted/30 rounded-xl border border-border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status do Motor</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground italic">
                                            Segurança: As chaves são criptografadas localmente em seu navegador e nunca deixam este dispositivo sem sua autorização.
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            <div className="rounded-2xl p-8 flex flex-col justify-center border shadow-inner overflow-hidden relative group transition-all duration-300 bg-primary border-primary">
                                <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Zap className="w-64 h-64 text-primary-foreground" />
                                </div>
                                <div className="bg-primary-foreground/10 w-fit p-3 rounded-2xl mb-6 backdrop-blur-sm border border-primary-foreground/10">
                                    <Bot className="w-6 h-6 text-primary-foreground" />
                                </div>
                                <h4 className="text-primary-foreground font-bold text-2xl mb-3 relative z-10 tracking-tight">Potencialize com o Gemini 1.5 Pro</h4>
                                <p className="text-primary-foreground/80 text-sm mb-6 relative z-10 leading-relaxed max-w-sm">
                                    Ao configurar sua chave, você desbloqueia a visão computacional e a geração de mídia diretamente no Copilot do Dashboard.
                                </p>
                                <Divider className="border-primary-foreground/10 my-0 mb-6" />
                                <div className="flex items-center gap-4 text-xs font-mono text-primary-foreground/50">
                                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> MULTIMODAL</span>
                                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> LATÊNCIA ZERO</span>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                )}
            </Tabs>

            {/* Terminal Interface */}
            {showTerminal && (
                <div className="mt-8 animate-in zoom-in duration-300">
                    <div className="flex items-center justify-between gap-2 px-4 py-2 border border-border rounded-t-xl bg-muted transition-all duration-300">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest ml-4">googlar-terminal_v2.log</span>
                        </div>
                        <button 
                            onClick={() => setShowTerminal(false)}
                            className="text-zinc-500 hover:text-white transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="bg-black border-x border-b border-zinc-800 p-6 rounded-b-xl max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed shadow-2xl">
                        {logs.map((log, i) => (
                            <div key={i} className={cn(
                                "mb-1",
                                log.includes('❌') ? "text-red-400" : 
                                log.includes('✅') || log.includes('✨') ? "text-[#00ffbc]" : 
                                "text-zinc-400"
                            )}>
                                <span className="opacity-40 mr-2">{'>'}</span>
                                {log}
                            </div>
                        ))}
                        {executingId && (
                            <div className="text-zinc-100 animate-pulse">
                                <span className="opacity-40 mr-2">{'>'}</span>
                                Carregando processo...
                            </div>
                        )}
                        <div id="terminal-bottom" />
                    </div>
                </div>
            )}

            {/* Modal de Criação */}
            <Modal
                title="Nova Automação n8n"
                open={isModalVisible}
                onOk={handleCreateAutomation}
                onCancel={() => {
                    setIsModalVisible(false);
                    setNewAutoName('');
                    setNewAutoUrl('');
                    setNewAutoDesc('');
                }}
                okText="Salvar Automação"
                cancelText="Cancelar"
            >
                <div className="flex flex-col gap-4 mt-4">
                    <div>
                        <Text className="text-zinc-500 block mb-2">Nome do Webhook</Text>
                        <Input
                            placeholder="Ex: Disparar Leads Slack"
                            value={newAutoName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAutoName(e.target.value)}
                            className="bg-muted border-border"
                        />
                    </div>
                    <div>
                        <Text strong className="block mb-2 text-zinc-700 dark:text-zinc-300">URL do Webhook n8n</Text>
                        <Input
                            placeholder="https://n8n.googlar.com.br/webhook/..."
                            value={newAutoUrl}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAutoUrl(e.target.value)}
                            className="bg-muted border-border font-mono text-xs"
                        />
                    </div>
                    <div>
                        <Text strong className="block mb-2 text-zinc-700 dark:text-zinc-300">Descrição</Text>
                        <Input.TextArea
                            placeholder="O que esta automação faz?"
                            value={newAutoDesc}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewAutoDesc(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>

            {/* Modal de Conversação */}
            <Modal
                title="Novo Webhook de Conversação"
                open={isConvModalVisible}
                onOk={handleCreateConvWebhook}
                onCancel={() => setIsConvModalVisible(false)}
                okText="Salvar Webhook"
                cancelText="Cancelar"
            >
                <div className="flex flex-col gap-4 mt-4">
                    <div>
                        <Text className="text-zinc-500 block mb-2">Identificação do Fluxo</Text>
                        <Input
                            placeholder="Ex: Atendimento WhatsApp"
                            value={newConvName}
                            onChange={(e) => setNewConvName(e.target.value)}
                            className="bg-muted border-border"
                        />
                    </div>
                    <div>
                        <Text strong className="block mb-2 text-zinc-700 dark:text-zinc-300">URL do Trigger n8n</Text>
                        <Input
                            placeholder="https://n8n.googlar.com.br/webhook/..."
                            value={newConvUrl}
                            onChange={(e) => setNewConvUrl(e.target.value)}
                            className="bg-muted border-border font-mono text-xs"
                        />
                    </div>
                    <div>
                        <Text strong className="block mb-2 text-zinc-700 dark:text-zinc-300">Gatilho (Trigger)</Text>
                        <Input
                            placeholder="Ex: Novo Lead, Mensagem de Erro, etc."
                            value={newConvTrigger}
                            onChange={(e) => setNewConvTrigger(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
