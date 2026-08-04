import { useState, type FormEvent } from 'react'
import { Package, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { CATEGORIAS_ITEM } from '@/lib/consignados'
import type { DadosItem, ItemPatrimonio, StatusItem } from '@/data/consignados'

/** Modal para cadastrar/editar um item do patrimônio (inventário). */
export function NovoItemModal({
  open,
  onClose,
  onSalvar,
  salvando,
  inicial,
}: {
  open: boolean
  onClose: () => void
  onSalvar: (dados: DadosItem) => void
  salvando?: boolean
  inicial?: ItemPatrimonio
}) {
  const editando = Boolean(inicial)
  const [numero, setNumero] = useState(inicial?.numeroPatrimonio ?? '')
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '')
  const [localPadrao, setLocalPadrao] = useState(inicial?.localPadrao ?? '')
  const [status, setStatus] = useState<StatusItem>(inicial?.status ?? 'disponivel')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '')

  function enviar(e: FormEvent) {
    e.preventDefault()
    onSalvar({
      numeroPatrimonio: numero.trim(),
      nome: nome.trim(),
      categoria: categoria || undefined,
      localPadrao: localPadrao.trim() || undefined,
      status,
      descricao: descricao.trim() || undefined,
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
            {editando ? <Pencil className="h-5 w-5" /> : <Package className="h-5 w-5" />}
          </span>
          {editando ? 'Editar item' : 'Novo item de patrimônio'}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-item" disabled={salvando || !numero.trim() || !nome.trim()}>
            {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Adicionar item'}
          </Button>
        </>
      }
    >
      <form id="form-item" onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nº do patrimônio">
            <Input
              required
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex.: 000123"
            />
          </Field>
          <Field label="Nome do item">
            <Input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Notebook Dell / Câmera Canon"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">— Selecione —</option>
              {CATEGORIAS_ITEM.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Situação">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusItem)}>
              <option value="disponivel">Disponível</option>
              <option value="manutencao">Em manutenção</option>
              <option value="baixado">Baixado</option>
            </Select>
          </Field>
        </div>

        <Field label="Local (estoque padrão)" hint="Onde o item fica quando está disponível.">
          <Input
            value={localPadrao}
            onChange={(e) => setLocalPadrao(e.target.value)}
            placeholder="Ex.: Sala CINTESP — armário 2"
          />
        </Field>

        <Field label="Descrição">
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Marca, modelo, nº de série…"
          />
        </Field>

        <Field label="Observações">
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Estado de conservação, acessórios que acompanham, etc."
          />
        </Field>
      </form>
    </Modal>
  )
}
