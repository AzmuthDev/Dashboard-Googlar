import * as React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Settings2, Link, Trash2, Pencil } from "lucide-react";
import { cn } from "../../lib/utils";
import { WorkflowBuilderCard } from "./workflow-builder-card";

export interface CompanyData {
    id: string;
    name: string;
    spreadsheetStatus: "Arquivo Vinculado" | "Sheet Vinculado" | "Não vinculada" | "Vinculada";
    users: { name: string, email: string, role?: string }[];
    usersCount: number;
    isActive: boolean;
    logoUrl?: string;
    coverUrl?: string;
}

interface CompanyCardsProps {
    title: string;
    companies: CompanyData[];
    className?: string;
    isAdmin: boolean;
    onManageAccess?: (id: string) => void;
    onConnectSheet?: (id: string) => void;
    onAccessCompany?: (id: string) => void;
    onDeleteCompany?: (id: string) => void;
    onEditCompany?: (id: string) => void;
}

export const CompanyCards = React.forwardRef<HTMLDivElement, CompanyCardsProps>(
    ({ title, companies, className, isAdmin, onManageAccess, onConnectSheet, onAccessCompany, onDeleteCompany, onEditCompany }, ref) => {
        const scrollContainerRef = React.useRef<HTMLDivElement>(null);
        const [canScroll, setCanScroll] = React.useState({ left: false, right: true });

        const checkScroll = () => {
            const container = scrollContainerRef.current;
            if (container) {
                setCanScroll({
                    left: container.scrollLeft > 0,
                    right: container.scrollLeft < container.scrollWidth - container.clientWidth - 1,
                });
            }
        };

        const scroll = (direction: "left" | "right") => {
            const container = scrollContainerRef.current;
            if (container) {
                const amount = container.clientWidth * 0.8;
                container.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
            }
        };

        React.useEffect(() => {
            checkScroll();
            const container = scrollContainerRef.current;
            if (container) {
                container.addEventListener("scroll", checkScroll);
                return () => container.removeEventListener("scroll", checkScroll);
            }
        }, [companies]);

        if (companies.length === 0) {
            return (
                <div className="w-full p-8 text-center border border-border bg-card rounded-2xl flex flex-col items-center justify-center">
                    <div className="h-12 w-12 text-muted-foreground/50 mb-4 bg-muted/20 flex items-center justify-center rounded-xl">0</div>
                    <h3 className="text-lg font-medium text-foreground">Ainda não há empresas disponíveis.</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {isAdmin ? "Clique em 'Nova Empresa' para adicionar uma base." : "Você ainda não possui acesso a nenhuma empresa no momento."}
                    </p>
                </div>
            )
        }

        return (
            <div ref={ref} className={cn("w-full py-4", className)}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        {title}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </h2>
                    <div className="flex items-center gap-2">
                        {canScroll.left && (
                            <button onClick={() => scroll("left")} className="p-2 rounded-full border border-black dark:border-white bg-white dark:bg-black hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                        )}
                        <button 
                            onClick={() => scroll("right")} 
                            className="p-2 rounded-full border border-black dark:border-white bg-white dark:bg-black hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors" 
                            disabled={!canScroll.right} 
                            style={{ opacity: canScroll.right ? 1 : 0.3 }}
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div ref={scrollContainerRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
                    <motion.div className="flex flex-nowrap gap-6 py-4 px-2">
                        {(() => {
                            const storedUsers = (() => {
                                try { return JSON.parse(localStorage.getItem('googlar_authorized_users') || '[]'); }
                                catch { return []; }
                            })();

                            return companies.map((company) => {
                                const usersArray = (company.users || []).slice(0, 5).map((u, idx) => {
                                    const realUser = Array.isArray(storedUsers) ? storedUsers.find((su: any) => su.email?.toLowerCase() === u.email?.toLowerCase()) : null;
                                    const name = u.name || u.email?.split('@')[0] || 'Usuário';
                                    const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
                                    return {
                                        id: idx + 1,
                                        name: name,
                                        designation: u.role === 'admin' ? "Administrador" : u.role === 'editor' ? "Editor" : "Usuário Base",
                                        image: realUser?.avatarUrl || fallbackImage
                                    };
                                });

                                const actions = [];
                                if (isAdmin) {
                                    actions.push({ Icon: Link, title: "Vincular Planilha", onClick: (e: any) => { e.stopPropagation(); onConnectSheet?.(company.id); } });
                                    actions.push({ Icon: Pencil, title: "Editar Perfil", onClick: (e: any) => { e.stopPropagation(); onEditCompany?.(company.id); } });
                                    actions.push({ Icon: Settings2, title: "Gerenciar Acessos", onClick: (e: any) => { e.stopPropagation(); onManageAccess?.(company.id); } });
                                    actions.push({ Icon: Trash2, isDanger: true, title: "Excluir Empresa", onClick: (e: any) => { e.stopPropagation(); onDeleteCompany?.(company.id); } });
                                }

                                return (
                                    <motion.div
                                        key={company.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex-shrink-0 snap-center"
                                    >
                                        <WorkflowBuilderCard
                                            imageUrl={company.coverUrl || company.logoUrl || ""}
                                            logoUrl={company.logoUrl}
                                            title={company.name}
                                            status={company.isActive ? "Active" : "Inactive"}
                                            lastUpdated={company.spreadsheetStatus}
                                            description={company.spreadsheetStatus.includes("Vinculado") ? "Base de dados ativa e conectada ao fluxo." : "Não conectada. Vincule uma planilha Google."}
                                            tags={["Base", company.spreadsheetStatus]}
                                            users={usersArray}
                                            actions={actions}
                                            onEnter={() => onAccessCompany?.(company.id)}
                                        />
                                    </motion.div>
                                );
                            });
                        })()}
                    </motion.div>
                </div>
            </div>
        );
    }
);
