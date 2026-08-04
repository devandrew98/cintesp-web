import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package,
  HandCoins,
  Boxes,
  CheckCircle2,
  PackageOpen,
  Search,
  Pencil,
  Trash2,
  MapPin,
  AlertCircle,
} from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { NovoItemModal } from '@/components/consignados/NovoItemModal'
import { NovoConsignadoModal } from '@/components/consignados/NovoConsignadoModal'
import { ConsignadoDetailModal } from '@/components/consignados/ConsignadoDetailModal'
import {
  listarItens,
  listarConsignados,
  criarItem,
  atualizarItem,
  excluirItem,
  criarConsignado,
  type Consignado,
  type DadosItem,
  type ItemPatrimonio,
} from '@/data/consignados'
import { listarUsuarios } from '@/data/api'
import { statusItemInfo, statusConsignadoInfo } from '@/lib/consignados'
import { formatDateOnlyBR, cn } from '@/lib/utils'

type Aba = 'emprestimos' | 'patrimonio'

/**
 * "Administração > Consignados" — controle de patrimônio e empréstimos.
 * Duas abas: Empréstimos (quem está com o quê) e Patrimônio (inventário).
 */
export function AdminConsignadosPage() {
  const qc = useQueryClient()
  const [aba, setAba] = useState<Aba>('emprestimos')
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'em_uso' | 'devolvido'>('todos')

  const [novoItem, setNovoItem] = useState(false)
  const [editItem, setEditItem] = useState<ItemPatrimonio | null>(null)
  const [novoEmprestimo, setNovoEmprestimo] = useState(false)
  const [detalhe, setDetalhe] = useState<Consignado | null>(null)
  const [itemExcluir, setItemExcluir] = useState<ItemPatrimonio | null>(null)

  const { data: itens = [], isLoading: carregandoItens, error: erroItens } = useQuery({
    queryKey: ['patrimonio-itens'],
    queryFn: listarItens,
  })
  const { data: consignados = [], isLoading: carregandoConsig } = useQuery({
    queryKey: ['consignados'],
    queryFn: listarConsignados,
  })
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })

  const invalidarItens = () => qc.invalidateQueries({ queryKey: ['patrimonio-itens'] })
  const invalidarConsig = () => {
    qc.invalidateQueries({ queryKey: ['consignados'] })
    qc.invalidateQueries({ queryKey: ['patrimonio-itens'] })
  }

  const criarItemMut = useMutation({
    mutationFn: criarItem,
    onSuccess: () => {
      invalidarItens()
      setNovoItem(false)
    },
  })
  const editarItemMut = useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: DadosItem }) => atualizarItem(id, dados),
    onSuccess: () => {
      invalidarItens()
      setEditItem(null)
    },
  })
  const excluirItemMut = useMutation({ mutationFn: excluirItem, onSuccess: invalidarItens })
  const criarConsigMut = useMutation({
    mutationFn: criarConsignado,
    onSuccess: () => {
      invalidarConsig()
      setNovoEmprestimo(false)
    },
  })

  const itensDisponiveis = useMemo(() => itens.filter((i) => i.status === 'disponivel'), [itens])

  const kpis = useMemo(
    () => ({
      total: itens.length,
      disponiveis: itens.filter((i) => i.status === 'disponivel').length,
      emUso: itens.filter((i) => i.status === 'em_uso').length,
      ativos: consignados.filter((c) => c.status === 'em_uso').length,
    }),
    [itens, consignados],
  )

  const consignadosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return consignados.filter((c) => {
      if (statusFiltro !== 'todos' && c.status !== statusFiltro) return false
      if (!q) return true
      return `${c.itemNumero ?? ''} ${c.itemNome ?? ''} ${c.pesquisadorNome ?? ''} ${c.local ?? ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [consignados, busca, statusFiltro])

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return itens
    return itens.filter((i) =>
      `${i.numeroPatrimonio} ${i.nome} ${i.categoria ?? ''} ${i.emprestimo?.pesquisadorNome ?? ''}`
        .toLowerCase()
        .includes(q),
    )
  }, [itens, busca])

  return (
    <AdminShell
      actions={
        <>
          <Button variant="secondary" icon={Package} onClick={() => setNovoItem(true)}>
            Novo item
          </Button>
          <Button icon={HandCoins} onClick={() => setNovoEmprestimo(true)}>
            Novo empréstimo
          </Button>
        </>
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Boxes} value={kpis.total} label="Itens" hint="No patrimônio" accent="violet" />
        <StatCard icon={CheckCircle2} value={kpis.disponiveis} label="Disponíveis" hint="Em estoque" accent="green" />
        <StatCard icon={PackageOpen} value={kpis.emUso} label="Em uso" hint="Emprestados" accent="amber" />
        <StatCard icon={HandCoins} value={kpis.ativos} label="Empréstimos ativos" hint="Em aberto" accent="blue" />
      </div>

      {erroItens && (
        <div className="card mb-4 flex items-start gap-3 border-red-200 p-4 dark:border-red-500/30">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="text-sm">
            <p className="font-semibold text-red-700 dark:text-red-400">
              Não foi possível carregar o patrimônio
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{(erroItens as Error).message}</p>
            <p className="mt-2 text-xs text-slate-500">
              Rode o
              <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
                docs/supabase-consignados.sql
              </code>
              no SQL Editor do Supabase.
            </p>
          </div>
        </div>
      )}

      {/* Abas internas */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60 sm:w-fit">
        {(['emprestimos', 'patrimonio'] as Aba[]).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              aba === a
                ? 'bg-white text-slate-800 shadow-card dark:bg-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {a === 'emprestimos' ? 'Empréstimos' : 'Patrimônio'}
          </button>
        ))}
      </div>

      {/* Busca + filtro */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={
              aba === 'emprestimos'
                ? 'Buscar por item, patrimônio, pesquisador ou local…'
                : 'Buscar por patrimônio, nome ou categoria…'
            }
            className="pl-9"
          />
        </div>
        {aba === 'emprestimos' && (
          <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as typeof statusFiltro)}>
            <option value="todos">Todos</option>
            <option value="em_uso">Em uso</option>
            <option value="devolvido">Devolvidos</option>
          </Select>
        )}
      </div>

      {/* ---------- Aba Empréstimos ---------- */}
      {aba === 'emprestimos' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3">Item / Patrimônio</th>
                  <th className="px-4 py-3">Pesquisador</th>
                  <th className="px-4 py-3">Retirada</th>
                  <th className="px-4 py-3">Entrega prev.</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {carregandoConsig ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Carregando…</td>
                  </tr>
                ) : consignadosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Nenhum empréstimo. Clique em “Novo empréstimo” para registrar.
                    </td>
                  </tr>
                ) : (
                  consignadosFiltrados.map((c) => {
                    const st = statusConsignadoInfo[c.status]
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setDetalhe(c)}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{c.itemNome ?? '—'}</p>
                          <p className="text-xs text-slate-400">Patrimônio {c.itemNumero ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.pesquisadorNome ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDateOnlyBR(c.dataRetirada)}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDateOnlyBR(c.dataEntregaPrevista)}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.local ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400" /> {c.local}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={st.tone as 'green' | 'amber'} dot>
                            {st.label}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Aba Patrimônio (inventário) ---------- */}
      {aba === 'patrimonio' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-3">Nº Patrimônio</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Local / Com quem</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {carregandoItens ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Carregando…</td>
                  </tr>
                ) : itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Nenhum item cadastrado. Clique em “Novo item”.
                    </td>
                  </tr>
                ) : (
                  itensFiltrados.map((i) => {
                    const st = statusItemInfo[i.status]
                    return (
                      <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                          {i.numeroPatrimonio}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{i.nome}</td>
                        <td className="px-4 py-3 text-slate-500">{i.categoria ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {i.emprestimo ? (
                            <span>
                              {i.emprestimo.pesquisadorNome ?? '—'}
                              {i.emprestimo.local ? ` · ${i.emprestimo.local}` : ''}
                            </span>
                          ) : (
                            i.localPadrao ?? '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={st.tone as 'green' | 'amber' | 'blue' | 'slate'} dot>
                            {st.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditItem(i)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                              aria-label={`Editar ${i.nome}`}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setItemExcluir(i)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              aria-label={`Excluir ${i.nome}`}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Modais ---------- */}
      {novoItem && (
        <NovoItemModal
          open={novoItem}
          onClose={() => setNovoItem(false)}
          salvando={criarItemMut.isPending}
          onSalvar={(dados) => criarItemMut.mutate(dados)}
        />
      )}
      {editItem && (
        <NovoItemModal
          open={Boolean(editItem)}
          onClose={() => setEditItem(null)}
          inicial={editItem}
          salvando={editarItemMut.isPending}
          onSalvar={(dados) => editarItemMut.mutate({ id: editItem.id, dados })}
        />
      )}
      {novoEmprestimo && (
        <NovoConsignadoModal
          open={novoEmprestimo}
          onClose={() => setNovoEmprestimo(false)}
          itensDisponiveis={itensDisponiveis}
          pesquisadores={usuarios}
          salvando={criarConsigMut.isPending}
          onSalvar={(dados) => criarConsigMut.mutate(dados)}
        />
      )}

      <ConsignadoDetailModal consignado={detalhe} onClose={() => setDetalhe(null)} />

      <ConfirmDialog
        open={Boolean(itemExcluir)}
        onClose={() => setItemExcluir(null)}
        onConfirm={() => {
          if (itemExcluir) excluirItemMut.mutate(itemExcluir.id)
          setItemExcluir(null)
        }}
        title="Excluir item"
        message={`Excluir "${itemExcluir?.nome}" (patrimônio ${itemExcluir?.numeroPatrimonio}) do inventário? O histórico de empréstimos é mantido.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </AdminShell>
  )
}
