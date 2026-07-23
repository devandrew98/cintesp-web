import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Contexto de autenticação (Supabase Auth).
 * Mantém a sessão/usuário atuais e expõe entrar/cadastrar/sair.
 * Em modo mock puro (sem chaves), o cliente é nulo: o contexto fica "aberto"
 * (sem sessão e sem carregamento) para o app rodar de exemplo normalmente.
 */
interface AuthContextValue {
  session: Session | null
  user: User | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<{ error?: string }>
  cadastrar: (email: string, senha: string, nome: string) => Promise<{ error?: string }>
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // Só "carrega" de verdade quando há Supabase (busca a sessão salva).
  const [carregando, setCarregando] = useState<boolean>(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    // 1) Recupera a sessão persistida ao abrir o app.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })
    // 2) Escuta login/logout/refresh de token.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function entrar(email: string, senha: string) {
    if (!supabase) return {}
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    return { error: error?.message }
  }

  async function cadastrar(email: string, senha: string, nome: string) {
    if (!supabase) return {}
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } }, // usado pelo gatilho para criar o perfil
    })
    return { error: error?.message }
  }

  async function sair() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, carregando, entrar, cadastrar, sair }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
