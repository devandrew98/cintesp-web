import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, MessageCircle, Phone, Trash2, XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Select, Textarea } from '@/components/ui/Field'
import {
  cancelarItem,
  criarAnotacao,
  definirStatusSolicitacao,
  listarAnotacoes,
  removerAnotacao,
  type Anotacao,
  type ItemAgendamento,
  type Solicitacao,
  type StatusAgendamento,
  type TipoAnotacao,
} from '@/data/agendamentos'
import {
  LOCOMOCAO_OPCOES,
  QUESTOES,
  dataBR,
  linkWhatsapp,
  mascararCpf,
  mensagemCancelamento,
  mensagemConfirmacao,
  nomeDiaSemana,
  rotuloHorario,
  sinaisDeAlerta,
} from '@/lib/agendamento'
import { cn, mensagemErro } from '@/lib/utils'

export type AbaSolicitacao = 'resumo' | 'triagem' | 'prontuario'

export const TOM_STATUS: Record<StatusAgendamento, 'amber' | 'green' | 'slate'> = {
  pendente: 'amber',
  confirmado: 'green',
  cancelado: 'slate',
}
export const ROTULO_STATUS: Record<StatusAgendamento, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
}

const ROTULO_ANOTACAO: Record<TipoAnotacao, string> = { anotacao: 'Anotação', prontuario: 'Prontuário', relatorio: 'Relatório' }
const TOM_ANOTACAO: Record<TipoAnotacao, 'blue' | 'violet' | 'green'> = { anotacao: 'blue', prontuario: 'violet', relatorio: 'green' }

