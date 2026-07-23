import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { cn } from '@/lib/utils'
import type { AreaAtuacao } from '@/types'

/** Paleta pré-definida de cores para as áreas (dá para escolher clicando). */
const CORES = [
  '#6366f1', '#0ea5e9', '#10b981', '#ec4899',
  '#f59e0b', '#8b5cf6', '#14b8a6', '#ef4444',
  '#22c55e', '#eab308', '#3b82f6', '#f97316',
]

/**
 * Modal de criação/edição de Área de Atuação.
 * Campos: nome + cor (escolhida na paleta). Mostra uma prévia do "chip".
 */
export function AreaFormModal({
  open,
  onClose,
  onSave,
  area,
}: {
  open: boolean
  onClose: () => void
  onSave: (area: AreaAtuacao) => void
  area?: AreaAtuacao | null
}) {
  const editando = Boolean(area)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES[0])

  // Ao abrir, sincroniza com a área em edição (ou zera se for nova).
  useEffect(() => {
    if (!open) return
    setNome(area?.nome ?? '')
    setCor(area?.cor ?? CORES[0])
  }, [open, area])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave({
      id: area?.id ?? `a-${Date.now()}`,
      nome: nome.trim(),
      cor,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar Área' : 'Nova Área de Atuação'}
      subtitle="Áreas ajudam a classificar e filtrar os pesquisadores."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-area">
            {editando ? 'Salvar alterações' : 'Criar área'}
          </Button>
        </>
      }
    >
      <form id="form-area" onSubmit={handleSubmit} className="space-y-5">
        <Field label="Nome da área">
          <Input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Inteligência Artificial"
          />
        </Field>

        {/* Seletor de cor */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Cor
          </span>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Selecionar cor ${c}`}
                style={{ backgroundColor: c }}
                className={cn(
                  'h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-slate-900',
                  cor === c ? 'ring-slate-800 dark:ring-white' : 'ring-transparent',
                )}
              />
            ))}
          </div>
        </div>

        {/* Prévia do chip como aparecerá na lista */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Prévia
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />
            {nome.trim() || 'Nome da área'}
          </span>
        </div>
      </form>
    </Modal>
  )
}
