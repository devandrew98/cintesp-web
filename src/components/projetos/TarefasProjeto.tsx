import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Check, ListChecks, Plus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ProgressoBar } from './ProgressoBar'
import { SetasOrdem } from './SetasOrdem'
import { TarefaModal } from './TarefaModal'
import { atualizarTarefa, listarTarefas, reordenarTarefas } from '@/data/tarefas'
import { usePermissoes } from '@/hooks/usePermissoes'
import { equipeDoGrupo, type GrupoTarefas } from '@/lib/grupos'
import { hojeISO } from '@/lib/agendamento'
import {
  STATUS_TAREFA,
  VISOES,
  alternarConcluida,
  atrasada,
  guardarVisao,
  infoPrioridade,
  infoStatus,
  lerVisao,
  minhasTarefas,
  moverNaOrdem,
  ordenarTarefas,
  permissoesTarefa,
  rotuloConferencia,
  statusPermitidos,
  resumoTarefas,
  tarefasDoStatus,
  type DadosTarefa,
  type PermissoesTarefa,
  type StatusTarefa,
  type Tarefa,
  type VisaoTarefas,
} from '@/lib/tarefas'
import { cn, formatDateOnlyBR, mensagemErro } from '@/lib/utils'
import type { Projeto } from '@/types'

/**
 * Tarefas de UM GRUPO do projeto, em 4 visões que o pesquisador escolhe (e o navegador lembra):
 * Tabela, Por status (quadro), Minhas tarefas e Checklist.
 * O que cada um pode fazer vem de permissoesTarefa(): sem liberação, o colaborador só consulta.
 */
export function TarefasProjeto({ projeto, grupo }: { projeto: Projeto; grupo: GrupoTarefas }) {
  const qc = useQueryClient()
  const { perfil, ehAdmin } = usePermissoes()
  const hoje = hojeISO()
  const perms = permissoesTarefa(projeto, perfil?.id, ehAdmin)
  const [visao, setVisao] = useState<VisaoTarefas>(() => lerVisao())
  const [erro, setErro] = useState<string | null>(null)
  const [modal, setModal] = useState<{ tarefa?: Tarefa; status?: StatusTarefa; responsavelId?: string } | null>(null)

  const equipe = useMemo(() => equipeDoGrupo(grupo, projeto), [grupo, projeto])
  const chave = ['tarefas', projeto.id]
  const { data: todas = [], isLoading } = useQuery({ queryKey: chave, queryFn: () => listarTarefas(projeto.id) })
  const tarefas = useMemo(() => todas.filter((t) => t.grupoId === grupo.id), [todas, grupo.id])

  // Mudança rápida (status, responsável, prazo…): aparece na hora e desfaz se o servidor recusar.
  const mudar = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<DadosTarefa> }) => atualizarTarefa(id, patch),
    onMutate: async ({ id, patch }) => {
      setErro(null)
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<Tarefa[]>(chave)
      qc.setQueryData<Tarefa[]>(chave, (l = []) =>
        l.map((t) => {
          if (t.id !== id) return t
          const resp = 'responsavelId' in patch ? projeto.pesquisadores.find((p) => p.usuarioId === patch.responsavelId) : undefined
          const nomeResp = resp?.nome ?? equipe.find((e) => e.id === patch.responsavelId)?.nome
          return { ...t, ...patch, ...('responsavelId' in patch ? { responsavelNome: nomeResp, responsavelFotoUrl: resp?.fotoUrl } : {}) }
        }),
      )
      return { antes }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(chave, ctx.antes)
      setErro(mensagemErro(e))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: chave })
      qc.invalidateQueries({ queryKey: ['projetos'] }) // o progresso do projeto acompanha as tarefas
    },
  })

  const ordenar = useMutation({
    mutationFn: reordenarTarefas,
    onMutate: () => setErro(null),
    onError: (e) => setErro(mensagemErro(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })
  const ordenadas = useMemo(() => ordenarTarefas(tarefas), [tarefas])
  const mover = (id: string, passo: -1 | 1) => ordenar.mutate(moverNaOrdem(ordenadas.map((t) => t.id), id, passo))
  const ordem: Ordem | undefined = perms.gestor && tarefas.length > 1 ? { ids: ordenadas.map((t) => t.id), ocupado: ordenar.isPending, mover } : undefined

  const resumo = useMemo(() => resumoTarefas(tarefas), [tarefas])
  const minhas = useMemo(() => minhasTarefas(tarefas, perfil?.id), [tarefas, perfil?.id])
  const abrir = (tarefa: Tarefa) => setModal({ tarefa })
  const trocarStatus = (t: Tarefa, status: StatusTarefa) => mudar.mutate({ id: t.id, patch: { status } })

  const escolherVisao = (v: VisaoTarefas) => {
    setVisao(v)
    guardarVisao(v)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-slate-200 p-0.5 dark:border-slate-700" role="tablist" aria-label="Visão das tarefas">
          {VISOES.map((v) => (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={visao === v.value}
              onClick={() => escolherVisao(v.value)}
              className={cn('whitespace-nowrap rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors', visao === v.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}
            >
              {v.label}
            </button>
          ))}
        </div>
        {perms.criar && (
          <Button icon={Plus} onClick={() => setModal({})} className="w-full sm:w-auto">
            Nova tarefa
          </Button>
        )}
      </div>

      {resumo.total > 0 && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="shrink-0">
            {resumo.concluidas} de {resumo.total} concluída(s)
          </span>
          <ProgressoBar progresso={resumo.percentual} className="max-w-xs" />
          <span>{resumo.percentual}%</span>
        </div>
      )}
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-400">Carregando tarefas…</p>
      ) : tarefas.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-14 text-center">
          <ListChecks className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Nenhuma tarefa neste grupo ainda.{perms.criar ? ' Crie a primeira!' : ''}</p>
        </div>
      ) : visao === 'tabela' ? (
        <TabelaTarefas lista={ordenadas} hoje={hoje} perms={perms} ordem={ordem} equipe={equipe} onAbrir={abrir} onMudar={(id, patch) => mudar.mutate({ id, patch })} />
      ) : visao === 'status' ? (
        <QuadroStatus tarefas={tarefas} hoje={hoje} perms={perms} onAbrir={abrir} onNova={(status) => setModal({ status })} onTrocarStatus={trocarStatus} />
      ) : visao === 'minhas' ? (
        minhas.length === 0 ? (
          <p className="card px-4 py-12 text-center text-sm text-slate-500">Nenhuma tarefa atribuída a você neste projeto.</p>
        ) : (
          <TabelaTarefas lista={minhas} hoje={hoje} perms={perms} equipe={equipe} onAbrir={abrir} onMudar={(id, patch) => mudar.mutate({ id, patch })} />
        )
      ) : (
        <Checklist lista={ordenadas} hoje={hoje} perms={perms} ordem={ordem} onAbrir={abrir} onAlternar={(t) => trocarStatus(t, alternarConcluida(t.status))} />
      )}

      <TarefaModal
        open={modal !== null}
        onClose={() => setModal(null)}
        projeto={projeto}
        grupo={grupo}
        tarefa={modal?.tarefa}
        statusInicial={modal?.status}
        responsavelInicialId={visao === 'minhas' ? perfil?.id : undefined}
        perms={perms}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

