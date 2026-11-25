import { CartaoGrafico, SemDados } from './CartaoGrafico'
import { progressoGrupo, type GrupoTarefas } from '@/lib/grupos'
import { infoStatus, ordenarTarefas, type Tarefa } from '@/lib/tarefas'
import { cn } from '@/lib/utils'

/** Estrutura Analítica do Projeto: projeto → grupos (entregas) → tarefas, numerados. */
export function GraficoEap({ titulo, grupos, tarefas }: { titulo: string; grupos: GrupoTarefas[]; tarefas: Tarefa[] }) {
  return (
    <CartaoGrafico
      titulo="Estrutura Analítica do Projeto (EAP)"
      comoLer="leia de cima para baixo. No topo está o projeto; abaixo, as grandes frentes (1, 2, 3…); dentro de cada uma, os pacotes de trabalho (1.1, 1.2…). Tudo o que o projeto precisa entregar deve aparecer em algum ramo. A bolinha mostra o status e o percentual, quanto da frente foi concluído."
    >
      {grupos.length === 0 ? (
        <SemDados>Crie grupos e tarefas no plano de trabalho para montar a EAP.</SemDados>
      ) : (
        <div className="flex flex-col items-center">
          <div className="max-w-full rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white">{titulo}</div>
          <span className="h-5 w-px bg-slate-300 dark:bg-slate-600" />
          <div className="w-full overflow-x-auto pb-2">
            <ol className="mx-auto flex w-max">
              {grupos.map((g, i) => {
                const doGrupo = ordenarTarefas(tarefas.filter((t) => t.grupoId === g.id))
                return (
                  <li key={g.id} className="relative w-60 px-2 pt-4">
                    {/* Ligação com o topo: um traço horizontal entre os ramos e um vertical em cada um. */}
                    <span className={cn('absolute top-0 h-px bg-slate-300 dark:bg-slate-600', i === 0 ? 'left-1/2' : 'left-0', i === grupos.length - 1 ? 'right-1/2' : 'right-0')} />
                    <span className="absolute left-1/2 top-0 h-4 w-px bg-slate-300 dark:bg-slate-600" />
                    <div className="rounded-xl border-2 border-brand-500 px-3 py-2">
                      <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">
                        {i + 1}. {g.titulo}
                      </p>
                      <p className="text-xs text-slate-500">{progressoGrupo(tarefas, g.id).percentual}% concluído</p>
                    </div>
                    <ol className="ml-3 border-l border-slate-300 dark:border-slate-600">
                      {doGrupo.map((t, j) => (
                        <li key={t.id} className="relative pl-3 pt-2">
                          <span className="absolute left-0 top-5 h-px w-3 bg-slate-300 dark:bg-slate-600" />
                          <div className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
                            <p className="break-words">
                              <span className="font-semibold">
                                {i + 1}.{j + 1}
                              </span>{' '}
                              {t.titulo}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                              <span className={cn('h-1.5 w-1.5 rounded-full', infoStatus(t.status).ponto)} /> {infoStatus(t.status).label}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
    </CartaoGrafico>
  )
}
