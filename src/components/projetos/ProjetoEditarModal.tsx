import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { EquipeCamposForm } from './EquipeCamposForm'
import { atualizarConteudoProjeto, atualizarEstruturaProjeto, type ConteudoProjeto } from '@/data/projetos'
import { STATUS_PROJETO, statusProjetoInfo, TRL_INFO, ehDonoProjeto } from '@/lib/projetos'
import { usePermissoes } from '@/hooks/usePermissoes'
import { mensagemErro } from '@/lib/utils'
import type { CampoEditavelProjeto, Projeto, StatusProjeto, TRL, Usuario } from '@/types'

/**
 * "Editar projeto": o dono (criador/responsável) e o admin editam tudo, inclusive a equipe;
 * pesquisadores vinculados só veem/editam os campos que o dono liberou.
 */
export function ProjetoEditarModal({
  projeto,
  open,
  onClose,
  usuarios,
  onExcluir,
}: {
  projeto: Projeto
  open: boolean
  onClose: () => void
  usuarios: Usuario[]
  /** Pedido de exclusão (a página abre a confirmação). Só aparece para admin e criador. */
  onExcluir: () => void
}) {
  const qc = useQueryClient()
  const { ehAdmin, perfil } = usePermissoes()
  const souDono = ehDonoProjeto(projeto, perfil?.id)
  const souCriador = Boolean(perfil?.id && projeto.criadoPorId === perfil.id)
  const souMembro = Boolean(perfil?.id && projeto.pesquisadores.some((v) => v.usuarioId === perfil.id))
  const total = ehAdmin || souDono
  const podeCampo = (c: CampoEditavelProjeto) => total || (souMembro && projeto.camposEditaveisMembros.includes(c))

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState<StatusProjeto>('planejamento')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFimPrevista, setDataFimPrevista] = useState('')
  const [trl, setTrl] = useState('')
  const [progresso, setProgresso] = useState(0)
  const [dadosTecnicos, setDadosTecnicos] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [membrosIds, setMembrosIds] = useState<string[]>([])
  const [camposLiberados, setCamposLiberados] = useState<CampoEditavelProjeto[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitulo(projeto.titulo)
    setDescricao(projeto.descricao ?? '')
    setStatus(projeto.status)
    setDataInicio(projeto.dataInicio ?? '')
    setDataFimPrevista(projeto.dataFimPrevista ?? '')
    setTrl(projeto.trl ? String(projeto.trl) : '')
    setProgresso(projeto.progresso)
    setDadosTecnicos(projeto.dadosTecnicos ?? '')
    setObservacoes(projeto.observacoes ?? '')
    setResponsavelId(projeto.responsavelId)
    setMembrosIds(projeto.pesquisadores.filter((p) => p.papel === 'membro').map((p) => p.usuarioId))
    setCamposLiberados(projeto.camposEditaveisMembros)
    setErro(null)
  }, [open, projeto])

  const salvar = useMutation({
    mutationFn: async () => {
      const patch: ConteudoProjeto = {}
      if (podeCampo('descricao')) patch.descricao = descricao
      if (total) {
        patch.titulo = titulo
        patch.status = status
        patch.dataInicio = dataInicio || undefined
        patch.dataFimPrevista = dataFimPrevista || undefined
      }
      if (podeCampo('trl')) patch.trl = trl ? (Number(trl) as TRL) : undefined
      if (podeCampo('progresso')) patch.progresso = progresso
      if (podeCampo('dadosTecnicos')) patch.dadosTecnicos = dadosTecnicos
      if (podeCampo('observacoes')) patch.observacoes = observacoes
      await atualizarConteudoProjeto(projeto.id, patch)
      if (total && responsavelId) {
        await atualizarEstruturaProjeto(projeto.id, { responsavelId, pesquisadoresIds: membrosIds, camposEditaveisMembros: camposLiberados })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projetos'] })
      onClose()
    },
    onError: (e) => setErro(mensagemErro(e)),
  })

  const semPermissao = !total && !(['trl', 'progresso', 'dadosTecnicos', 'descricao', 'observacoes'] as const).some(podeCampo)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Pencil className="h-5 w-5" />
          </span>
          Editar projeto
        </span>
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {(ehAdmin || souCriador) && (
            <Button variant="ghost" icon={Trash2} onClick={onExcluir} className="w-full text-red-600 sm:mr-auto sm:w-auto">
              Excluir projeto
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || semPermissao || (total && !titulo.trim())} className="w-full sm:w-auto">
            {salvar.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      }
    >
      {semPermissao ? (
        <p className="py-6 text-center text-sm text-slate-500">Você pode acompanhar este projeto e criar tarefas, mas só o criador e o responsável editam os dados dele.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {total && (
              <>
                <Field label="Título">
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </Field>
                <Field label="Status">
                  <Select value={status} onChange={(e) => setStatus(e.target.value as StatusProjeto)}>
                    {STATUS_PROJETO.map((s) => (
                      <option key={s} value={s}>
                        {statusProjetoInfo[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Início">
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </Field>
                <Field label="Fim previsto">
                  <Input type="date" value={dataFimPrevista} onChange={(e) => setDataFimPrevista(e.target.value)} />
                </Field>
              </>
            )}
            {podeCampo('trl') && (
              <Field label="TRL (maturidade tecnológica)">
                <Select value={trl} onChange={(e) => setTrl(e.target.value)}>
                  <option value="">— Não definido —</option>
                  {TRL_INFO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} — {t.descricao}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {podeCampo('progresso') && (
              <Field label={`Progresso — ${progresso}%`}>
                <Input type="number" min={0} max={100} step={5} value={progresso} onChange={(e) => setProgresso(Math.max(0, Math.min(100, Number(e.target.value))))} />
              </Field>
            )}
          </div>
          {podeCampo('descricao') && (
            <Field label="Descrição" hint="Objetivo, escopo, contexto do projeto.">
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Field>
          )}
          {podeCampo('dadosTecnicos') && (
            <Field label="Dados técnicos">
              <Textarea value={dadosTecnicos} onChange={(e) => setDadosTecnicos(e.target.value)} placeholder="Componentes, versões, especificações..." />
            </Field>
          )}
          {podeCampo('observacoes') && (
            <Field label="Observações">
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </Field>
          )}

          {total && (
            <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Equipe</p>
              <EquipeCamposForm
                pesquisadores={usuarios}
                responsavelId={responsavelId}
                onResponsavelChange={setResponsavelId}
                membrosIds={membrosIds}
                onAlternarMembro={(id) => setMembrosIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))}
                camposLiberados={camposLiberados}
                onAlternarCampo={(c) => setCamposLiberados((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]))}
              />
            </div>
          )}
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
        </div>
      )}
    </Modal>
  )
}
