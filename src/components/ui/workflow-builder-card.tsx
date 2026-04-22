import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "../../lib/utils";
import { Card } from "./card";
import { Badge } from "./badge";
import { AnimatedTooltip } from "./animated-tooltip";

export interface User {
    id: number;
    name: string;
    designation: string;
    image: string;
}

export interface Action {
    Icon: React.ElementType;
    bgColor?: string;
    isDanger?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    title?: string;
}

export interface WorkflowBuilderCardProps {
    imageUrl: string;
    logoUrl?: string;
    status: "Active" | "Inactive";
    lastUpdated: string;
    title: string;
    description: string;
    tags: string[];
    users: User[];
    actions: Action[];
    className?: string;
    onEnter?: () => void;
}

export const WorkflowBuilderCard = ({
    imageUrl,
    logoUrl,
    status,
    lastUpdated,
    title,
    description,
    tags,
    users,
    actions,
    className,
    onEnter
}: WorkflowBuilderCardProps) => {
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <motion.div
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn("w-full max-w-sm cursor-pointer", className)}
            onClick={onEnter}
        >
            <Card className="overflow-hidden rounded-2xl shadow-2xl transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] bg-[#050505] border-zinc-800/50 h-full flex flex-col group/card">
                {/* Card Image */}
                <div className="relative h-40 w-full flex-shrink-0 bg-zinc-900/50 flex items-center justify-center overflow-hidden">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-5xl font-black text-zinc-800">
                            {title.charAt(0)}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent pointer-events-none"></div>

                    {/* Floating Logo Profile */}
                    {logoUrl && (
                        <div className="absolute -bottom-6 left-6 h-16 w-16 rounded-2xl border-4 border-[#050505] bg-white flex items-center justify-center shadow-2xl z-20 overflow-hidden ring-1 ring-white/10">
                            <img src={logoUrl} alt={`${title} logo`} className="h-12 w-12 object-contain" />
                        </div>
                    )}
                </div>

                <div className={cn("px-6 pb-6 flex-1 flex flex-col", logoUrl ? "pt-10" : "pt-6")}>
                    {/* Always-visible header content */}
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                <span className="text-zinc-400">{lastUpdated}</span>
                                <span className="opacity-30">•</span>
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={cn(
                                            "h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                                            status === "Active" ? "bg-emerald-500 text-emerald-500" : "bg-red-500 text-red-500"
                                        )}
                                        aria-label={status}
                                    />
                                    <span className={status === "Active" ? "text-emerald-500/80" : "text-red-500/80"}>{status === "Active" ? "Online" : "Offline"}</span>
                                </div>
                            </div>
                            <h3 className="mt-2 text-2xl font-black text-white tracking-tighter leading-none">
                                {title}
                            </h3>
                        </div>
                    </div>

                    {/* Description and tags section */}
                    <div className="mt-4 space-y-4">
                        <p className="text-xs text-zinc-400 font-medium leading-relaxed line-clamp-2 italic opacity-80">
                            {description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {tags.map((tag) => (
                                <Badge key={tag} className="bg-white/5 text-white/60 border-white/10 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md hover:bg-white/10 hover:text-white transition-colors">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between border-t border-zinc-800/50 p-6 bg-white/[0.02] flex-shrink-0 mt-auto overflow-visible">
                    <div className="flex items-center">
                        <AnimatedTooltip items={users} />
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {actions.map(({ Icon, isDanger, onClick, title }, index) => (
                            <button
                                key={index}
                                onClick={onClick}
                                title={title}
                                className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 shadow-xl active:scale-90 ring-offset-2 ring-offset-[#050505] focus:ring-1",
                                    isDanger 
                                        ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                                        : "bg-white/5 border-white/10 text-white hover:bg-white hover:text-black"
                                )}
                            >
                                <Icon size={14} strokeWidth={2.5} />
                            </button>
                        ))}
                    </div>
                </div>
            </Card>
        </motion.div>
    );
};
