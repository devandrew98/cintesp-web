import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface MesAno {
  ano: number
  /** 1-12 */
  mes: number
}

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function mesAtual(agora = new Date()): MesAno {
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 }
}

export const ehMesAtual = (v: MesAno) => v.ano === mesAtual().ano && v.mes === mesAtual().mes

function deslocar(v: MesAno, delta: number): MesAno {
  const d = new Date(v.ano, v.mes - 1 + delta, 1)
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
}

const campo =
  'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'

/** Escolhe mês/ano (com setas). Não deixa ir para meses futuros. */
export function SeletorMes({ valor, onChange, anosAtras = 8 }: { valor: MesAno; onChange: (v: MesAno) => void; anosAtras?: number }) {
  const hoje = mesAtual()
  const noLimite = valor.ano > hoje.ano || (valor.ano === hoje.ano && valor.mes >= hoje.mes)
  const anos = Array.from({ length: anosAtras + 1 }, (_, i) => hoje.ano - i)
  const limitar = (v: MesAno): MesAno => (v.ano > hoje.ano || (v.ano === hoje.ano && v.mes > hoje.mes) ? hoje : v)

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => onChange(deslocar(valor, -1))}
        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <select
        aria-label="Mês"
        value={valor.mes}
        onChange={(e) => onChange(limitar({ ano: valor.ano, mes: Number(e.target.value) }))}
        className={campo}
      >
        {NOMES_MESES.map((m, i) => (
          <option key={m} value={i + 1} disabled={valor.ano === hoje.ano && i + 1 > hoje.mes}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="Ano"
        value={valor.ano}
        onChange={(e) => onChange(limitar({ ano: Number(e.target.value), mes: valor.mes }))}
        className={campo}
      >
        {anos.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="Próximo mês"
        disabled={noLimite}
        onClick={() => onChange(deslocar(valor, 1))}
        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
