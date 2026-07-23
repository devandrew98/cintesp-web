import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Pencil, Trash2 } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AreaFormModal } from '@/components/admin/AreaFormModal'
import { listarAreas, salvarArea, excluirArea, listarUsuarios } from '@/data/api'
import type { AreaAtuacao } from '@/types'

/**
 * Tela "Administração > Áreas de Atuação".
 * CRUD de áreas em modo mock (na Fase 4 vira tabela `areas` no Supabase).
 * Cada área mostra quantos pesquisadores a possuem; áreas em uso não podem
 * ser excluídas para não deixar usuários com referência quebrada.
 */
export function AdminAreasPage() {
  const queryClient = useQueryClient()
  const { data: lista = [] } = useQuery({ queryKey: ['areas'], queryFn: listarAreas })
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['areas'] })
  const salvarMut = useMutation({ mutationFn: salvarArea, onSuccess: invalidar })
  const excluirMut = useMutation({ mutationFn: excluirArea, onSuccess: invalidar })

  const [formAberto, setFormAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<AreaAtuacao | null>(null)
  const [aExcluir, setAExcluir] = useState<AreaAtuacao | null>(null)

  // Quantos usuários atuam em cada área (id da área → total).
  const contagem = useMemo(() => {
    const m: Record<string, number> = {}
    // `if (a)` protege contra alguma referência de área pendente/nula no registro.
    for (const u of usuarios) for (const a of u.areas) if (a) m[a.id] = (m[a.id] ?? 0) + 1
    return m
  }, [usuarios])

  function abrirNova() {
    setEmEdicao(null)
    setFormAberto(true)
  }
  function abrirEdicao(a: AreaAtuacao) {
    setEmEdicao(a)
    setFormAberto(true)
  }
  function salvar(a: AreaAtuacao) {
    salvarMut.mutate(a)
  }
  function excluir(a: AreaAtuacao) {
    excluirMut.mutate(a.id)
  }

  return (
    <AdminShell
      actions={
        <Button icon={Plus} onClick={abrirNova}>
          Nova Área
        </Button>
      }
    >
      <p className="mb-4 text-sm text-slate-500">{lista.length} áreas cadastradas</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((a) => {
          const qtd = contagem[a.id] ?? 0
          const emUso = qtd > 0
          return (
            <div key={a.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {/* Bolinha grande com a cor da área */}
                <span
                  className="h-10 w-10 shrink-0 rounded-xl"
                  style={{ backgroundColor: a.cor }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 dark:text-white">{a.nome}</h3>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <Users className="h-3.5 w-3.5" />
                    {qtd} {qtd === 1 ? 'pesquisador' : 'pesquisadores'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => abrirEdicao(a)}
                  title="Editar área"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setAExcluir(a)}
                  disabled={emUso}
                  title={
                    emUso
                      ? `Não é possível excluir: ${qtd} ${qtd === 1 ? 'pesquisador atua' : 'pesquisadores atuam'} nesta área`
                      : 'Excluir área'
                  }
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <AreaFormModal
        open={formAberto}
        onClose={() => setFormAberto(false)}
        onSave={salvar}
        area={emEdicao}
      />

      <ConfirmDialog
        open={Boolean(aExcluir)}
        onClose={() => setAExcluir(null)}
        onConfirm={() => aExcluir && excluir(aExcluir)}
        title="Excluir área"
        message={
          <>
            Tem certeza que deseja excluir a área <strong>{aExcluir?.nome}</strong>? Esta ação não
            pode ser desfeita.
          </>
        }
      />
    </AdminShell>
  )
}
