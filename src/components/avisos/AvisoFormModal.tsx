import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import type { Aviso, StatusAviso, TipoAviso } from '@/types'

interface AvisoFormModalProps {
  open: boolean
  onClose: () => void
  onCreate: (aviso: Aviso) => void
}

const hoje = new Date().toISOString().slice(0, 10)

export function AvisoFormModal({ open, onClose, onCreate }: AvisoFormModalProps) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<TipoAviso>('geral')
  const [data, setData] = useState(hoje)
  const [hora, setHora] = useState('')
  const [publicoAlvo, setPublicoAlvo] = useState('Todos os pesquisadores')
  const [status, setStatus] = useState<StatusAviso>('ativo')
  const [destaque, setDestaque] = useState(false)

  function reset() {
    setTitulo('')
    setDescricao('')
    setTipo('geral')
    setData(hoje)
    setHora('')
    setPublicoAlvo('Todos os pesquisadores')
    setStatus('ativo')
    setDestaque(false)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const novo: Aviso = {
      id: `av-${Date.now()}`,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tipo,
      status,
      destaque,
      data: new Date(`${data}T${hora || '00:00'}`).toISOString(),
      hora: hora || undefined,
      publicoAlvo,
      autor: 'Administrador',
      publicadoHa: status === 'ativo' ? 'agora' : undefined,
      visualizacoes: 0,
    }
    onCreate(novo)
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Aviso"
      subtitle="Publique um comunicado para a equipe."
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-novo-aviso">
            {status === 'programado' ? 'Programar aviso' : 'Publicar aviso'}
          </Button>
        </>
      }
    >
      <form id="form-novo-aviso" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Título">
          <Input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Reunião geral da equipe"
          />
        </Field>

        <Field label="Descrição">
          <Textarea
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhe o comunicado..."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAviso)}>
              <option value="geral">Geral</option>
              <option value="importante">Importante</option>
              <option value="reuniao">Reunião</option>
              <option value="treinamento">Treinamento</option>
            </Select>
          </Field>
          <Field label="Público-alvo">
            <Input value={publicoAlvo} onChange={(e) => setPublicoAlvo(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Hora (opcional)">
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </Field>
        </div>

        <Field label="Publicação">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusAviso)}>
            <option value="ativo">Publicar agora</option>
            <option value="programado">Programar para depois</option>
          </Select>
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <input
            type="checkbox"
            checked={destaque}
            onChange={(e) => setDestaque(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Fixar em <strong>Avisos em Destaque</strong>
          </span>
        </label>
      </form>
    </Modal>
  )
}
