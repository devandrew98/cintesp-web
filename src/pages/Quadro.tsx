import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Users2, Clock3, Search, SlidersHorizontal, X, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { PesquisadorCard } from '@/components/ui/PesquisadorCard'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { filtrarUsuarios } from '@/lib/pesquisadores'
import { listarUsuarios, listarAreas, listarFuncoes } from '@/data/api'
import type { StatusDisponibilidade } from '@/types'

/**
 * Tela "Quadro de Disponibilidade" (Fase 5).
 * Mostra toda a equipe ativa com filtros por status de disponibilidade,
 * área de atuação, função e busca por nome. Em modo mock lê de `data/mock`.
 */
export function QuadroPage() {
  const [busca, setBusca] = useState('')
  const [disponibilidade, setDisponibilidade] = useState<StatusDisponibilidade | 'todos'>('todos')
  const [areaId, setAreaId] = useState<string>('todas')
  const [funcaoId, setFuncaoId] = useState<string>('todas')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Dados (Supabase quando conectado; senão, mock).
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
  })
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: listarAreas })
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: listarFuncoes })

  // Só a equipe ativa aparece no quadro.
  const ativos = useMemo(() => usuarios.filter((u) => u.status === 'ativo'), [usuarios])

  const filtrados = useMemo(
    () => filtrarUsuarios(ativos, { busca, disponibilidade, areaId, funcaoId }),
    [ativos, busca, disponibilidade, areaId, funcaoId],
  )

  // KPIs sempre sobre o total ativo (não sobre o filtro).
  const kpis = useMemo(
    () => ({
      disponiveis: ativos.filter((u) => u.disponibilidade === 'disponivel').length,
      emAtendimento: ativos.filter((u) => u.disponibilidade === 'em_atendimento').length,
      ausentes: ativos.filter((u) => u.disponibilidade === 'ausente').length,
    }),
    [ativos],
  )

  const temFiltro = disponibilidade !== 'todos' || areaId !== 'todas' || funcaoId !== 'todas' || busca

  function limparFiltros() {
    setBusca('')
    setDisponibilidade('todos')
    setAreaId('todas')
    setFuncaoId('todas')
  }

  return (
    <div>
      <PageHeader
        title="Quadro de Disponibilidade"
        subtitle="Veja toda a equipe e filtre por status, área ou função."
        actions={
          <Button
            variant="secondary"
            icon={SlidersHorizontal}
            onClick={() => setMostrarFiltros((v) => !v)}
          >
            Filtros
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={CheckCircle2} value={kpis.disponiveis} label="Disponíveis agora" accent="green" />
        <StatCard icon={Users2} value={kpis.emAtendimento} label="Em atendimento" accent="blue" />
        <StatCard icon={Clock3} value={kpis.ausentes} label="Ausentes" accent="amber" />
      </div>

      {/* Barra de busca + filtros */}
      <div className="mt-6 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou área..."
            className="pl-9"
          />
        </div>

        {mostrarFiltros && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              value={disponibilidade}
              onChange={(e) => setDisponibilidade(e.target.value as StatusDisponibilidade | 'todos')}
            >
              <option value="todos">Todos os status</option>
              <option value="disponivel">Disponíveis</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="ausente">Ausentes</option>
            </Select>
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="todas">Todas as áreas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
            <Select value={funcaoId} onChange={(e) => setFuncaoId(e.target.value)}>
              <option value="todas">Todas as funções</option>
              {funcoes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Contador de resultados + limpar */}
      <div className="mt-5 mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {filtrados.length} {filtrados.length === 1 ? 'pesquisador' : 'pesquisadores'}
          {temFiltro ? ' (filtrado)' : ''}
        </p>
        {temFiltro && (
          <button
            onClick={limparFiltros}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Grade de cards */}
      {isLoading ? (
        <div className="card flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando equipe…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card px-6 py-16 text-center text-sm text-slate-400">
          Nenhum pesquisador encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((u) => (
            <PesquisadorCard key={u.id} usuario={u} />
          ))}
        </div>
      )}
    </div>
  )
}
