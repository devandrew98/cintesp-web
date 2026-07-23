import { Construction } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'

/**
 * Placeholder das sub-telas de Administração ainda não construídas
 * (Funções, Áreas, Instituições, Configurações). Mantém a barra de abas
 * para a navegação ficar consistente com a tela de Usuários.
 */
export function AdminEmConstrucao({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <AdminShell>
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <Construction className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
        <p className="max-w-md text-sm text-slate-500">
          Esta seção da Administração entra na {fase}. A navegação e o layout já funcionam.
        </p>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {fase}
        </span>
      </div>
    </AdminShell>
  )
}
