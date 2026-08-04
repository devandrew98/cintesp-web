import { useMemo, useState, type FormEvent } from 'react'
import { HandCoins, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { formatarCPF } from '@/lib/cpf'
import { cn } from '@/lib/utils'
import type { ItemPatrimonio, NovoConsignado } from '@/data/consignados'
import type { Usuario } from '@/types'

const hoje = () => new Date().toISOString().slice(0, 10)

/** Modal para registrar um empréstimo (consignar um ou mais itens a um pesquisador). */
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
  const [itemIds, setItemIds] = useState<string[]>([])
  const [pesquisadorId, setPesquisadorId] = useState('')
  const [dataRetirada, setDataRetirada] = useState(hoje())
  const [dataEntrega, setDataEntrega] = useState('')
  const [local, setLocal] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const itensSelecionados = useMemo(
    () => itensDisponiveis.filter((i) => itemIds.includes(i.id)),
    [itensDisponiveis, itemIds],
  )
  const pesquisador = useMemo(
    () => pesquisadores.find((p) => p.id === pesquisadorId),
    [pesquisadores, pesquisadorId],
  )
  const localPadraoSugerido = itensSelecionados.find((i) => i.localPadrao)?.localPadrao

  function alternarItem(id: string) {
    setItemIds((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (itensSelecionados.length === 0) return
    onSalvar({
      itens: itensSelecionados.map((it) => ({
        itemId: it.id,
        itemNumero: it.numeroPatrimonio,
        itemNome: it.nome,
      })),
      pesquisadorId: pesquisador?.id,
      pesquisadorNome: pesquisador?.nome,
      pesquisadorCpf: pesquisador?.cpf,
      pesquisadorArea: pesquisador?.areas.map((a) => a.nome).join(', ') || undefined,
      dataRetirada,
      dataEntregaPrevista: dataEntrega || undefined,
      local: local.trim() || localPadraoSugerido || undefined,
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
      subtitle="Consigne um ou mais itens a um pesquisador — todos ficam no mesmo protocolo. Depois é só imprimir o formulário para assinar."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-consignado"
            disabled={salvando || itemIds.length === 0 || !pesquisadorId}
          >
            {salvando
              ? 'Registrando…'
              : `Registrar empréstimo${itemIds.length > 1 ? ` (${itemIds.length} itens)` : ''}`}
          </Button>
        </>
      }
    >
      <form id="form-consignado" onSubmit={enviar} className="space-y-4">
        <Field
          label={`Itens (patrimônio)${itemIds.length > 0 ? ` — ${itemIds.length} selecionado(s)` : ''}`}
          hint="Marque um ou mais itens para consigná-los juntos, no mesmo protocolo."
        >
          {itensDisponiveis.length === 0 ? (
            <p className="text-xs text-amber-600">
              Nenhum item disponível. Cadastre um item na aba “Patrimônio”.
            </p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {itensDisponiveis.map((i) => {
                const marcado = itemIds.includes(i.id)
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => alternarItem(i.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      marcado
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        marcado
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-300 dark:border-slate-600',
                      )}
                    >
                      {marcado && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{i.numeroPatrimonio}</span> — {i.nome}
                      {i.categoria ? ` (${i.categoria})` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
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

        <Field label="Local de uso" hint="Onde os itens vão ficar durante o empréstimo.">
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={localPadraoSugerido ? `Padrão: ${localPadraoSugerido}` : 'Ex.: Praia Clube'}
          />
        </Field>

        <Field label="Observações">
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Acessórios que acompanham, estado dos itens, etc."
          />
        </Field>
      </form>
    </Modal>
  )
}
