import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ListChecks, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { atualizarTarefa, criarTarefa, excluirTarefa } from '@/data/tarefas'
import { equipeDoGrupo, type GrupoTarefas } from '@/lib/grupos'
import { PRIORIDADES, STATUS_TAREFA, validarTarefa, type PrioridadeTarefa, type StatusTarefa, type Tarefa } from '@/lib/tarefas'
import { mensagemErro } from '@/lib/utils'
import type { Projeto } from '@/types'

/** Cria, edita ou (somente leitura) consulta uma tarefa do projeto. */
export function TarefaModal({
  open,
  onClose,
  projeto,
  grupo,
  tarefa,
  statusInicial = 'nao_iniciado',
  responsavelInicialId,
  somenteLeitura,
  podeExcluir,
}: {
  open: boolean
  onClose: () => void
  projeto: Projeto
  grupo: GrupoTarefas
  /** Presente = edição. */
  tarefa?: Tarefa
  statusInicial?: StatusTarefa
  responsavelInicialId?: string
  somenteLeitura: boolean
  podeExcluir: boolean
}) {
  const qc = useQueryClient()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState<StatusTarefa>('nao_iniciado')
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>('media')
  const [responsavelId, setResponsavelId] = useState('')
  const [dataEntrega, setDataEntrega] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmaExcluir, setConfirmaExcluir] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitulo(tarefa?.titulo ?? '')
    setDescricao(tarefa?.descricao ?? '')
    setStatus(tarefa?.status ?? statusInicial)
    setPrioridade(tarefa?.prioridade ?? 'media')
    setResponsavelId(tarefa?.responsavelId ?? responsavelInicialId ?? '')
    setDataEntrega(tarefa?.dataEntrega ?? '')
    setErro(null)
    setConfirmaExcluir(false)
  }, [open, tarefa, statusInicial, responsavelInicialId])

  // Equipe do projeto (+ quem já é responsável pela tarefa, mesmo que tenha saído da equipe).
  const equipe = equipeDoGrupo(grupo, projeto)
  if (tarefa?.responsavelId && !equipe.some((e) => e.id === tarefa.responsavelId)) equipe.push({ id: tarefa.responsavelId, nome: tarefa.responsavelNome ?? '—' })

  const aposSalvar = () => {
    qc.invalidateQueries({ queryKey: ['tarefas', projeto.id] })
    onClose()
  }

  const salvar = useMutation({
    mutationFn: () => {
      const dados = { titulo, descricao, status, prioridade, responsavelId: responsavelId || undefined, dataEntrega: dataEntrega || undefined }
      const invalido = validarTarefa(dados)
      if (invalido) throw new Error(invalido)
      return tarefa ? atualizarTarefa(tarefa.id, dados) : criarTarefa(projeto.id, grupo.id, dados)
    },
    onSuccess: aposSalvar,
    onError: (e) => setErro(mensagemErro(e)),
  })

  const excluir = useMutation({
    mutationFn: () => excluirTarefa(tarefa!.id),
    onSuccess: aposSalvar,
    onError: (e) => setErro(mensagemErro(e)),
  })

  const ocupado = salvar.isPending || excluir.isPending
  const ro = somenteLeitura

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <ListChecks className="h-5 w-5" />
          </span>
          {ro ? 'Tarefa' : tarefa ? 'Editar tarefa' : 'Nova tarefa'}
        </span>
      }
      subtitle={tarefa?.criadoPorNome ? `${grupo.titulo} · criada por ${tarefa.criadoPorNome}` : grupo.titulo}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {tarefa && podeExcluir && !ro && (
            <Button variant={confirmaExcluir ? 'danger' : 'ghost'} icon={Trash2} disabled={ocupado} onClick={() => (confirmaExcluir ? excluir.mutate() : setConfirmaExcluir(true))} className={confirmaExcluir ? 'w-full sm:mr-auto sm:w-auto' : 'w-full text-red-600 sm:mr-auto sm:w-auto'}>
              {confirmaExcluir ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {ro ? 'Fechar' : 'Cancelar'}
          </Button>
          {!ro && (
            <Button onClick={() => salvar.mutate()} disabled={ocupado || !titulo.trim()} className="w-full sm:w-auto">
              {salvar.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Título">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que precisa ser feito?" disabled={ro} autoFocus={!ro} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusTarefa)} disabled={ro}>
              {STATUS_TAREFA.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prioridade">
            <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeTarefa)} disabled={ro}>
              {PRIORIDADES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} disabled={ro}>
              <option value="">— Sem responsável —</option>
              {equipe.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data de entrega">
            <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} disabled={ro} />
          </Field>
        </div>
        <Field label="Descrição">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes, links, critérios de aceite…" disabled={ro} />
        </Field>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
