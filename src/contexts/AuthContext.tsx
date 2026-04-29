import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AuthorizedUser } from '../types'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: AuthorizedUser | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Emails que sempre são admin (Fail-safe)
const MASTER_ADMINS = ['joseeduardorms29@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AuthorizedUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const initStartedRef = useRef(false)

  const fetchProfile = useCallback(async (userId: string, userEmail: string): Promise<AuthorizedUser | null> => {
    console.log(`[Auth] Iniciando busca de perfil para: ${userEmail}`);
    
    // Fallback imediato para Admin Master enquanto carrega
    const isMaster = MASTER_ADMINS.includes(userEmail.toLowerCase());

    try {
      // Timeout na própria query (se demorar mais de 4s, prossegue com fallback ou erro)
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na consulta')), 7000)
      );

      const { data, error } = await (Promise.race([profilePromise, timeoutPromise]) as any);

      if (error || !data) {
        console.warn(`[Auth] Perfil não encontrado no banco:`, error?.message);
        if (isMaster) {
           return { name: 'José Eduardo', email: userEmail, role: 'admin', isAdmin: true, addedAt: new Date().toISOString(), assignedCompanyIds: [] };
        }
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        email: userEmail,
        role: data.role as 'admin' | 'standard',
        isAdmin: data.is_admin || isMaster,
        addedAt: data.created_at,
        assignedCompanyIds: data.assigned_company_ids ?? [],
        avatarUrl: data.avatar_url ?? undefined,
        jobTitle: data.job_title ?? undefined,
      };
    } catch (err) {
      console.error(`[Auth] Erro ao buscar perfil:`, err);
      if (isMaster) {
         return { name: 'José Eduardo (Admin)', email: userEmail, role: 'admin', isAdmin: true, addedAt: new Date().toISOString(), assignedCompanyIds: [] };
      }
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const safetyTimer = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('[Auth] Timeout de segurança atingido. Liberando UI...');
        setIsLoading(false);
      }
    }, 6000);

    const initAuth = async () => {
      try {
        console.log('[Auth] Verificando sessão inicial...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          console.log('[Auth] Sessão recuperada com sucesso.');
          setSession(currentSession);
          setUser(currentSession.user);
          const prof = await fetchProfile(currentSession.user.id, currentSession.user.email ?? '');
          if (mounted) setProfile(prof);
        } else {
          console.log('[Auth] Nenhuma sessão ativa.');
        }
      } catch (err) {
        console.error('[Auth] Falha crítica na inicialização:', err);
      } finally {
        if (mounted) {
          clearTimeout(safetyTimer);
          setIsLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;
      console.log(`[Auth] Evento Supabase: ${event}`);

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      } else if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        if (!profile) {
          const prof = await fetchProfile(currentSession.user.id, currentSession.user.email ?? '');
          if (mounted) setProfile(prof);
        }
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile, profile, isLoading]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return { error: error.message };
      if (data?.user) {
        const prof = await fetchProfile(data.user.id, data.user.email ?? '');
        setProfile(prof);
      }
      return { error: null };
    } catch (err) {
      return { error: 'Erro de conexão.' };
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem('googlar_active_company');
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    return { error: error ? error.message : null };
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
}
