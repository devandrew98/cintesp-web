import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ListChecks, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { atualizarTarefa, criarTarefa, excluirTarefa } from '@/data/tarefas'
import { equipeDoGrupo, type GrupoTarefas } from '@/lib/grupos'
import { CONFERENCIAS, PRIORIDADES, infoStatus, statusPermitidos, validarTarefa, type Conferencia, type DadosTarefa, type PermissoesTarefa, type PrioridadeTarefa, type StatusTarefa, type Tarefa } from '@/lib/tarefas'
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
  perms,
}: {
  open: boolean
  onClose: () => void
  projeto: Projeto
  grupo: GrupoTarefas
  /** Presente = edição. */
  tarefa?: Tarefa
  statusInicial?: StatusTarefa
  responsavelInicialId?: string
  perms: PermissoesTarefa
}) {
  const qc = useQueryClient()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState<StatusTarefa>('nao_iniciado')
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>('media')
  const [responsavelId, setResponsavelId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataEntrega, setDataEntrega] = useState('')
  const [conferencia, setConferencia] = useState<Conferencia | ''>('')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmaExcluir, setConfirmaExcluir] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitulo(tarefa?.titulo ?? '')
    setDescricao(tarefa?.descricao ?? '')
    setStatus(tarefa?.status ?? statusInicial)
    setPrioridade(tarefa?.prioridade ?? 'media')
    setResponsavelId(tarefa?.responsavelId ?? responsavelInicialId ?? '')
    setDataInicio(tarefa?.dataInicio ?? '')
    setDataEntrega(tarefa?.dataEntrega ?? '')
    setConferencia(tarefa?.conferencia ?? '')
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
      const dados: DadosTarefa = {
        titulo,
        descricao,
        status,
        prioridade,
        responsavelId: responsavelId || undefined,
        dataInicio: dataInicio || undefined,
        dataEntrega: dataEntrega || undefined,
        conferencia: status === 'concluido' ? conferencia || undefined : undefined,
      }
      const invalido = validarTarefa(dados)
      if (invalido) throw new Error(invalido)
      if (!tarefa) return criarTarefa(projeto.id, grupo.id, dados)
      // Só manda o que mudou: quem atualiza apenas o andamento não reenvia o resto.
      const mudou = (k: keyof DadosTarefa) => (dados[k] || '') !== (tarefa[k] || '')
      const patch = Object.fromEntries((Object.keys(dados) as (keyof DadosTarefa)[]).filter(mudou).map((k) => [k, dados[k]])) as Partial<DadosTarefa>
      return atualizarTarefa(tarefa.id, patch)
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
  // `ro` = não edita os dados; o status e a conferência têm regra própria.
  const ro = tarefa ? !perms.editar : !perms.criar
  const opcoesStatus = tarefa ? statusPermitidos(tarefa.status, perms) : statusPermitidos('nao_iniciado', { gestor: perms.gestor, andamento: perms.criar })
  const podeSalvar = tarefa ? perms.editar || opcoesStatus.length > 1 || perms.gestor : perms.criar

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
          {!podeSalvar ? 'Tarefa' : tarefa ? 'Editar tarefa' : 'Nova tarefa'}
        </span>
      }
      subtitle={tarefa?.criadoPorNome ? `${grupo.titulo} · criada por ${tarefa.criadoPorNome}` : grupo.titulo}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {tarefa && perms.excluir && (
            <Button variant={confirmaExcluir ? 'danger' : 'ghost'} icon={Trash2} disabled={ocupado} onClick={() => (confirmaExcluir ? excluir.mutate() : setConfirmaExcluir(true))} className={confirmaExcluir ? 'w-full sm:mr-auto sm:w-auto' : 'w-full text-red-600 sm:mr-auto sm:w-auto'}>
              {confirmaExcluir ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {podeSalvar ? 'Cancelar' : 'Fechar'}
          </Button>
          {podeSalvar && (
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
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusTarefa)} disabled={opcoesStatus.length < 2}>
              {(opcoesStatus.includes(status) ? opcoesStatus : [status, ...opcoesStatus]).map((s) => (
                <option key={s} value={s}>
                  {infoStatus(s).label}
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
          <Field label="Data de início">
            <Input type="date" value={dataInicio} max={dataEntrega || undefined} onChange={(e) => setDataInicio(e.target.value)} disabled={ro} />
          </Field>
          <Field label="Data de entrega">
            <Input type="date" value={dataEntrega} min={dataInicio || undefined} onChange={(e) => setDataEntrega(e.target.value)} disabled={ro} />
          </Field>
          {status === 'concluido' && (perms.gestor || conferencia) && (
            <Field label="Conferência (opcional)" hint={tarefa?.conferidaPorNome && conferencia === tarefa.conferencia ? `Marcada por ${tarefa.conferidaPorNome}.` : undefined}>
              <Select value={conferencia} onChange={(e) => setConferencia(e.target.value as Conferencia | '')} disabled={!perms.gestor}>
                <option value="">— Sem marcação —</option>
                {CONFERENCIAS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Descrição">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes, links, critérios de aceite…" disabled={ro} />
        </Field>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
