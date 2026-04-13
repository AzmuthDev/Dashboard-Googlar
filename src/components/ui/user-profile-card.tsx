import { User, ArrowUpRight, ShieldCheck, Briefcase, Camera, Key, Trash2, Edit3, Crown } from 'lucide-react';
import { motion, type Transition } from 'framer-motion';

const transition: Transition = { type: 'spring', stiffness: 300, damping: 30 };

const summaryTextVariants = { collapsed: { opacity: 1, y: 0 }, expanded: { opacity: 0, y: -16 } };
const actionTextVariants = { collapsed: { opacity: 0, y: 16 }, expanded: { opacity: 1, y: 0 } };

interface UserProfileCardProps {
    name: string;
    email: string;
    role: string;
    accountLevel: string;
    avatarUrl?: string;
    isCollapsed?: boolean; // Controls whether plain avatar is shown
    isCurrentUser?: boolean;
    isAdminUser?: boolean;
    onEditPhoto?: () => void;
    onEditPassword?: () => void;
    onEditProfile?: () => void;
    onEditUser?: () => void;
    onDelete?: () => void;
}

export const UserProfileCard = ({
    name, email, role, accountLevel, avatarUrl, isCollapsed,
    isCurrentUser, isAdminUser, onEditPhoto, onEditPassword, onEditProfile, onEditUser, onDelete
}: UserProfileCardProps) => {

    // Se a sidebar estiver colapsada, renderizamos apenas o avatar simples
    if (isCollapsed) {
        return (
            <div className="flex justify-center p-4">
                <div className="relative">
                    <img
                        src={avatarUrl || "/owl-fallback.png"}
                        alt={name}
                        className="size-10 rounded-full border border-border object-cover bg-card"
                    />
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-background" />
                </div>
            </div>
        );
    }

    const infoRows = [
        { label: 'Cargo', value: role, Icon: Briefcase },
        { label: 'Nível', value: accountLevel, Icon: ShieldCheck },
    ];

    return (
        <motion.div
            className="bg-muted/30 p-3 rounded-2xl w-full max-w-[260px] mx-auto space-y-3"
            initial="collapsed"
            whileHover="expanded"
        >
            <motion.div
                layout="position"
                transition={transition}
                className="bg-card border border-border rounded-xl px-4 py-4 shadow-sm"
            >
                <div className="flex items-center gap-3">
                    <div className="relative group cursor-pointer" onClick={onEditPhoto}>
                        <img
                            src={avatarUrl || "/owl-fallback.png"}
                            alt={name}
                            className="size-11 rounded-full border border-border object-cover bg-background transition-opacity group-hover:opacity-75"
                        />
                        {onEditPhoto && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="size-4 text-white" />
                            </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-sm font-semibold text-foreground truncate">{name}</h1>
                        <p className="text-xs text-muted-foreground font-medium truncate">{email}</p>
                    </div>
                </div>

                <motion.div
                    variants={{
                        collapsed: { height: 0, opacity: 0, marginTop: 0 },
                        expanded: { height: 'auto', opacity: 1, marginTop: '16px' }
                    }}
                    transition={{ staggerChildren: 0.1, ...transition }}
                    className="overflow-hidden"
                >
                    {infoRows.map(({ label, value, Icon }) => (
                        <motion.div
                            key={label}
                            variants={{ collapsed: { opacity: 0, y: 10 }, expanded: { opacity: 1, y: 0 } }}
                            transition={transition}
                            className="mt-3 first:mt-0"
                        >
                            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                                <div className='flex items-center gap-1.5'><Icon className='size-3.5 text-primary' /> {label}</div>
                            </div>
                            <div className="text-sm text-foreground font-medium bg-muted/50 px-2.5 py-1.5 rounded-md truncate">
                                {value}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </motion.div>

            <div className="flex items-center gap-2 px-1">
                <div className={`size-6 rounded-full flex items-center justify-center flex-shrink-0 ${isAdminUser ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                    {isAdminUser ? <Crown className="size-3.5" /> : <User className="size-3.5" />}
                </div>
                <span className="grid flex-1">
                    <motion.span className="text-xs font-medium text-muted-foreground row-start-1 col-start-1" variants={summaryTextVariants}>
                        {isCurrentUser ? 'Meu Perfil' : 'Gerenciar Usuário'}
                    </motion.span>

                    {/* Action Buttons Container */}
                    <motion.div
                        className="flex items-center gap-2 row-start-1 col-start-1"
                        variants={actionTextVariants}
                    >
                        {isCurrentUser && onEditProfile && (
                            <button onClick={onEditProfile} className="text-xs font-medium text-primary flex items-center gap-1 cursor-pointer select-none group focus:outline-none">
                                Editar Perfil <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                            </button>
                        )}
                        {!isCurrentUser && onEditPassword && (
                            <button onClick={onEditPassword} className="p-1 rounded hover:bg-muted text-amber-500 transition-colors" title="Mudar Senha">
                                <Key className="size-3.5" />
                            </button>
                        )}
                        {onEditUser && !isCurrentUser && (
                            <button onClick={onEditUser} className="p-1 rounded hover:bg-muted text-blue-500 transition-colors" title="Editar Usuário / Nível">
                                <Edit3 className="size-3.5" />
                            </button>
                        )}
                        {onDelete && !isCurrentUser && (
                            <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors" title="Remover Acesso">
                                <Trash2 className="size-3.5" />
                            </button>
                        )}
                    </motion.div>
                </span>
            </div>
        </motion.div>
    );
}
