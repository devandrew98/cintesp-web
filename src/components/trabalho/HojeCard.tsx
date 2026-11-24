import { useMemo, useState } from 'react'
import { CalendarCheck, MapPin, Video } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { LinhaAfazer } from '@/components/afazeres/LinhaAfazer'
import { TarefaPessoalModal } from '@/components/afazeres/TarefaPessoalModal'
import { useAbrirEvento } from '@/components/agenda/Programacao'
import type { ItemAfazer } from '@/lib/afazeres'
import { rotuloQuando, type Ocorrencia } from '@/lib/agendaEquipe'
import { cn } from '@/lib/utils'

/**
 * "Hoje": linha do tempo dos eventos do dia (dia inteiro primeiro, depois por horário) e,
 * logo abaixo, as tarefas com prazo hoje (ou atrasadas), que dá para marcar como feitas.
 */
export function HojeCard({
  ocorrencias,
  tarefas,
  hoje,
  onAlternar,
  aoSalvarTarefa,
  className,
}: {
  ocorrencias: Ocorrencia[]
  tarefas: ItemAfazer[]
  hoje: string
  onAlternar: (i: ItemAfazer) => void
  aoSalvarTarefa: () => void
  className?: string
}) {
  const { abrir, modais } = useAbrirEvento()
  const [editar, setEditar] = useState<ItemAfazer | null>(null)
  const agora = new Date()
  const hhmm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`

  const ordenadas = useMemo(
    () => [...ocorrencias].sort((a, b) => Number(Boolean(b.evento.diaInteiro)) - Number(Boolean(a.evento.diaInteiro)) || (a.evento.horaInicio ?? '').localeCompare(b.evento.horaInicio ?? '')),
    [ocorrencias],
  )
  const vazio = ordenadas.length === 0 && tarefas.length === 0

  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-brand-600" />
          Hoje
        </span>
      }
      action={<span className="text-sm text-slate-400">{ordenadas.length} evento(s) · {tarefas.length} tarefa(s)</span>}
      bodyClassName="p-4"
    >
      {vazio ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 py-10 text-center">
          <span className="text-3xl">☀️</span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Dia livre por aqui.</p>
          <p className="text-xs text-slate-400">Nenhum evento nem tarefa com prazo para hoje.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {ordenadas.length > 0 && (
            <ol className="relative space-y-3 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
              {ordenadas.map((o) => {
                const passou = !o.evento.diaInteiro && Boolean(o.evento.horaFim) && o.dataFim <= hoje && o.evento.horaFim! < hhmm
                const emCurso = !o.evento.diaInteiro && Boolean(o.evento.horaInicio) && o.evento.horaInicio! <= hhmm && (!o.evento.horaFim || o.evento.horaFim >= hhmm)
                return (
                  <li key={`${o.evento.id}|${o.data}`} className="relative">
                    <span className={cn('absolute -left-[22px] top-3 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-slate-900', emCurso ? 'bg-brand-500' : passou ? 'bg-slate-300 dark:bg-slate-600' : 'bg-violet-400')} />
                    <button type="button" onClick={() => abrir(o)} className={cn('block w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60', passou && 'opacity-60')}>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">{rotuloQuando(o)}</span>
                        {emCurso && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">agora</span>}
                        {o.evento.donoId && <span className="text-[11px] text-slate-400">meu evento</span>}
                      </span>
                      <span className="block break-words text-sm font-medium text-slate-800 dark:text-slate-100">{o.evento.titulo}</span>
                      {(o.evento.local || o.evento.linkVideo) && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                          {o.evento.local && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {o.evento.local}
                            </span>
                          )}
                          {o.evento.linkVideo && (
                            <span className="inline-flex items-center gap-1">
                              <Video className="h-3 w-3" /> Videoconferência
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          )}

          {tarefas.length > 0 && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Tarefas com prazo hoje</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {tarefas.map((i) => (
                  <LinhaAfazer key={i.chave} item={i} hoje={hoje} mostrarData={i.dataEntrega !== hoje} onAlternar={onAlternar} onAbrir={setEditar} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <TarefaPessoalModal open={editar !== null} item={editar ?? undefined} onClose={() => setEditar(null)} aoSalvar={aoSalvarTarefa} />
      {modais}
    </SectionCard>
  )
}
