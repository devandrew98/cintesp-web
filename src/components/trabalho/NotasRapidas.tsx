import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pin, Plus, StickyNote } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { criarNota, listarNotas } from '@/data/afazeres'
import { organizarNotas } from '@/lib/afazeres'
import { mensagemErro } from '@/lib/utils'

/** Anotações fixadas (ou as mais recentes) + caixa de nota rápida. Só eu vejo. */
export function NotasRapidas({ className }: { className?: string }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const { data: notas = [] } = useQuery({ queryKey: ['afazeres-notas'], queryFn: listarNotas })
  const lista = organizarNotas(notas).slice(0, 3)

  const salvar = useMutation({
    mutationFn: () => criarNota({ titulo: '', texto: texto.trim(), fixada: false }),
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['afazeres-notas'] })
    },
  })
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (texto.trim() && !salvar.isPending) salvar.mutate()
  }

  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-500" />
          Anotações
        </span>
      }
      action={
        <Link to="/afazeres" className="text-sm font-medium text-brand-600 hover:underline">
          Ver tudo
        </Link>
      }
      bodyClassName="p-4"
    >
      <form onSubmit={enviar} className="space-y-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(e)
          }}
          placeholder="Nota rápida… (Ctrl+Enter salva)"
          aria-label="Nota rápida"
          className="min-h-[64px]"
        />
        <Button type="submit" size="sm" icon={Plus} disabled={!texto.trim() || salvar.isPending} className="w-full">
          {salvar.isPending ? 'Salvando…' : 'Guardar nota'}
        </Button>
        {salvar.isError && <p className="text-xs text-red-500">{mensagemErro(salvar.error)}</p>}
      </form>

      {lista.length > 0 && (
        <ul className="mt-4 space-y-2">
          {lista.map((n) => (
            <li key={n.id}>
              <Link to="/afazeres" className="block rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                <span className="flex items-center gap-1.5">
                  {n.fixada && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
                  {n.titulo && <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{n.titulo}</span>}
                </span>
                <span className="line-clamp-2 whitespace-pre-line break-words text-xs text-slate-500">{n.texto}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
