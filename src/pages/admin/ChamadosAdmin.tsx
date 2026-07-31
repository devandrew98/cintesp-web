import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Headphones, Loader2, PlayCircle, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { listarChamados, aceitarChamado, atualizarStatusChamado } from '@/data/chamados'
import {
  SETORES,
  rotuloSetor,
  statusChamadoInfo,
  prioridadeChamadoInfo,
} from '@/lib/chamados'
import { formatDateBR } from '@/lib/utils'
import type { SetorChamado, StatusChamado } from '@/types'

const STATUS_OPCOES: StatusChamado[] = [
  'aberto',
  'em_andamento',
  'aguardando_usuario',
  'finalizado',
  'cancelado',
]

/**
 * "Chamados" (Administração) — só administradores.
 * Lista todos os chamados, com KPIs, filtros por setor/status/prioridade e
 * as ações de aceitar (→ em andamento) e mudar o status.
 */
export function ChamadosAdminPage() {
  const qc = useQueryClient()
  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['chamados'],
    queryFn: listarChamados,
  })

  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<StatusChamado | 'todos'>('todos')
  const [setor, setSetor] = useState<SetorChamado | 'todos'>('todos')

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['chamados'] })
    qc.invalidateQueries({ queryKey: ['meus-chamados'] })
  }
  const aceitar = useMutation({ mutationFn: aceitarChamado, onSuccess: invalidar })
  const mudarStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusChamado }) =>
      atualizarStatusChamado(id, status),
    onSuccess: invalidar,
  })

  const kpis = useMemo(
    () => ({
      abertos: lista.filter((c) => c.status === 'aberto').length,
      emAndamento: lista.filter((c) => c.status === 'em_andamento').length,
      aguardando: lista.filter((c) => c.status === 'aguardando_usuario').length,
      finalizados: lista.filter((c) => c.status === 'finalizado').length,
    }),
    [lista],
  )

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista.filter((c) => {
      if (status !== 'todos' && c.status !== status) return false
      if (setor !== 'todos' && c.setor !== setor) return false
      if (q) {
        const alvo = `${c.titulo} ${c.descricao} ${c.solicitanteNome ?? ''}`.toLowerCase()
        if (!alvo.includes(q)) return false
      }
      return true
    })
  }, [lista, busca, status, setor])

  return (
    <div>
      <PageHeader
        title="Chamados"
        subtitle="Acompanhe, aceite e resolva os chamados abertos pela equipe."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Headphones} value={kpis.abertos} label="Abertos" accent="green" />
        <StatCard icon={PlayCircle} value={kpis.emAndamento} label="Em andamento" accent="blue" />
        <StatCard icon={Loader2} value={kpis.aguardando} label="Aguardando usuário" accent="amber" />
        <StatCard icon={Headphones} value={kpis.finalizados} label="Finalizados" accent="violet" />
      </div>

      {/* Filtros */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, descrição ou solicitante…"
            className="pl-9"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as StatusChamado | 'todos')}>
          <option value="todos">Todos os status</option>
          {STATUS_OPCOES.map((s) => (
            <option key={s} value={s}>
              {statusChamadoInfo[s].label}
            </option>
          ))}
        </Select>
        <Select value={setor} onChange={(e) => setSetor(e.target.value as SetorChamado | 'todos')}>
          <option value="todos">Todos os setores</option>
          {SETORES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Lista */}
      <div className="mt-5">
        {isLoading ? (
          <div className="card flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando chamados…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="card px-6 py-16 text-center text-sm text-slate-400">
            Nenhum chamado encontrado.
          </div>
        ) : (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {filtrados.map((c) => {
              const st = statusChamadoInfo[c.status]
              const pr = prioridadeChamadoInfo[c.prioridade]
              return (
                <div key={c.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  {/* Título + descrição */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{c.titulo}</p>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {rotuloSetor(c.setor)}
                        {c.categoria ? ` · ${c.categoria}` : ''}
                      </span>
                      <Badge tone={pr.tone as 'slate' | 'blue' | 'amber' | 'red'}>{pr.label}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{c.descricao}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar nome={c.solicitanteNome ?? '—'} size="sm" className="h-5 w-5 text-[9px]" />
                        {c.solicitanteNome ?? '—'}
                      </span>
                      <span>· {formatDateBR(c.criadoEm)}</span>
                      {c.responsavelNome && <span>· Resp.: {c.responsavelNome}</span>}
                    </div>
                  </div>

                  {/* Status + ações */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={st.tone as 'green' | 'amber' | 'blue' | 'violet' | 'slate'} dot>
                      {st.label}
                    </Badge>
                    {c.status === 'aberto' ? (
                      <button
                        onClick={() => aceitar.mutate(c.id)}
                        disabled={aceitar.isPending}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        Aceitar
                      </button>
                    ) : (
                      <Select
                        value={c.status}
                        onChange={(e) =>
                          mudarStatus.mutate({ id: c.id, status: e.target.value as StatusChamado })
                        }
                        className="h-9 w-44 text-sm"
                      >
                        {STATUS_OPCOES.map((s) => (
                          <option key={s} value={s}>
                            {statusChamadoInfo[s].label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
