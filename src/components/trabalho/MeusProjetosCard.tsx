import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { ProgressoBar } from '@/components/projetos/ProgressoBar'
import { listarProjetos } from '@/data/projetos'
import { usePermissoes } from '@/hooks/usePermissoes'
import type { ItemAfazer } from '@/lib/afazeres'
import { ehEquipeProjeto } from '@/lib/grupos'
import { statusProjetoInfo } from '@/lib/projetos'
import { formatDateOnlyBR } from '@/lib/utils'

/** Meus projetos (que criei ou em que estou vinculado): progresso e a próxima tarefa minha de cada um. */
export function MeusProjetosCard({ itens, className }: { itens: ItemAfazer[]; className?: string }) {
  const { perfil } = usePermissoes()
  const { data: projetos = [] } = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos })

  const meus = useMemo(() => projetos.filter((p) => ehEquipeProjeto(p, perfil?.id)).filter((p) => p.status !== 'concluido' && p.status !== 'cancelado'), [projetos, perfil?.id])
  const proxima = (projetoId: string) =>
    itens
      .filter((i) => i.projetoId === projetoId && i.status !== 'concluido')
      .sort((a, b) => (a.dataEntrega ?? '9999').localeCompare(b.dataEntrega ?? '9999'))[0]

  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-violet-500" />
          Meus projetos
        </span>
      }
      action={
        <Link to="/projetos" className="text-sm font-medium text-brand-600 hover:underline">
          Ver todos
        </Link>
      }
      bodyClassName="p-4"
    >
      {meus.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Você ainda não participa de nenhum projeto em andamento.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {meus.slice(0, 6).map((p) => {
            const prox = proxima(p.id)
            return (
              <Link key={p.id} to={`/projetos/${p.id}`} className="block min-w-0 rounded-xl border border-slate-200 p-3 transition-colors hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-brand-500/50 dark:hover:bg-slate-800/40">
                <p className="line-clamp-2 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{p.titulo}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{statusProjetoInfo[p.status].label}</p>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressoBar progresso={p.progresso} className="h-1.5" />
                  <span className="text-[11px] font-medium text-slate-500">{p.progresso}%</span>
                </div>
                <p className="mt-2 truncate text-xs text-slate-500">{prox ? `Próxima: ${prox.titulo}${prox.dataEntrega ? ` · ${formatDateOnlyBR(prox.dataEntrega)}` : ''}` : 'Sem tarefas suas em aberto'}</p>
              </Link>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