interface Ordem {
  ids: string[]
  ocupado: boolean
  mover: (id: string, passo: -1 | 1) => void
}

function Setas({ t, ordem }: { t: Tarefa; ordem: Ordem }) {
  const i = ordem.ids.indexOf(t.id)
  return <SetasOrdem nome={t.titulo} primeiro={i === 0} ultimo={i === ordem.ids.length - 1} ocupado={ordem.ocupado} onMover={(passo) => ordem.mover(t.id, passo)} />
}

function SeloConferencia({ t }: { t: Tarefa }) {
  if (!t.conferencia) return null
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-100 px-2 py-0.5 align-middle text-[10px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" title={t.conferidaPorNome ? `Por ${t.conferidaPorNome}` : undefined}>
      <Check className="h-3 w-3" /> {rotuloConferencia(t.conferencia)}
    </span>
  )
}

function PillStatus({ status }: { status: StatusTarefa }) {
  const i = infoStatus(status)
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', i.pill)}>{i.label}</span>
}

function Responsavel({ t }: { t: Pick<Tarefa, 'responsavelNome' | 'responsavelFotoUrl'> }) {
  if (!t.responsavelNome) return <span className="text-xs text-slate-400">—</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <Avatar nome={t.responsavelNome} fotoUrl={t.responsavelFotoUrl} size="sm" className="h-6 w-6 text-[9px]" />
      <span className="truncate">{t.responsavelNome}</span>
    </span>
  )
}

function Entrega({ t, hoje }: { t: Tarefa; hoje: string }) {
  if (!t.dataEntrega) return <span className="text-xs text-slate-400">—</span>
  const atraso = atrasada(t, hoje)
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs', atraso ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300')}>
      <Calendar className="h-3.5 w-3.5" />
      {formatDateOnlyBR(t.dataEntrega)}
      {atraso && ' · atrasada'}
    </span>
  )
}

const seletorPill = 'rounded-full border-0 py-0.5 pl-2.5 pr-6 text-xs font-medium focus:ring-2 focus:ring-brand-500'

