import { useMemo, useState } from 'react'
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { cn } from '@/lib/utils'
import type { StatusUsuario, Usuario } from '@/types'

const POR_PAGINA = 8

/**
 * Painel esquerdo da tela de Usuários: contador, botão "Novo Usuário",
 * busca por nome, filtro por status e a lista paginada de usuários.
 * O item selecionado é destacado; clicar chama `onSelect`.
 */
export function UserList({
  usuarios,
  selecionadoId,
  onSelect,
  onNovo,
}: {
  usuarios: Usuario[]
  selecionadoId: string
  onSelect: (id: string) => void
  onNovo: () => void
}) {
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusUsuario | 'todos'>('todos')
  const [pagina, setPagina] = useState(1)

  // Aplica busca + filtro de status.
  const filtrados = useMemo(() => {
    return usuarios.filter((u) => {
      const bateBusca = u.nome.toLowerCase().includes(busca.trim().toLowerCase())
      const bateStatus = statusFiltro === 'todos' || u.status === statusFiltro
      return bateBusca && bateStatus
    })
  }, [usuarios, busca, statusFiltro])

  // Recorte da página atual.
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  return (
    <div className="card flex h-full flex-col">
      {/* Cabeçalho: contador + botão novo */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Usuários</h2>
          <p className="text-xs text-slate-400">{usuarios.length} pesquisadores cadastrados</p>
        </div>
        <Button size="sm" icon={Plus} onClick={onNovo}>
          Novo
        </Button>
      </div>

      {/* Busca + filtro de status */}
      <div className="space-y-2 border-b border-slate-100 p-4 dark:border-slate-800">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPagina(1)
            }}
            placeholder="Buscar pesquisador..."
            className="pl-9"
          />
        </div>
        <Select
          value={statusFiltro}
          onChange={(e) => {
            setStatusFiltro(e.target.value as StatusUsuario | 'todos')
            setPagina(1)
          }}
        >
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </Select>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-2">
        {visiveis.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-slate-400">
            Nenhum pesquisador encontrado.
          </p>
        ) : (
          visiveis.map((u) => {
            const ativo = u.id === selecionadoId
            return (
              <button
                key={u.id}
                onClick={() => onSelect(u.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  ativo
                    ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                )}
              >
                <Avatar nome={u.nome} fotoUrl={u.fotoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {u.nome}
                  </p>
                  <p className="truncate text-xs text-slate-400">{u.funcao.nome}</p>
                </div>
                {/* Bolinha + rótulo de status */}
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    u.status === 'ativo'
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      u.status === 'ativo' ? 'bg-brand-500' : 'bg-slate-400',
                    )}
                  />
                  {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </button>
            )
          })
        )}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 p-3 text-sm dark:border-slate-800">
          <button
            disabled={paginaAtual === 1}
            onClick={() => setPagina((p) => p - 1)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-slate-400">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <button
            disabled={paginaAtual === totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
