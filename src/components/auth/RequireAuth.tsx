import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'

/**
 * Protege as rotas do app.
 * - Sem Supabase (modo mock puro): libera tudo (não há login).
 * - Com Supabase: exige sessão; sem sessão, manda para /login.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, carregando } = useAuth()
  const location = useLocation()

  // Modo mock puro: nada a proteger.
  if (!supabase) return <>{children}</>

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
