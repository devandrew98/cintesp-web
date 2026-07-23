import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { PERMISSOES } from '@/lib/permissoes'
import { cn } from '@/lib/utils'
import type { Funcao } from '@/types'

/**
 * Modal de criação/edição de Função.
 * - Sem `funcao`  → modo "Nova Função" (campos vazios).
 * - Com `funcao`  → modo "Editar Função" (campos preenchidos).
 * Devolve a função montada via `onSave` (o pai decide inserir ou atualizar).
 */
export function FuncaoFormModal({
  open,
  onClose,
  onSave,
  funcao,
}: {
  open: boolean
  onClose: () => void
  onSave: (funcao: Funcao) => void
  funcao?: Funcao | null
}) {
  const editando = Boolean(funcao)
  const [nome, setNome] = useState('')
  const [permissoes, setPermissoes] = useState<string[]>([])

  // Ao abrir, sincroniza o formulário com a função em edição (ou zera se for nova).
  useEffect(() => {
    if (!open) return
    setNome(funcao?.nome ?? '')
    setPermissoes(funcao?.permissoes ?? [])
  }, [open, funcao])

  // Marca/desmarca uma permissão.
  function togglePermissao(id: string) {
    setPermissoes((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave({
      id: funcao?.id ?? `f-${Date.now()}`, // mantém o id ao editar; gera um novo ao criar
      nome: nome.trim(),
      permissoes,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar Função' : 'Nova Função'}
      subtitle="Defina o nome do papel e o que ele pode fazer no sistema."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-funcao">
            {editando ? 'Salvar alterações' : 'Criar função'}
          </Button>
        </>
      }
    >
      <form id="form-funcao" onSubmit={handleSubmit} className="space-y-5">
        <Field label="Nome da função">
          <Input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Coordenador"
          />
        </Field>

        {/* Lista de permissões como "cards" clicáveis (checkbox). */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Permissões
          </span>
          <div className="space-y-2">
            {PERMISSOES.map((p) => {
              const marcada = permissoes.includes(p.id)
              return (
                <label
                  key={p.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    marcada
                      ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => togglePermissao(p.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                      {p.label}
                    </span>
                    <span className="block text-xs text-slate-500">{p.descricao}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </form>
    </Modal>
  )
}
