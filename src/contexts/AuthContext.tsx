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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AuthorizedUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const profileFetchedRef = useRef(false)

  const fetchProfile = useCallback(async (userId: string, userEmail: string): Promise<AuthorizedUser | null> => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (error || !data) {
          console.warn(`[Auth] Perfil tentativa ${attempt}/3:`, error?.message)
          if (attempt < 3) { await new Promise(r => setTimeout(r, attempt * 600)); continue }
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
        console.error(`[Auth] Perfil erro tentativa ${attempt}/3:`, err)
        if (attempt < 3) { await new Promise(r => setTimeout(r, attempt * 600)); continue }
        return null
      }
    }
    return null
  }, [])

  /**
   * Fluxo único de inicialização.
   * Usa APENAS onAuthStateChange — sem initAuth separado para evitar race conditions.
   * Quando há sessão armazenada (F5), o Supabase emite INITIAL_SESSION.
   * Forçamos um refreshSession() para garantir que o token está válido.
   */
  useEffect(() => {
    let mounted = true

    const safetyTimer = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('[Auth] Timeout de segurança — liberando UI.')
        setIsLoading(false)
      }
    }, 10000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, eventSession) => {
        if (!mounted) return
        console.log(`[Auth] Evento: ${event}`)

        let activeSession = eventSession

        // No F5, o evento INITIAL_SESSION traz o token armazenado que pode estar expirado.
        // Forçamos refresh para obter um token válido.
        if (event === 'INITIAL_SESSION' && eventSession) {
          try {
            const { data } = await supabase.auth.refreshSession()
            if (data?.session) {
              activeSession = data.session
            }
          } catch (e) {
            console.warn('[Auth] Refresh falhou, usando sessão armazenada:', e)
          }
        }

        setSession(activeSession)
        setUser(activeSession?.user ?? null)

        if (activeSession?.user && !profileFetchedRef.current) {
          profileFetchedRef.current = true
          const prof = await fetchProfile(activeSession.user.id, activeSession.user.email ?? '')
          if (mounted) setProfile(prof)
        } else if (!activeSession) {
          setProfile(null)
          profileFetchedRef.current = false
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

  // --- Recuperação ao voltar para a aba ---
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      console.log('[Auth] Tab visível — revalidando...')
      try {
        const { data } = await supabase.auth.refreshSession()
        if (data?.session) {
          setSession(data.session)
          setUser(data.session.user)
          if (!profile && data.session.user) {
            const prof = await fetchProfile(data.session.user.id, data.session.user.email ?? '')
            if (prof) setProfile(prof)
          }
        }
      } catch (e) {
        console.error('[Auth] Revalidação falhou:', e)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [profile, fetchProfile])

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials'))
          return { error: 'E-mail ou senha incorretos. Tente novamente.' }
        if (error.message.includes('Email not confirmed'))
          return { error: 'E-mail pendente de confirmação.' }
        return { error: error.message }
      }
      if (data?.user) {
        profileFetchedRef.current = true
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
    setSession(null)
    setUser(null)
    setProfile(null)
    profileFetchedRef.current = false
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
  if (context === undefined) throw new Error('useAuth deve ser usado dentro de um <AuthProvider>')
  return context
}
