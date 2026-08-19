import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e Anon Key são obrigatórios. Verifique o arquivo .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true, // Mantém sessão ativa entre trocas de aba e recarregamentos
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          role: 'admin' | 'standard'
          is_admin: boolean
          job_title: string | null
          avatar_url: string | null
          assigned_company_ids: string[] | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          role?: 'admin' | 'standard'
          is_admin?: boolean
          job_title?: string | null
          avatar_url?: string | null
          assigned_company_ids?: string[] | null
        }
        Update: {
          name?: string
          role?: 'admin' | 'standard'
          is_admin?: boolean
          job_title?: string | null
          avatar_url?: string | null
          assigned_company_ids?: string[] | null
        }
      }
    }
  }
}
