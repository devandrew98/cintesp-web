import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CalendarioMes } from '@/components/agendamento/CalendarioMes'
import { EventoEquipeModal } from '@/components/agenda/EventoEquipeModal'
import { useAbrirEvento, useTodosEventos } from '@/components/agenda/Programacao'
import { LinhaAfazer } from './LinhaAfazer'
import { TarefaPessoalModal } from './TarefaPessoalModal'
import { useAfazeres } from './useAfazeres'
import { usePermissoes } from '@/hooks/usePermissoes'
import { itensDoDia, type ItemAfazer } from '@/lib/afazeres'
import { ehEventoMeu, ocorrenciasDoDia, ocorrenciasNoPeriodo, rotuloDia, rotuloQuando, type Ocorrencia } from '@/lib/agendaEquipe'
import { hojeISO, montarData, partesData, somarDias } from '@/lib/agendamento'
import { cn } from '@/lib/utils'

/**
 * Minha agenda: meus compromissos (privados por padrão) + tarefas com prazo (pessoais e dos projetos),
 * com a opção de ver junto a agenda geral da equipe.
 */
export function MinhaAgenda() {
  const { perfil } = usePermissoes()
  const { data: eventos = [] } = useTodosEventos()
  const { itens, alternar, recarregar } = useAfazeres()
  const { abrir, modais } = useAbrirEvento()
  const hoje = hojeISO()
  const [{ ano, mes }, setMes] = useState(() => ({ ano: partesData(hoje).a, mes: partesData(hoje).m }))
  const [dia, setDia] = useState(hoje)
  const [comGeral, setComGeral] = useState(true)
  const [novoCompromisso, setNovoCompromisso] = useState(false)
  const [tarefaModal, setTarefaModal] = useState<ItemAfazer | null>(null)

  // Meus compromissos (privados e públicos meus) e, se pedido, os oficiais da equipe + públicos de outros.
  const visiveis = useMemo(() => eventos.filter((e) => ehEventoMeu(e, perfil?.id) || (comGeral && (!e.donoId || e.visibilidade === 'publica'))), [eventos, perfil?.id, comGeral])

  const primeiro = montarData(ano, mes, 1)
  const ultimo = montarData(ano, mes, new Date(ano, mes, 0).getDate())
  const doMes = useMemo(() => ocorrenciasNoPeriodo(visiveis, primeiro, ultimo), [visiveis, primeiro, ultimo])
  const doDia = useMemo(() => ocorrenciasNoPeriodo(visiveis, dia, dia), [visiveis, dia])
  const tarefasDoDia = useMemo(() => itensDoDia(itens, dia), [itens, dia])
  const proximos = useMemo(() => ocorrenciasNoPeriodo(visiveis.filter((e) => ehEventoMeu(e, perfil?.id)), hoje, somarDias(hoje, 30)).slice(0, 5), [visiveis, perfil?.id, hoje])

  const marcadores = (iso: string) => {
    const m: { cor: string }[] = []
    const eventosDia = ocorrenciasDoDia(doMes, iso)
    if (eventosDia.some((o) => ehEventoMeu(o.evento, perfil?.id))) m.push({ cor: 'bg-violet-500' })
    if (eventosDia.some((o) => !ehEventoMeu(o.evento, perfil?.id))) m.push({ cor: 'bg-brand-500' })
    if (itens.some((i) => i.dataEntrega === iso && i.status !== 'concluido')) m.push({ cor: 'bg-amber-500' })
    return m
  }

  const linhaEvento = (o: Ocorrencia) => {
    const meu = ehEventoMeu(o.evento, perfil?.id)
    return (
      <li key={`${o.evento.id}|${o.data}`}>
        <button type="button" onClick={() => abrir(o)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
          <span className={cn('h-8 w-1 shrink-0 rounded-full', meu ? 'bg-violet-500' : 'bg-brand-500')} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{o.evento.titulo}</span>
            <span className="block text-xs text-slate-400">
              {rotuloQuando(o)}
              {meu ? (o.evento.visibilidade === 'privada' ? ' · privado' : ' · público') : o.evento.donoNome ? ` · de ${o.evento.donoNome}` : ' · equipe'}
            </span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={comGeral} onChange={(e) => setComGeral(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Mostrar também a agenda geral da equipe
        </label>
        <Button icon={Plus} onClick={() => setNovoCompromisso(true)} className="w-full sm:w-auto">
          Novo compromisso
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
        <div>
          <CalendarioMes ano={ano} mes={mes} onMes={(a, m) => setMes({ ano: a, mes: m })} selecionado={dia} onSelecionar={setDia} marcadores={marcadores} />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <li className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> Meus compromissos
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Tarefas com prazo
            </li>
            {comGeral && (
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> Agenda geral
              </li>
            )}
          </ul>
        </div>

        <div className="min-w-0 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{rotuloDia(dia, hoje)}</h3>
          {doDia.length === 0 && tarefasDoDia.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400 dark:border-slate-700">Nada marcado para este dia.</p>
          ) : (
            <>
              {doDia.length > 0 && (
                <section>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Compromissos</p>
                  <ul className="card divide-y divide-slate-100 dark:divide-slate-800">{doDia.map(linhaEvento)}</ul>
                </section>
              )}
              {tarefasDoDia.length > 0 && (
                <section>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Tarefas com prazo neste dia</p>
                  <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
                    {tarefasDoDia.map((i) => (
                      <LinhaAfazer key={i.chave} item={i} hoje={hoje} mostrarData={false} onAlternar={(x) => alternar.mutate(x)} onAbrir={(x) => setTarefaModal(x)} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {proximos.length > 0 && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Meus próximos compromissos</p>
              <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
                {proximos.map((o) => (
                  <li key={`${o.evento.id}|${o.data}`}>
                    <button type="button" onClick={() => abrir(o)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <span className="w-14 shrink-0 text-xs font-semibold text-violet-600 dark:text-violet-300">{o.data.slice(8)}/{o.data.slice(5, 7)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{o.evento.titulo}</span>
                      <span className="shrink-0 text-xs text-slate-400">{rotuloQuando(o)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <EventoEquipeModal open={novoCompromisso} onClose={() => setNovoCompromisso(false)} dataInicial={dia} pessoal />
      <TarefaPessoalModal open={tarefaModal !== null} item={tarefaModal ?? undefined} onClose={() => setTarefaModal(null)} aoSalvar={() => recarregar()} />
      {modais}
    </div>
  )
}
