import { CartaoGrafico, SemDados } from './CartaoGrafico'
import { montarGantt } from '@/lib/graficos'
import type { GrupoTarefas } from '@/lib/grupos'
import { STATUS_TAREFA, atrasada, infoStatus, type Tarefa } from '@/lib/tarefas'
import { cn, formatDateOnlyBR } from '@/lib/utils'

const NOME = 'sticky left-0 z-10 w-40 shrink-0 truncate bg-white pr-2 dark:bg-slate-900 sm:w-56'

export function GraficoGantt({ grupos, tarefas, hoje }: { grupos: GrupoTarefas[]; tarefas: Tarefa[]; hoje: string }) {
  const g = montarGantt(grupos, tarefas, hoje)
  // Projetos curtos ganham dias mais largos; longos ficam compactos e rolam na horizontal.
  const porDia = g ? Math.min(28, Math.max(5, Math.round(720 / g.totalDias))) : 0
  const largura = g ? g.totalDias * porDia : 0

  return (
    <CartaoGrafico
      titulo="Diagrama de Gantt"
      comoLer="cada linha é uma tarefa e o tempo corre da esquerda para a direita. A barra começa na data de início e termina na entrega; quanto mais comprida, mais dias. A linha vermelha é hoje: barra que acabou antes dela sem estar concluída está atrasada. Barras na mesma coluna acontecem ao mesmo tempo."
    >
      {!g ? (
        <SemDados>Coloque a data de início e de entrega nas tarefas para montar o cronograma.</SemDados>
      ) : (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {STATUS_TAREFA.map((s) => (
              <li key={s.value} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-sm', s.ponto)} /> {s.label}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-red-500" /> Hoje
            </li>
          </ul>
          <div className="max-h-[480px] overflow-auto">
            <div className="w-max min-w-full text-xs">
              <div className="sticky top-0 z-20 flex border-b border-slate-100 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                <span className={cn(NOME, 'py-1 font-semibold uppercase')}>Tarefa</span>
                <span className="flex" style={{ width: largura }}>
                  {g.meses.map((m) => (
                    <span key={m.rotulo} className="overflow-hidden whitespace-nowrap border-l border-slate-100 py-1 pl-1 dark:border-slate-800" style={{ width: m.dias * porDia }}>
                      {m.dias * porDia >= 36 ? m.rotulo : ''}
                    </span>
                  ))}
                </span>
              </div>
              {g.grupos.map((grupo) => (
                <div key={grupo.id}>
                  <div className="flex">
                    <span className={cn(NOME, 'pt-2.5 font-semibold text-slate-800 dark:text-slate-100')} title={grupo.titulo}>
                      {grupo.titulo}
                    </span>
                  </div>
                  {grupo.barras.map(({ tarefa: t, desloc, dias }) => {
                    const detalhe = `${t.titulo} — ${infoStatus(t.status).label}\nInício: ${t.dataInicio ? formatDateOnlyBR(t.dataInicio) : '—'} · Entrega: ${t.dataEntrega ? formatDateOnlyBR(t.dataEntrega) : '—'}${t.responsavelNome ? `\nResponsável: ${t.responsavelNome}` : ''}${atrasada(t, hoje) ? '\nAtrasada' : ''}`
                    return (
                      <div key={t.id} className="group flex items-center hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <span className={cn(NOME, 'py-1.5 pl-2 text-slate-600 dark:text-slate-300')} title={detalhe}>
                          {t.titulo}
                        </span>
                        <span className="relative block h-6" style={{ width: largura }}>
                          {g.hoje !== null && <span className="absolute -bottom-0.5 -top-0.5 w-0.5 bg-red-500/70" style={{ left: g.hoje * porDia + porDia / 2 }} />}
                          <span
                            tabIndex={0}
                            title={detalhe}
                            aria-label={detalhe}
                            className={cn('absolute top-1.5 h-3 rounded', infoStatus(t.status).ponto, atrasada(t, hoje) && 'ring-2 ring-red-500')}
                            style={{ left: desloc * porDia, width: Math.max(6, dias * porDia) }}
                          />
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          {g.semData.length > 0 && <p className="mt-3 text-xs text-slate-400">Fora do cronograma (sem datas): {g.semData.map((t) => t.titulo).join(', ')}.</p>}
        </>
      )}
    </CartaoGrafico>
  )
}
