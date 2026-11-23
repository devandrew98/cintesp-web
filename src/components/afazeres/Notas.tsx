import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pin, PinOff, Plus, Search, StickyNote, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { atualizarNota, criarNota, excluirNota, listarNotas } from '@/data/afazeres'
import { organizarNotas, validarNota, type Nota } from '@/lib/afazeres'
import { cn, mensagemErro } from '@/lib/utils'

/** Aba Anotações: bloco de notas particular, com busca e notas fixadas no topo. */
export function Notas() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<{ nota?: Nota } | null>(null)
  const { data: notas = [], isLoading } = useQuery({ queryKey: ['afazeres-notas'], queryFn: listarNotas })
  const lista = organizarNotas(notas, busca)
  const recarregar = () => qc.invalidateQueries({ queryKey: ['afazeres-notas'] })

  const fixar = useMutation({ mutationFn: (n: Nota) => atualizarNota(n.id, { fixada: !n.fixada }), onSuccess: recarregar })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nas anotações…" className="pl-9" aria-label="Buscar anotações" />
        </div>
        <Button icon={Plus} onClick={() => setModal({})} className="w-full sm:w-auto">
          Nova anotação
        </Button>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando anotações…</p>
      ) : lista.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-14 text-center">
          <StickyNote className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">{notas.length === 0 ? 'Nenhuma anotação ainda. Só você vê o que escrever aqui.' : 'Nenhuma anotação encontrada.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((n) => (
            <article key={n.id} className={cn('card group relative flex flex-col p-4', n.fixada && 'ring-1 ring-amber-300 dark:ring-amber-500/40')}>
              <button type="button" onClick={() => setModal({ nota: n })} className="flex-1 text-left">
                {n.titulo && <h3 className="mb-1 break-words pr-8 text-sm font-semibold text-slate-900 dark:text-white">{n.titulo}</h3>}
                <p className="line-clamp-6 whitespace-pre-line break-words text-sm text-slate-600 dark:text-slate-300">{n.texto}</p>
                <p className="mt-3 text-[11px] text-slate-400">Editada em {new Date(n.atualizadoEm).toLocaleDateString('pt-BR')}</p>
              </button>
              <button
                type="button"
                onClick={() => fixar.mutate(n)}
                aria-label={n.fixada ? 'Desafixar' : 'Fixar no topo'}
                className={cn('absolute right-2 top-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800', n.fixada ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500')}
              >
                {n.fixada ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </button>
            </article>
          ))}
        </div>
      )}

      <NotaModal open={modal !== null} nota={modal?.nota} onClose={() => setModal(null)} aoSalvar={recarregar} />
    </div>
  )
}

function NotaModal({ open, nota, onClose, aoSalvar }: { open: boolean; nota?: Nota; onClose: () => void; aoSalvar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [fixada, setFixada] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirma, setConfirma] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitulo(nota?.titulo ?? '')
    setTexto(nota?.texto ?? '')
    setFixada(nota?.fixada ?? false)
    setErro(null)
    setConfirma(false)
  }, [open, nota])

  const depois = () => {
    aoSalvar()
    onClose()
  }
  const salvar = useMutation({
    mutationFn: () => {
      const invalido = validarNota({ titulo, texto })
      if (invalido) throw new Error(invalido)
      return nota ? atualizarNota(nota.id, { titulo, texto, fixada }) : criarNota({ titulo, texto, fixada })
    },
    onSuccess: depois,
    onError: (e) => setErro(mensagemErro(e)),
  })
  const excluir = useMutation({ mutationFn: () => excluirNota(nota!.id), onSuccess: depois, onError: (e) => setErro(mensagemErro(e)) })
  const ocupado = salvar.isPending || excluir.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <StickyNote className="h-5 w-5" />
          </span>
          {nota ? 'Editar anotação' : 'Nova anotação'}
        </span>
      }
      subtitle="Só você vê."
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {nota && (
            <Button variant={confirma ? 'danger' : 'ghost'} icon={Trash2} disabled={ocupado} onClick={() => (confirma ? excluir.mutate() : setConfirma(true))} className={confirma ? 'w-full sm:mr-auto sm:w-auto' : 'w-full text-red-600 sm:mr-auto sm:w-auto'}>
              {confirma ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={ocupado || (!titulo.trim() && !texto.trim())} className="w-full sm:w-auto">
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Título (opcional)">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
        </Field>
        <Field label="Anotação">
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} className="min-h-[180px]" />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={fixada} onChange={(e) => setFixada(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Fixar no topo
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
