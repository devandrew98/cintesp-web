import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePermissoes } from '@/hooks/usePermissoes'

/**
 * Protege a plataforma de quem ainda é "Participante" (conta recém-criada,
 * aguardando um admin definir a função). Esses usuários só podem abrir chamado,
 * então caem em /abrir-chamado até serem liberados.
 *
 * Sem Supabase (modo mock puro), libera tudo.
 */
export function RequireLiberado({ children }: { children: ReactNode }) {
  const { carregando, podeUsarPlataforma } = usePermissoes()

  if (!supabase) return <>{children}</>

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!podeUsarPlataforma) {
    return <Navigate to="/abrir-chamado" replace />
  }

  return <>{children}</>
}
