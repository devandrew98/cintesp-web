import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PersonRow } from '@/components/ui/PersonRow'
import { filtrarUsuarios } from '@/lib/pesquisadores'
import { cn } from '@/lib/utils'
import { listarUsuarios } from '@/data/api'
import { PesquisadorDetailModal } from '@/components/pesquisadores/PesquisadorDetailModal'
import type { StatusDisponibilidade, Usuario } from '@/types'

/**
 * Tela "Busca Rápida" (Fase 5).
 * Campo de busca em destaque + chips de status para encontrar pesquisadores
 * na hora. Filtra por nome, e-mail, função ou área conforme você digita.
 */
const chipsStatus: Array<{ value: StatusDisponibilidade | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'disponivel', label: 'Disponíveis' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'home_office', label: 'Home office' },
  { value: 'ausente', label: 'Ausentes' },
]

export function BuscaPage() {
  const [busca, setBusca] = useState('')
  // Pesquisador aberto no modal de detalhe (mesmo da tela Pesquisadores).
  const [selecionado, setSelecionado] = useState<Usuario | null>(null)
  const [status, setStatus] = useState<StatusDisponibilidade | 'todos'>('todos')

  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })

  const resultados = useMemo(
    () => filtrarUsuarios(usuarios, { busca, disponibilidade: status, apenasAtivos: true }),
    [usuarios, busca, status],
  )

  const digitou = busca.trim().length > 0 || status !== 'todos'

  return (
    <div>
      <PageHeader
        title="Busca Rápida"
        subtitle="Encontre pesquisadores por nome, área, e-mail ou status."
      />

      {/* Campo de busca em destaque */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Digite um nome, área ou e-mail..."
          className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-11 text-base text-slate-800 shadow-card placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Chips de status */}
      <div className="mt-4 flex flex-wrap gap-2">
        {chipsStatus.map((c) => (
          <button
            key={c.value}
            onClick={() => setStatus(c.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              status === c.value
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Resultados */}
      <div className="mt-6">
        {!digitou ? (
          <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <Search className="h-7 w-7" />
            </div>
            <p className="text-sm text-slate-500">
              Comece a digitar para buscar entre {usuarios.filter((u) => u.status === 'ativo').length}{' '}
              pesquisadores.
            </p>
          </div>
        ) : resultados.length === 0 ? (
          <div className="card px-6 py-16 text-center text-sm text-slate-400">
            Nenhum resultado para <strong className="text-slate-600 dark:text-slate-300">“{busca}”</strong>.
          </div>
        ) : (
          <div className="card p-2">
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}
            </p>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {resultados.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelecionado(u)}
                  className="w-full text-left"
                >
                  <PersonRow usuario={u} subtitle={u.areas[0]?.nome} compactStatus />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detalhe do pesquisador — mesmo modal usado na tela Pesquisadores */}
      <PesquisadorDetailModal usuario={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  )
}
