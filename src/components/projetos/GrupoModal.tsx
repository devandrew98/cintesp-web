import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Layers, Lock, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { atualizarGrupo, criarGrupo, excluirGrupo } from '@/data/grupos'
import { validarGrupo, type GrupoTarefas } from '@/lib/grupos'
import { cn, mensagemErro } from '@/lib/utils'
import type { Projeto } from '@/types'

/** Cria ou edita um grupo de tarefas: nome, responsável, link do Drive e quem pode acessar. */
export function GrupoModal({
  open,
  onClose,
  projeto,
  grupo,
  podeSalvar,
  podeExcluir,
}: {
  open: boolean
  onClose: () => void
  projeto: Projeto
  /** Presente = edição. */
  grupo?: GrupoTarefas
  podeSalvar: boolean
  podeExcluir: boolean
}) {
  const qc = useQueryClient()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [restrito, setRestrito] = useState(false)
  const [membrosIds, setMembrosIds] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [confirma, setConfirma] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitulo(grupo?.titulo ?? '')
    setDescricao(grupo?.descricao ?? '')
    setResponsavelId(grupo?.responsavelId ?? '')
    setDriveUrl(grupo?.driveUrl ?? '')
    setRestrito(grupo?.restrito ?? false)
    setMembrosIds(grupo?.membros.map((m) => m.usuarioId) ?? [])
    setErro(null)
    setConfirma(false)
  }, [open, grupo])

  const depois = () => {
    qc.invalidateQueries({ queryKey: ['grupos', projeto.id] })
    qc.invalidateQueries({ queryKey: ['tarefas', projeto.id] })
    qc.invalidateQueries({ queryKey: ['projetos'] })
    onClose()
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const dados = { titulo, descricao, responsavelId: responsavelId || undefined, driveUrl, restrito, membrosIds }
      const invalido = validarGrupo(dados)
      if (invalido) throw new Error(invalido)
      if (grupo) await atualizarGrupo(grupo.id, dados)
      else await criarGrupo(projeto.id, dados)
    },
    onSuccess: depois,
    onError: (e) => setErro(mensagemErro(e)),
  })
  const excluir = useMutation({ mutationFn: () => excluirGrupo(grupo!.id), onSuccess: depois, onError: (e) => setErro(mensagemErro(e)) })
  const ocupado = salvar.isPending || excluir.isPending
  const alternar = (id: string) => setMembrosIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Layers className="h-5 w-5" />
          </span>
          {grupo ? 'Editar grupo' : 'Novo grupo'}
        </span>
      }
      subtitle="Um grupo reúne as tarefas de uma frente do projeto. O progresso dele vem das tarefas concluídas."
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {grupo && podeExcluir && (
            <Button variant={confirma ? 'danger' : 'ghost'} icon={Trash2} disabled={ocupado} onClick={() => (confirma ? excluir.mutate() : setConfirma(true))} className={confirma ? 'w-full sm:mr-auto sm:w-auto' : 'w-full text-red-600 sm:mr-auto sm:w-auto'}>
              {confirma ? 'Confirmar: apaga o grupo e as tarefas' : 'Excluir grupo'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={ocupado || !podeSalvar || !titulo.trim()} className="w-full sm:w-auto">
            {salvar.isPending ? 'Salvando…' : grupo ? 'Salvar' : 'Criar grupo'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Nome do grupo">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Grupo 1: Busca bibliográfica" autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Responsável pelo grupo">
            <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              <option value="">{grupo ? '— Sem responsável —' : '— Eu mesmo —'}</option>
              {projeto.pesquisadores.map((p) => (
                <option key={p.usuarioId} value={p.usuarioId}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Link do Drive do grupo" hint="Só quem tem acesso ao grupo vê este link.">
            <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" />
          </Field>
        </div>
        <Field label="Descrição do grupo">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que esta frente do projeto precisa entregar…" />
        </Field>

        <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={restrito} onChange={(e) => setRestrito(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                <Lock className="h-3.5 w-3.5" /> Restringir o acesso
              </span>
              <span className="block text-xs text-slate-500">Só as pessoas escolhidas abaixo (além do dono do projeto, do responsável do grupo e do administrador) veem as tarefas e o link do Drive deste grupo.</span>
            </span>
          </label>
          {restrito && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {projeto.pesquisadores.map((p) => {
                const marcado = membrosIds.includes(p.usuarioId)
                return (
                  <button key={p.usuarioId} type="button" onClick={() => alternar(p.usuarioId)} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors', marcado ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60')}>
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', marcado ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600')}>{marcado && <Check className="h-3 w-3" />}</span>
                    {p.nome}
                  </button>
                )
              })}
            </div>
          )}
          {!restrito && <p className="text-xs text-slate-400">Grupo aberto: toda a equipe do projeto vê. Quem não está no projeto nunca vê as tarefas.</p>}
        </div>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
