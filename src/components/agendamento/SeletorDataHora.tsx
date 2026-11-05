import { useState } from 'react'
import { CalendarioMes } from './CalendarioMes'
import {
  HORARIOS,
  chaveSlot,
  dataExtenso,
  diaLotado,
  ehDiaUtil,
  hojeISO,
  partesData,
  periodoDaFase,
  rotuloHorario,
  type ConfigAgendamento,
  type FaseAvaliacao,
} from '@/lib/agendamento'
import { cn } from '@/lib/utils'

/**
 * Calendário + blocos de horário de UMA avaliação. Só deixa marcar o que realmente está livre:
 * dia útil, dentro do período da fase, no futuro, sem estar lotado, em dia diferente do das
 * outras avaliações da mesma fase, e em blocos que ninguém (nem as outras escolhas) ocupa.
 */
export function SeletorDataHora({
  fase,
  config,
  ocupados,
  diasUsadosNaFase,
  slotsUsados,
  valor,
  onEscolher,
}: {
  fase: FaseAvaliacao
  config: ConfigAgendamento
  /** Blocos ocupados no servidor (chave "data|hora"). */
  ocupados: Set<string>
  /** Dias já escolhidos pelas OUTRAS avaliações da mesma fase. */
  diasUsadosNaFase: Set<string>
  /** Blocos já escolhidos pelas OUTRAS avaliações (qualquer fase). */
  slotsUsados: Set<string>
  valor?: { data: string; hora: string }
  onEscolher: (data: string, hora: string) => void
}) {
  const { inicio, fim } = periodoDaFase(fase, config)
  const hoje = hojeISO()
  const primeiro = valor?.data ?? (inicio > hoje ? inicio : hoje)
  const { a, m } = partesData(primeiro)
  const [mesVisto, setMesVisto] = useState({ ano: a, mes: m })
  const [dataAtiva, setDataAtiva] = useState<string | undefined>(valor?.data)

  const todos = new Set([...ocupados, ...slotsUsados])

  const motivoDia = (iso: string): string | undefined => {
    if (!ehDiaUtil(iso)) return 'Fim de semana'
    if (iso < inicio || iso > fim) return 'Fora do período desta fase'
    if (iso < hoje) return 'Data que já passou'
    if (diasUsadosNaFase.has(iso)) return 'Você já usou este dia em outra avaliação desta fase'
    if (diaLotado(iso, todos)) return 'Sem horários livres'
    return undefined
  }

  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[minmax(0,17rem)_1fr] dark:border-slate-700 dark:bg-slate-900/40">
      <CalendarioMes
        ano={mesVisto.ano}
        mes={mesVisto.mes}
        onMes={(ano, mes) => setMesVisto({ ano, mes })}
        selecionado={dataAtiva}
        onSelecionar={setDataAtiva}
        desabilitado={(iso) => motivoDia(iso) !== undefined}
        motivo={motivoDia}
        navMin={inicio}
        navMax={fim}
      />

      <div>
        {dataAtiva ? (
          <>
            <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{dataExtenso(dataAtiva)}</p>
            <div className="grid grid-cols-2 gap-2">
              {HORARIOS.map((h) => {
                const ocupado = todos.has(chaveSlot(dataAtiva, h))
                const escolhido = valor?.data === dataAtiva && valor.hora === h
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={ocupado}
                    onClick={() => onEscolher(dataAtiva, h)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-sm transition-colors',
                      escolhido
                        ? 'border-brand-600 bg-brand-600 font-semibold text-white'
                        : ocupado
                          ? 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300 line-through dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
                    )}
                  >
                    {rotuloHorario(h)}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">Horários riscados já estão ocupados.</p>
          </>
        ) : (
          <p className="flex h-full min-h-[6rem] items-center text-sm text-slate-400">
            Escolha um dia no calendário para ver os horários disponíveis.
          </p>
        )}
      </div>
    </div>
  )
}
