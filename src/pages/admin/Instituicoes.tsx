import { useMemo, useState } from 'react'
import { Plus, Building2, Users, Pencil, Trash2 } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { InstituicaoFormModal } from '@/components/admin/InstituicaoFormModal'
import { instituicoes as instituicoesMock, usuarios } from '@/data/mock'
import type { Instituicao } from '@/types'

/**
 * Tela "Administração > Instituições".
 * CRUD de instituições em modo mock (na Fase 4 vira tabela `instituicoes`).
 * Cada instituição mostra quantos usuários estão vinculados; as que têm
 * vínculos não podem ser excluídas.
 */
export function AdminInstituicoesPage() {
  const [lista, setLista] = useState<Instituicao[]>(instituicoesMock)
  const [formAberto, setFormAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Instituicao | null>(null)
  const [aExcluir, setAExcluir] = useState<Instituicao | null>(null)

  // Quantos usuários pertencem a cada instituição (id → total).
  const contagem = useMemo(() => {
    const m: Record<string, number> = {}
    for (const u of usuarios) if (u.instituicao) m[u.instituicao.id] = (m[u.instituicao.id] ?? 0) + 1
    return m
  }, [])

  function abrirNova() {
    setEmEdicao(null)
    setFormAberto(true)
  }
  function abrirEdicao(i: Instituicao) {
    setEmEdicao(i)
    setFormAberto(true)
  }
  function salvar(i: Instituicao) {
    setLista((prev) =>
      prev.some((x) => x.id === i.id) ? prev.map((x) => (x.id === i.id ? i : x)) : [...prev, i],
    )
  }
  function excluir(i: Instituicao) {
    setLista((prev) => prev.filter((x) => x.id !== i.id))
  }

  return (
    <AdminShell
      actions={
        <Button icon={Plus} onClick={abrirNova}>
          Nova Instituição
        </Button>
      }
    >
      <p className="mb-4 text-sm text-slate-500">{lista.length} instituições cadastradas</p>

      {/* Lista em um único card, com linhas divididas */}
      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {lista.map((i) => {
          const qtd = contagem[i.id] ?? 0
          const emUso = qtd > 0
          return (
            <div key={i.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-slate-900 dark:text-white">{i.nome}</h3>
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {i.sigla}
                    </span>
                  </div>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <Users className="h-3.5 w-3.5" />
                    {qtd} {qtd === 1 ? 'pesquisador' : 'pesquisadores'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => abrirEdicao(i)}
                  title="Editar instituição"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setAExcluir(i)}
                  disabled={emUso}
                  title={
                    emUso
                      ? `Não é possível excluir: ${qtd} ${qtd === 1 ? 'pesquisador vinculado' : 'pesquisadores vinculados'}`
                      : 'Excluir instituição'
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

      <InstituicaoFormModal
        open={formAberto}
        onClose={() => setFormAberto(false)}
        onSave={salvar}
        instituicao={emEdicao}
      />

      <ConfirmDialog
        open={Boolean(aExcluir)}
        onClose={() => setAExcluir(null)}
        onConfirm={() => aExcluir && excluir(aExcluir)}
        title="Excluir instituição"
        message={
          <>
            Tem certeza que deseja excluir a instituição <strong>{aExcluir?.nome}</strong>? Esta ação
            não pode ser desfeita.
          </>
        }
      />
    </AdminShell>
  )
}
