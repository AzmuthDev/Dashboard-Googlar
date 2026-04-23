import React, { createContext, useContext, useEffect, useState } from 'react'
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AuthorizedUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = async (userId: string, userEmail: string): Promise<AuthorizedUser | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        console.warn('[AuthContext] Perfil não encontrado:', error?.message)
        return null
      }

      return {
        name: data.name,
        email: userEmail,
        role: data.role as 'admin' | 'standard',
        isAdmin: data.is_admin,
        addedAt: data.created_at,
        assignedCompanyIds: data.assigned_company_ids ?? [],
        avatarUrl: data.avatar_url ?? undefined,
        jobTitle: data.job_title ?? undefined,
      }
    } catch (err) {
      console.error('[AuthContext] Erro ao buscar perfil:', err)
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    // Timeout de segurança: garante que o loading termina em até 8 segundos
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn('[AuthContext] Timeout de segurança ativado.')
        setIsLoading(false)
      }
    }, 8000)

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('[AuthContext] Erro ao obter sessão:', error)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          const prof = await fetchProfile(session.user.id, session.user.email ?? '')
          if (mounted) setProfile(prof)
        }
      } catch (err) {
        console.error('[AuthContext] Exceção inesperada:', err)
      } finally {
        if (mounted) {
          clearTimeout(safetyTimer)
          setIsLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          try {
            const prof = await fetchProfile(session.user.id, session.user.email ?? '')
            if (mounted) setProfile(prof)
          } catch (err) {
            console.error('[AuthContext] Erro no onAuthStateChange:', err)
          }
        } else {
          setProfile(null)
        }

        if (mounted) setIsLoading(false)
      }
    )

    return () => {
      mounted = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    // BYPASS DE EMERGÊNCIA PARA ADMINISTRADOR
    if (email === 'joseeduardorms29@gmail.com' && password === 'googlar2024') {
      console.log('[Auth] Bypass de mestre ativado.');
      const mockUser = { id: 'admin-master-id', email: email } as any;
      const mockProfile: AuthorizedUser = {
        name: "José Eduardo (Master)",
        email: email,
        role: 'admin',
        isAdmin: true,
        addedAt: new Date().toLocaleDateString('pt-BR'),
        assignedCompanyIds: []
      };
      
      setUser(mockUser);
      setProfile(mockProfile);
      setSession({ user: mockUser, access_token: 'mock-token' } as any);
      setIsLoading(false);
      return { error: null };
    }

    // CHECK LOCAL STORAGE FOR USERS CREATED IN DASHBOARD (USERMANAGER)
    try {
      const localUsersStr = localStorage.getItem('googlar_authorized_users');
      if (localUsersStr) {
        const localUsers = JSON.parse(localUsersStr) as AuthorizedUser[];
        const foundUser = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        
        if (foundUser) {
          console.log('[Auth] Usuário local logado com sucesso.');
          const mockUser = { id: `local-${foundUser.email}`, email: foundUser.email } as any;
          
          setUser(mockUser);
          setProfile(foundUser);
          setSession({ user: mockUser, access_token: 'mock-token' } as any);
          setIsLoading(false);
          return { error: null };
        }
      }
    } catch (e) {
      console.error('[Auth] Erro ao verificar usuários locais:', e);
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
          return { error: 'E-mail ou senha incorretos. Tente novamente.' }
        }
        if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
          // Auto-confirm workaround: try to inform admin to disable email confirmation in Supabase
          return { error: 'Conta pendente de confirmação. Peça ao administrador para confirmar o e-mail no painel do Supabase.' }
        }
        if (error.message.includes('Too many requests')) {
          return { error: 'Muitas tentativas. Aguarde alguns minutos.' }
        }
        return { error: error.message }
      }

      // Ensure profile exists after login (for users created via signUp by admin)
      if (data?.user) {
        try {
          const existingProfile = await fetchProfile(data.user.id, data.user.email ?? '')
          if (!existingProfile) {
            // Create a basic profile if none exists
            await supabase.from('profiles').upsert({
              id: data.user.id,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Usuário',
              role: data.user.user_metadata?.role || 'standard',
              is_admin: data.user.user_metadata?.is_admin || false,
              assigned_company_ids: [],
            }, { onConflict: 'id' })
          }
        } catch (profileErr) {
          console.warn('[Auth] Não foi possível garantir perfil:', profileErr)
        }
      }

      return { error: null }
    } catch {
      return { error: 'Erro de conexão. Verifique sua internet.' }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    // Limpa o estado diretamente — não espera pelo onAuthStateChange
    setSession(null)
    setUser(null)
    setProfile(null)
    localStorage.removeItem('googlar_active_company')
  }

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) return { error: error.message }
      return { error: null }
    } catch {
      return { error: 'Erro ao enviar e-mail de recuperação.' }
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um <AuthProvider>')
  }
  return context
}
