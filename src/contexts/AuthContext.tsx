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

const MASTER_ADMINS = ['joseeduardorms29@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AuthorizedUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const initialized = useRef(false)

  const fetchProfile = useCallback(async (userId: string, userEmail: string): Promise<AuthorizedUser | null> => {
    console.log(`[Auth] Buscando perfil: ${userEmail}`);
    const isMaster = MASTER_ADMINS.includes(userEmail.toLowerCase());
    
    const fallbackAdmin: AuthorizedUser = { 
      name: 'José Eduardo', 
      email: userEmail, 
      role: 'admin', 
      isAdmin: true, 
      addedAt: new Date().toISOString(), 
      assignedCompanyIds: [] 
    };

    try {
      // Usamos um timeout manual de 5s para não travar o carregamento inicial
      const profilePromise = supabase.from('profiles').select('*').eq('id', userId).single();
      const timeoutPromise = new Promise((_, r) => setTimeout(() => r('timeout'), 5000));

      const result = await Promise.race([profilePromise, timeoutPromise]);

      if (result === 'timeout') {
        console.warn('[Auth] Timeout na busca do perfil.');
        return isMaster ? fallbackAdmin : null;
      }

      const { data, error } = result as any;

      if (error || !data) {
        console.warn(`[Auth] Perfil não encontrado: ${error?.message}`);
        return isMaster ? fallbackAdmin : null;
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
      console.error(`[Auth] Erro na busca de perfil:`, err);
      return isMaster ? fallbackAdmin : null;
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    console.log('[Auth] Inicializando AuthProvider...');

    // Escuta mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[Auth] Evento: ${event}`);
      
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        
        // Só busca perfil se ainda não tiver ou se for login/refresh
        const prof = await fetchProfile(currentSession.user.id, currentSession.user.email ?? '');
        setProfile(prof);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      
      setIsLoading(false);
    });

    // Verificação inicial forçada caso o onAuthStateChange demore
    const checkInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession && !user) {
          console.log('[Auth] Sessão inicial encontrada manualmente');
          setSession(initialSession);
          setUser(initialSession.user);
          const prof = await fetchProfile(initialSession.user.id, initialSession.user.email ?? '');
          setProfile(prof);
        }
      } catch (err) {
        console.error('[Auth] Erro ao checar sessão inicial:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkInitialSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, user]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      return { error: 'Erro de conexão.' };
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('googlar_active_company');
    } catch (err) {
      console.error('[Auth] Erro ao sair:', err);
    }
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
