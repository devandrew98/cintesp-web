import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, LayoutGrid, Pencil, RotateCcw } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useItensNav } from '@/hooks/useItensNav'
import { usePermissoes } from '@/hooks/usePermissoes'
import { cn } from '@/lib/utils'

const PADRAO = ['/meu-horario', '/quadro', '/busca', '/avisos']
const MAXIMO = 12
const TONS = [
  'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300',
  'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-300',
  'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300',
  'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-300',
]

const chave = (uid?: string) => `cintesp:atalhos:${uid ?? 'anon'}`
function ler(uid?: string): string[] {
  try {
    const bruto = localStorage.getItem(chave(uid))
    const v = bruto ? JSON.parse(bruto) : null
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : PADRAO
  } catch {
    return PADRAO
  }
}
function guardar(uid: string | undefined, lista: string[]) {
  try {
    localStorage.setItem(chave(uid), JSON.stringify(lista))
  } catch {
    /* sem localStorage: vale só até recarregar */
  }
}

/** Acesso rápido: cada pessoa escolhe (e ordena) as abas que quer ter à mão. Fica salvo neste aparelho. */
export function AcessoRapido({ className }: { className?: string }) {
  const { perfil } = usePermissoes()
  const uid = perfil?.id
  const itens = useItensNav()
  const [escolhidos, setEscolhidos] = useState<string[]>(() => ler(uid))
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<string[]>([])

  useEffect(() => setEscolhidos(ler(uid)), [uid])

  const porRota = useMemo(() => new Map(itens.map((i) => [i.to, i])), [itens])
  const visiveis = escolhidos.map((to) => porRota.get(to)).filter((i): i is NonNullable<typeof i> => Boolean(i))

  const abrirEditor = () => {
    setRascunho(escolhidos.filter((to) => porRota.has(to)))
    setEditando(true)
  }
  const alternar = (to: string) => setRascunho((r) => (r.includes(to) ? r.filter((x) => x !== to) : r.length >= MAXIMO ? r : [...r, to]))
  const mover = (i: number, d: -1 | 1) =>
    setRascunho((r) => {
      const j = i + d
      if (j < 0 || j >= r.length) return r
      const c = [...r]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })
  const salvar = () => {
    guardar(uid, rascunho)
    setEscolhidos(rascunho)
    setEditando(false)
  }

  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-brand-600" />
          Acesso rápido
        </span>
      }
      action={
        <button type="button" onClick={abrirEditor} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
      }
    >
      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
          <p className="text-sm text-slate-500">Nenhum atalho ainda.</p>
          <Button size="sm" variant="secondary" onClick={abrirEditor}>
            Escolher atalhos
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-3 lg:grid-cols-2">
          {visiveis.map((i, k) => (
            <Link key={i.to} to={i.to} className={cn('flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl p-4 text-center text-xs font-semibold transition-colors', TONS[k % TONS.length])}>
              <i.icon className="h-5 w-5" />
              <span className="line-clamp-2 break-words">{i.label}</span>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={editando}
        onClose={() => setEditando(false)}
        size="lg"
        title="Editar acesso rápido"
        subtitle={`Marque as abas que você quer ter à mão (até ${MAXIMO}) e ajuste a ordem. Fica salvo neste aparelho.`}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button variant="ghost" icon={RotateCcw} onClick={() => setRascunho(PADRAO.filter((to) => porRota.has(to)))} className="w-full sm:mr-auto sm:w-auto">
              Restaurar padrão
            </Button>
            <Button variant="secondary" onClick={() => setEditando(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={salvar} className="w-full sm:w-auto">
              Salvar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Abas disponíveis</p>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {itens.map((i) => {
                const marcado = rascunho.includes(i.to)
                return (
                  <button key={i.to} type="button" onClick={() => alternar(i.to)} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors', marcado ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60')}>
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', marcado ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600')}>{marcado && <Check className="h-3 w-3" />}</span>
                    <i.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{i.rotulo}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Seus atalhos ({rascunho.length})</p>
            {rascunho.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400 dark:border-slate-700">Marque abas ao lado.</p>
            ) : (
              <ol className="space-y-1">
                {rascunho.map((to, i) => {
                  const it = porRota.get(to)
                  if (!it) return null
                  return (
                    <li key={to} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-700">
                      <it.icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                      <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${it.label}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => mover(i, 1)} disabled={i === rascunho.length - 1} aria-label={`Descer ${it.label}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>
      </Modal>
    </SectionCard>
  )
}
