import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Shield, Users, Pencil, Trash2 } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FuncaoFormModal } from '@/components/admin/FuncaoFormModal'
import { rotuloPermissao } from '@/lib/permissoes'
import { listarFuncoes, salvarFuncao, excluirFuncao, listarUsuarios } from '@/data/api'
import type { Funcao } from '@/types'

/**
 * Tela "Administração > Funções".
 * CRUD de funções/permissões em modo mock: a lista vive em estado local
 * (na Fase 4 vira tabela `funcoes` no Supabase). Cada função mostra quantos
 * usuários a possuem — e não pode ser excluída enquanto houver algum.
 */
export function AdminFuncoesPage() {
  const queryClient = useQueryClient()
  const { data: lista = [] } = useQuery({ queryKey: ['funcoes'], queryFn: listarFuncoes })
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['funcoes'] })
  const salvarMut = useMutation({ mutationFn: salvarFuncao, onSuccess: invalidar })
  const excluirMut = useMutation({ mutationFn: excluirFuncao, onSuccess: invalidar })

  const [formAberto, setFormAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Funcao | null>(null)
  const [aExcluir, setAExcluir] = useState<Funcao | null>(null)

  // Quantos usuários possuem cada função (id da função → total).
  const contagem = useMemo(() => {
    const m: Record<string, number> = {}
    for (const u of usuarios) m[u.funcao.id] = (m[u.funcao.id] ?? 0) + 1
    return m
  }, [usuarios])

  function abrirNova() {
    setEmEdicao(null)
    setFormAberto(true)
  }
  function abrirEdicao(f: Funcao) {
    setEmEdicao(f)
    setFormAberto(true)
  }
  // Insere (se for nova) ou atualiza (se já existir), persistindo no banco.
  function salvar(f: Funcao) {
    salvarMut.mutate(f)
  }
  function excluir(f: Funcao) {
    excluirMut.mutate(f.id)
  }

  return (
    <AdminShell
      actions={
        <Button icon={Plus} onClick={abrirNova}>
          Nova Função
        </Button>
      }
    >
      <p className="mb-4 text-sm text-slate-500">{lista.length} funções cadastradas</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((f) => {
          const qtd = contagem[f.id] ?? 0
          const temUsuarios = qtd > 0
          return (
            <div key={f.id} className="card flex flex-col p-5">
              {/* Cabeçalho do card: ícone + nome + ações */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{f.nome}</h3>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <Users className="h-3.5 w-3.5" />
                      {qtd} {qtd === 1 ? 'usuário' : 'usuários'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => abrirEdicao(f)}
                    title="Editar função"
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setAExcluir(f)}
                    disabled={temUsuarios}
                    title={
                      temUsuarios
                        ? `Não é possível excluir: ${qtd} ${qtd === 1 ? 'usuário usa' : 'usuários usam'} esta função`
                        : 'Excluir função'
                    }
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Permissões da função como chips */}
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Permissões ({f.permissoes.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {f.permissoes.length === 0 ? (
                    <span className="text-xs text-slate-400">Nenhuma permissão.</span>
                  ) : (
                    f.permissoes.map((p) => (
                      <span
                        key={p}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {rotuloPermissao(p)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de criar/editar */}
      <FuncaoFormModal
        open={formAberto}
        onClose={() => setFormAberto(false)}
        onSave={salvar}
        funcao={emEdicao}
      />

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={Boolean(aExcluir)}
        onClose={() => setAExcluir(null)}
        onConfirm={() => aExcluir && excluir(aExcluir)}
        title="Excluir função"
        message={
          <>
            Tem certeza que deseja excluir a função <strong>{aExcluir?.nome}</strong>? Esta ação não
            pode ser desfeita.
          </>
        }
      />
    </AdminShell>
  )
}
