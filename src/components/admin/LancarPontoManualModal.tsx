import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Select, Input, Textarea } from '@/components/ui/Field'
import { lancarPontoManual } from '@/data/ponto'
import { deDatetimeLocal } from '@/lib/ponto'
import { mensagemErro } from '@/lib/utils'
import type { TipoPonto } from '@/types'

/**
 * Lança um registro de ponto retroativo (pesquisador esqueceu de bater o
 * ponto). Exige motivo — fica em auditoria, igual à correção.
 */
export function LancarPontoManualModal({
  usuarios,
  open,
  onClose,
}: {
  usuarios: { id: string; nome: string }[]
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [usuarioId, setUsuarioId] = useState('')
  const [tipo, setTipo] = useState<TipoPonto>('entrada')
  const [horario, setHorario] = useState('')
  const [motivo, setMotivo] = useState('')

  function limpar() {
    setUsuarioId('')
    setTipo('entrada')
    setHorario('')
    setMotivo('')
  }

  const salvarMut = useMutation({
    mutationFn: () =>
      lancarPontoManual({ usuarioId, tipo, registradoEm: deDatetimeLocal(horario), motivo: motivo.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto-registros'] })
      limpar()
      onClose()
    },
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <CalendarPlus className="h-5 w-5" />
          </span>
          Lançar ponto manual
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvarMut.mutate()}
            disabled={salvarMut.isPending || !usuarioId || !horario || !motivo.trim()}
          >
            {salvarMut.isPending ? 'Salvando…' : 'Lançar registro'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Pesquisador">
          <Select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Selecione…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPonto)}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </Select>
        </Field>
        <Field label="Horário">
          <Input type="datetime-local" value={horario} onChange={(e) => setHorario(e.target.value)} />
        </Field>
        <Field label="Motivo" hint="Obrigatório — ex.: esqueceu de bater o ponto na entrada.">
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explique o motivo do lançamento manual…" />
        </Field>
        {salvarMut.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {mensagemErro(salvarMut.error)}
          </p>
        )}
      </div>
    </Modal>
  )
}
