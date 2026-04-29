import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

  const fetchProfile = useCallback(async (userId: string, userEmail: string): Promise<AuthorizedUser | null> => {
    // Retry logic: tenta até 3 vezes com delay progressivo
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (error || !data) {
          console.warn(`[AuthContext] Tentativa ${attempt}/3 - Perfil não encontrado:`, error?.message)
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt * 500)) // 500ms, 1000ms
            continue
          }
          return null
        }

        return {
          id: data.id,
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
        console.error(`[AuthContext] Tentativa ${attempt}/3 - Erro:`, err)
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 500))
          continue
        }
        return null
      }
    }
    return null
  }, [])

  // --- Recuperação de sessão ao voltar para a aba ---
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[AuthContext] Tab ficou visível — revalidando sessão...')
        try {
          const { data: { session: freshSession } } = await supabase.auth.getSession()
          
          if (freshSession?.user) {
            setSession(freshSession)
            setUser(freshSession.user)
            
            // Se o perfil não está carregado, tenta buscar de novo
            if (!profile) {
              const prof = await fetchProfile(freshSession.user.id, freshSession.user.email ?? '')
              if (prof) setProfile(prof)
            }
          }
        } catch (err) {
          console.error('[AuthContext] Erro ao revalidar sessão:', err)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [profile, fetchProfile])

  // --- Inicialização ---
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
        // Primeiro tenta refreshar o token (garante validade após F5)
        const { data: refreshData } = await supabase.auth.refreshSession()
        const activeSession = refreshData?.session

        // Se o refresh falhar, tenta getSession como fallback
        const finalSession = activeSession || (await supabase.auth.getSession()).data.session

        if (!mounted) return

        if (!finalSession) {
          console.log('[AuthContext] Nenhuma sessão ativa encontrada.')
          return
        }

        setSession(finalSession)
        setUser(finalSession.user)

        if (finalSession.user) {
          const prof = await fetchProfile(finalSession.user.id, finalSession.user.email ?? '')
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
  }, [fetchProfile])

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

      if (error) {
        if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
          return { error: 'E-mail ou senha incorretos. Tente novamente.' }
        }
        if (error.message.includes('Email not confirmed')) {
          return { error: 'E-mail pendente de confirmação.' }
        }
        return { error: error.message }
      }

      // Sincroniza o perfil imediatamente após o login
      if (data?.user) {
        const prof = await fetchProfile(data.user.id, data.user.email ?? '')
        if (prof) setProfile(prof)
      }

      return { error: null }
    } catch (err) {
      console.error('[Auth] Erro ao entrar:', err)
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
