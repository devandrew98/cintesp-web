import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { listarAvisos } from '@/data/api'

/** Os avisos ativos mais recentes. */
export function AvisosRecentes({ className }: { className?: string }) {
  const { data: avisos = [] } = useQuery({ queryKey: ['avisos'], queryFn: listarAvisos })
  const ativos = avisos.filter((a) => a.status === 'ativo').slice(0, 4)

  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-slate-500" />
          Avisos
        </span>
      }
      action={
        <Link to="/avisos" className="text-sm font-medium text-brand-600 hover:underline">
          Ver todos
        </Link>
      }
      bodyClassName="p-2"
    >
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {ativos.length === 0 && <p className="px-2 py-8 text-center text-sm text-slate-400">Nenhum aviso no momento.</p>}
        {ativos.map((a) => (
          <Link to="/avisos" key={a.id} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <Megaphone className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{a.titulo}</p>
              <p className="line-clamp-1 text-xs text-slate-400">{a.descricao}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">{a.publicadoHa}</span>
          </Link>
        ))}
      </div>
    </SectionCard>
  )
}
