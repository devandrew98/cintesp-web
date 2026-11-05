import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react'
import { usePermissoes } from '@/hooks/usePermissoes'

/**
 * Protege a área do "Pesquisador Avaliador" (solicitações, agenda, prontuários).
 * Só quem tem essa função/permissão entra — nem o administrador, por serem dados de saúde.
 * Camada de conforto: a barreira de verdade é a RLS do banco (`pode_avaliar()`).
 */
export function RequireAvaliador({ children }: { children: ReactNode }) {
  const { ehAvaliador, carregando } = usePermissoes()

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!ehAvaliador) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Acesso restrito</h2>
        <p className="max-w-md text-sm text-slate-500">
          Esta área é exclusiva do <strong>Pesquisador Avaliador</strong>. Se você precisa de acesso, peça a um
          administrador para ajustar a sua função em <strong>Administração &gt; Pesquisadores</strong>.
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
