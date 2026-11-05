import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, MapPin, Plus, Repeat, Video } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/Button'
import { CalendarioMes } from '@/components/agendamento/CalendarioMes'
import { EventoEquipeModal } from '@/components/agenda/EventoEquipeModal'
import { DetalheEventoModal } from '@/components/agenda/DetalheEventoModal'
import { listarEventosEquipe } from '@/data/agendaEquipe'
import { usePermissoes } from '@/hooks/usePermissoes'
import { hojeISO, montarData, partesData, somarDias, MESES } from '@/lib/agendamento'
import { ocorrenciasDoDia, ocorrenciasNoPeriodo, rotuloDia, rotuloQuando, type Ocorrencia } from '@/lib/agendaEquipe'

/** Eventos da agenda da equipe (todos os usuários logados leem). */
export function useEventosEquipe() {
  return useQuery({ queryKey: ['agenda-equipe'], queryFn: listarEventosEquipe })
}

/** Quantos eventos acontecem hoje (para os cartões de resumo). */
export function useEventosHoje(): number {
  const { data: eventos = [] } = useEventosEquipe()
  const hoje = hojeISO()
  return useMemo(() => ocorrenciasNoPeriodo(eventos, hoje, hoje).length, [eventos, hoje])
}

/** Uma linha de evento: chip com a data + título + horário/local. Clicável. */
function LinhaEvento({ o, onAbrir, mostrarData = true }: { o: Ocorrencia; onAbrir: () => void; mostrarData?: boolean }) {
  const { d, m } = partesData(o.data)
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      {mostrarData && (
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <span className="text-base font-bold leading-none">{d}</span>
          <span className="text-[10px] font-semibold uppercase leading-tight">{MESES[m - 1].slice(0, 3)}</span>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{o.evento.titulo}</span>
          {o.evento.repeticao !== 'nunca' && <Repeat className="h-3 w-3 shrink-0 text-slate-400" aria-label="Se repete" />}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
          <span>{rotuloQuando(o)}</span>
          {o.evento.local && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {o.evento.local}
            </span>
          )}
          {o.evento.linkVideo && (
            <span className="inline-flex items-center gap-1">
              <Video className="h-3 w-3" />
              Videoconferência
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

/** Abre o detalhe e (para admin) o editor. Compartilhado entre a Agenda e o Dashboard. */
function useAbrirEvento() {
  const { ehAdmin } = usePermissoes()
  const [aberta, setAberta] = useState<Ocorrencia | null>(null)
  const [editando, setEditando] = useState<Ocorrencia | null>(null)
  const modais = (
    <>
      <DetalheEventoModal
        ocorrencia={aberta}
        onClose={() => setAberta(null)}
        onEditar={ehAdmin ? () => { setEditando(aberta); setAberta(null) } : undefined}
      />
      <EventoEquipeModal open={Boolean(editando)} onClose={() => setEditando(null)} evento={editando?.evento} dataInicial={editando?.data} />
    </>
  )
  return { abrir: setAberta, modais }
}

/** Resumo para o Dashboard: próximos eventos (a partir de hoje). */
export function ProgramacaoResumo({ limite = 4 }: { limite?: number }) {
  const { data: eventos = [] } = useEventosEquipe()
  const { abrir, modais } = useAbrirEvento()
  const hoje = hojeISO()
  const proximos = useMemo(() => ocorrenciasNoPeriodo(eventos, hoje, somarDias(hoje, 90)).slice(0, limite), [eventos, hoje, limite])

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          Programação
        </span>
      }
      action={
        <Link to="/agenda" className="text-sm font-medium text-brand-600 hover:underline">
          Ver todas
        </Link>
      }
      bodyClassName="p-2"
    >
      {proximos.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm text-slate-400">Nenhum evento programado.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {proximos.map((o) => (
            <LinhaEvento key={`${o.evento.id}|${o.data}`} o={o} onAbrir={() => abrir(o)} />
          ))}
        </div>
      )}
      {modais}
    </SectionCard>
  )
}

/** Programação completa (página Agenda do Dia): calendário mensal + dia selecionado + próximos eventos. */
export function ProgramacaoCard({ className }: { className?: string }) {
  const { ehAdmin } = usePermissoes()
  const { data: eventos = [] } = useEventosEquipe()
  const { abrir, modais } = useAbrirEvento()
  const hoje = hojeISO()
  const [{ ano, mes }, setMes] = useState(() => ({ ano: partesData(hoje).a, mes: partesData(hoje).m }))
  const [dia, setDia] = useState(hoje)
  const [novo, setNovo] = useState(false)

  // Ocorrências do mês exibido (inclui eventos de vários dias que vêm de antes).
  const primeiro = montarData(ano, mes, 1)
  const ultimo = montarData(ano, mes, new Date(ano, mes, 0).getDate())
  const doMes = useMemo(() => ocorrenciasNoPeriodo(eventos, primeiro, ultimo), [eventos, primeiro, ultimo])
  const doDia = useMemo(() => ocorrenciasDoDia(ocorrenciasNoPeriodo(eventos, dia, dia), dia), [eventos, dia])
  const proximos = useMemo(() => ocorrenciasNoPeriodo(eventos, hoje, somarDias(hoje, 60)).slice(0, 8), [eventos, hoje])

  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          Programação
        </span>
      }
      action={
        ehAdmin ? (
          <Button size="sm" icon={Plus} onClick={() => setNovo(true)}>
            Novo evento
          </Button>
        ) : undefined
      }
      bodyClassName="p-5"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
        <CalendarioMes
          ano={ano}
          mes={mes}
          onMes={(a, m) => setMes({ ano: a, mes: m })}
          selecionado={dia}
          onSelecionar={setDia}
          marcadores={(iso) => (ocorrenciasDoDia(doMes, iso).length > 0 ? [{ cor: 'bg-brand-500' }] : [])}
        />

        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{rotuloDia(dia, hoje)}</h3>
          {doDia.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
              Nada programado para este dia.
              {ehAdmin && (
                <button type="button" onClick={() => setNovo(true)} className="ml-1 font-medium text-brand-600 hover:underline">
                  Adicionar evento
                </button>
              )}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {doDia.map((o) => (
                <LinhaEvento key={`${o.evento.id}|${o.data}`} o={o} onAbrir={() => abrir(o)} mostrarData={false} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Próximos eventos</h3>
        {proximos.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Nenhum evento nos próximos 60 dias.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {proximos.map((o) => (
              <LinhaEvento key={`${o.evento.id}|${o.data}`} o={o} onAbrir={() => abrir(o)} />
            ))}
          </div>
        )}
      </div>

      <EventoEquipeModal open={novo} onClose={() => setNovo(false)} dataInicial={dia} />
      {modais}
    </SectionCard>
  )
}
