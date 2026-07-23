import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import type { Instituicao } from '@/types'

/**
 * Modal de criação/edição de Instituição.
 * Campos: nome completo + sigla (ex.: "UFU").
 */
export function InstituicaoFormModal({
  open,
  onClose,
  onSave,
  instituicao,
}: {
  open: boolean
  onClose: () => void
  onSave: (instituicao: Instituicao) => void
  instituicao?: Instituicao | null
}) {
  const editando = Boolean(instituicao)
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')

  // Ao abrir, sincroniza com a instituição em edição (ou zera se for nova).
  useEffect(() => {
    if (!open) return
    setNome(instituicao?.nome ?? '')
    setSigla(instituicao?.sigla ?? '')
  }, [open, instituicao])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave({
      id: instituicao?.id ?? `i-${Date.now()}`,
      nome: nome.trim(),
      sigla: sigla.trim().toUpperCase(),
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
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
      </form>
    </Modal>
  )
}
