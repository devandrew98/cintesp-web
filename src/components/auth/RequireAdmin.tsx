import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react'
import { usePermissoes } from '@/hooks/usePermissoes'

/**
 * Protege as telas de ADMINISTRAÇÃO.
 *
 * Só quem tem a permissão `gerenciar_tudo` (Administrador) entra. Quem não
 * tem vê um aviso claro de acesso restrito, em vez de uma tela quebrada ou
 * de erros ao tentar salvar.
 *
 * Isto é a camada de conforto/UX. A barreira de verdade está no banco (RLS),
 * que recusa a gravação mesmo que alguém chame a API diretamente.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { ehAdmin, carregando } = usePermissoes()

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!ehAdmin) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Acesso restrito
        </h2>
        <p className="max-w-md text-sm text-slate-500">
          Esta área é exclusiva de administradores. Se você precisa de acesso, peça a um
          administrador para alterar a sua função em <strong>Administração &gt; Usuários</strong>.
        </p>
        <Link
          to="/"
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
