import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ListTodo, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { atualizarTarefaPessoal, criarTarefaPessoal, excluirTarefaPessoal } from '@/data/afazeres'
import { validarTarefaPessoal, type ItemAfazer } from '@/lib/afazeres'
import { PRIORIDADES, STATUS_TAREFA, type PrioridadeTarefa, type StatusTarefa } from '@/lib/tarefas'
import { mensagemErro } from '@/lib/utils'

/** Cria ou edita uma tarefa particular (só você vê). */
export function TarefaPessoalModal({ open, onClose, item, dataInicial, aoSalvar }: { open: boolean; onClose: () => void; item?: ItemAfazer; dataInicial?: string; aoSalvar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState<StatusTarefa>('nao_iniciado')
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>('media')
  const [dataEntrega, setDataEntrega] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmaExcluir, setConfirmaExcluir] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitulo(item?.titulo ?? '')
    setDescricao(item?.descricao ?? '')
    setStatus(item?.status ?? 'nao_iniciado')
    setPrioridade(item?.prioridade ?? 'media')
    setDataEntrega(item?.dataEntrega ?? dataInicial ?? '')
    setErro(null)
    setConfirmaExcluir(false)
  }, [open, item, dataInicial])

  const depois = () => {
    aoSalvar()
    onClose()
  }
  const salvar = useMutation({
    mutationFn: () => {
      const dados = { titulo, descricao, status, prioridade, dataEntrega: dataEntrega || undefined }
      const invalido = validarTarefaPessoal(dados)
      if (invalido) throw new Error(invalido)
      return item ? atualizarTarefaPessoal(item.id, dados) : criarTarefaPessoal(dados)
    },
    onSuccess: depois,
    onError: (e) => setErro(mensagemErro(e)),
  })
  const excluir = useMutation({ mutationFn: () => excluirTarefaPessoal(item!.id), onSuccess: depois, onError: (e) => setErro(mensagemErro(e)) })
  const ocupado = salvar.isPending || excluir.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <ListTodo className="h-5 w-5" />
          </span>
          {item ? 'Editar tarefa' : 'Nova tarefa'}
        </span>
      }
      subtitle="Tarefa particular — só você vê."
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {item && (
            <Button variant={confirmaExcluir ? 'danger' : 'ghost'} icon={Trash2} disabled={ocupado} onClick={() => (confirmaExcluir ? excluir.mutate() : setConfirmaExcluir(true))} className={confirmaExcluir ? 'w-full sm:mr-auto sm:w-auto' : 'w-full text-red-600 sm:mr-auto sm:w-auto'}>
              {confirmaExcluir ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={ocupado || !titulo.trim()} className="w-full sm:w-auto">
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Título">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que precisa ser feito?" autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusTarefa)}>
              {STATUS_TAREFA.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prioridade">
            <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeTarefa)}>
              {PRIORIDADES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data de entrega">
            <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
          </Field>
        </div>
        <Field label="Descrição">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Field>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
