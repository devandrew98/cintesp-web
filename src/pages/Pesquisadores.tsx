import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PesquisadorCard } from '@/components/ui/PesquisadorCard'
import { PesquisadorDetailModal } from '@/components/pesquisadores/PesquisadorDetailModal'
import { Input, Select } from '@/components/ui/Field'
import { filtrarUsuarios } from '@/lib/pesquisadores'
import { listarUsuarios, listarAreas } from '@/data/api'
import type { StatusDisponibilidade, Usuario } from '@/types'

/**
 * Tela "Pesquisadores" (Fase 5): diretório da equipe ativa.
 * Busca + filtros por área e status; clicar num card abre o detalhe
 * (contato, áreas e horário da semana).
 */
export function PesquisadoresPage() {
  const [busca, setBusca] = useState('')
  const [areaId, setAreaId] = useState('todas')
  const [disponibilidade, setDisponibilidade] = useState<StatusDisponibilidade | 'todos'>('todos')
  const [selecionado, setSelecionado] = useState<Usuario | null>(null)

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
  })
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: listarAreas })

  const ativos = useMemo(() => usuarios.filter((u) => u.status === 'ativo'), [usuarios])
  const filtrados = useMemo(
    () => filtrarUsuarios(ativos, { busca, areaId, disponibilidade }),
    [ativos, busca, areaId, disponibilidade],
  )

  return (
    <div>
      <PageHeader
        title="Pesquisadores"
        subtitle="Diretório da equipe — clique num pesquisador para ver os detalhes."
      />

      {/* Busca + filtros */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pesquisador..."
            className="pl-9"
          />
        </div>
        <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="todas">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </Select>
        <Select
          value={disponibilidade}
          onChange={(e) => setDisponibilidade(e.target.value as StatusDisponibilidade | 'todos')}
        >
          <option value="todos">Todos os status</option>
          <option value="disponivel">Disponíveis</option>
          <option value="em_atendimento">Em atendimento</option>
          <option value="ausente">Ausentes</option>
        </Select>
      </div>

      <p className="mt-5 mb-3 text-sm text-slate-500">
        {filtrados.length} {filtrados.length === 1 ? 'pesquisador' : 'pesquisadores'}
      </p>

      {isLoading ? (
        <div className="card flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando pesquisadores…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card px-6 py-16 text-center text-sm text-slate-400">
          Nenhum pesquisador encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((u) => (
            <PesquisadorCard key={u.id} usuario={u} onClick={() => setSelecionado(u)} />
          ))}
        </div>
      )}

      {/* Detalhe */}
      <PesquisadorDetailModal usuario={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  )
}
