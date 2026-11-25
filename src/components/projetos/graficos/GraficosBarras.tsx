import { CartaoGrafico, SemDados } from './CartaoGrafico'
import { porResponsavel } from '@/lib/graficos'
import { progressoGrupo, type GrupoTarefas } from '@/lib/grupos'
import { STATUS_TAREFA, type Tarefa } from '@/lib/tarefas'
import { cn } from '@/lib/utils'

interface Parte {
  valor: number
  cor: string
  nome: string
}

/** Barra horizontal (com partes empilhadas) numa escala comum; o valor vai escrito ao lado. */
function Barra({ rotulo, partes, maximo, texto }: { rotulo: string; partes: Parte[]; maximo: number; texto: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs">
      <span className="truncate text-slate-600 dark:text-slate-300" title={rotulo}>
        {rotulo}
      </span>
      <span className="flex h-3.5 gap-0.5 border-l border-slate-300 dark:border-slate-600">
        {partes
          .filter((p) => p.valor > 0)
          .map((p) => (
            <span key={p.nome} tabIndex={0} title={`${rotulo} — ${p.nome}: ${p.valor}`} aria-label={`${rotulo}, ${p.nome}: ${p.valor}`} className={cn('last:rounded-r', p.cor)} style={{ width: `${(p.valor / maximo) * 100}%` }} />
          ))}
      </span>
      <span className="w-12 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{texto}</span>
    </li>
  )
}

export function GraficosBarras({ grupos, tarefas }: { grupos: GrupoTarefas[]; tarefas: Tarefa[] }) {
  const porStatus = STATUS_TAREFA.map((s) => ({ ...s, total: tarefas.filter((t) => t.status === s.value).length }))
  const maxStatus = Math.max(1, ...porStatus.map((s) => s.total))
  const pessoas = porResponsavel(tarefas)
  const maxPessoa = Math.max(1, ...pessoas.map((p) => p.abertas + p.concluidas))
  const semTarefas = <SemDados>Sem tarefas para mostrar.</SemDados>

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <CartaoGrafico titulo="Tarefas por status" comoLer="cada barra é um status e o comprimento é a quantidade de tarefas, escrita ao lado. Barras grandes em “Aguardando” costumam indicar algo travando a equipe.">
        {tarefas.length === 0 ? (
          semTarefas
        ) : (
          <ul className="space-y-2.5">
            {porStatus.map((s) => (
              <Barra key={s.value} rotulo={s.label} maximo={maxStatus} texto={String(s.total)} partes={[{ nome: s.label, valor: s.total, cor: s.ponto }]} />
            ))}
          </ul>
        )}
      </CartaoGrafico>

      <CartaoGrafico titulo="Progresso por grupo" comoLer="a barra cheia equivale a 100%. Compare os grupos: os mais curtos estão mais atrasados em relação ao que foi planejado para eles.">
        {grupos.length === 0 ? (
          <SemDados>Nenhum grupo ainda.</SemDados>
        ) : (
          <ul className="space-y-2.5">
            {grupos.map((g) => {
              const pct = progressoGrupo(tarefas, g.id).percentual
              return <Barra key={g.id} rotulo={g.titulo} maximo={100} texto={`${pct}%`} partes={[{ nome: 'Concluído (%)', valor: pct, cor: 'bg-brand-600' }]} />
            })}
          </ul>
        )}
      </CartaoGrafico>

      <div className="xl:col-span-2">
        <CartaoGrafico titulo="Tarefas por responsável" comoLer="o comprimento total é quantas tarefas a pessoa tem; a parte verde já foi concluída e a azul ainda está aberta. Serve para ver quem está sobrecarregado e redistribuir.">
          {pessoas.length === 0 ? (
            semTarefas
          ) : (
            <>
              <ul className="mb-3 flex gap-4 text-xs text-slate-500">
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Concluídas
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Abertas
                </li>
              </ul>
              <ul className="space-y-2.5">
                {pessoas.map((p) => (
                  <Barra
                    key={p.nome}
                    rotulo={p.nome}
                    maximo={maxPessoa}
                    texto={`${p.concluidas}/${p.concluidas + p.abertas}`}
                    partes={[
                      { nome: 'Concluídas', valor: p.concluidas, cor: 'bg-brand-600' },
                      { nome: 'Abertas', valor: p.abertas, cor: 'bg-sky-500' },
                    ]}
                  />
                ))}
              </ul>
            </>
          )}
        </CartaoGrafico>
      </div>
    </div>
  )
}
