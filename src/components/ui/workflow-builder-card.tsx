import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

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

    // Animation variants for the details section
    const detailVariants = {
        hidden: { opacity: 0, height: 0, marginTop: 0 },
        visible: {
            opacity: 1,
            height: "auto",
            transition: { duration: 0.3, ease: "easeOut" },
        },
    };

    return (
        <motion.div
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn("w-full max-w-sm cursor-pointer", className)}
            onClick={onEnter}
        >
            <Card className="overflow-hidden rounded-xl shadow-md transition-shadow duration-300 hover:shadow-xl bg-card border-border h-full flex flex-col">
                {/* Card Image */}
                <div className="relative h-36 w-full flex-shrink-0 bg-accent/30 flex items-center justify-center">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={title}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-muted-foreground/30">
                            {title.charAt(0)}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/10 to-transparent pointer-events-none"></div>

                    {/* Floating Logo Profile */}
                    {logoUrl && (
                        <div className="absolute -bottom-5 left-4 h-14 w-14 rounded-xl border-4 border-card bg-card overflow-hidden shadow-lg z-10 flex items-center justify-center isolate">
                            <img src={logoUrl} alt={`${title} logo`} className="h-full w-full object-contain" />
                        </div>
                    )}
                </div>

                <div className={cn("px-4 pb-4 flex-1 flex flex-col", logoUrl ? "pt-7" : "pt-4")}>
                    {/* Always-visible header content */}
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{lastUpdated}</span>
                                <span>•</span>
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={cn(
                                            "h-2 w-2 rounded-full",
                                            status === "Active" ? "bg-emerald-500" : "bg-red-500"
                                        )}
                                        aria-label={status}
                                    />
                                    <span>{status === "Active" ? "Ativa" : "Inativa"}</span>
                                </div>
                            </div>
                            <h3 className="mt-1 text-lg font-semibold text-card-foreground">
                                {title}
                            </h3>
                        </div>
                    </div>

                    {/* Animated description and tags section */}
                    <AnimatePresence>
                        {isHovered && (
                            <motion.div
                                key="details"
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                variants={detailVariants as any}
                                className="overflow-hidden"
                            >
                                <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {tags.map((tag) => (
                                        <Badge key={tag} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-transparent">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between border-t border-border p-4 bg-muted/20 flex-shrink-0 mt-auto overflow-visible">
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
                                    "flex h-8 w-8 items-center justify-center rounded-full border border-black dark:border-white transition-all shadow-sm hover:scale-105",
                                    isDanger 
                                        ? "bg-white dark:bg-black text-red-500 hover:bg-red-500 hover:text-white dark:hover:bg-red-500"
                                        : "bg-white dark:bg-black text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
                                )}
                            >
                                <Icon size={14} />
                            </button>
                        ))}
                    </div>
                </div>
            </Card>
        </motion.div>
    );
};
