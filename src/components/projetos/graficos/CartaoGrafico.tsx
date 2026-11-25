import { Info } from 'lucide-react'

/** Moldura de um gráfico do projeto: título, mini resumo de leitura e o desenho. */
export function CartaoGrafico({ titulo, comoLer, acao, children }: { titulo: string; comoLer: React.ReactNode; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
        {acao}
      </div>
      <div className="mt-2 flex gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
        <p>
          <strong>Como ler: </strong>
          {comoLer}
        </p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export const SemDados = ({ children }: { children: React.ReactNode }) => <p className="rounded-xl border border-dashed border-slate-200 px-3 py-10 text-center text-sm text-slate-400 dark:border-slate-700">{children}</p>