// ---- Tabela ----
function TabelaTarefas({
  lista,
  hoje,
  perms,
  ordem,
  equipe,
  onAbrir,
  onMudar,
}: {
  lista: Tarefa[]
  hoje: string
  perms: PermissoesTarefa
  ordem?: Ordem
  equipe: { id: string; nome: string }[]
  onAbrir: (t: Tarefa) => void
  onMudar: (id: string, patch: Partial<DadosTarefa>) => void
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[840px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
            <th className="px-4 py-3 font-semibold">Tarefa</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 font-semibold">Responsável</th>
            <th className="px-3 py-3 font-semibold">Início</th>
            <th className="px-3 py-3 font-semibold">Entrega</th>
            <th className="px-3 py-3 font-semibold">Prioridade</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {lista.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
              <td className="max-w-[320px] px-4 py-2.5">
                <span className="flex items-center gap-2">
                  {ordem && <Setas t={t} ordem={ordem} />}
                  <span className="min-w-0">
                    <button type="button" onClick={() => onAbrir(t)} className={cn('text-left font-medium hover:text-brand-600', t.status === 'concluido' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>
                      {t.titulo}
                    </button>
                    <SeloConferencia t={t} />
                  </span>
                </span>
              </td>
              <td className="px-3 py-2.5">
                {statusPermitidos(t.status, perms).length > 1 ? (
                  <select
                    value={t.status}
                    onChange={(e) => onMudar(t.id, { status: e.target.value as StatusTarefa })}
                    aria-label={`Status de ${t.titulo}`}
                    className={cn(seletorPill, infoStatus(t.status).pill)}
                  >
                    {statusPermitidos(t.status, perms).map((s) => (
                      <option key={s} value={s}>
                        {infoStatus(s).label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <PillStatus status={t.status} />
                )}
              </td>
              <td className="px-3 py-2.5">
                {perms.editar ? (
                  <select
                    value={t.responsavelId ?? ''}
                    onChange={(e) => onMudar(t.id, { responsavelId: e.target.value || undefined })}
                    aria-label={`Responsável por ${t.titulo}`}
                    className="max-w-[180px] rounded-lg border border-transparent bg-transparent py-0.5 pl-1 pr-6 text-xs text-slate-600 hover:border-slate-200 focus:border-brand-500 dark:text-slate-300 dark:hover:border-slate-700"
                  >
                    <option value="">— Sem responsável —</option>
                    {equipe.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                    {t.responsavelId && !equipe.some((p) => p.id === t.responsavelId) && <option value={t.responsavelId}>{t.responsavelNome}</option>}
                  </select>
                ) : (
                  <Responsavel t={t} />
                )}
              </td>
              <td className="px-3 py-2.5">
                {perms.editar ? (
                  <input
                    type="date"
                    value={t.dataInicio ?? ''}
                    max={t.dataEntrega}
                    onChange={(e) => onMudar(t.id, { dataInicio: e.target.value || undefined })}
                    aria-label={`Início de ${t.titulo}`}
                    className="rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-600 hover:border-slate-200 focus:border-brand-500 dark:text-slate-300 dark:hover:border-slate-700"
                  />
                ) : (
                  <span className="text-xs text-slate-600 dark:text-slate-300">{t.dataInicio ? formatDateOnlyBR(t.dataInicio) : '—'}</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                {perms.editar ? (
                  <div className="flex flex-col items-start gap-0.5">
                    <input
                      type="date"
                      value={t.dataEntrega ?? ''}
                      min={t.dataInicio}
                      onChange={(e) => onMudar(t.id, { dataEntrega: e.target.value || undefined })}
                      aria-label={`Entrega de ${t.titulo}`}
                      className={cn('rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-slate-200 focus:border-brand-500 dark:hover:border-slate-700', atrasada(t, hoje) ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300')}
                    />
                  </div>
                ) : (
                  <Entrega t={t} hoje={hoje} />
                )}
              </td>
              <td className="px-3 py-2.5">
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', infoPrioridade(t.prioridade).pill)}>{infoPrioridade(t.prioridade).label}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- Quadro por status (arrastar e soltar no computador; seletor no cartão no celular) ----
function QuadroStatus({
  tarefas,
  hoje,
  perms,
  onAbrir,
  onNova,
  onTrocarStatus,
}: {
  tarefas: Tarefa[]
  hoje: string
  perms: PermissoesTarefa
  onAbrir: (t: Tarefa) => void
  onNova: (status: StatusTarefa) => void
  onTrocarStatus: (t: Tarefa, s: StatusTarefa) => void
}) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<StatusTarefa | null>(null)

  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
      {STATUS_TAREFA.map((col) => {
        const itens = tarefasDoStatus(tarefas, col.value)
        return (
          <section
            key={col.value}
            onDragOver={(e) => {
              const t = tarefas.find((x) => x.id === arrastando)
              if (!t || !statusPermitidos(t.status, perms).includes(col.value)) return
              e.preventDefault()
              setSobre(col.value)
            }}
            onDragLeave={() => setSobre((s) => (s === col.value ? null : s))}
            onDrop={(e) => {
              e.preventDefault()
              const t = tarefas.find((x) => x.id === arrastando)
              if (t && t.status !== col.value && statusPermitidos(t.status, perms).includes(col.value)) onTrocarStatus(t, col.value)
              setArrastando(null)
              setSobre(null)
            }}
            className={cn('w-[82vw] shrink-0 snap-start rounded-2xl p-2.5 sm:w-72 lg:w-auto', col.coluna, sobre === col.value && 'ring-2 ring-brand-400')}
          >
            <header className="mb-2 flex items-center justify-between px-1">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', col.pill)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', col.ponto)} />
                {col.label}
              </span>
              <span className="text-xs font-medium text-slate-400">{itens.length}</span>
            </header>
            <div className="space-y-2">
              {itens.map((t) => (
                <article
                  key={t.id}
                  draggable={statusPermitidos(t.status, perms).length > 1}
                  onDragStart={() => setArrastando(t.id)}
                  onDragEnd={() => {
                    setArrastando(null)
                    setSobre(null)
                  }}
                  className={cn('rounded-xl border border-slate-200 bg-white p-3 shadow-card dark:border-slate-700 dark:bg-slate-900', statusPermitidos(t.status, perms).length > 1 && 'cursor-grab active:cursor-grabbing', arrastando === t.id && 'opacity-50')}
                >
                  <button type="button" onClick={() => onAbrir(t)} className={cn('block w-full text-left text-sm font-medium', t.status === 'concluido' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>
                    {t.titulo}
                  </button>
                  <SeloConferencia t={t} />
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Responsavel t={t} />
                    <Entrega t={t} hoje={hoje} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', infoPrioridade(t.prioridade).pill)}>{infoPrioridade(t.prioridade).label}</span>
                    {statusPermitidos(t.status, perms).length > 1 && (
                      <select
                        value={t.status}
                        onChange={(e) => onTrocarStatus(t, e.target.value as StatusTarefa)}
                        aria-label={`Mover ${t.titulo} para`}
                        className="rounded-lg border border-slate-200 bg-transparent py-0.5 pl-1.5 pr-6 text-[11px] text-slate-500 dark:border-slate-700 lg:hidden"
                      >
                        {statusPermitidos(t.status, perms).map((s) => (
                          <option key={s} value={s}>
                            {infoStatus(s).label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </article>
              ))}
              {perms.criar && (perms.gestor || col.value !== 'concluido') && (
                <button type="button" onClick={() => onNova(col.value)} className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-sm text-slate-400 hover:bg-white/70 hover:text-brand-600 dark:hover:bg-slate-800/60">
                  <Plus className="h-4 w-4" /> Adicionar tarefa
                </button>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ---- Checklist ----
function Checklist({ lista, hoje, perms, ordem, onAbrir, onAlternar }: { lista: Tarefa[]; hoje: string; perms: PermissoesTarefa; ordem?: Ordem; onAbrir: (t: Tarefa) => void; onAlternar: (t: Tarefa) => void }) {
  const pendentes = lista.filter((t) => t.status !== 'concluido')
  const feitas = lista.filter((t) => t.status === 'concluido')
  const linha = (t: Tarefa) => (
    <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
      {ordem && <Setas t={t} ordem={ordem} />}
      <button
        type="button"
        disabled={!perms.gestor}
        title={perms.gestor ? undefined : 'Só o responsável pelo projeto ou o administrador conclui tarefas'}
        onClick={() => onAlternar(t)}
        aria-label={t.status === 'concluido' ? `Reabrir ${t.titulo}` : `Concluir ${t.titulo}`}
        className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-default', t.status === 'concluido' ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:border-brand-500 dark:border-slate-600')}
      >
        {t.status === 'concluido' && <Check className="h-3.5 w-3.5" />}
      </button>
      <button type="button" onClick={() => onAbrir(t)} className="min-w-0 flex-1 text-left">
        <span className={cn('block truncate text-sm font-medium', t.status === 'concluido' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100')}>{t.titulo}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {t.status !== 'concluido' && t.status !== 'nao_iniciado' && <PillStatus status={t.status} />}
          <Entrega t={t} hoje={hoje} />
          <SeloConferencia t={t} />
        </span>
      </button>
      <Responsavel t={t} />
    </li>
  )
  return (
    <div className="space-y-4">
      <ul className="card divide-y divide-slate-100 dark:divide-slate-800">{pendentes.length === 0 ? <li className="px-4 py-6 text-center text-sm text-slate-400">Tudo concluído! 🎉</li> : pendentes.map(linha)}</ul>
      {feitas.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Concluídas ({feitas.length})</p>
          <ul className="card divide-y divide-slate-100 dark:divide-slate-800">{feitas.map(linha)}</ul>
        </div>
      )}
    </div>
  )
}
