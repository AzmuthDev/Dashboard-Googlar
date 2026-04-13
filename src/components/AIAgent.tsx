"use client"

import React, { useState, useRef, useEffect } from "react"
import { Send, Image as ImageIcon, Sparkles, User, Bot, Trash2, Paperclip, Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { cn } from "../lib/utils"
import { message } from "antd"

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
    image?: string
}

interface AIAgentProps {
    dashboardData?: any;
}

export function AIAgent({ dashboardData }: AIAgentProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: "assistant",
            content: "Antygraviti - Data Observer Ativo. Analisando o fluxo de dados em tempo real. Como posso auxiliar na interpretação métrica hoje?",
            timestamp: new Date()
        }
    ])
    const [inputValue, setInputValue] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const [attachedImage, setAttachedImage] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isTyping])

    useEffect(() => {
        const handleConfigUpdate = () => {
            message.success("Antygraviti: Motor de IA reiniciado com nova configuração.");
            // Reset welcome message or clear errors if needed
        };
        window.addEventListener('googlar_ai_config_updated', handleConfigUpdate);
        return () => window.removeEventListener('googlar_ai_config_updated', handleConfigUpdate);
    }, []);

    const handleSendMessage = async () => {
        if (!inputValue.trim() && !attachedImage) return

        const apiKey = localStorage.getItem('googlar_gemini_api_key');
        
        if (!apiKey) {
            const errorMsg: ChatMessage = {
                id: Date.now().toString(),
                role: "assistant",
                content: "⚠️ Erro de Autenticação: Nenhuma chave de API detectada no campo de configuração. Por favor, insira sua Gemini API Key na aba 'Configurações' para ativar o Agente.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, { id: 'user_' + Date.now(), role: 'user', content: inputValue, timestamp: new Date() }, errorMsg]);
            setInputValue("");
            return;
        }

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: inputValue,
            timestamp: new Date(),
            image: attachedImage || undefined
        }

        setMessages(prev => [...prev, userMsg])
        setInputValue("")
        setAttachedImage(null)
        setIsTyping(true)

        try {
            // Masked key for internal log reference (Security Protocol)
            const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
            console.log(`[Antygraviti Core] Safe Mode Handshake with masked key: ${maskedKey}`);

            // Prepare Antygraviti Core Payload (Direct Dashboard Grounding)
            const systemInstruction = `
              IDENTIDADE: Você é o Antygraviti, o motor de IA nativo deste Dashboard. 
              Sua prioridade é a VERDADE DOS DADOS. Você é uma camada de inteligência de dados, não um chatbot genérico.

              DATA GROUNDING: Toda resposta deve ser baseada no bloco [DADOS_DASHBOARD] abaixo. 

              [DADOS_DASHBOARD]: ${JSON.stringify(dashboardData || "Nenhum dado de tela disponível no momento.")}

              PROIBIÇÃO DE ALUCINAÇÃO: Nunca use números de exemplo. Use apenas os números reais fornecidos.
              PREFIXO OBRIGATÓRIO: "Analisando os dados atuais no dashboard, identifiquei que..."
            `;

            // Safe Mode: Consolidate prompt to handle v1/v1beta differences
            const fullPrompt = `${systemInstruction}\n\nUSUÁRIO: ${userMsg.content}`;

            const payload = {
                contents: [
                    {
                        parts: [
                            { text: fullPrompt }
                        ]
                    }
                ]
            };

            // Multimodal Support: Add image if attached
            if (attachedImage) {
                const base64Data = attachedImage.split(',')[1];
                const mimeType = attachedImage.split(';')[0].split(':')[1];
                payload.contents[0].parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                } as any);
                console.log(`[Antygraviti Core] Multimodal input detected in Safe Mode (MIME: ${mimeType})`);
            }

            // URL Universal v1 para Máxima Compatibilidade
            const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.error) {
                const errorDetail = data.error.message || JSON.stringify(data.error);
                throw new Error(`Erro da API: ${errorDetail}`);
            }

            if (!response.ok) {
                let errorType = "Erro de Conexão";
                if (response.status === 401) errorType = "⚠️ Chave de API inválida ou expirada.";
                if (response.status === 429) errorType = "⚠️ Limite de cota (Quota) atingido.";
                if (response.status >= 500) errorType = "⚠️ Instabilidade nos servidores do Google.";
                
                throw new Error(errorType);
            }

            const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "O servidor retornou uma resposta vazia.";

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: aiResponse,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, aiMsg])

        } catch (error: any) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: error.message || "Falha na conexão com a ponte Antygraviti.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setIsTyping(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setAttachedImage(reader.result as string)
                message.info("Imagem anexada para análise multimodal.")
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <div className="flex flex-col h-[600px] bg-card rounded-2xl border border-border overflow-hidden shadow-2xl relative transition-all duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30 backdrop-blur-md z-10 transition-all">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg transition-all">
                        <Sparkles className="w-5 h-5 text-primary-foreground animate-pulse" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-foreground leading-none">Googlar Copilot</h4>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1 block">Multimodal Admin Agent</span>
                    </div>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setMessages([messages[0]])}
                    className="text-muted-foreground hover:text-destructive transition-colors hover:bg-destructive/10"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            {/* Chat Messages */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
            >
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={cn(
                            "flex gap-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                            msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                        )}
                    >
                        <div className={cn(
                            "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center shadow-sm transition-all",
                            msg.role === "user" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                        )}>
                            {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className={cn(
                                "p-4 rounded-2xl text-sm leading-relaxed",
                                msg.role === "user" 
                                    ? "bg-primary text-primary-foreground shadow-lg" 
                                    : "bg-muted text-foreground rounded-tl-none border border-border",
                                msg.role === "user" ? "rounded-tr-none font-medium" : ""
                            )}>
                                {msg.image && (
                                    <div className="mb-3 rounded-lg overflow-hidden border border-zinc-800/50">
                                        <img src={msg.image} alt="Uploaded" className="max-w-full h-auto" />
                                    </div>
                                )}
                                {msg.content}
                            </div>
                            <span className={cn(
                                "text-[9px] font-bold text-muted-foreground uppercase tracking-tighter",
                                msg.role === "user" ? "text-right" : ""
                            )}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex gap-4 max-w-[80%]">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                            <Bot className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <div className="bg-muted p-4 rounded-2xl rounded-tl-none border border-border flex items-center gap-2 shadow-sm transition-all">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-medium">Analisando dados...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-6 pt-2 bg-gradient-to-t from-card via-card to-transparent transition-all">
                {attachedImage && (
                    <div className="mb-3 p-2 bg-muted rounded-xl border border-border flex items-center justify-between animate-in zoom-in duration-200 transition-all">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shadow-sm">
                                <img src={attachedImage} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Imagem pronta para análise</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setAttachedImage(null)} className="h-8 w-8 p-0 hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                )}
                <div className="relative group">
                    <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center gap-2 bg-muted border border-border p-2 pl-4 rounded-2xl focus-within:border-primary transition-all shadow-inner">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "text-muted-foreground hover:text-foreground transition-colors shrink-0 hover:bg-muted-foreground/10",
                                attachedImage ? "text-emerald-500" : ""
                            )}
                        >
                            <Paperclip className="w-4 h-4" />
                        </Button>
                        <Input
                            placeholder="Pergunte qualquer coisa ao Copilot..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                            className="border-none bg-transparent shadow-none focus-visible:ring-0 text-foreground px-0"
                        />
                        <Button 
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() && !attachedImage}
                            className="bg-primary text-primary-foreground rounded-xl px-5 h-10 font-bold hover:scale-105 active:scale-95 transition-all shadow-lg border-none"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            <span className="text-xs uppercase tracking-widest">Enviar</span>
                        </Button>
                    </div>
                </div>
                <div className="mt-3 flex items-center justify-center gap-4">
                    <div className="flex items-center gap-1.5 opacity-60">
                        <ImageIcon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Multimodal</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-border" />
                    <div className="flex items-center gap-1.5 opacity-60">
                        <Sparkles className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Gemini 1.5 Pro</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
