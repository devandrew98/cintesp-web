import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { salvarConfig } from '@/data/agendamentos'
import { mascararTelefone, numeroWhatsapp, type ConfigAgendamento } from '@/lib/agendamento'
import { mensagemErro } from '@/lib/utils'

/** Local, WhatsApp do pesquisador, períodos das fases e abrir/fechar o formulário público. */
export function ConfigAgendamentoModal({ open, onClose, config }: { open: boolean; onClose: () => void; config: ConfigAgendamento }) {
  const qc = useQueryClient()
  const [c, setC] = useState(config)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setC(config)
      setErro(null)
    }
  }, [open, config])

  const salvar = useMutation({
    mutationFn: () => salvarConfig(c),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agendamento-config'] })
      onClose()
    },
    onError: (e) => setErro(mensagemErro(e)),
  })

  const set = <K extends keyof ConfigAgendamento>(k: K, v: ConfigAgendamento[K]) => setC((x) => ({ ...x, [k]: v }))
  const whatsappInvalido = Boolean(c.whatsapp?.trim()) && !numeroWhatsapp(c.whatsapp)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Settings className="h-5 w-5" />
          </span>
          Configurações do agendamento
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || whatsappInvalido}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="WhatsApp do pesquisador" hint="Número que recebe a mensagem pronta depois que a pessoa envia o formulário.">
          <Input type="tel" value={c.whatsapp ?? ''} onChange={(e) => set('whatsapp', mascararTelefone(e.target.value))} placeholder="(34) 99999-9999" />
        </Field>
        {whatsappInvalido && <p className="-mt-2 text-xs text-red-500">Informe o número com DDD.</p>}
        <Field label="Local das avaliações">
          <Input value={c.local} onChange={(e) => set('local', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fase 1 — início">
            <Input type="date" value={c.fase1Inicio} onChange={(e) => set('fase1Inicio', e.target.value)} />
          </Field>
          <Field label="Fase 1 — fim">
            <Input type="date" value={c.fase1Fim} onChange={(e) => set('fase1Fim', e.target.value)} />
          </Field>
          <Field label="Fase 2 — início">
            <Input type="date" value={c.fase2Inicio} onChange={(e) => set('fase2Inicio', e.target.value)} />
          </Field>
          <Field label="Fase 2 — fim">
            <Input type="date" value={c.fase2Fim} onChange={(e) => set('fase2Fim', e.target.value)} />
          </Field>
        </div>
        <Field label="Prazo da triagem (informativo)">
          <Input type="date" value={c.triagemLimite ?? ''} onChange={(e) => set('triagemLimite', e.target.value || undefined)} />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={c.ativo} onChange={(e) => set('ativo', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Receber novas solicitações (desmarque para fechar o formulário público)
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
