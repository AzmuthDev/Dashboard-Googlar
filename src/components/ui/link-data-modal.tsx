import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { X, Link2, FileSpreadsheet, UploadCloud, AlertCircle, CheckCircle2 } from 'lucide-react';
import { message } from 'antd';
import { carregarDados } from '../../utils/dataIngestion';
import { syncCampaignTermsToSupabase } from '../../utils/supabaseSync';
import { cn } from '../../lib/utils';
import type { Company } from '../../types';

interface LinkDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: string | null;
    companyName: string;
    onSuccess: () => void;
}

export function LinkDataModal({ isOpen, onClose, companyId, companyName, onSuccess }: LinkDataModalProps) {
    const [activeTab, setActiveTab] = useState<'sheets' | 'local'>('sheets');
    const [sheetsUrl, setSheetsUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'fetching' | 'syncing' | 'done'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isOpen && companyId) {
            // Force reset ALL local states!
            setSheetsUrl('');
            setUploadProgress(0);
            setIsUploading(false);

            const storedCompanies = JSON.parse(localStorage.getItem('googlar_companies') || '[]');
            const company = storedCompanies.find((c: Company) => c.id === companyId);
            
            if (company && company.sheetsUrl) {
                setSheetsUrl(company.sheetsUrl);
                setActiveTab('sheets');
            } else if (company && company.dataSourceType === 'local') {
                setActiveTab('local');
            } else {
                setActiveTab('sheets');
            }
        }
    }, [isOpen, companyId]);

    const handleSaveSheets = async () => {
        if (!sheetsUrl.trim() || !sheetsUrl.includes('docs.google.com/spreadsheets')) {
            message.error("Por favor, insira uma URL válida do Google Sheets.");
            return;
        }

        if (!companyId) return;

        try {
            // 1. Salvar URL da empresa no localStorage
            const storedCompanies = JSON.parse(localStorage.getItem('googlar_companies') || '[]');
            const updatedCompanies = storedCompanies.map((c: Company) => {
                if (c.id === companyId) {
                    return { ...c, sheetsUrl: sheetsUrl.trim(), dataSourceType: 'sheets' };
                }
                return c;
            });
            localStorage.setItem('googlar_companies', JSON.stringify(updatedCompanies));
            window.dispatchEvent(new Event('googlar_companies_updated'));

            // 2. Buscar dados do Sheets
            setSyncStatus('fetching');
            setIsUploading(true);
            setUploadProgress(20);

            const parsedData = await carregarDados(sheetsUrl.trim(), 'sheets', companyId);
            setUploadProgress(50);

            // 3. Sincronizar com o Supabase
            setSyncStatus('syncing');
            setUploadProgress(60);

            const syncResult = await syncCampaignTermsToSupabase(companyId, parsedData);
            setUploadProgress(100);
            setSyncStatus('done');

            if (syncResult.success) {
                message.success(`${syncResult.count} termos sincronizados com o banco de dados!`);
            } else {
                message.warning(`Sheets vinculado, mas erro ao sincronizar: ${syncResult.error}`);
            }

            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
                setSyncStatus('idle');
                onSuccess();
                onClose();
            }, 1000);

        } catch (error: any) {
            setIsUploading(false);
            setUploadProgress(0);
            setSyncStatus('idle');
            message.error(`Erro ao vincular planilha: ${error.message}`);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !companyId) return;

        if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            message.error("Formato inválido. Use .csv ou .xlsx");
            return;
        }

        setIsUploading(true);
        setSyncStatus('fetching');
        setUploadProgress(20);

        try {
            const parsedData = await carregarDados(file, 'local', companyId);
            setUploadProgress(50);

            // Salva no localStorage
            localStorage.setItem(`googlar_local_data_${companyId}`, JSON.stringify({
                fileName: file.name,
                updatedAt: new Date().toISOString(),
                data: parsedData
            }));

            const storedCompanies = JSON.parse(localStorage.getItem('googlar_companies') || '[]');
            const updatedCompanies = storedCompanies.map((c: Company) => {
                if (c.id === companyId) {
                    const { sheetsUrl, ...rest } = c;
                    return { ...rest, dataSourceType: 'local', localFileName: file.name };
                }
                return c;
            });
            localStorage.setItem('googlar_companies', JSON.stringify(updatedCompanies));
            window.dispatchEvent(new Event('googlar_companies_updated'));

            // Sincroniza com Supabase
            setSyncStatus('syncing');
            setUploadProgress(65);

            const syncResult = await syncCampaignTermsToSupabase(companyId, parsedData);
            setUploadProgress(100);
            setSyncStatus('done');

            if (syncResult.success) {
                message.success(`${syncResult.count} termos de ${file.name} sincronizados com o banco!`);
            } else {
                message.warning(`Arquivo processado, mas erro ao sincronizar: ${syncResult.error}`);
            }
            
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
                setSyncStatus('idle');
                onSuccess();
                onClose();
            }, 800);

        } catch (error: any) {
            setIsUploading(false);
            setUploadProgress(0);
            setSyncStatus('idle');
            message.error(`Falha no upload: ${error.message}`);
        }
    };

    // Modal Background and Container Animation Variants
    const overlayVariants = {
        hidden: { opacity: 0, backdropFilter: "blur(0px)" },
        visible: { opacity: 1, backdropFilter: "blur(8px)", transition: { duration: 0.3 } },
        exit: { opacity: 0, backdropFilter: "blur(0px)", transition: { duration: 0.2 } }
    };

    const modalVariants: Variants = {
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", damping: 25, stiffness: 300 } },
        exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60"
                    />

                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                            <div>
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Link2 className="w-5 h-5 text-emerald-500" />
                                    Vincular Fonte de Dados
                                </h3>
                                <p className="text-sm text-zinc-400 mt-1">
                                    Conectando dados para: <strong className="text-white">{companyName}</strong>
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 -mr-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-zinc-800/80 bg-zinc-900/30">
                            <button
                                onClick={() => setActiveTab('sheets')}
                                className={cn(
                                    "flex-1 py-3.5 text-sm font-medium transition-all flex items-center justify-center gap-2 relative",
                                    activeTab === 'sheets' ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <Link2 className="w-4 h-4" />
                                Google Sheets
                                {activeTab === 'sheets' && (
                                    <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('local')}
                                className={cn(
                                    "flex-1 py-3.5 text-sm font-medium transition-all flex items-center justify-center gap-2 relative",
                                    activeTab === 'local' ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Arquivo Local
                                {activeTab === 'local' && (
                                    <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500" />
                                )}
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <AnimatePresence mode="wait">
                                {activeTab === 'sheets' ? (
                                    <motion.div
                                        key="sheets"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-4"
                                    >
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-300">URL Pública da Planilha</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Link2 className="h-4 w-4 text-zinc-500" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={sheetsUrl}
                                                    onChange={(e) => setSheetsUrl(e.target.value)}
                                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-zinc-600"
                                                />
                                            </div>
                                            <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-zinc-400 leading-relaxed">
                                                    A planilha Google deve estar configurada com acesso <strong>"Qualquer pessoa com o link"</strong> para que o painel consiga ler os dados via CSV.
                                                </p>
                                            </div>
                                        </div>
                                        {isUploading && activeTab === 'sheets' && (
                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center justify-between text-xs text-zinc-400">
                                                    <span>
                                                        {syncStatus === 'fetching' && '🔄 Buscando dados da planilha...'}
                                                        {syncStatus === 'syncing' && '☁️ Sincronizando com o banco...'}
                                                        {syncStatus === 'done' && '✅ Concluído!'}
                                                    </span>
                                                    <span>{uploadProgress}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-emerald-500"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div className="pt-4 flex justify-end">
                                            <button
                                                onClick={onClose}
                                                disabled={isUploading}
                                                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleSaveSheets}
                                                disabled={isUploading}
                                                className="ml-3 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-lg shadow-emerald-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                                            >
                                                {isUploading ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        {syncStatus === 'fetching' ? 'Buscando...' : syncStatus === 'syncing' ? 'Sincronizando...' : 'Concluindo...'}
                                                    </>
                                                ) : 'Vincular Planilha'}
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="local"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-4"
                                    >
                                        <div 
                                            className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-900/30 hover:bg-zinc-900/50 rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center cursor-pointer group relative overflow-hidden"
                                            onClick={() => !isUploading && fileInputRef.current?.click()}
                                        >
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileUpload}
                                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                                className="hidden"
                                            />
                                            
                                            {isUploading ? (
                                                <div className="flex flex-col items-center w-full max-w-[240px]">
                                                    {syncStatus === 'done' ? (
                                                        <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-full border-4 border-zinc-800 border-t-emerald-500 animate-spin mb-4" />
                                                    )}
                                                    <p className="text-sm font-medium text-zinc-300 mb-2">
                                                        {syncStatus === 'fetching' && 'Lendo arquivo...'}
                                                        {syncStatus === 'syncing' && 'Sincronizando com banco...'}
                                                        {syncStatus === 'done' && 'Concluído!'}
                                                    </p>
                                                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                        <motion.div 
                                                            className="h-full bg-emerald-500"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${uploadProgress}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-zinc-500 mt-2">{uploadProgress}%</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all duration-300">
                                                        <UploadCloud className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400" />
                                                    </div>
                                                    <p className="text-sm font-medium text-zinc-200 mb-1">
                                                        Clique ou arraste um arquivo
                                                    </p>
                                                    <p className="text-xs text-zinc-500">
                                                        Suporta .CSV ou .XLSX até 10MB
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                        <div className="pt-2 flex justify-end">
                                            <button
                                                onClick={onClose}
                                                disabled={isUploading}
                                                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
