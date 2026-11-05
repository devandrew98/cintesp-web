import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MESES, hojeISO, montarData } from '@/lib/agendamento'
import { cn } from '@/lib/utils'

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export interface MarcadorDia {
  /** Classe de cor do ponto (ex.: "bg-amber-500"). */
  cor: string
  titulo?: string
}

/**
 * Calendário mensal (sem libs). Quem usa decide quais dias ficam desabilitados e quais
 * marcadores aparecem; aqui só se desenha e se navega entre meses.
 */
export function CalendarioMes({
  ano,
  mes,
  onMes,
  selecionado,
  onSelecionar,
  desabilitado,
  motivo,
  marcadores,
  navMin,
  navMax,
}: {
  ano: number
  /** 1-12 */
  mes: number
  onMes: (ano: number, mes: number) => void
  selecionado?: string
  onSelecionar: (iso: string) => void
  desabilitado?: (iso: string) => boolean
  /** Dica (tooltip) de por que o dia está desabilitado. */
  motivo?: (iso: string) => string | undefined
  marcadores?: (iso: string) => MarcadorDia[]
  /** Limites da navegação ("yyyy-mm-dd"; só o mês importa). */
  navMin?: string
  navMax?: string
}) {
  const hoje = hojeISO()
  const primeiroDia = new Date(ano, mes - 1, 1).getDay()
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const celulas: (number | null)[] = [...Array(primeiroDia).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]

  const ir = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1)
    onMes(d.getFullYear(), d.getMonth() + 1)
  }
  const chaveMes = (a: number, m: number) => a * 100 + m
  const noMin = navMin ? chaveMes(ano, mes) <= Number(navMin.slice(0, 4)) * 100 + Number(navMin.slice(5, 7)) : false
  const noMax = navMax ? chaveMes(ano, mes) >= Number(navMax.slice(0, 4)) * 100 + Number(navMax.slice(5, 7)) : false

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => ir(-1)}
          disabled={noMin}
          aria-label="Mês anterior"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {MESES[mes - 1]} {ano}
        </span>
        <button
          type="button"
          onClick={() => ir(1)}
          disabled={noMax}
          aria-label="Próximo mês"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {SEMANA.map((d, i) => (
          <span key={i} className="pb-1 text-[11px] font-medium text-slate-400">
            {d}
          </span>
        ))}
        {celulas.map((dia, i) => {
          if (!dia) return <span key={`v${i}`} />
          const iso = montarData(ano, mes, dia)
          const off = desabilitado?.(iso) ?? false
          const sel = selecionado === iso
          const marcas = marcadores?.(iso) ?? []
          return (
            <button
              key={iso}
              type="button"
              disabled={off}
              title={off ? motivo?.(iso) : undefined}
              onClick={() => onSelecionar(iso)}
              className={cn(
                'relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-colors',
                sel
                  ? 'bg-brand-600 font-semibold text-white'
                  : off
                    ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                    : 'text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-800',
                iso === hoje && !sel && 'ring-1 ring-brand-400',
              )}
            >
              {dia}
              {marcas.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {marcas.slice(0, 3).map((m, k) => (
                    <span key={k} title={m.titulo} className={cn('h-1.5 w-1.5 rounded-full', sel ? 'bg-white' : m.cor)} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
