import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { corrigirRegistroPonto } from '@/data/ponto'
import { paraDatetimeLocal, deDatetimeLocal } from '@/lib/ponto'
import { mensagemErro } from '@/lib/utils'
import type { RegistroPonto, TipoPonto } from '@/types'

/**
 * Corrige um registro de ponto já existente (horário/tipo errado).
 * Exige motivo — o valor anterior fica em auditoria (historico_alteracoes).
 */
export function CorrigirPontoModal({
  registro,
  open,
  onClose,
}: {
  registro: RegistroPonto | null
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<TipoPonto>('entrada')
  const [horario, setHorario] = useState('')
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (!registro) return
    setTipo(registro.tipo)
    setHorario(paraDatetimeLocal(registro.registradoEm))
    setMotivo('')
  }, [registro])

  const salvarMut = useMutation({
    mutationFn: () =>
      corrigirRegistroPonto(registro!.id, { tipo, registradoEm: deDatetimeLocal(horario), motivo: motivo.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto-registros'] })
      onClose()
    },
  })

  if (!registro) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Pencil className="h-5 w-5" />
          </span>
          Corrigir registro — {registro.usuarioNome ?? 'Pesquisador'}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvarMut.mutate()}
            disabled={salvarMut.isPending || !motivo.trim() || !horario}
          >
            {salvarMut.isPending ? 'Salvando…' : 'Salvar correção'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPonto)}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </Select>
        </Field>
        <Field label="Horário">
          <Input type="datetime-local" value={horario} onChange={(e) => setHorario(e.target.value)} />
        </Field>
        <Field label="Motivo da correção" hint="Obrigatório — fica registrado no histórico de auditoria.">
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: leitor travou, horário registrado errado…" />
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
