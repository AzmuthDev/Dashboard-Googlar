'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

interface LoginFormProps {
    onSubmit?: (email: string, password: string, remember: boolean) => void;
}

interface AnimatedBackgroundProps {
    className?: string;
}

interface FormInputProps {
    icon: React.ReactNode;
    type: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean;
}

interface ToggleSwitchProps {
    checked: boolean;
    onChange: () => void;
    id: string;
}

const VideoBackground = ({ videoUrl, className }: { videoUrl: string, className?: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 0.5;
        }
    }, [videoUrl]);

    return (
        <div className={`absolute inset-0 overflow-hidden z-0 ${className || ''}`}>
            <video
                ref={videoRef}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-x-0 w-[500%] left-[-200%] md:left-0 md:w-full h-full object-cover opacity-60 mix-blend-screen scale-[1.05]"
            >
                <source src={videoUrl} type="video/mp4" />
                Seu navegador não suporta a tag de vídeo.
            </video>
        </div>
    );
};

// FormInput Component
const FormInput: React.FC<FormInputProps> = ({ icon, type, placeholder, value, onChange, required }) => {
    return (
        <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                {icon}
            </div>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
                className="w-full pl-10 pr-3 py-3 bg-[#eef2f6] border border-transparent rounded-[10px] text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]"
            />
        </div>
    );
};

// ToggleSwitch Component
const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, id }) => {
    return (
        <div className="relative inline-block w-[36px] h-5 cursor-pointer">
            <input
                type="checkbox"
                id={id}
                className="sr-only"
                checked={checked}
                onChange={onChange}
            />
            <div className={`absolute inset-0 rounded-full transition-colors duration-200 ease-in-out ${checked ? 'bg-zinc-300' : 'bg-white/20'}`}>
                <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${checked ? 'transform translate-x-4 bg-zinc-900' : 'bg-white'}`} />
            </div>
        </div>
    );
};

// AnimatedBackground Component
const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ className }) => {
    return (
        <div className={`absolute inset-0 w-full h-full overflow-hidden bg-[#09090b] ${className || ''}`}>
            {/* Tech Grid Pattern */}
            <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
                backgroundSize: '40px 40px'
            }}></div>

            {/* Animated Glow Orbs removed for a cleaner cinematic earth look */}

            {/* Original Network Globe Video */}
            <VideoBackground videoUrl="/earth-network-globe.mp4" />

            <div className="absolute inset-0 bg-black/10 z-0 pointer-events-none" />
        </div>
    );
};

// Main LoginForm Component
const LoginForm: React.FC<LoginFormProps> = () => {
    const { signIn, resetPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [isResetLoading, setIsResetLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError(null);
        setIsSubmitting(true);

        const { error } = await signIn(email, password);

        if (error) {
            setLoginError(error);
            setIsSubmitting(false);
            return;
        }

        setIsSuccess(true);
        // O AuthContext detecta a sessão automaticamente — não precisamos fazer nada aqui.
        setIsSubmitting(false);
    };

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsResetLoading(true);

        const { error } = await resetPassword(resetEmail);

        if (error) {
            toast.error('Erro ao enviar e-mail', { description: error });
        } else {
            toast.success('Link enviado!', { 
                description: `Um e-mail de recuperação foi enviado para ${resetEmail}.` 
            });
            setTimeout(() => setIsForgotPassword(false), 2000);
        }
        setIsResetLoading(false);
    };

    if (isForgotPassword) {
        return (
            <div className="p-8 sm:p-10 rounded-[28px] backdrop-blur-xl bg-white/5 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-full max-w-[420px] mx-auto z-10 relative animate-in fade-in zoom-in duration-300">
                <div className="mb-10 text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                            <Lock className="text-white" size={32} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h3>
                    <p className="text-zinc-400 text-sm">Insira seu e-mail cadastrado para receber as instruções de reset.</p>
                </div>

                <form onSubmit={handleResetSubmit} className="space-y-6">
                    <FormInput
                        icon={<Mail className="text-zinc-500" size={18} />}
                        type="email"
                        placeholder="Seu e-mail profissional"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                    />

                    <button
                        type="submit"
                        disabled={isResetLoading}
                        className="w-full py-3.5 rounded-xl bg-white text-zinc-900 font-bold hover:bg-zinc-100 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isResetLoading ? 'Processando...' : 'Enviar Link de Reset'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsForgotPassword(false)}
                        className="w-full flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors py-2"
                    >
                        <ArrowLeft size={16} />
                        Voltar para o Login
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="p-8 sm:p-10 rounded-[28px] backdrop-blur-xl bg-white/5 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-full max-w-[420px] mx-auto z-10 relative">
            <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold mb-4 relative group flex justify-center">
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-white/40 blur-[40px] rounded-full z-0 pointer-events-none animate-pulse" style={{ animationDuration: '3s' }}></span>
                    <span className="relative flex justify-center items-center h-[90px] w-auto z-10">
                        <img src="/logo.png?v=2" alt="Googlar Logo" className="h-full w-auto object-contain drop-shadow-2xl" />
                    </span>
                </h2>
                <p className="flex flex-col items-center">
                    <span className="text-[15px] font-light text-[#E2E8F0] tracking-wide">Bem vindo ao Painel Googlar</span>
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <FormInput
                    icon={<Mail className="text-zinc-500" size={18} />}
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <div className="relative">
                    <FormInput
                        icon={<Lock className="text-zinc-500" size={18} />}
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div onClick={() => setRemember(!remember)} className="cursor-pointer">
                            <ToggleSwitch
                                checked={remember}
                                onChange={() => setRemember(!remember)}
                                id="remember-me"
                            />
                        </div>
                        <label
                            htmlFor="remember-me"
                            className="text-sm text-white/80 cursor-pointer hover:text-white transition-colors"
                            onClick={() => setRemember(!remember)}
                        >
                            Remember me
                        </label>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-sm text-white/80 hover:text-white transition-colors"
                    >
                        Forgot password?
                    </button>
                </div>

                {loginError && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-in fade-in duration-200">
                        <span>⚠️</span>
                        <span>{loginError}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-3.5 mt-2 rounded-xl transition-all duration-500 ease-in-out transform focus:outline-none focus:ring-2 focus:ring-white/30 font-medium tracking-wide ${isSuccess
                        ? 'animate-success text-white'
                        : isSubmitting
                            ? 'bg-gradient-to-b from-white to-[#e2e8f0] border border-white text-zinc-900 shadow-[0_0_40px_rgba(255,255,255,0.8),inset_0_2px_10px_rgba(255,255,255,1)] hover:scale-100 disabled:opacity-100 disabled:cursor-wait'
                            : 'bg-gradient-to-b from-[#2A2A2A] to-[#111111] border border-[#333333] text-white hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.5)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.5)]'
                        }`}
                >
                    {isSubmitting ? 'Entrando...' : 'Entrar no Googlar'}
                </button>
            </form>

        </div>
    );
};

// Export as default components
const LoginPage = {
    LoginForm,
    AnimatedBackground
};

export default LoginPage;
