import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Paperclip, Loader2, Lock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Field'
import {
  listarMensagensChamado,
  enviarMensagemChamado,
  aceitarChamado,
  atualizarStatusChamado,
} from '@/data/chamados'
import { statusChamadoInfo, prioridadeChamadoInfo, rotuloSetor } from '@/lib/chamados'
import { usePermissoes } from '@/hooks/usePermissoes'
import { cn, formatDateBR, mensagemErro } from '@/lib/utils'
import type { Chamado, StatusChamado } from '@/types'

const STATUS_OPCOES: StatusChamado[] = [
  'aberto',
  'em_andamento',
  'aguardando_usuario',
  'finalizado',
  'cancelado',
]

/** O anexo é uma imagem? (para mostrar a pré-visualização) */
function ehImagem(url?: string): boolean {
  return !!url && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url)
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Detalhe completo de um chamado + conversa (chat).
 *
 * Mostra o texto inteiro e o anexo. Solicitante e admin conversam por aqui.
 * O envio fica bloqueado quando o chamado está finalizado/cancelado.
 * Admin ainda pode aceitar / mudar o status por aqui.
 */
export function ChamadoDetailModal({
  chamado,
  onClose,
}: {
  chamado: Chamado | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { ehAdmin, perfil } = usePermissoes()
  const meuId = perfil?.id
  const [texto, setTexto] = useState('')
  const fimRef = useRef<HTMLDivElement>(null)

  const aberto = Boolean(chamado)
  const fechado = chamado?.status === 'finalizado' || chamado?.status === 'cancelado'

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ['chamado-mensagens', chamado?.id],
    queryFn: () => listarMensagensChamado(chamado!.id),
    enabled: aberto,
    refetchInterval: aberto ? 4000 : false,
  })

  const invalidarChamados = () => {
    qc.invalidateQueries({ queryKey: ['chamados'] })
    qc.invalidateQueries({ queryKey: ['meus-chamados'] })
  }

  const enviar = useMutation({
    mutationFn: (corpo: string) => enviarMensagemChamado(chamado!.id, corpo),
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['chamado-mensagens', chamado?.id] })
    },
  })
  const aceitar = useMutation({
    mutationFn: () => aceitarChamado(chamado!.id),
    onSuccess: invalidarChamados,
  })
  const mudarStatus = useMutation({
    mutationFn: (s: StatusChamado) => atualizarStatusChamado(chamado!.id, s),
    onSuccess: invalidarChamados,
  })

  // Rola para a última mensagem quando a conversa muda.
  useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens.length, aberto])

  function submeter() {
    const corpo = texto.trim()
    if (!corpo || enviar.isPending) return
    enviar.mutate(corpo)
  }

  if (!chamado) return null
  const st = statusChamadoInfo[chamado.status]
  const pr = prioridadeChamadoInfo[chamado.prioridade]

  return (
    <Modal
      open={aberto}
      onClose={onClose}
      size="xl"
      title={chamado.titulo}
      subtitle={`${rotuloSetor(chamado.setor)}${chamado.categoria ? ` · ${chamado.categoria}` : ''}`}
    >
      <div className="space-y-5">
        {/* Status + prioridade + data */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone as 'green' | 'amber' | 'blue' | 'violet' | 'slate'} dot>
            {st.label}
          </Badge>
          <Badge tone={pr.tone as 'slate' | 'blue' | 'amber' | 'red'}>{pr.label}</Badge>
          <span className="text-xs text-slate-400">Aberto em {formatDateBR(chamado.criadoEm)}</span>
        </div>

        {/* Solicitante / responsável */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <Avatar
              nome={chamado.solicitanteNome ?? '—'}
              fotoUrl={chamado.solicitanteFotoUrl}
              size="sm"
              className="h-7 w-7 text-[10px]"
            />
            <span className="text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">Solicitante:</span>{' '}
              <span className="font-medium">{chamado.solicitanteNome ?? '—'}</span>
            </span>
          </span>
          {chamado.responsavelNome && (
            <span className="text-slate-500">
              <span className="text-slate-400">Responsável:</span> {chamado.responsavelNome}
            </span>
          )}
        </div>

        {/* Descrição completa */}
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Descrição</p>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
            {chamado.descricao}
          </p>
        </div>

        {/* Anexo */}
        {chamado.anexoUrl && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Anexo</p>
            {ehImagem(chamado.anexoUrl) ? (
              <a href={chamado.anexoUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={chamado.anexoUrl}
                  alt="Anexo do chamado"
                  className="max-h-72 rounded-xl border border-slate-200 object-contain dark:border-slate-700"
                />
              </a>
            ) : (
              <a
                href={chamado.anexoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Paperclip className="h-4 w-4" /> Abrir anexo
              </a>
            )}
          </div>
        )}

        {/* Ações do admin */}
        {ehAdmin && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="text-sm text-slate-500">Ação:</span>
            {chamado.status === 'aberto' ? (
              <button
                onClick={() => aceitar.mutate()}
                disabled={aceitar.isPending}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Aceitar chamado
              </button>
            ) : (
              <Select
                value={chamado.status}
                onChange={(e) => mudarStatus.mutate(e.target.value as StatusChamado)}
                className="h-9 w-52 text-sm"
              >
                {STATUS_OPCOES.map((s) => (
                  <option key={s} value={s}>
                    {statusChamadoInfo[s].label}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}

        {/* Conversa (chat) */}
        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Conversa</p>

          <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
            {isLoading ? (
              <p className="py-6 text-center text-sm text-slate-400">Carregando conversa…</p>
            ) : mensagens.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Nenhuma mensagem ainda. {fechado ? '' : 'Comece a conversa abaixo.'}
              </p>
            ) : (
              mensagens.map((m) => {
                const minha = Boolean(m.autorId && m.autorId === meuId)
                return (
                  <div key={m.id} className={cn('flex gap-2', minha && 'flex-row-reverse')}>
                    <Avatar
                      nome={m.autorNome ?? '—'}
                      fotoUrl={m.autorFotoUrl}
                      size="sm"
                      className="h-7 w-7 shrink-0 text-[10px]"
                    />
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                        minha
                          ? 'bg-brand-600 text-white'
                          : 'bg-white text-slate-700 shadow-card dark:bg-slate-900 dark:text-slate-200',
                      )}
                    >
                      {!minha && (
                        <p className="mb-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {m.autorNome ?? '—'}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.corpo}</p>
                      <p className={cn('mt-1 text-[10px]', minha ? 'text-white/70' : 'text-slate-400')}>
                        {quando(m.criadoEm)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={fimRef} />
          </div>

          {/* Campo de envio (bloqueado se finalizado/cancelado) */}
          {fechado ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Lock className="h-4 w-4 shrink-0" />
              Chamado {st.label.toLowerCase()} — não é possível enviar novas mensagens.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submeter()
              }}
              className="mt-3 flex items-end gap-2"
            >
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submeter()
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
                {enviar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          )}
          {enviar.isError && (
            <p className="mt-1 text-xs text-red-500">
              Não foi possível enviar: {mensagemErro(enviar.error)}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
