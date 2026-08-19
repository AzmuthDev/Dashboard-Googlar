import React, { useState } from 'react';
import { useAuditoriaLSA } from '../hooks/useAuditoriaLSA';
import type { AuditoriaLSA } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Mic, HeadsetIcon, Tag, XCircle, FileText, ChevronRight } from 'lucide-react';
import { Input, Modal, Spin } from 'antd';

interface AuditoriaLSAPageProps {
    activeCompanyId: string | null;
}

export function AuditoriaLSAPage({ activeCompanyId }: AuditoriaLSAPageProps) {
    const { data: audios, isLoading } = useAuditoriaLSA(activeCompanyId);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAudio, setSelectedAudio] = useState<AuditoriaLSA | null>(null);

    const filteredAudios = (audios || []).filter(audio => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            (audio.termos_pesquisa || []).some(t => t.toLowerCase().includes(searchLower)) ||
            (audio.palavras_negativas || []).some(t => t.toLowerCase().includes(searchLower)) ||
            audio.lead_id.toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <HeadsetIcon className="w-8 h-8 text-primary" />
                        Auditoria LSA
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Acompanhe e audite os leads e áudios gerados pelas campanhas de Local Services Ads.
                    </p>
                </div>
                <div className="w-72">
                    <Input
                        prefix={<Search className="text-muted-foreground w-4 h-4" />}
                        placeholder="Buscar por termo ou lead..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-card border-border rounded-xl px-4 py-2"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <Spin size="large" />
                    <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Carregando áudios...</p>
                </div>
            ) : filteredAudios.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-3xl mt-8">
                    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-6">
                        <Mic className="text-2xl text-muted-foreground" />
                    </div>
                    <h2 className="text-2xl font-black uppercase text-foreground mb-4">Nenhum áudio encontrado</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                        {searchTerm 
                            ? 'Sua busca não retornou nenhum resultado. Tente outros termos.'
                            : 'Esta empresa ainda não possui áudios LSA processados no sistema.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredAudios.map((audio) => (
                        <div key={audio.id} className="bg-card border border-border rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ID do Lead</span>
                                    <p className="font-mono text-sm text-foreground mt-0.5">{audio.lead_id}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data</span>
                                    <p className="text-sm font-medium text-foreground mt-0.5">
                                        {format(new Date(audio.created_at), "dd MMM, yyyy", { locale: ptBR })}
                                    </p>
                                </div>
                            </div>

                            <div className="mb-5 bg-background rounded-xl p-3 border border-border">
                                <audio controls className="w-full h-10" src={audio.url_audio}>
                                    Seu navegador não suporta o elemento de áudio.
                                </audio>
                            </div>

                            <div className="flex-1 space-y-4">
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Tag className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-xs font-bold text-foreground">Termos Identificados</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(audio.termos_pesquisa || []).length > 0 ? (
                                            audio.termos_pesquisa.map((t, i) => (
                                                <span key={i} className="px-2 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-md text-[11px] font-medium">
                                                    {t}
                                                </span>
                                            ))
                                        ) : <span className="text-xs text-muted-foreground">-</span>}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                                        <span className="text-xs font-bold text-foreground">Palavras Negativas</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(audio.palavras_negativas || []).length > 0 ? (
                                            audio.palavras_negativas.map((t, i) => (
                                                <span key={i} className="px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md text-[11px] font-medium">
                                                    {t}
                                                </span>
                                            ))
                                        ) : <span className="text-xs text-muted-foreground">-</span>}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedAudio(audio)}
                                className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 bg-accent hover:bg-accent/80 text-foreground text-sm font-bold rounded-xl transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                                Ver Transcrição & Insights
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                title={
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <HeadsetIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground m-0">Insights do Áudio</h3>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-black">Lead: {selectedAudio?.lead_id}</p>
                        </div>
                    </div>
                }
                open={!!selectedAudio}
                onCancel={() => setSelectedAudio(null)}
                footer={null}
                width={700}
                className="googlar-modal"
                closeIcon={<span className="text-muted-foreground hover:text-foreground text-xl">×</span>}
            >
                {selectedAudio && (
                    <div className="py-4 space-y-8">
                        <div>
                            <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                                <ChevronRight className="w-4 h-4" /> Transcrição
                            </h4>
                            <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                {selectedAudio.transcricao || <span className="text-muted-foreground italic">Nenhuma transcrição disponível para este áudio.</span>}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-3 flex items-center gap-2">
                                <ChevronRight className="w-4 h-4" /> Segmentação Sugerida (IA)
                            </h4>
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                {selectedAudio.segmentacao_sugerida || <span className="text-muted-foreground italic">Nenhum insight de segmentação gerado.</span>}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
