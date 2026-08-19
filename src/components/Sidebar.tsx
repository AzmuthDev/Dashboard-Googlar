import { Layout, Avatar } from 'antd'
import {
    AppstoreOutlined,
    ToolOutlined,
    LineChartOutlined,
    SoundOutlined,
    TeamOutlined
} from '@ant-design/icons'
import { Wand2 } from 'lucide-react'
import { GlowingEffect } from './ui/glowing-effect'
import { cn } from '../lib/utils'

const { Sider } = Layout

type ViewKey = 'dashboard' | 'users' | 'semantic-audit' | 'keyword-planner';

interface NavItem {
    key: ViewKey | string;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
}

function SidebarNavItem({
    item,
    isActive,
    isDarkMode,
    onClick,
}: {
    item: NavItem;
    isActive: boolean;
    isDarkMode: boolean;
    onClick: () => void;
}) {
    return (
        <li className="relative list-none">
            {/* GlowingEffect only in light mode */}
            {!isDarkMode && (
                <GlowingEffect
                    spread={30}
                    glow={false}
                    disabled={false}
                    proximity={48}
                    inactiveZone={0.01}
                    borderWidth={1.5}
                />
            )}
            <button
                onClick={onClick}
                disabled={item.disabled}
                title={item.label}
                className={cn(
                    'relative w-full flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl transition-all duration-200 group',
                    'text-zinc-400 hover:text-zinc-900 dark:hover:text-white',
                    isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
                    item.disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
                )}
            >
                <span className={cn(
                    'text-[18px] transition-transform duration-200 group-hover:scale-110',
                    isActive && 'text-black dark:text-white'
                )}>
                    {item.icon}
                </span>
                <span className="text-[9px] font-semibold tracking-wide leading-tight text-center uppercase opacity-60 group-hover:opacity-100 max-w-[56px] truncate">
                    {item.label}
                </span>
                {/* Active indicator */}
                {isActive && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-black dark:bg-white rounded-full" />
                )}
            </button>
        </li>
    )
}

export function Sidebar({
    currentUser,
    onViewChange,
    currentView,
    isDarkMode,
}: {
    currentUser: { email: string; isAdmin: boolean } | null;
    onViewChange: (view: ViewKey) => void;
    currentView: ViewKey;
    isDarkMode?: boolean;
}) {
    const isAdmin = currentUser?.isAdmin
    const dark = isDarkMode ?? false

    const navItems: NavItem[] = [
        { key: 'dashboard',       icon: <AppstoreOutlined />, label: 'Dashboard' },
        { key: 'semantic-audit',  icon: <SoundOutlined />,    label: 'Auditoria' },
        { key: 'keyword-planner', icon: <Wand2 size={18} />,  label: 'Planejador' },
        { key: 'reports',         icon: <LineChartOutlined />, label: 'Relatórios', disabled: true },
        { key: 'ads',             icon: <ToolOutlined />,      label: 'Anúncios',  disabled: true },
        { key: 'users',           icon: <TeamOutlined />,      label: isAdmin ? 'Usuários' : 'Perfil' },
    ]

    const avatarSrc = "/owl-fallback.png"

    return (
        <Sider
            collapsed={true}
            collapsedWidth={80}
            theme={dark ? 'dark' : 'light'}
            style={{
                borderRight: dark ? '1px solid #27272a' : '1px solid #e4e4e7',
                display: 'flex',
                flexDirection: 'column',
                background: dark ? '#09090b' : '#ffffff',
            }}
        >
            {/* Logo */}
            <button
                onClick={() => onViewChange('dashboard')}
                className="w-full h-16 flex items-center justify-center font-black text-2xl text-black dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
                G
            </button>

            {/* Nav */}
            <nav className="flex-1 px-2 py-2 flex flex-col gap-1">
                <ul className="flex flex-col gap-1">
                    {navItems.map(item => (
                        <SidebarNavItem
                            key={item.key}
                            item={item}
                            isActive={currentView === item.key}
                            isDarkMode={dark}
                            onClick={() => {
                                if (!item.disabled && (
                                    item.key === 'dashboard' || 
                                    item.key === 'users' || 
                                    item.key === 'semantic-audit' || 
                                    item.key === 'keyword-planner'
                                )) {
                                    onViewChange(item.key as ViewKey)
                                }
                            }}
                        />
                    ))}
                </ul>
            </nav>

            {/* Avatar */}
            <div className="flex justify-center pb-6 pt-2">
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-full p-0.5">
                    <Avatar
                        size={38}
                        src={avatarSrc}
                        className="bg-zinc-100 dark:bg-zinc-800"
                    />
                </div>
            </div>
        </Sider>
    )
}
