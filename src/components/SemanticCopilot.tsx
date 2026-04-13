import { useState, useEffect, useRef } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import ReactMarkdown from 'react-markdown'
import { Button, Input, DatePicker, message, Skeleton } from 'antd'
import { Sparkles, Send, Calendar, Bot } from 'lucide-react'
import type { CampaignTerm } from '../types'
import { cn } from '../lib/utils'

const { RangePicker } = DatePicker

interface SemanticCopilotProps {
    data: CampaignTerm[]
}

interface Message {
    role: 'user' | 'assistant'
    content: string
}

export function SemanticCopilot({ data }: SemanticCopilotProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: '**Semantic Copilot Ativo.** Pronto para auditoria de tráfego e identificação de Deslizes Semânticos via Metodologia Guglar. Como posso analisar seus dados agora?' }
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [dateRange, setDateRange] = useState<[any, any] | null>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const getApiKey = () => localStorage.getItem('googlar_gemini_api_key')

    const runAiAnalysis = async (customPrompt?: string, filteredData?: CampaignTerm[]) => {
        const apiKey = getApiKey()
        if (!apiKey) {
            message.error("Chave de API do Gemini não configurada. Vá em 'Ferramentas' para configurar.")
            return
        }

        setIsLoading(true)
        try {
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

            const contextData = filteredData || data.slice(0, 50) // Limit context for safety
            const dataSummary = contextData.map(item => ({
                termo: item.search_term,
                custo: item.cost,
                cliques: item.clicks,
                conversoes: item.conversions,
                sugestao: item.suggestion_group
            }))

            const systemPrompt = `Você é o Semantic Copilot, um Especialista Sênior em Google Ads e Auditoria de Tráfego embutido no 'Googlar Dashboard'. Sua missão é analisar arrays de dados em JSON contendo Termos de Pesquisa e métricas (Custo, Cliques, CTR, Conversões) aplicando estritamente a Metodologia Guglar.
            Seu objetivo central é identificar o 'Deslize Semântico': O momento exato em que o leilão do Google associa uma palavra-chave comprada a um termo de busca do usuário com intenção divergente do core business do cliente, causando vazamento de budget (verba).

            Regras de Julgamento (Funil de Triagem Tripartite):
            1. Caça ao Clickbait Semântico: Identifique termos de pesquisa que possuem um CTR alto e Custo financeiro elevado, mas geraram 0 Conversões. Isso indica que o anúncio promete algo que a Landing Page não entrega. Destaque o valor exato desperdiçado.
            2. Desalinhamento de Core Business (Red Flag ❌): Busque por termos que denotam intenção fora do escopo comercial do cliente. Exemplos: intenção de gratuidade ('grátis', 'vagas', 'curso'), busca por peças de reposição baratas quando o cliente vende maquinário pesado, ou intenção B2C em campanhas B2B. Recomende a Negativação imediata.
            3. Termos Ambíguos (Yellow Flag ❓): Identifique buscas de 'Cauda Longa' (Long-tail) ou topo de funil (ex: 'como funciona', 'o que é'). Classifique-os como Dúvida, indicando que precisam de Validação Gerencial/Cliente para decidir se o branding compensa o clique.
            4. Oportunidades de Segmentação (Green Flag ✅): Encontre termos de alta relevância (exata correspondência com o negócio) que possuam bom volume de conversão ou cliques baratos, sugerindo que sejam extraídos para grupos de anúncios próprios para melhorar o Índice de Qualidade.

            DADOS ATUAIS (JSON): ${JSON.stringify(dataSummary)}

            Diretrizes de Resposta (Formato):
            - Nunca comece com saudações genéricas (ex: 'Olá! Aqui está a análise...'). Vá direto ao ponto de forma executiva e assertiva.
            - Formate sua resposta utilizando Markdown.
            - Utilize Tabelas para listar os 'Top Ofensores' (termos que mais gastaram sem converter).
            - Utilize Listas (Bullet points) para explicar o contexto dos Deslizes Semânticos encontrados.
            - Use um tom profissional, técnico e analítico, compatível com uma auditoria de alto padrão (Premium). Refira-se ao orçamento desperdiçado como 'Vazamento de Budget'.`

            const prompt = customPrompt || "Analise os padrões de desempenho nos dados fornecidos e identifique os 3 maiores deslizes semânticos."
            
            const result = await model.generateContent([systemPrompt, prompt])
            const response = await result.response
            const text = response.text()

            setMessages(prev => [...prev, { role: 'assistant', content: text }])
        } catch (error: any) {
            console.error("Gemini Error:", error)
            message.error("Erro ao processar consulta com a IA: " + error.message)
            setMessages(prev => [...prev, { role: 'assistant', content: "❌ **Erro:** Não consegui processar sua solicitação no momento. Verifique sua chave de API." }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleSendMessage = () => {
        if (!input.trim() || isLoading) return
        
        const userMsg = input.trim()
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])
        setInput('')
        
        runAiAnalysis(userMsg)
    }

    const handlePatternAnalysis = () => {
        // In a real app, we would filter 'data' by 'dateRange' here
        // For this implementation, we'll simulate the filter or use the provided data
        setMessages(prev => [...prev, { role: 'user', content: `Analisar padrões do período ${dateRange ? 'selecionado' : 'geral'}.` }])
        runAiAnalysis("Identifique os padrões de desperdício (Deslizes Semânticos) no conjunto de dados fornecido.")
    }

    return (
        <div className="flex flex-col h-full gap-4 text-foreground">
            {/* Seção Superior - Análise de Padrões */}
            <div className="flex flex-col gap-3 p-4 bg-muted/50 rounded-2xl border border-border">
                <div className="flex items-center gap-2 mb-1">
                    <Calendar size={16} className="text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Auditoria por Período</span>
                </div>
                <RangePicker 
                    className="w-full bg-background border-border" 
                    onChange={(val) => setDateRange(val as any)}
                />
                <Button 
                    className="btn-bw-inverse w-full font-bold h-10 border-none"
                    onClick={handlePatternAnalysis}
                    disabled={isLoading}
                    icon={<Sparkles size={16} />}
                >
                    Analisar Padrões no Período
                </Button>
            </div>

            {/* Seção Central - Chat / Respostas */}
            <div className="flex-1 overflow-y-auto px-2 space-y-4 min-h-0 custom-scrollbar">
                {messages.map((msg, i) => (
                    <div key={i} className={cn(
                        "flex gap-3 max-w-[90%]",
                        msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
                            msg.role === 'assistant' 
                                ? "bg-background border border-border text-foreground" 
                                : "bg-primary text-primary-foreground"
                        )}>
                            {msg.role === 'user' ? <div className="text-[10px] font-bold">EU</div> : <Bot size={16} />}
                        </div>
                        <div className={cn(
                            "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                            msg.role === 'user' 
                                ? "bg-primary text-primary-foreground rounded-tr-none shadow-lg" 
                                : "bg-card border border-border rounded-tl-none prose dark:prose-invert max-w-none text-card-foreground"
                        )}>
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 mr-auto max-w-[90%]">
                        <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border animate-pulse text-foreground">
                            <Bot size={16} />
                        </div>
                        <div className="p-4 bg-card border border-border rounded-2xl rounded-tl-none w-full space-y-2">
                            <Skeleton active paragraph={{ rows: 2 }} title={false} />
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Seção Inferior - Input de Chat */}
            <div className="pt-2 border-t border-border mt-auto">
                <div className="flex gap-2 bg-muted p-2 rounded-2xl border border-border focus-within:border-primary transition-all">
                    <Input 
                        placeholder="Pergunte qualquer coisa sobre a campanha..." 
                        variant="borderless"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPressEnter={handleSendMessage}
                        className="flex-1 text-foreground placeholder:text-muted-foreground"
                        disabled={isLoading}
                    />
                    <Button 
                        type="primary" 
                        shape="circle" 
                        icon={<Send size={18} />} 
                        onClick={handleSendMessage}
                        disabled={isLoading || !input.trim()}
                        className="border-none flex items-center justify-center h-10 w-10 shrink-0 shadow-md hover:scale-105 active:scale-95 transition-all bg-primary text-primary-foreground"
                    />
                </div>
            </div>
        </div>
    )
}
