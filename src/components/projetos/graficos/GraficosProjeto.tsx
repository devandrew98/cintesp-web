import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GraficoGantt } from './GraficoGantt'
import { GraficoEap } from './GraficoEap'
import { GraficoCausaEfeito } from './GraficoCausaEfeito'
import { GraficosBarras } from './GraficosBarras'
import { listarGrupos } from '@/data/grupos'
import { listarTarefas } from '@/data/tarefas'
import { usePermissoes } from '@/hooks/usePermissoes'
import { hojeISO } from '@/lib/agendamento'
import { podeVerGrupo } from '@/lib/grupos'
import { podeNoProjeto } from '@/lib/projetos'
import { cn } from '@/lib/utils'
import type { Projeto } from '@/types'

const GRAFICOS = [
  { id: 'gantt', label: 'Gantt' },
  { id: 'eap', label: 'EAP' },
  { id: 'causa', label: 'Causa e efeito' },
  { id: 'barras', label: 'Barras' },
] as const

/** Aba "Gráficos": mesmas tarefas do plano de trabalho (só os grupos que a pessoa pode ver). */
export function GraficosProjeto({ projeto }: { projeto: Projeto }) {
  const { perfil, ehAdmin } = usePermissoes()
  const [qual, setQual] = useState<(typeof GRAFICOS)[number]['id']>('gantt')
  const { data: grupos = [], isLoading: lg } = useQuery({ queryKey: ['grupos', projeto.id], queryFn: () => listarGrupos(projeto.id) })
  const { data: todas = [], isLoading: lt } = useQuery({ queryKey: ['tarefas', projeto.id], queryFn: () => listarTarefas(projeto.id) })

  const visiveis = useMemo(() => grupos.filter((g) => podeVerGrupo(g, projeto, perfil?.id, ehAdmin)), [grupos, projeto, perfil?.id, ehAdmin])
  const tarefas = useMemo(() => todas.filter((t) => visiveis.some((g) => g.id === t.grupoId)), [todas, visiveis])

  return (
    <div className="space-y-4">
      <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="Gráfico">
        {GRAFICOS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={qual === g.id}
            onClick={() => setQual(g.id)}
            className={cn('whitespace-nowrap rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors', qual === g.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}
          >
            {g.label}
          </button>
        ))}
      </div>

      {lg || lt ? (
        <p className="py-12 text-center text-sm text-slate-400">Carregando…</p>
      ) : qual === 'gantt' ? (
        <GraficoGantt grupos={visiveis} tarefas={tarefas} hoje={hojeISO()} />
      ) : qual === 'eap' ? (
        <GraficoEap titulo={projeto.titulo} grupos={visiveis} tarefas={tarefas} />
      ) : qual === 'causa' ? (
        <GraficoCausaEfeito projetoId={projeto.id} podeEditar={podeNoProjeto(projeto, 'causaEfeito', perfil?.id, ehAdmin)} />
      ) : (
        <GraficosBarras grupos={visiveis} tarefas={tarefas} />
      )}
    </div>
  )
}
