import * as React from "react";
import { cn } from "@/lib/utils";
import { Settings, LogOut, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AuthorizedUser } from "../../types";

interface Profile extends AuthorizedUser {
    avatar?: string;
    subscription?: string;
    model?: string;
}

interface MenuItem {
    label: string;
    value?: string;
    onClick?: () => void;
    icon: React.ReactNode;
    external?: boolean;
}

interface ProfileDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
    data: Profile;
    onLogout?: () => void;
    isCollapsed?: boolean;
}

export function ProfileDropdown({
    data,
    onLogout,
    isCollapsed,
    className,
    ...props
}: ProfileDropdownProps) {
    const isAdmin = data.role === 'admin';
    const [, setIsOpen] = React.useState(false);

    // We mock menu items based on the context of Googlar Dashboard
    const menuItems: MenuItem[] = [
        {
            label: isAdmin ? "Configurações" : "Meu Perfil",
            icon: <User className="w-4 h-4" />,
            onClick: () => { window.location.hash = isAdmin ? '#gerenciar-acessos' : '#meu-perfil' }
        },
        {
            label: isAdmin ? "Administrador" : "Usuário Padrão",
            value: isAdmin ? "PRO" : "TEAM",
            icon: <Settings className="w-4 h-4" />
        }
    ];

    if (isCollapsed) {
        return (
            <div className={cn("relative flex justify-center", className)} {...props}>
                <DropdownMenu onOpenChange={setIsOpen}>
                    <DropdownMenuTrigger asChild>
                        <button type="button" className="relative group focus:outline-none focus:ring-2 focus:ring-primary rounded-full">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-sky-400 to-cyan-300 p-0.5 shadow-sm transition-transform hover:scale-105">
                                <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 flex items-center justify-center">
                                    {data.avatar ? (
                                        <img src={data.avatar} alt={data.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="size-5 text-zinc-400" />
                                    )}
                                </div>
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="start" sideOffset={14} className="w-56 p-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50">
                        <DropdownMenuItem disabled className="px-3 py-2 border-b border-zinc-800/60 flex flex-col items-start gap-1">
                            <span className="text-sm font-medium text-zinc-100">{data.name}</span>
                            <span className="text-xs text-zinc-400">{data.email}</span>
                        </DropdownMenuItem>
                        <div className="py-1">
                            {menuItems.map((item) => (
                                <DropdownMenuItem key={item.label} onSelect={item.onClick} className="flex items-center gap-2 p-2 px-3 hover:bg-zinc-800 rounded-lg cursor-pointer group">
                                    <div className="text-zinc-400 group-hover:text-zinc-200 transition-colors">{item.icon}</div>
                                    <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100">{item.label}</span>
                                    {item.value && (
                                        <span className="ml-auto text-[10px] font-semibold tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
                                            {item.value}
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </div>
                        <DropdownMenuSeparator className="bg-zinc-800" />
                        <DropdownMenuItem onSelect={onLogout} className="flex items-center gap-2 p-2 px-3 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer group mt-1">
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm font-medium">Sair do Painel</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        )
    }

    return (
        <div className={cn("relative", className)} {...props}>
            <DropdownMenu onOpenChange={setIsOpen}>
                <div className="group relative">
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-transparent border border-transparent hover:border-zinc-800 hover:bg-zinc-800/50 transition-all duration-200 focus:outline-none"
                        >
                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                <div className="relative shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-sky-400 to-cyan-300 p-[2px]">
                                        <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 flex items-center justify-center">
                                            {data.avatar ? (
                                                <img src={data.avatar} alt={data.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="size-5 text-zinc-400" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <div className="text-sm font-medium text-zinc-100 tracking-tight leading-tight truncate">
                                        {data.name}
                                    </div>
                                    <div className="text-xs text-zinc-400 tracking-tight leading-tight truncate">
                                        {data.email}
                                    </div>
                                </div>
                            </div>
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        side="top"
                        align="start"
                        sideOffset={8}
                        className="w-[260px] p-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-[999] 
                    data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 origin-bottom-left"
                    >
                        <div className="space-y-1">
                            {menuItems.map((item) => (
                                <DropdownMenuItem key={item.label} onSelect={item.onClick} className="flex items-center p-2.5 px-3 hover:bg-zinc-800 rounded-lg transition-all duration-200 cursor-pointer group focus:bg-zinc-800 outline-none">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                            {item.icon}
                                        </div>
                                        <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                                            {item.label}
                                        </span>
                                    </div>
                                    <div className="flex-shrink-0 ml-auto">
                                        {item.value && (
                                            <span className="text-[10px] font-semibold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 py-0.5 px-1.5 tracking-wider uppercase">
                                                {item.value}
                                            </span>
                                        )}
                                    </div>
                                </DropdownMenuItem>
                            ))}
                        </div>

                        <DropdownMenuSeparator className="my-2 bg-zinc-800" />

                        <DropdownMenuItem
                            onSelect={() => { onLogout?.() }}
                            className="flex items-center gap-3 p-2.5 px-3 bg-red-500/5 hover:bg-red-500/15 rounded-lg cursor-pointer group focus:bg-red-500/15 outline-none transition-all duration-200"
                        >
                            <LogOut className="w-4 h-4 text-red-500 group-hover:text-red-400 transition-colors" />
                            <span className="text-sm font-medium text-red-500 group-hover:text-red-400 transition-colors">
                                Sair do Painel
                            </span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </div>
            </DropdownMenu>
        </div>
    );
}
