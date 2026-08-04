import { useMemo, useState, type FormEvent } from 'react'
import { HandCoins } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { formatarCPF } from '@/lib/cpf'
import type { ItemPatrimonio, NovoConsignado } from '@/data/consignados'
import type { Usuario } from '@/types'

const hoje = () => new Date().toISOString().slice(0, 10)

/** Modal para registrar um empréstimo (consignar um item a um pesquisador). */
export function NovoConsignadoModal({
  open,
  onClose,
  onSalvar,
  salvando,
  itensDisponiveis,
  pesquisadores,
}: {
  open: boolean
  onClose: () => void
  onSalvar: (dados: NovoConsignado) => void
  salvando?: boolean
  itensDisponiveis: ItemPatrimonio[]
  pesquisadores: Usuario[]
}) {
  const [itemId, setItemId] = useState('')
  const [pesquisadorId, setPesquisadorId] = useState('')
  const [dataRetirada, setDataRetirada] = useState(hoje())
  const [dataEntrega, setDataEntrega] = useState('')
  const [local, setLocal] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const item = useMemo(() => itensDisponiveis.find((i) => i.id === itemId), [itensDisponiveis, itemId])
  const pesquisador = useMemo(
    () => pesquisadores.find((p) => p.id === pesquisadorId),
    [pesquisadores, pesquisadorId],
  )

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!item) return
    onSalvar({
      itemId: item.id,
      itemNumero: item.numeroPatrimonio,
      itemNome: item.nome,
      pesquisadorId: pesquisador?.id,
      pesquisadorNome: pesquisador?.nome,
      pesquisadorCpf: pesquisador?.cpf,
      pesquisadorArea: pesquisador?.areas.map((a) => a.nome).join(', ') || undefined,
      dataRetirada,
      dataEntregaPrevista: dataEntrega || undefined,
      local: local.trim() || item.localPadrao || undefined,
      observacoes: observacoes.trim() || undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <HandCoins className="h-5 w-5" />
          </span>
          Novo empréstimo
        </span>
      }
      subtitle="Consigne um item a um pesquisador. Depois é só imprimir o protocolo para assinar."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-consignado" disabled={salvando || !itemId || !pesquisadorId}>
            {salvando ? 'Registrando…' : 'Registrar empréstimo'}
          </Button>
        </>
      }
    >
      <form id="form-consignado" onSubmit={enviar} className="space-y-4">
        <Field label="Item (patrimônio)">
          <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">— Selecione um item disponível —</option>
            {itensDisponiveis.map((i) => (
              <option key={i.id} value={i.id}>
                {i.numeroPatrimonio} — {i.nome}
                {i.categoria ? ` (${i.categoria})` : ''}
              </option>
            ))}
          </Select>
          {itensDisponiveis.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Nenhum item disponível. Cadastre um item na aba “Patrimônio”.
            </p>
          )}
        </Field>

        <Field label="Pesquisador (quem recebe)">
          <Select value={pesquisadorId} onChange={(e) => setPesquisadorId(e.target.value)}>
            <option value="">— Selecione o pesquisador —</option>
            {pesquisadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.cpf ? ` — ${formatarCPF(p.cpf)}` : ''}
              </option>
            ))}
          </Select>
          {pesquisador && (
            <p className="mt-1 text-xs text-slate-400">
              {pesquisador.areas.length > 0
                ? `Áreas: ${pesquisador.areas.map((a) => a.nome).join(', ')}`
                : 'Sem área de atuação informada.'}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data de retirada">
            <Input type="date" value={dataRetirada} onChange={(e) => setDataRetirada(e.target.value)} />
          </Field>
          <Field label="Data prevista de entrega">
            <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
          </Field>
        </div>

        <Field label="Local de uso" hint="Onde o item vai ficar durante o empréstimo.">
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={item?.localPadrao ? `Padrão: ${item.localPadrao}` : 'Ex.: Praia Clube'}
          />
        </Field>

        <Field label="Observações">
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Acessórios que acompanham, estado do item, etc."
          />
        </Field>
      </form>
    </Modal>
  )
}
