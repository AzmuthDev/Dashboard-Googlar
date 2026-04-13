import { useState } from 'react'
import { Input, Button, message, Tooltip } from 'antd'
import { 
    Globe, ShieldCheck, Zap, Copy, 
    MessageCircle, Mail, Sparkles, 
    AlertCircle, Search 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'
import { Card } from './ui/card'
import ReactMarkdown from 'react-markdown'

interface BIResult {
    whatsapp?: string;
    email?: string;
    analise_ia?: string;
    [key: string]: any;
}

export function AntygravitiBI({ activeCompanyId }: { activeCompanyId?: string | null }) {
    const [companyUrl, setCompanyUrl] = useState('');
    const [isScraping, setIsScraping] = useState(false);
    const [result, setResult] = useState<BIResult | null>(null);

    const handleAnalisar = async () => {
        if (!companyUrl) {
            message.warning("Insira a URL da empresa para analisar.");
            return;
        }

        setIsScraping(true);
        setResult(null); // Clear previous results to trigger skeletons
        
        const WEBHOOK_URL = "https://n8n-n8n-start.hup4p9.easypanel.host/webhook/12b95c4f-2c92-4f20-b16a-f2e9a1364ab8";

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    site_url: companyUrl,
                    company_id: activeCompanyId
                })
            });

            if (!response.ok) {
                throw new Error(response.status === 404 || response.status === 500 
                    ? "ERRO_CONEXAO" 
                    : "Falha desconhecida");
            }
            
            const data = await response.json();
            setResult(data);
            message.success("Inteligência competitiva extraída com sucesso!");
        } catch (err: any) {
            console.error('[Antygraviti BI Error]:', err);
            if (err.message === "ERRO_CONEXAO") {
                message.error("⚠️ Falha na conexão com o Scraper. Verifique se a URL está ativa ou tente novamente em instantes.");
            } else {
                message.error("⚠️ Ocorreu um erro ao processar o BI. Tente novamente.");
            }
        } finally {
            setIsScraping(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        if (!text || text === "Não encontrado") return;
        navigator.clipboard.writeText(text);
        message.success(`${label} copiado!`);
    };

    return (
        <div className="space-y-6">
            <Card className="p-6 border-border bg-primary border-primary shadow-xl rounded-3xl text-primary-foreground overflow-hidden relative group">
                <div className="absolute -top-10 -right-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Globe size={200} />
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-primary-foreground/10 rounded-xl backdrop-blur-md">
                            <ShieldCheck size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">BI Context Engine</span>
                    </div>

                    <h4 className="text-xl font-bold mb-2">Análise de Empresa</h4>
                    <p className="text-primary-foreground/70 text-xs leading-relaxed mb-6 font-medium">
                        Insira a URL da empresa ou concorrente para extrair DNA estratégico e dados de contato.
                    </p>

                    <div className="flex flex-col gap-3">
                        <Input 
                            placeholder="https://empresa-concorrente.com.br" 
                            className="bg-primary-foreground/10 border-primary-foreground/20 text-white placeholder:text-white/40 h-11 rounded-xl focus:ring-1 focus:ring-white/30"
                            value={companyUrl}
                            onChange={(e) => setCompanyUrl(e.target.value)}
                            onPressEnter={handleAnalisar}
                        />
                        <Button 
                            className="w-full h-11 rounded-xl font-bold border-none bg-primary-foreground text-primary shadow-lg transform active:scale-95 transition-all"
                            onClick={handleAnalisar}
                            loading={isScraping}
                        >
                            {isScraping ? 'Analisando...' : 'Analisar Empresa'}
                        </Button>
                    </div>
                </div>
            </Card>

            <AnimatePresence mode="wait">
                {(isScraping || result) && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="space-y-4"
                    >
                        {/* Contact Data Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4 border-border bg-card shadow-lg rounded-2xl relative overflow-hidden group">
                                {isScraping ? (
                                    <div className="animate-pulse space-y-2">
                                        <div className="h-3 w-16 bg-muted rounded" />
                                        <div className="h-4 w-24 bg-muted/50 rounded" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                                            <MessageCircle size={12} className="text-emerald-500" /> WhatsApp
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={cn(
                                                "text-xs font-mono font-bold truncate",
                                                result?.whatsapp === "Não encontrado" ? "opacity-40 italic" : "text-foreground"
                                            )}>
                                                {result?.whatsapp || "—"}
                                            </span>
                                            {result?.whatsapp && result.whatsapp !== "Não encontrado" && (
                                                <Tooltip title="Copiar WhatsApp">
                                                    <Copy 
                                                        size={14} 
                                                        className="text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                                                        onClick={() => copyToClipboard(result.whatsapp!, 'WhatsApp')}
                                                    />
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>

                            <Card className="p-4 border-border bg-card shadow-lg rounded-2xl relative overflow-hidden group">
                                {isScraping ? (
                                    <div className="animate-pulse space-y-2">
                                        <div className="h-3 w-16 bg-muted rounded" />
                                        <div className="h-4 w-24 bg-muted/50 rounded" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                                            <Mail size={12} className="text-blue-500" /> E-mail
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={cn(
                                                "text-xs font-mono font-bold truncate",
                                                result?.email === "Não encontrado" ? "opacity-40 italic" : "text-foreground"
                                            )}>
                                                {result?.email || "—"}
                                            </span>
                                            {result?.email && result.email !== "Não encontrado" && (
                                                <Tooltip title="Copiar E-mail">
                                                    <Copy 
                                                        size={14} 
                                                        className="text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                                                        onClick={() => copyToClipboard(result.email!, 'E-mail')}
                                                    />
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </div>

                        {/* Analysis Block */}
                        <Card className="p-6 border-border bg-card shadow-xl rounded-3xl relative overflow-hidden group min-h-[200px]">
                            <div className="flex items-center justify-between mb-4 sticky top-0 bg-card/80 backdrop-blur-md py-2 z-10 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-amber-500" />
                                    <span className="font-black text-[10px] uppercase tracking-[0.2em] text-foreground">Bloco de Inteligência</span>
                                </div>
                                {!isScraping && result?.analise_ia && (
                                    <Tooltip title="Copiar BI">
                                        <Copy 
                                            size={14} 
                                            className="text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                                            onClick={() => copyToClipboard(result.analise_ia!, 'BI Report')}
                                        />
                                    </Tooltip>
                                )}
                            </div>

                            {isScraping ? (
                                <div className="space-y-4 p-2 animate-pulse">
                                    <div className="h-3 w-full bg-muted rounded" />
                                    <div className="h-3 w-5/6 bg-muted/70 rounded" />
                                    <div className="h-3 w-4/6 bg-muted/40 rounded" />
                                    <div className="h-3 w-full bg-muted rounded" />
                                    <div className="h-3 w-2/3 bg-muted/60 rounded" />
                                </div>
                            ) : (
                                <motion.div 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }} 
                                    className="prose prose-sm dark:prose-invert text-foreground max-w-none font-medium leading-relaxed whitespace-pre-wrap"
                                >
                                    {result?.analise_ia ? (
                                        <ReactMarkdown>
                                            {result.analise_ia.replace(/\\n/g, '\n')}
                                        </ReactMarkdown>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-30">
                                            <AlertCircle size={32} strokeWidth={1} />
                                            <p className="text-xs mt-2 uppercase font-black tracking-widest">Aguardando Processamento</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
