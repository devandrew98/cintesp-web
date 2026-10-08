import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { excluirRegistroPonto } from '@/data/ponto'
import { TIPO_PONTO_LABEL, formatarDataHoraPonto } from '@/lib/ponto'
import { mensagemErro } from '@/lib/utils'
import type { RegistroPonto } from '@/types'

/**
 * Exclui um registro de ponto (duplicado, lançado por engano…).
 * Exige motivo — o registro apagado fica descrito em auditoria
 * (historico_alteracoes), mas não pode ser restaurado.
 */
export function ExcluirPontoModal({
  registro,
  open,
  onClose,
}: {
  registro: RegistroPonto | null
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (registro) setMotivo('')
  }, [registro])

  const excluirMut = useMutation({
    mutationFn: () => excluirRegistroPonto(registro!.id, motivo.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto-registros'] })
      qc.invalidateQueries({ queryKey: ['usuarios'] })
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
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
          </span>
          Excluir registro
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => excluirMut.mutate()}
            disabled={excluirMut.isPending || !motivo.trim()}
          >
            {excluirMut.isPending ? 'Excluindo…' : 'Excluir'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Excluir <strong>{TIPO_PONTO_LABEL[registro.tipo].toLowerCase()}</strong> de{' '}
          <strong>{registro.usuarioNome ?? 'pesquisador'}</strong> em{' '}
          {formatarDataHoraPonto(registro.registradoEm)}? Esta ação não pode ser desfeita.
        </p>
        <Field label="Motivo da exclusão" hint="Obrigatório — fica registrado no histórico de auditoria.">
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: registro duplicado, saída lançada por engano…"
          />
        </Field>
        {excluirMut.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {mensagemErro(excluirMut.error)}
          </p>
        )}
      </div>
    </Modal>
  )
}
