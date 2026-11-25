import { Link } from 'react-router-dom'
import { Calendar, Check, FolderKanban } from 'lucide-react'
import type { ItemAfazer } from '@/lib/afazeres'
import { alternarConcluida, atrasada, infoPrioridade, infoStatus } from '@/lib/tarefas'
import { cn, formatDateOnlyBR } from '@/lib/utils'

/** Uma tarefa (pessoal ou de projeto) com caixa de marcar. Pessoal abre o editor; de projeto leva ao projeto. */
export function LinhaAfazer({
  item,
  hoje,
  onAlternar,
  onAbrir,
  mostrarData = true,
}: {
  item: ItemAfazer
  hoje: string
  onAlternar: (i: ItemAfazer) => void
  onAbrir: (i: ItemAfazer) => void
  mostrarData?: boolean
}) {
  const feita = item.status === 'concluido'
  const atraso = atrasada({ dataEntrega: item.dataEntrega, status: item.status }, hoje)
  const travada = Boolean(item.permitidos) && !item.permitidos!.includes(alternarConcluida(item.status))
  const corpo = (
    <>
      <span className={cn('block truncate text-sm font-medium', feita ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>{item.titulo}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {item.projetoTitulo && (
          <span className="inline-flex max-w-[220px] items-center gap-1 text-slate-400">
            <FolderKanban className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.projetoTitulo}</span>
          </span>
        )}
        {mostrarData && item.dataEntrega && (
          <span className={cn('inline-flex items-center gap-1', atraso ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400')}>
            <Calendar className="h-3 w-3" />
            {formatDateOnlyBR(item.dataEntrega)}
            {atraso && ' · atrasada'}
          </span>
        )}
        {!feita && item.status !== 'nao_iniciado' && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', infoStatus(item.status).pill)}>{infoStatus(item.status).label}</span>}
      </span>
    </>
  )
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <button
        type="button"
        disabled={travada}
        title={travada ? 'Só o responsável pelo projeto ou o administrador conclui esta tarefa' : undefined}
        onClick={() => onAlternar(item)}
        aria-label={feita ? `Reabrir ${item.titulo}` : `Concluir ${item.titulo}`}
        className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40', feita ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:border-brand-500 dark:border-slate-600')}
      >
        {feita && <Check className="h-3.5 w-3.5" />}
      </button>
      {item.origem === 'projeto' ? (
        <Link to={`/projetos/${item.projetoId}`} className="min-w-0 flex-1 hover:text-brand-600" title="Abrir o projeto">
          {corpo}
        </Link>
      ) : (
        <button type="button" onClick={() => onAbrir(item)} className="min-w-0 flex-1 text-left">
          {corpo}
        </button>
      )}
      {item.prioridade === 'alta' && !feita && <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', infoPrioridade('alta').pill)}>Alta</span>}
    </li>
  )
}
