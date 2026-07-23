import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'

interface PlaceholderProps {
  title: string
  fase: string
  descricao: string
}

export function Placeholder({ title, fase, descricao }: PlaceholderProps) {
  return (
    <div>
      <PageHeader title={title} subtitle={descricao} />
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <Construction className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Tela planejada para a {fase}
        </h3>
        <p className="max-w-md text-sm text-slate-500">
          Esta seção já está prevista no roadmap. O layout, a navegação e o tema
          (claro/escuro) já funcionam — o conteúdo desta página entra na fase indicada.
        </p>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {fase}
        </span>
      </div>
    </div>
  )
}
