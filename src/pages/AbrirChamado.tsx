import { useMemo, useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { LifeBuoy, Send, Loader2, CheckCircle2, Clock, Paperclip, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { abrirChamado, listarMeusChamados, enviarAnexoChamado } from '@/data/chamados'
import {
  SETORES,
  CATEGORIAS_POR_SETOR,
  PRIORIDADES,
  prioridadeChamadoInfo,
  statusChamadoInfo,
  rotuloSetor,
} from '@/lib/chamados'
import { mensagemErro, formatDateBR } from '@/lib/utils'
import { usePermissoes } from '@/hooks/usePermissoes'
import type { PrioridadeChamado, SetorChamado } from '@/types'

/**
 * "Abrir Chamado" — disponível para TODOS os usuários logados (inclusive quem
 * ainda é Participante). Envia o chamado e lista os chamados que a pessoa abriu.
 */
export function AbrirChamadoPage() {
  const qc = useQueryClient()
  const { ehParticipante } = usePermissoes()
  const { data: meus = [], isLoading } = useQuery({
    queryKey: ['meus-chamados'],
    queryFn: listarMeusChamados,
  })

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [setor, setSetor] = useState<SetorChamado>('ti')
  const [categoria, setCategoria] = useState('')
  const [prioridade, setPrioridade] = useState<PrioridadeChamado>('media')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const categorias = useMemo(() => CATEGORIAS_POR_SETOR[setor], [setor])

  const criar = useMutation({
    mutationFn: abrirChamado,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meus-chamados'] })
      qc.invalidateQueries({ queryKey: ['chamados'] })
      qc.invalidateQueries({ queryKey: ['chamados-stats'] })
      setTitulo('')
      setDescricao('')
      setCategoria('')
      setPrioridade('media')
      setArquivo(null)
    },
  })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      let anexoUrl: string | undefined
      if (arquivo) anexoUrl = await enviarAnexoChamado(arquivo)
      await criar.mutateAsync({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        setor,
        categoria: categoria || undefined,
        prioridade,
        anexoUrl,
      })
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Abrir Chamado"
        subtitle="Descreva seu problema ou solicitação. A equipe responsável vai atender."
      />

      {ehParticipante && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Sua conta está <strong>aguardando liberação</strong> de um administrador. Enquanto isso,
            você já pode abrir chamados aqui. Assim que sua função for definida, o restante da
            plataforma fica disponível.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Formulário */}
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-brand-600" /> Novo chamado
            </span>
          }
          bodyClassName="p-5"
        >
          {criar.isSuccess && (
            <p className="mb-4 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              <CheckCircle2 className="h-4 w-4" /> Chamado aberto! Acompanhe abaixo.
            </p>
          )}
          <form onSubmit={enviar} className="space-y-4">
            <Field label="Título">
              <Input
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Computador não liga"
                maxLength={120}
              />
            </Field>

            <Field label="Resumo do problema">
              <Textarea
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o que está acontecendo, quando começou, e o que já tentou."
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Setor">
                <Select
                  value={setor}
                  onChange={(e) => {
                    setSetor(e.target.value as SetorChamado)
                    setCategoria('')
                  }}
                >
                  {SETORES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Categoria">
                <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option value="">— Selecione —</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Prioridade">
              <Select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as PrioridadeChamado)}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {prioridadeChamadoInfo[p].label}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Anexo (opcional) */}
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Anexo (opcional)
              </span>
              {arquivo ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                  <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                    {arquivo.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setArquivo(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                    aria-label="Remover anexo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-600"
                >
                  <Paperclip className="h-4 w-4" /> Anexar arquivo (print, foto, PDF…)
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  if (f && f.size > 10 * 1024 * 1024) {
                    setErro('O anexo deve ter no máximo 10 MB.')
                    return
                  }
                  setArquivo(f)
                  if (inputRef.current) inputRef.current.value = ''
                }}
              />
            </div>

            {erro && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
                {erro}
              </p>
            )}

            <Button type="submit" icon={enviando ? undefined : Send} disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                'Abrir chamado'
              )}
            </Button>
          </form>
        </SectionCard>

        {/* Meus chamados */}
        <SectionCard
          title="Meus chamados"
          action={<span className="text-sm font-medium text-brand-600">{meus.length}</span>}
          bodyClassName="p-2"
        >
          {isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">Carregando…</p>
          ) : meus.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              Você ainda não abriu nenhum chamado.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {meus.map((c) => {
                const st = statusChamadoInfo[c.status]
                const pr = prioridadeChamadoInfo[c.prioridade]
                return (
                  <div key={c.id} className="px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{c.titulo}</p>
                      <Badge tone={st.tone as 'green' | 'amber' | 'blue' | 'violet' | 'slate'} dot>
                        {st.label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>{rotuloSetor(c.setor)}</span>
                      {c.categoria && <span>· {c.categoria}</span>}
                      <span>· Prioridade {pr.label}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateBR(c.criadoEm)}
                      </span>
                      {c.responsavelNome && <span>· Responsável: {c.responsavelNome}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
