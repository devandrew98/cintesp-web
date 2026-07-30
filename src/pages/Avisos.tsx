import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Megaphone,
  Clock,
  CheckCircle2,
  Eye,
  Search,
  SlidersHorizontal,
  Plus,
  Calendar,
  Users,
  ChevronRight,
  Pin,
  Mail,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { SectionCard } from '@/components/ui/SectionCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AvisoFormModal } from '@/components/avisos/AvisoFormModal'
import { AvisoDetailModal } from '@/components/avisos/AvisoDetailModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { tipoAvisoInfo, statusAvisoInfo } from '@/lib/avisos'
import { cn, formatDateBR } from '@/lib/utils'
import {
  listarAvisos,
  criarAviso,
  atualizarAviso,
  excluirAviso,
  estatisticasAvisos,
  registrarLeituraAviso,
} from '@/data/api'
import { usePermissoes } from '@/hooks/usePermissoes'
import type { Aviso, TipoAviso } from '@/types'

const tiposFiltro: Array<{ value: TipoAviso | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'importante', label: 'Importante' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'treinamento', label: 'Treinamento' },
  { value: 'geral', label: 'Geral' },
]

export function AvisosPage() {
  const queryClient = useQueryClient()
  // Lê os avisos (Supabase quando conectado; senão, mock).
  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['avisos'],
    queryFn: listarAvisos,
  })
  // KPIs REAIS (lidos hoje / visualizações), atualizados ao vivo.
  const { data: stats } = useQuery({
    queryKey: ['avisos-stats'],
    queryFn: estatisticasAvisos,
    refetchOnWindowFocus: true,
  })
  // Cria um aviso e atualiza a lista no cache.
  const criar = useMutation({
    mutationFn: criarAviso,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['avisos'] }),
  })

  // Edita um aviso já publicado (só admin, garantido também pelo RLS).
  const editar = useMutation({
    mutationFn: atualizarAviso,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avisos'] })
      setEmEdicao(null)
      setModalAberto(false)
    },
  })
  const remover = useMutation({
    mutationFn: excluirAviso,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avisos'] })
      setAberto(null)
      setAExcluir(null)
    },
  })

  // Só administradores (ou quem tem 'publicar_avisos') podem criar avisos.
  const { podePublicarAvisos } = usePermissoes()
  // Aviso aberto para leitura (modal de detalhe).
  const [aberto, setAberto] = useState<Aviso | null>(null)
  // Aviso sendo editado (abre o formulário em modo edição).
  const [emEdicao, setEmEdicao] = useState<Aviso | null>(null)
  const [aExcluir, setAExcluir] = useState<Aviso | null>(null)
  const [query, setQuery] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<TipoAviso | 'todos'>('todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)

  // Ao abrir um aviso, registra a leitura e atualiza os KPIs.
  useEffect(() => {
    if (!aberto) return
    registrarLeituraAviso(aberto.id).then(() =>
      queryClient.invalidateQueries({ queryKey: ['avisos-stats'] }),
    )
  }, [aberto, queryClient])

  const recentes = useMemo(() => {
    return lista
      .filter((a) => a.status !== 'arquivado')
      .filter((a) => tipoFiltro === 'todos' || a.tipo === tipoFiltro)
      .filter((a) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return a.titulo.toLowerCase().includes(q) || a.descricao.toLowerCase().includes(q)
      })
      .sort((a, b) => +new Date(b.data) - +new Date(a.data))
  }, [lista, query, tipoFiltro])

  const destaques = useMemo(() => lista.filter((a) => a.destaque), [lista])

  const kpis = useMemo(
    () => ({
      ativos: lista.filter((a) => a.status === 'ativo').length,
      programados: lista.filter((a) => a.status === 'programado').length,
    }),
    [lista],
  )

  return (
    <div>
      <PageHeader
        title="Avisos"
        subtitle="Acompanhe comunicados e informações importantes da equipe."
        actions={
          <>
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar avisos..."
                className="h-10 w-56 pl-9"
              />
            </div>
            <Button
              variant="secondary"
              icon={SlidersHorizontal}
              onClick={() => setMostrarFiltros((v) => !v)}
            >
              Filtros
            </Button>
            {podePublicarAvisos && (
              <Button icon={Plus} onClick={() => setModalAberto(true)}>
                Novo Aviso
              </Button>
            )}
          </>
        }
      />

      {/* Busca no mobile */}
      <div className="relative mb-4 sm:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar avisos..."
          className="pl-9"
        />
      </div>

      {/* Linha de filtros por tipo */}
      {mostrarFiltros && (
        <div className="mb-5 flex flex-wrap gap-2">
          {tiposFiltro.map((t) => (
            <button
              key={t.value}
              onClick={() => setTipoFiltro(t.value)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                tipoFiltro === t.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Megaphone} value={kpis.ativos} label="Avisos ativos" hint="Publicados" accent="green" />
        <StatCard icon={Clock} value={kpis.programados} label="Programados" hint="Agendados para publicação" accent="amber" />
        <StatCard icon={CheckCircle2} value={stats?.lidosHoje ?? 0} label="Lidos hoje" hint="Aberturas de avisos hoje" accent="blue" />
        <StatCard icon={Eye} value={stats?.visualizacoes7d ?? 0} label="Visualizações" hint="Últimos 7 dias" accent="violet" />
      </div>

      {/* Recentes + Destaque */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Avisos Recentes"
          action={<span className="text-sm font-medium text-brand-600">{recentes.length} avisos</span>}
          bodyClassName="p-2"
        >
          {isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">Carregando avisos…</p>
          ) : recentes.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              Nenhum aviso encontrado para os filtros selecionados.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentes.map((a) => (
                <AvisoRecenteCard key={a.id} aviso={a} onAbrir={() => setAberto(a)} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Avisos em Destaque"
          bodyClassName="space-y-3 p-3"
        >
          {destaques.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-slate-400">
              Nenhum aviso em destaque.
            </p>
          ) : (
            destaques.map((a) => (
              <AvisoDestaqueCard key={a.id} aviso={a} onAbrir={() => setAberto(a)} />
            ))
          )}
        </SectionCard>
      </div>

      {/* Banner e-mail */}
      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-brand-100 bg-brand-50 p-5 dark:border-brand-500/20 dark:bg-brand-500/10 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">Receber avisos por e-mail</p>
            <p className="text-sm text-slate-500">
              Ative para receber todos os avisos importantes diretamente no seu e-mail.
            </p>
          </div>
        </div>
        {/* Leva para a tela onde as notificações são realmente configuradas */}
        <Link
          to="/admin/configuracoes"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Configurar notificações
        </Link>
      </div>

      {/* Formulário: cria um aviso novo OU edita um existente */}
      {(modalAberto || emEdicao) && (
        <AvisoFormModal
          key={emEdicao?.id ?? 'novo'}
          open={modalAberto || Boolean(emEdicao)}
          avisoEmEdicao={emEdicao}
          salvando={criar.isPending || editar.isPending}
          onClose={() => {
            setModalAberto(false)
            setEmEdicao(null)
          }}
          onSalvar={(registro) => {
            if (emEdicao) editar.mutate(registro)
            else {
              criar.mutate(registro)
              setModalAberto(false)
            }
          }}
        />
      )}

      {/* Leitura do aviso, com compartilhar e (para admin) editar/excluir */}
      {aberto && (
        <AvisoDetailModal
          aviso={aberto}
          open={Boolean(aberto)}
          onClose={() => setAberto(null)}
          podeGerenciar={podePublicarAvisos}
          onEditar={() => {
            setEmEdicao(aberto)
            setAberto(null)
          }}
          onExcluir={() => setAExcluir(aberto)}
        />
      )}

      {/* Confirmação antes de excluir */}
      <ConfirmDialog
        open={Boolean(aExcluir)}
        onClose={() => setAExcluir(null)}
        onConfirm={() => aExcluir && remover.mutate(aExcluir.id)}
        title="Excluir aviso"
        message={`Tem certeza que deseja excluir "${aExcluir?.titulo}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  )
}

function AvisoRecenteCard({ aviso, onAbrir }: { aviso: Aviso; onAbrir: () => void }) {
  const info = tipoAvisoInfo[aviso.tipo]
  const status = statusAvisoInfo[aviso.status]
  const Icon = info.icon

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', info.iconBox)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-semibold text-slate-800 dark:text-slate-100">{aviso.titulo}</h3>
          <Badge tone={status.tone as 'green' | 'amber' | 'slate'}>{status.label}</Badge>
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{aviso.descricao}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateBR(aviso.data)}
            {aviso.hora && ` · ${aviso.hora}`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {aviso.publicoAlvo}
          </span>
          {aviso.publicadoHa && <span>Publicado {aviso.publicadoHa}</span>}
        </div>
      </div>

      <ChevronRight className="mt-1 h-4 w-4 shrink-0 self-center text-slate-300" />
    </button>
  )
}

function AvisoDestaqueCard({ aviso, onAbrir }: { aviso: Aviso; onAbrir: () => void }) {
  const info = tipoAvisoInfo[aviso.tipo]
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="w-full rounded-xl border border-slate-100 bg-white p-4 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-brand-500/30"
    >
      <div className="flex items-start justify-between">
        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', info.pill)}>
          {info.label}
        </span>
        <Pin className="h-4 w-4 -rotate-45 fill-current text-brand-500" />
      </div>
      <h3 className="mt-2 font-semibold text-slate-800 dark:text-slate-100">{aviso.titulo}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{aviso.descricao}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDateBR(aviso.data)}
          {aviso.hora && ` · ${aviso.hora}`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {aviso.publicoAlvo}
        </span>
      </div>
    </button>
  )
}