/** Detalhe de uma solicitação: resumo + ações, respostas da triagem e prontuário/anotações. */
export function SolicitacaoModal({
  solicitacao,
  local,
  autorNome,
  abaInicial = 'resumo',
  onClose,
}: {
  solicitacao: Solicitacao | null
  local: string
  autorNome?: string
  abaInicial?: AbaSolicitacao
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [aba, setAba] = useState<AbaSolicitacao>(abaInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [desmarcar, setDesmarcar] = useState<ItemAgendamento | null>(null)

  useEffect(() => {
    setAba(abaInicial)
    setErro(null)
  }, [solicitacao?.id, abaInicial])

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['agendamento-solicitacoes'] })
    qc.invalidateQueries({ queryKey: ['agendamento-ocupados'] })
  }
  const falha = (e: unknown) => setErro(mensagemErro(e))

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'confirmado' | 'cancelado' }) => definirStatusSolicitacao(id, status),
    onSuccess: () => {
      setErro(null)
      invalidar()
    },
    onError: falha,
  })
  const itemMut = useMutation({
    mutationFn: (id: string) => cancelarItem(id),
    onSuccess: () => {
      setErro(null)
      invalidar()
    },
    onError: falha,
  })

  if (!solicitacao) return null
  const s = solicitacao
  const ativos = s.itens.filter((i) => i.status !== 'cancelado')
  const resumoMsg = { nome: s.nome, local, itens: ativos.length > 0 ? ativos : s.itens }
  const waConfirmar = linkWhatsapp(s.telefone, mensagemConfirmacao(resumoMsg))
  const waCancelar = linkWhatsapp(s.telefone, mensagemCancelamento({ ...resumoMsg, itens: s.itens }))
  const alertas = sinaisDeAlerta(s.triagem)

  const abas: [AbaSolicitacao, string][] = [
    ['resumo', 'Resumo'],
    ['triagem', 'Triagem'],
    ['prontuario', 'Prontuário e anotações'],
  ]

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={s.nome}
        subtitle={`Protocolo ${s.protocolo} · enviado em ${new Date(s.criadoEm).toLocaleString('pt-BR')}`}
        footer={
          aba === 'resumo' ? (
            <>
              {s.status !== 'cancelado' && (
                <Button variant="secondary" icon={XCircle} onClick={() => setConfirmarCancelar(true)} disabled={statusMut.isPending}>
                  Cancelar agendamento
                </Button>
              )}
              {s.status === 'pendente' && (
                <Button icon={CheckCircle2} onClick={() => statusMut.mutate({ id: s.id, status: 'confirmado' })} disabled={statusMut.isPending}>
                  Confirmar
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
          {abas.map(([id, rotulo]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                aba === id ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}

        {aba === 'resumo' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TOM_STATUS[s.status]} dot>
                {ROTULO_STATUS[s.status]}
              </Badge>
              <Badge tone={s.perfil === 'Atleta' ? 'violet' : 'slate'}>{s.perfil}</Badge>
              {alertas.length > 0 && (
                <Badge tone="red">
                  <AlertTriangle className="h-3 w-3" /> Atenção na triagem
                </Badge>
              )}
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Dado rotulo="CPF" valor={mascararCpf(s.cpf)} />
              <Dado rotulo="Telefone / WhatsApp" valor={s.telefone} />
              <Dado rotulo="E-mail" valor={s.email} />
              <Dado rotulo="Endereço" valor={s.endereco} />
              <div className="sm:col-span-2">
                <Dado rotulo="Deficiência / patologia" valor={s.deficiencia} />
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              {s.status !== 'cancelado' && waConfirmar && (
                <a
                  href={waConfirmar}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> Confirmar pelo WhatsApp
                </a>
              )}
              {s.status === 'cancelado' && waCancelar && (
                <a
                  href={waCancelar}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <MessageCircle className="h-4 w-4" /> Avisar o cancelamento
                </a>
              )}
              <a
                href={`tel:${s.telefone.replace(/\D/g, '')}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Phone className="h-4 w-4" /> Ligar
              </a>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Avaliações agendadas — {local}</h3>
              <ul className="space-y-2">
                {s.itens.map((i) => (
                  <li
                    key={i.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm',
                      i.status === 'cancelado' ? 'border-slate-100 opacity-60 dark:border-slate-800' : 'border-slate-200 dark:border-slate-700',
                    )}
                  >
                    <span>
                      <span className={cn('block font-medium text-slate-800 dark:text-slate-100', i.status === 'cancelado' && 'line-through')}>{i.avaliacaoNome}</span>
                      <span className="text-xs text-slate-500">
                        {nomeDiaSemana(i.data)}, {dataBR(i.data)} · {rotuloHorario(i.hora)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={TOM_STATUS[i.status]}>{ROTULO_STATUS[i.status]}</Badge>
                      {i.status !== 'cancelado' && (
                        <button
                          onClick={() => setDesmarcar(i)}
                          title="Desmarcar esta avaliação (libera o horário)"
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {aba === 'triagem' && <TriagemLeitura s={s} alertas={alertas} />}
        {aba === 'prontuario' && <Prontuario solicitacaoId={s.id} autorNome={autorNome} onErro={falha} />}
      </Modal>

      <ConfirmDialog
        open={confirmarCancelar}
        onClose={() => setConfirmarCancelar(false)}
        onConfirm={() => statusMut.mutate({ id: s.id, status: 'cancelado' })}
        title="Cancelar agendamento"
        message={`Cancelar todas as avaliações de ${s.nome}? Os horários voltam a ficar livres. Depois você pode avisar a pessoa pelo WhatsApp.`}
        confirmLabel="Cancelar agendamento"
      />
      <ConfirmDialog
        open={Boolean(desmarcar)}
        onClose={() => setDesmarcar(null)}
        onConfirm={() => desmarcar && itemMut.mutate(desmarcar.id)}
        title="Desmarcar avaliação"
        message={desmarcar ? `Desmarcar "${desmarcar.avaliacaoNome}" de ${dataBR(desmarcar.data)} às ${desmarcar.hora}? O horário volta a ficar livre.` : ''}
        confirmLabel="Desmarcar"
      />
    </>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{rotulo}</dt>
      <dd className="font-medium text-slate-800 dark:text-slate-100">{valor || '—'}</dd>
    </div>
  )
}

function TriagemLeitura({ s, alertas }: { s: Solicitacao; alertas: string[] }) {
  const t = s.triagem
  const linha = (num: number, texto: string, resposta: string, detalhe?: string, destaque = false) => (
    <li key={num} className={cn('rounded-xl border px-3 py-2 text-sm', destaque ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700')}>
      <p className="text-slate-500">
        {num}. {texto}
      </p>
      <p className="font-semibold text-slate-800 dark:text-slate-100">{resposta}</p>
      {detalhe && <p className="mt-0.5 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{detalhe}</p>}
    </li>
  )
  return (
    <div className="space-y-3">
      {alertas.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Respostas que pedem atenção: <strong>{alertas.join('; ')}</strong>.
          </span>
        </p>
      )}
      <ul className="space-y-2">
        {QUESTOES.filter((q) => q.numero < 8).map((q) =>
          linha(q.numero, q.texto, t[q.chave]?.resposta ?? '—', t[q.chave]?.detalhe, ['cardio', 'sintomasEsforco', 'respiratoria'].includes(q.chave) && t[q.chave]?.resposta === 'Sim'),
        )}
        {linha(8, 'Como se locomove na maior parte do tempo?', t.locomocao || '—', t.locomocao === 'Outro' ? `Qual: ${t.locomocaoOutro}` : undefined)}
        {QUESTOES.filter((q) => q.numero > 8).map((q) => linha(q.numero, q.texto, t[q.chave]?.resposta ?? '—', t[q.chave]?.detalhe))}
        {linha(10, 'Autoriza os testes e declara que as informações são verdadeiras?', t.autorizacao || '—')}
      </ul>
      <p className="text-xs text-slate-400">Opções de locomoção do formulário: {LOCOMOCAO_OPCOES.join(' · ')}.</p>
    </div>
  )
}

function Prontuario({ solicitacaoId, autorNome, onErro }: { solicitacaoId: string; autorNome?: string; onErro: (e: unknown) => void }) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<TipoAnotacao>('anotacao')
  const [texto, setTexto] = useState('')
  const [excluir, setExcluir] = useState<Anotacao | null>(null)

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['agendamento-anotacoes', solicitacaoId],
    queryFn: () => listarAnotacoes(solicitacaoId),
  })
  const recarregar = () => qc.invalidateQueries({ queryKey: ['agendamento-anotacoes', solicitacaoId] })

  const salvar = useMutation({
    mutationFn: () => criarAnotacao(solicitacaoId, tipo, texto, autorNome),
    onSuccess: () => {
      setTexto('')
      recarregar()
    },
    onError: onErro,
  })
  const apagar = useMutation({ mutationFn: (id: string) => removerAnotacao(id), onSuccess: recarregar, onError: onErro })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAnotacao)} aria-label="Tipo">
          {(Object.keys(ROTULO_ANOTACAO) as TipoAnotacao[]).map((t) => (
            <option key={t} value={t}>
              {ROTULO_ANOTACAO[t]}
            </option>
          ))}
        </Select>
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva a anotação, o registro do prontuário ou o relatório…" />
        <div className="flex justify-end">
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !texto.trim()}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Carregando…</p>
      ) : notas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
          Nenhum registro ainda para este solicitante.
        </p>
      ) : (
        <ul className="space-y-2">
          {notas.map((n) => (
            <li key={n.id} className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <Badge tone={TOM_ANOTACAO[n.tipo]}>{ROTULO_ANOTACAO[n.tipo]}</Badge>
                  {new Date(n.criadoEm).toLocaleString('pt-BR')}
                  {n.autorNome && ` · ${n.autorNome}`}
                </span>
                <button onClick={() => setExcluir(n)} title="Excluir registro" className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{n.texto}</p>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(excluir)}
        onClose={() => setExcluir(null)}
        onConfirm={() => excluir && apagar.mutate(excluir.id)}
        title="Excluir registro"
        message="Excluir este registro do prontuário? Não dá para desfazer."
      />
    </div>
  )
}
