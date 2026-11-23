import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Paperclip, Send } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { enviarAnexoProjeto, enviarMensagemProjeto, listarMensagensProjeto } from '@/data/projetos'
import { usePermissoes } from '@/hooks/usePermissoes'
import { cn, mensagemErro } from '@/lib/utils'
import type { Projeto } from '@/types'

const TAMANHO_MAX_MB = 20

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Chat privado do projeto (visível só para a equipe, o criador e o administrador). */
export function ProjetoChat({ projeto }: { projeto: Projeto }) {
  const qc = useQueryClient()
  const { perfil } = usePermissoes()
  const [texto, setTexto] = useState('')
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const [erroAnexo, setErroAnexo] = useState<string | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ['projeto-mensagens', projeto.id],
    queryFn: () => listarMensagensProjeto(projeto.id),
    refetchInterval: 4000,
  })

  const enviar = useMutation({
    mutationFn: (corpo: string) => enviarMensagemProjeto(projeto.id, { corpo }),
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['projeto-mensagens', projeto.id] })
    },
  })

  async function anexarArquivo(arquivo: File) {
    setErroAnexo(null)
    if (arquivo.size > TAMANHO_MAX_MB * 1024 * 1024) {
      setErroAnexo(`O arquivo deve ter no máximo ${TAMANHO_MAX_MB} MB.`)
      return
    }
    setEnviandoAnexo(true)
    try {
      const anexo = await enviarAnexoProjeto(projeto.id, arquivo)
      await enviarMensagemProjeto(projeto.id, { anexoUrl: anexo.url, anexoNome: anexo.nome, anexoTipo: anexo.tipo, anexoTamanho: anexo.tamanho })
      qc.invalidateQueries({ queryKey: ['projeto-mensagens', projeto.id] })
    } catch (err) {
      setErroAnexo(mensagemErro(err))
    } finally {
      setEnviandoAnexo(false)
    }
  }

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens.length])

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Chat do projeto — visível só para a equipe</p>
      <div className="max-h-96 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">Carregando conversa…</p>
        ) : mensagens.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhuma mensagem ainda. Comece a conversa abaixo.</p>
        ) : (
          mensagens.map((m) => {
            const minha = Boolean(m.autorId && m.autorId === perfil?.id)
            return (
              <div key={m.id} className={cn('flex gap-2', minha && 'flex-row-reverse')}>
                <Avatar nome={m.autorNome ?? '—'} fotoUrl={m.autorFotoUrl} size="sm" className="h-7 w-7 shrink-0 text-[10px]" />
                <div className={cn('max-w-[75%] rounded-2xl px-3 py-2 text-sm', minha ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 shadow-card dark:bg-slate-900 dark:text-slate-200')}>
                  {!minha && <p className="mb-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{m.autorNome ?? '—'}</p>}
                  {m.corpo && <p className="whitespace-pre-wrap break-words">{m.corpo}</p>}
                  {m.anexoUrl && (
                    <a
                      href={m.anexoUrl}
                      download={m.anexoNome}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn('mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium', minha ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}
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
      {(erroAnexo || enviar.isError) && <p className="mt-1 text-xs text-red-500">{erroAnexo || `Não foi possível enviar: ${mensagemErro(enviar.error)}`}</p>}
    </div>
  )
}
