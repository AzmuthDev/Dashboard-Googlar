import { useState } from 'react';
import { 
    Search, Wand2, TrendingUp, Plus, 
     Zap, Globe, Lightbulb, ShieldCheck, Copy
} from 'lucide-react';
import { Input, Button, Table, message, Tooltip, Progress } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { Card } from './ui/card';
import ReactMarkdown from 'react-markdown';
import { AntygravitiBI } from './AntygravitiBI';

// --- Types ---
interface KeywordSuggestion {
    id: string;
    term: string;
    volume: number;
    trend: 'up' | 'down' | 'stable';
    intent: 'Informacional' | 'Transacional' | 'Navegacional' | 'Comercial';
    cpc: number;
    kd: number; // Keyword Difficulty
}

export function KeywordPlanner({ activeCompanyId }: { activeCompanyId?: string | null }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<KeywordSuggestion[]>([]);

    const handleSearch = async () => {
        if (!searchQuery) return;
        setIsLoading(true);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const mockResults: KeywordSuggestion[] = [
                { id: '1', term: `${searchQuery} premium`, volume: 1200, trend: 'up', intent: 'Comercial', cpc: 4.5, kd: 45 },
                { id: '2', term: `comprar ${searchQuery}`, volume: 850, trend: 'stable', intent: 'Transacional', cpc: 6.2, kd: 62 },
                { id: '3', term: `melhor ${searchQuery} 2024`, volume: 2100, trend: 'up', intent: 'Informacional', cpc: 1.8, kd: 32 },
                { id: '4', term: `${searchQuery} b2b`, volume: 450, trend: 'stable', intent: 'Comercial', cpc: 8.9, kd: 75 },
                { id: '5', term: `como usar ${searchQuery}`, volume: 3200, trend: 'down', intent: 'Informacional', cpc: 0.5, kd: 15 },
            ];
            setResults(mockResults);
        } catch (err) {
            message.error("Erro ao buscar sugestões.");
        } finally {
            setIsLoading(false);
        }
    };

    const columns = [
        {
            title: 'Palavra-Chave',
            dataIndex: 'term',
            key: 'term',
            render: (text: string) => (
                <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{text}</span>
                    <Tooltip title="Copiar">
                        <Copy 
                            size={12} 
                            className="cursor-pointer text-muted-foreground hover:text-foreground" 
                            onClick={() => {
                                navigator.clipboard.writeText(text);
                                message.success("Copiado!");
                            }}
                        />
                    </Tooltip>
                </div>
            )
        },
        {
            title: 'Volume',
            dataIndex: 'volume',
            key: 'volume',
            render: (v: number) => <span className="font-mono text-xs text-foreground">{v.toLocaleString('pt-BR')}</span>
        },
        {
            title: 'Intenção',
            dataIndex: 'intent',
            key: 'intent',
            render: (intent: string) => {
                const colors: any = {
                    'Informacional': 'bg-blue-500/10 text-blue-500',
                    'Transacional': 'bg-emerald-500/10 text-emerald-500',
                    'Navegacional': 'bg-purple-500/10 text-purple-500',
                    'Comercial': 'bg-amber-500/10 text-amber-500',
                };
                return (
                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider", colors[intent])}>
                        {intent}
                    </span>
                );
            }
        },
        {
            title: 'CPC (R$)',
            dataIndex: 'cpc',
            key: 'cpc',
            render: (v: number) => <span className="text-xs font-bold text-foreground">R$ {v.toFixed(2)}</span>
        },
        {
            title: 'Dificuldade (KD)',
            dataIndex: 'kd',
            key: 'kd',
            render: (kd: number) => (
                <div className="flex items-center gap-2 min-w-[80px]">
                    <span className="text-[10px] font-bold text-muted-foreground">{kd}%</span>
                    <Progress 
                        percent={kd} 
                        size="small" 
                        showInfo={false} 
                        strokeColor={kd > 70 ? '#ef4444' : kd > 40 ? '#f59e0b' : '#10b981'}
                        trailColor="var(--muted)"
                    />
                </div>
            )
        },
        {
            title: '',
            key: 'actions',
            render: () => (
                <Button type="text" icon={<Plus size={16} className="text-primary" />} />
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-8 border-border bg-card shadow-xl rounded-3xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Search size={120} />
                        </div>
                        <div className="relative z-10">
                            <h1 className="text-3xl font-black uppercase tracking-tighter mb-4 text-foreground">
                                Planejador de Palavras
                            </h1>
                            <p className="text-muted-foreground text-sm mb-8 flex items-center gap-2">
                                <Zap size={14} className="text-primary" />
                                Encontre os termos que dominam o mercado e expanda seu gradil.
                            </p>
                            <div className="flex gap-3">
                                <Input 
                                    placeholder="Ex: 'advogado especialista em familia'..."
                                    size="large"
                                    className="h-14 rounded-2xl bg-muted border-border text-foreground font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onPressEnter={handleSearch}
                                />
                                <Button 
                                    type="primary" size="large" 
                                    className="h-14 px-8 rounded-2xl font-bold bg-primary text-primary-foreground border-none"
                                    onClick={handleSearch}
                                    loading={isLoading}
                                >
                                    Gerar Insights
                                </Button>
                            </div>
                        </div>
                    </Card>
                    <AnimatePresence mode="wait">
                        {results.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
                                <Card className="border-border bg-card shadow-xl rounded-3xl overflow-hidden">
                                    <div className="p-6 border-b border-border flex items-center justify-between">
                                        <h3 className="font-bold text-foreground flex items-center gap-2">
                                            <TrendingUp size={18} className="text-primary" />
                                            Oportunidades Encontradas
                                        </h3>
                                    </div>
                                    <Table dataSource={results} columns={columns} pagination={false} rowKey="id" rowClassName="hover:bg-muted/50 transition-colors" />
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="space-y-6">
                    <AntygravitiBI activeCompanyId={activeCompanyId} />
                </div>
            </div>
        </div>
    );
}
