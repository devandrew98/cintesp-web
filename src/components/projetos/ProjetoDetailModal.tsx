import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FolderKanban,
  Send,
  Paperclip,
  Loader2,
  Lock,
  Users,
  Trash2,
  Download,
  Calendar,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { ProgressoBar } from './ProgressoBar'
import { EquipeCamposForm } from './EquipeCamposForm'
import {
  atualizarConteudoProjeto,
  atualizarEstruturaProjeto,
  enviarAnexoProjeto,
  enviarMensagemProjeto,
  listarMensagensProjeto,
  type ConteudoProjeto,
} from '@/data/projetos'
import { STATUS_PROJETO, statusProjetoInfo, TRL_INFO, rotuloTRL } from '@/lib/projetos'
import { usePermissoes } from '@/hooks/usePermissoes'
import { cn, formatDateOnlyBR, mensagemErro } from '@/lib/utils'
import type { CampoEditavelProjeto, Projeto, StatusProjeto, TRL, Usuario } from '@/types'

const TAMANHO_MAX_MB = 20

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/**
 * Detalhe do projeto: informações editáveis (por campo, conforme permissão),
 * equipe (admin) e o chat privado (admin + vinculados).
 */
export function ProjetoDetailModal({
  projeto,
  onClose,
  usuarios,
  onExcluir,
}: {
  projeto: Projeto | null
  onClose: () => void
  usuarios: Usuario[]
  onExcluir: () => void
}) {
  const qc = useQueryClient()
  const { ehAdmin, perfil } = usePermissoes()
  const [texto, setTexto] = useState('')
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  const souResponsavel = Boolean(projeto && perfil?.id === projeto.responsavelId)
  const souMembro = Boolean(projeto && perfil?.id && projeto.pesquisadores.some((v) => v.usuarioId === perfil.id))
  const podeConteudoTotal = ehAdmin || souResponsavel
  const podeVerProjeto = ehAdmin || souMembro

  function podeEditarCampo(campo: CampoEditavelProjeto): boolean {
    if (podeConteudoTotal) return true
    return souMembro && (projeto?.camposEditaveisMembros ?? []).includes(campo)
  }
  const podeEditarAlgumConteudo =
    podeConteudoTotal || ['trl', 'progresso', 'dadosTecnicos', 'descricao', 'observacoes'].some((c) => podeEditarCampo(c as CampoEditavelProjeto))

  // ---------- Conteúdo (edição inline por campo) ----------
  const [titulo, setTitulo] = useState(projeto?.titulo ?? '')
  const [descricao, setDescricao] = useState(projeto?.descricao ?? '')
  const [status, setStatus] = useState<StatusProjeto>(projeto?.status ?? 'planejamento')
  const [dataInicio, setDataInicio] = useState(projeto?.dataInicio ?? '')
  const [dataFimPrevista, setDataFimPrevista] = useState(projeto?.dataFimPrevista ?? '')
  const [trl, setTrl] = useState<string>(projeto?.trl ? String(projeto.trl) : '')
  const [progresso, setProgresso] = useState(projeto?.progresso ?? 0)
  const [dadosTecnicos, setDadosTecnicos] = useState(projeto?.dadosTecnicos ?? '')
  const [observacoes, setObservacoes] = useState(projeto?.observacoes ?? '')

  const salvarConteudo = useMutation({
    mutationFn: (patch: ConteudoProjeto) => atualizarConteudoProjeto(projeto!.id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projetos'] }),
  })

  function submeterConteudo() {
    if (!projeto) return
    const patch: ConteudoProjeto = {}
    if (podeEditarCampo('descricao')) patch.descricao = descricao
    if (podeConteudoTotal) {
      patch.titulo = titulo
      patch.status = status
      patch.dataInicio = dataInicio || undefined
      patch.dataFimPrevista = dataFimPrevista || undefined
    }
    if (podeEditarCampo('trl')) patch.trl = trl ? (Number(trl) as TRL) : undefined
    if (podeEditarCampo('progresso')) patch.progresso = progresso
    if (podeEditarCampo('dadosTecnicos')) patch.dadosTecnicos = dadosTecnicos
    if (podeEditarCampo('observacoes')) patch.observacoes = observacoes
    salvarConteudo.mutate(patch)
  }

  // ---------- Equipe (admin) ----------
  const [editandoEquipe, setEditandoEquipe] = useState(false)
  const [responsavelId, setResponsavelId] = useState(projeto?.responsavelId ?? '')
  const [membrosIds, setMembrosIds] = useState<string[]>(
    (projeto?.pesquisadores ?? []).filter((p) => p.papel === 'membro').map((p) => p.usuarioId),
  )
  const [camposLiberados, setCamposLiberados] = useState<CampoEditavelProjeto[]>(projeto?.camposEditaveisMembros ?? [])

  const salvarEquipe = useMutation({
    mutationFn: () =>
      atualizarEstruturaProjeto(projeto!.id, { responsavelId, pesquisadoresIds: membrosIds, camposEditaveisMembros: camposLiberados }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projetos'] })
      setEditandoEquipe(false)
    },
  })

  // ---------- Chat ----------
  const { data: mensagens = [], isLoading: carregandoChat } = useQuery({
    queryKey: ['projeto-mensagens', projeto?.id],
    queryFn: () => listarMensagensProjeto(projeto!.id),
    enabled: Boolean(projeto) && podeVerProjeto,
    refetchInterval: projeto && podeVerProjeto ? 4000 : false,
  })

  const enviar = useMutation({
    mutationFn: (corpo: string) => enviarMensagemProjeto(projeto!.id, { corpo }),
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['projeto-mensagens', projeto?.id] })
    },
  })

  const [erroAnexo, setErroAnexo] = useState<string | null>(null)
  async function anexarArquivo(arquivo: File) {
    if (!projeto) return
    setErroAnexo(null)
    if (arquivo.size > TAMANHO_MAX_MB * 1024 * 1024) {
      setErroAnexo(`O arquivo deve ter no máximo ${TAMANHO_MAX_MB} MB.`)
      return
    }
    setEnviandoAnexo(true)
    try {
      const anexo = await enviarAnexoProjeto(projeto.id, arquivo)
      await enviarMensagemProjeto(projeto.id, {
        anexoUrl: anexo.url,
        anexoNome: anexo.nome,
        anexoTipo: anexo.tipo,
        anexoTamanho: anexo.tamanho,
      })
      qc.invalidateQueries({ queryKey: ['projeto-mensagens', projeto.id] })
    } catch (err) {
      setErroAnexo(mensagemErro(err))
    } finally {
      setEnviandoAnexo(false)
    }
  }

  useEffect(() => {
    if (projeto) fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens.length, projeto])

  if (!projeto || !podeVerProjeto) return null
  const st = statusProjetoInfo[projeto.status]

  return (
    <Modal
      open={Boolean(projeto)}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <FolderKanban className="h-5 w-5" />
          </span>
          {projeto.titulo}
        </span>
      }
      subtitle={`Responsável: ${projeto.responsavelNome ?? '—'}`}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone as 'green' | 'amber' | 'blue' | 'red' | 'slate'} dot>
            {st.label}
          </Badge>
          {projeto.trl && <Badge tone="violet">{rotuloTRL(projeto.trl)}</Badge>}
          {!podeEditarAlgumConteudo && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Lock className="h-3 w-3" /> Somente leitura para você
            </span>
          )}
        </div>

        {/* Equipe (avatares) */}
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          {projeto.pesquisadores.map((p) => (
            <span key={p.usuarioId} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2.5 text-xs dark:bg-slate-800">
              <Avatar nome={p.nome ?? '—'} fotoUrl={p.fotoUrl} size="sm" className="h-5 w-5 text-[9px]" />
              {p.nome ?? '—'}
              {p.papel === 'responsavel' && <span className="text-slate-400">(responsável)</span>}
            </span>
          ))}
          {ehAdmin && (
            <button
              type="button"
              onClick={() => setEditandoEquipe((v) => !v)}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              {editandoEquipe ? 'Cancelar' : 'Gerenciar equipe'}
            </button>
          )}
        </div>

        {/* Edição de equipe (admin) */}
        {editandoEquipe && (
          <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <EquipeCamposForm
              pesquisadores={usuarios}
              responsavelId={responsavelId}
              onResponsavelChange={setResponsavelId}
              membrosIds={membrosIds}
              onAlternarMembro={(id) => setMembrosIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))}
              camposLiberados={camposLiberados}
              onAlternarCampo={(c) => setCamposLiberados((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]))}
            />
            <Button onClick={() => salvarEquipe.mutate()} disabled={!responsavelId || salvarEquipe.isPending}>
              {salvarEquipe.isPending ? 'Salvando…' : 'Salvar equipe'}
            </Button>
          </div>
        )}

        {/* Informações do projeto */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Título">
            {podeConteudoTotal ? (
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-200">{projeto.titulo}</p>
            )}
          </Field>
          <Field label="Status">
            {podeConteudoTotal ? (
              <Select value={status} onChange={(e) => setStatus(e.target.value as StatusProjeto)}>
                {STATUS_PROJETO.map((s) => (
                  <option key={s} value={s}>
                    {statusProjetoInfo[s].label}
                  </option>
                ))}
              </Select>
            ) : (
              <Badge tone={st.tone as 'green' | 'amber' | 'blue' | 'red' | 'slate'}>{st.label}</Badge>
            )}
          </Field>

          <Field label="Início">
            {podeConteudoTotal ? (
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> {formatDateOnlyBR(projeto.dataInicio)}
              </p>
            )}
          </Field>
          <Field label="Fim previsto">
            {podeConteudoTotal ? (
              <Input type="date" value={dataFimPrevista} onChange={(e) => setDataFimPrevista(e.target.value)} />
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> {formatDateOnlyBR(projeto.dataFimPrevista)}
              </p>
            )}
          </Field>

          <Field label="TRL (maturidade tecnológica)">
            {podeEditarCampo('trl') ? (
              <Select value={trl} onChange={(e) => setTrl(e.target.value)}>
                <option value="">— Não definido —</option>
                {TRL_INFO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} — {t.descricao}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-200">{rotuloTRL(projeto.trl)}</p>
            )}
          </Field>
          <Field label={`Progresso — ${podeEditarCampo('progresso') ? progresso : projeto.progresso}%`}>
            {podeEditarCampo('progresso') ? (
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={progresso}
                onChange={(e) => setProgresso(Math.max(0, Math.min(100, Number(e.target.value))))}
              />
            ) : null}
            <ProgressoBar progresso={podeEditarCampo('progresso') ? progresso : projeto.progresso} className="mt-2" />
          </Field>

          <Field label="Descrição" hint={!podeEditarCampo('descricao') ? undefined : 'Objetivo, escopo, contexto do projeto.'}>
            {podeEditarCampo('descricao') ? (
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{projeto.descricao || '—'}</p>
            )}
          </Field>

          <Field label="Dados técnicos">
            {podeEditarCampo('dadosTecnicos') ? (
              <Textarea
                value={dadosTecnicos}
                onChange={(e) => setDadosTecnicos(e.target.value)}
                placeholder="Componentes, versões, especificações..."
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{projeto.dadosTecnicos || '—'}</p>
            )}
          </Field>

          <Field label="Observações">
            {podeEditarCampo('observacoes') ? (
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{projeto.observacoes || '—'}</p>
            )}
          </Field>
        </div>

        {podeEditarAlgumConteudo && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={submeterConteudo} disabled={salvarConteudo.isPending}>
              {salvarConteudo.isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
            {salvarConteudo.isError && (
              <span className="text-xs text-red-500">{mensagemErro(salvarConteudo.error)}</span>
            )}
            {salvarConteudo.isSuccess && <span className="text-xs text-brand-600">Salvo!</span>}
          </div>
        )}

        {ehAdmin && (
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button variant="danger" icon={Trash2} onClick={onExcluir}>
              Excluir projeto
            </Button>
          </div>
        )}

        {/* Chat privado */}
        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Chat do projeto — visível só para a equipe
          </p>

          <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
            {carregandoChat ? (
              <p className="py-6 text-center text-sm text-slate-400">Carregando conversa…</p>
            ) : mensagens.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nenhuma mensagem ainda. Comece a conversa abaixo.</p>
            ) : (
              mensagens.map((m) => {
                const minha = Boolean(m.autorId && m.autorId === perfil?.id)
                return (
                  <div key={m.id} className={cn('flex gap-2', minha && 'flex-row-reverse')}>
                    <Avatar nome={m.autorNome ?? '—'} fotoUrl={m.autorFotoUrl} size="sm" className="h-7 w-7 shrink-0 text-[10px]" />
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                        minha ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 shadow-card dark:bg-slate-900 dark:text-slate-200',
                      )}
                    >
                      {!minha && <p className="mb-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{m.autorNome ?? '—'}</p>}
                      {m.corpo && <p className="whitespace-pre-wrap break-words">{m.corpo}</p>}
                      {m.anexoUrl && (
                        <a
                          href={m.anexoUrl}
                          download={m.anexoNome}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium',
                            minha ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
                          )}
                        >
                          <Download className="h-3.5 w-3.5 shrink-0" /> {m.anexoNome}
                        </a>
                      )}
                      <p className={cn('mt-1 text-[10px]', minha ? 'text-white/70' : 'text-slate-400')}>{quando(m.criadoEm)}</p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={fimRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const corpo = texto.trim()
              if (!corpo || enviar.isPending) return
              enviar.mutate(corpo)
            }}
            className="mt-3 flex items-end gap-2"
          >
            <button
              type="button"
              onClick={() => inputArquivoRef.current?.click()}
              disabled={enviandoAnexo}
              title="Anexar arquivo"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {enviandoAnexo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <input
              ref={inputArquivoRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) anexarArquivo(f)
                if (inputArquivoRef.current) inputArquivoRef.current.value = ''
              }}
            />
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  const corpo = texto.trim()
                  if (corpo && !enviar.isPending) enviar.mutate(corpo)
                }
              }}
              rows={1}
              placeholder="Escreva uma mensagem…"
              className="max-h-32 min-h-[42px] flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={enviar.isPending || !texto.trim()}
              aria-label="Enviar mensagem"
              className="flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          {(erroAnexo || enviar.isError) && (
            <p className="mt-1 text-xs text-red-500">{erroAnexo || `Não foi possível enviar: ${mensagemErro(enviar.error)}`}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
