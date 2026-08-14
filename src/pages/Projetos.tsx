import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderKanban, Search, SlidersHorizontal, Plus, Users, Calendar, FolderOpen } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProgressoBar } from '@/components/projetos/ProgressoBar'
import { ProjetoFormModal } from '@/components/projetos/ProjetoFormModal'
import { ProjetoDetailModal } from '@/components/projetos/ProjetoDetailModal'
import { listarProjetos, criarProjeto, excluirProjeto } from '@/data/projetos'
import { listarUsuarios } from '@/data/api'
import { STATUS_PROJETO, statusProjetoInfo, rotuloTRL } from '@/lib/projetos'
import { usePermissoes } from '@/hooks/usePermissoes'
import { formatDateOnlyBR } from '@/lib/utils'
import type { Projeto, StatusProjeto } from '@/types'

export function ProjetosPage() {
  const qc = useQueryClient()
  const { ehAdmin } = usePermissoes()

  const { data: lista = [], isLoading } = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos })
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })

  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusProjeto | 'todos'>('todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const [modalNovo, setModalNovo] = useState(false)
  const [detalhe, setDetalhe] = useState<Projeto | null>(null)
  const [aExcluir, setAExcluir] = useState<Projeto | null>(null)

  const invalidar = () => qc.invalidateQueries({ queryKey: ['projetos'] })
  const criar = useMutation({ mutationFn: criarProjeto, onSuccess: () => { invalidar(); setModalNovo(false) } })
  const remover = useMutation({
    mutationFn: excluirProjeto,
    onSuccess: () => {
      invalidar()
      setAExcluir(null)
      setDetalhe(null)
    },
  })

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista
      .filter((p) => statusFiltro === 'todos' || p.status === statusFiltro)
      .filter((p) => {
        if (!q) return true
        return `${p.titulo} ${p.descricao ?? ''} ${p.responsavelNome ?? ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm))
  }, [lista, busca, statusFiltro])

  const kpis = useMemo(
    () => ({
      total: lista.length,
      emAndamento: lista.filter((p) => p.status === 'em_andamento').length,
      concluidos: lista.filter((p) => p.status === 'concluido').length,
    }),
    [lista],
  )

  return (
    <div>
      <PageHeader
        title="Projetos"
        subtitle={ehAdmin ? 'Todos os projetos de pesquisa.' : 'Projetos em que você está vinculado.'}
        actions={
          <>
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar projetos..."
                className="h-10 w-56 pl-9"
              />
            </div>
            <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setMostrarFiltros((v) => !v)}>
              Filtros
            </Button>
            {ehAdmin && (
              <Button icon={Plus} onClick={() => setModalNovo(true)}>
                Novo projeto
              </Button>
            )}
          </>
        }
      />

      <div className="relative mb-4 sm:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projetos..." className="pl-9" />
      </div>

      {mostrarFiltros && (
        <div className="mb-5">
          <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as typeof statusFiltro)} className="sm:w-64">
            <option value="todos">Todos os status</option>
            {STATUS_PROJETO.map((s) => (
              <option key={s} value={s}>
                {statusProjetoInfo[s].label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.total}</p>
          <p className="text-sm text-slate-500">{ehAdmin ? 'Projetos no total' : 'Meus projetos'}</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.emAndamento}</p>
          <p className="text-sm text-slate-500">Em andamento</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.concluidos}</p>
          <p className="text-sm text-slate-500">Concluídos</p>
        </div>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400">Carregando projetos…</p>
      ) : filtrados.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-16 text-center">
          <FolderOpen className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {lista.length === 0
              ? ehAdmin
                ? 'Nenhum projeto cadastrado ainda.'
                : 'Você ainda não está vinculado a nenhum projeto.'
              : 'Nenhum projeto encontrado para os filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((p) => (
            <ProjetoCard key={p.id} projeto={p} onAbrir={() => setDetalhe(p)} />
          ))}
        </div>
      )}

      {modalNovo && (
        <ProjetoFormModal
          open={modalNovo}
          onClose={() => setModalNovo(false)}
          salvando={criar.isPending}
          pesquisadores={usuarios}
          onSalvar={(dados) => criar.mutate(dados)}
        />
      )}

      <ProjetoDetailModal
        key={detalhe?.id}
        projeto={detalhe}
        onClose={() => setDetalhe(null)}
        usuarios={usuarios}
        onExcluir={() => detalhe && setAExcluir(detalhe)}
      />

      <ConfirmDialog
        open={Boolean(aExcluir)}
        onClose={() => setAExcluir(null)}
        onConfirm={() => aExcluir && remover.mutate(aExcluir.id)}
        title="Excluir projeto"
        message={`Tem certeza que deseja excluir "${aExcluir?.titulo}"? O chat e o histórico serão perdidos. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  )
}

function ProjetoCard({ projeto, onAbrir }: { projeto: Projeto; onAbrir: () => void }) {
  const st = statusProjetoInfo[projeto.status]
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="card flex flex-col gap-3 p-4 text-left transition-colors hover:border-brand-200 dark:hover:border-brand-500/30"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <FolderKanban className="h-5 w-5" />
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge tone={st.tone as 'green' | 'amber' | 'blue' | 'red' | 'slate'} dot>
            {st.label}
          </Badge>
          {projeto.trl && <Badge tone="violet">{rotuloTRL(projeto.trl)}</Badge>}
        </div>
      </div>

      <h3 className="line-clamp-2 font-semibold text-slate-900 dark:text-white">{projeto.titulo}</h3>
      {projeto.descricao && <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{projeto.descricao}</p>}

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>Progresso</span>
          <span>{projeto.progresso}%</span>
        </div>
        <ProgressoBar progresso={projeto.progresso} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
        <span className="inline-flex items-center gap-1.5">
          <Avatar nome={projeto.responsavelNome ?? '—'} fotoUrl={projeto.responsavelFotoUrl} size="sm" className="h-6 w-6 text-[10px]" />
          {projeto.responsavelNome ?? '—'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> {projeto.pesquisadores.length}
        </span>
      </div>
      {projeto.dataFimPrevista && (
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="h-3.5 w-3.5" /> Previsão: {formatDateOnlyBR(projeto.dataFimPrevista)}
        </p>
      )}
    </button>
  )
}
