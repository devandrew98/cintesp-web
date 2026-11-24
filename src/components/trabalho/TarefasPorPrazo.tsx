import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ListTodo } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { LinhaAfazer } from '@/components/afazeres/LinhaAfazer'
import { TarefaPessoalModal } from '@/components/afazeres/TarefaPessoalModal'
import type { GruposPrazo, ItemAfazer } from '@/lib/afazeres'
import { cn } from '@/lib/utils'

const GRUPOS: { chave: keyof GruposPrazo; titulo: string; vermelho?: boolean; abertoPadrao: boolean }[] = [
  { chave: 'atrasadas', titulo: 'Atrasadas', vermelho: true, abertoPadrao: true },
  { chave: 'hoje', titulo: 'Hoje', abertoPadrao: true },
  { chave: 'amanha', titulo: 'Amanhã', abertoPadrao: true },
  { chave: 'estaSemana', titulo: 'Esta semana', abertoPadrao: true },
  { chave: 'semanaQueVem', titulo: 'Semana que vem', abertoPadrao: false },
  { chave: 'depois', titulo: 'Mais adiante', abertoPadrao: false },
  { chave: 'semData', titulo: 'Sem data', abertoPadrao: false },
]

/** Minhas tarefas (pessoais + dos projetos) agrupadas pelo prazo: atrasadas, hoje, amanhã, esta semana, semana que vem… */
export function TarefasPorPrazo({ grupos, hoje, onAlternar, aoSalvarTarefa, className }: { grupos: GruposPrazo; hoje: string; onAlternar: (i: ItemAfazer) => void; aoSalvarTarefa: () => void; className?: string }) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [editar, setEditar] = useState<ItemAfazer | null>(null)
  const total = GRUPOS.reduce((n, g) => n + grupos[g.chave].length, 0)

  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-sky-500" />
          Minhas tarefas
        </span>
      }
      action={
        <Link to="/afazeres" className="text-sm font-medium text-brand-600 hover:underline">
          Ver tudo
        </Link>
      }
      bodyClassName="p-4"
    >
      {total === 0 ? (
        <div className="flex flex-col items-center gap-1 py-10 text-center">
          <span className="text-3xl">🎉</span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma tarefa em aberto.</p>
          <Link to="/afazeres" className="text-xs font-medium text-brand-600 hover:underline">
            Adicionar uma tarefa
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {GRUPOS.filter((g) => grupos[g.chave].length > 0).map((g) => {
            const lista = grupos[g.chave]
            const aberto = abertos[g.chave] ?? g.abertoPadrao
            return (
              <section key={g.chave}>
                <button type="button" onClick={() => setAbertos((a) => ({ ...a, [g.chave]: !aberto }))} aria-expanded={aberto} className="mb-1 flex w-full items-center gap-2 px-1 text-left">
                  <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', !aberto && '-rotate-90')} />
                  <span className={cn('text-xs font-semibold uppercase tracking-wide', g.vermelho ? 'text-red-500' : 'text-slate-400')}>{g.titulo}</span>
                  <span className={cn('rounded-full px-1.5 text-[11px] font-semibold', g.vermelho ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>{lista.length}</span>
                </button>
                {aberto && (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                    {lista.map((i) => (
                      <LinhaAfazer key={i.chave} item={i} hoje={hoje} onAlternar={onAlternar} onAbrir={setEditar} />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
      <TarefaPessoalModal open={editar !== null} item={editar ?? undefined} onClose={() => setEditar(null)} aoSalvar={aoSalvarTarefa} />
    </SectionCard>
  )
}
