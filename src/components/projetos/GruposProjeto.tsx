import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ExternalLink, FolderOpen, Layers, Lock, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GrupoModal } from './GrupoModal'
import { ProgressoBar } from './ProgressoBar'
import { TarefasProjeto } from './TarefasProjeto'
import { listarGrupos } from '@/data/grupos'
import { listarTarefas } from '@/data/tarefas'
import { usePermissoes } from '@/hooks/usePermissoes'
import { podeCriarGrupo, podeGerenciarGrupo, podeVerGrupo, progressoGrupo, progressoProjeto, type GrupoTarefas } from '@/lib/grupos'
import { cn } from '@/lib/utils'
import type { Projeto } from '@/types'

type AbaGrupo = 'tarefas' | 'detalhes'

/**
 * Plano de trabalho do projeto: GRUPOS (frentes de trabalho) e, dentro de cada um, as tarefas.
 * Cada grupo mostra o responsável e o progresso (calculado pelas tarefas concluídas — nunca manual).
 * Grupos restritos só aparecem para quem foi escolhido.
 */
export function GruposProjeto({ projeto }: { projeto: Projeto }) {
  const { perfil, ehAdmin } = usePermissoes()
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [modal, setModal] = useState<{ grupo?: GrupoTarefas } | null>(null)

  const { data: grupos = [], isLoading } = useQuery({ queryKey: ['grupos', projeto.id], queryFn: () => listarGrupos(projeto.id) })
  const { data: tarefas = [] } = useQuery({ queryKey: ['tarefas', projeto.id], queryFn: () => listarTarefas(projeto.id) })

  const visiveis = useMemo(() => grupos.filter((g) => podeVerGrupo(g, projeto, perfil?.id, ehAdmin)), [grupos, projeto, perfil?.id, ehAdmin])
  const doProjeto = useMemo(() => progressoProjeto(tarefas), [tarefas])
  const podeCriar = podeCriarGrupo(projeto, perfil?.id, ehAdmin)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Plano de trabalho</h2>
          <p className="text-xs text-slate-500">
            {visiveis.length} grupo(s) · {doProjeto.concluidas} de {doProjeto.total} tarefa(s) concluída(s) · o progresso do projeto ({projeto.progresso}%) vem daí
          </p>
        </div>
        {podeCriar && (
          <Button icon={Plus} onClick={() => setModal({})} className="w-full sm:w-auto">
            Novo grupo
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-400">Carregando grupos…</p>
      ) : visiveis.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-14 text-center">
          <Layers className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Nenhum grupo ainda.{podeCriar ? ' Crie o primeiro para começar a organizar as tarefas do projeto.' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiveis.map((g) => (
            <CartaoGrupo key={g.id} grupo={g} projeto={projeto} aberto={Boolean(abertos[g.id])} onAlternar={() => setAbertos((a) => ({ ...a, [g.id]: !a[g.id] }))} progresso={progressoGrupo(tarefas, g.id).percentual} onEditar={() => setModal({ grupo: g })} />
          ))}
        </div>
      )}

      <GrupoModal open={modal !== null} onClose={() => setModal(null)} projeto={projeto} grupo={modal?.grupo} podeGerenciar={modal?.grupo ? podeGerenciarGrupo(modal.grupo, projeto, perfil?.id, ehAdmin) : true} />
    </div>
  )
}

function CartaoGrupo({ grupo, projeto, aberto, onAlternar, progresso, onEditar }: { grupo: GrupoTarefas; projeto: Projeto; aberto: boolean; onAlternar: () => void; progresso: number; onEditar: () => void }) {
  const { perfil, ehAdmin } = usePermissoes()
  const [aba, setAba] = useState<AbaGrupo>('tarefas')
  const gerencia = podeGerenciarGrupo(grupo, projeto, perfil?.id, ehAdmin)

  return (
    <section className="card overflow-hidden border-l-4 border-l-brand-500">
      <button type="button" onClick={onAlternar} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{grupo.titulo}</span>
            {grupo.restrito && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Grupo restrito" />}
          </span>
          <span className="block truncate text-xs text-slate-500">Resp: {grupo.responsavelNome ?? '—'}</span>
          <span className="mt-1.5 flex items-center gap-2">
            <ProgressoBar progresso={progresso} className="h-1.5 max-w-xs" />
            <span className="text-[11px] font-medium text-slate-500">{progresso}%</span>
          </span>
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="border-t border-slate-100 px-4 pb-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex gap-1" role="tablist">
              {(
                [
                  ['tarefas', 'Tarefas'],
                  ['detalhes', 'Detalhes'],
                ] as const
              ).map(([v, t]) => (
                <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)} className={cn('-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors', aba === v ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200')}>
                  {t}
                </button>
              ))}
            </div>
            {gerencia && (
              <Button variant="ghost" size="sm" icon={Pencil} onClick={onEditar}>
                Editar grupo
              </Button>
            )}
          </div>

          <div className="mt-4">
            {aba === 'tarefas' ? (
              <TarefasProjeto projeto={projeto} grupo={grupo} />
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Descrição</p>
                  {grupo.descricao ? <p className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">{grupo.descricao}</p> : <p className="text-slate-400">—</p>}
                </div>
                {grupo.driveUrl && (
                  <a href={grupo.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                    <FolderOpen className="h-4 w-4" /> Acessar o Drive deste grupo <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                )}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Acesso</p>
                  {grupo.restrito ? (
                    <p className="text-slate-700 dark:text-slate-200">
                      <Lock className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
                      Restrito a: {grupo.membros.length > 0 ? grupo.membros.map((m) => m.nome ?? '—').join(', ') : 'ninguém escolhido'} (além do dono do projeto, do responsável do grupo e do administrador).
                    </p>
                  ) : (
                    <p className="text-slate-700 dark:text-slate-200">Toda a equipe do projeto.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
