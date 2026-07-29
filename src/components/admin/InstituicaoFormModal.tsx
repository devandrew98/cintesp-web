import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Search, Users } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { listarUsuarios } from '@/data/api'
import { cn } from '@/lib/utils'
import type { Instituicao } from '@/types'

/**
 * Modal de criação/edição de Instituição.
 *
 * Além do nome e da sigla, permite escolher **quais pesquisadores** pertencem
 * a ela. Marcar/desmarcar aqui grava o vínculo direto no cadastro de cada
 * usuário (campo `instituicao_id`).
 */
export function InstituicaoFormModal({
  open,
  onClose,
  onSave,
  instituicao,
}: {
  open: boolean
  onClose: () => void
  /** Devolve a instituição e a lista final de pesquisadores vinculados. */
  onSave: (instituicao: Instituicao, usuarioIds: string[]) => void
  instituicao?: Instituicao | null
}) {
  const editando = Boolean(instituicao)
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const [vinculados, setVinculados] = useState<string[]>([])
  const [busca, setBusca] = useState('')

  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })

  // Ao abrir, sincroniza com a instituição em edição (ou zera se for nova).
  useEffect(() => {
    if (!open) return
    setNome(instituicao?.nome ?? '')
    setSigla(instituicao?.sigla ?? '')
    setBusca('')
    // Marca quem já pertence a esta instituição.
    setVinculados(
      instituicao
        ? usuarios.filter((u) => u.instituicao?.id === instituicao.id).map((u) => u.id)
        : [],
    )
  }, [open, instituicao, usuarios])

  function alternar(id: string) {
    setVinculados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    )
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter((u) => u.nome.toLowerCase().includes(q))
  }, [usuarios, busca])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave(
      {
        id: instituicao?.id ?? `i-${Date.now()}`,
        nome: nome.trim(),
        sigla: sigla.trim().toUpperCase(),
      },
      vinculados,
    )
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editando ? 'Editar Instituição' : 'Nova Instituição'}
      subtitle="Instituições parceiras às quais os pesquisadores estão vinculados."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-instituicao">
            {editando ? 'Salvar alterações' : 'Criar instituição'}
          </Button>
        </>
      }
    >
      <form id="form-instituicao" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome completo">
          <Input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Universidade Federal de Uberlândia"
          />
        </Field>
        <Field label="Sigla" hint="Aparece como etiqueta curta (ex.: UFU, IFTM).">
          <Input
            required
            value={sigla}
            onChange={(e) => setSigla(e.target.value)}
            placeholder="Ex.: UFU"
            maxLength={12}
            className="uppercase"
          />
        </Field>

        {/* ---------- Pesquisadores vinculados ---------- */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Users className="h-4 w-4 text-slate-400" />
              Pesquisadores vinculados
            </span>
            <span className="text-xs text-slate-400">{vinculados.length} selecionado(s)</span>
          </div>

          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pesquisador..."
              className="pl-9"
            />
          </div>

          {usuarios.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
              Nenhum pesquisador cadastrado ainda.
            </p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5 dark:border-slate-700">
              {filtrados.map((u) => {
                const marcado = vinculados.includes(u.id)
                // Avisa quando a pessoa já pertence a OUTRA instituição.
                const outraInstituicao =
                  u.instituicao && u.instituicao.id !== instituicao?.id ? u.instituicao.sigla : null

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => alternar(u.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                      marcado
                        ? 'bg-brand-50 dark:bg-brand-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                        marcado
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-300 dark:border-slate-600',
                      )}
                    >
                      {marcado && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <Avatar nome={u.nome} fotoUrl={u.fotoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-700 dark:text-slate-200">
                        {u.nome}
                      </span>
                      <span className="block truncate text-xs text-slate-400">{u.funcao.nome}</span>
                    </span>
                    {outraInstituicao && !marcado && (
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">
                        {outraInstituicao}
                      </span>
                    )}
                  </button>
                )
              })}
              {filtrados.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">Nenhum resultado.</p>
              )}
            </div>
          )}

          <p className="mt-1.5 text-xs text-slate-400">
            Quem for desmarcado fica sem instituição. Uma pessoa pertence a uma instituição por vez.
          </p>
        </div>
      </form>
    </Modal>
  )
}
