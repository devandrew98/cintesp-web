import { useState, type FormEvent } from 'react'
import { ListTodo, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { LinhaAfazer } from './LinhaAfazer'
import { TarefaPessoalModal } from './TarefaPessoalModal'
import { useAfazeres } from './useAfazeres'
import { agruparAfazeres, type ItemAfazer } from '@/lib/afazeres'
import { hojeISO } from '@/lib/agendamento'
import { cn, mensagemErro } from '@/lib/utils'

type Filtro = 'todas' | 'pessoal' | 'projeto'

/** Aba Tarefas: pessoais + as dos projetos em que sou responsável, agrupadas por prazo. */
export function TarefasPessoais() {
  const { itens, carregando, alternar, adicionarRapida, recarregar } = useAfazeres()
  const hoje = hojeISO()
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [rapida, setRapida] = useState('')
  const [modal, setModal] = useState<{ item?: ItemAfazer } | null>(null)

  const visiveis = itens.filter((i) => filtro === 'todas' || i.origem === filtro)
  const g = agruparAfazeres(visiveis, hoje)

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const t = rapida.trim()
    if (!t || adicionarRapida.isPending) return
    adicionarRapida.mutate(t, { onSuccess: () => setRapida('') })
  }

  const grupo = (titulo: string, lista: ItemAfazer[], destaque?: 'vermelho') =>
    lista.length === 0 ? null : (
      <section key={titulo}>
        <h3 className={cn('mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide', destaque === 'vermelho' ? 'text-red-500' : 'text-slate-400')}>
          {titulo} ({lista.length})
        </h3>
        <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
          {lista.map((i) => (
            <LinhaAfazer key={i.chave} item={i} hoje={hoje} onAlternar={(x) => alternar.mutate(x)} onAbrir={(x) => setModal({ item: x })} />
          ))}
        </ul>
      </section>
    )

  const vazio = visiveis.length === 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="Filtrar tarefas">
          {(
            [
              ['todas', 'Todas'],
              ['pessoal', 'Pessoais'],
              ['projeto', 'Dos projetos'],
            ] as const
          ).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setFiltro(v)} className={cn('rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors', filtro === v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
              {t}
            </button>
          ))}
        </div>
        <Button icon={Plus} variant="secondary" onClick={() => setModal({})} className="w-full sm:w-auto">
          Tarefa com detalhes
        </Button>
      </div>

      <form onSubmit={enviar} className="flex gap-2">
        <Input value={rapida} onChange={(e) => setRapida(e.target.value)} placeholder="Adicionar uma tarefa e apertar Enter…" aria-label="Nova tarefa rápida" />
        <Button type="submit" disabled={!rapida.trim() || adicionarRapida.isPending} icon={Plus}>
          <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </form>
      {adicionarRapida.isError && <p className="text-sm text-red-500">{mensagemErro(adicionarRapida.error)}</p>}
      {alternar.isError && <p className="text-sm text-red-500">{mensagemErro(alternar.error)}</p>}

      {carregando ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando tarefas…</p>
      ) : vazio ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-14 text-center">
          <ListTodo className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">Nenhuma tarefa por aqui. Adicione a primeira acima!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupo('Atrasadas', g.atrasadas, 'vermelho')}
          {grupo('Para hoje', g.hoje)}
          {grupo('Próximas', g.proximas)}
          {grupo('Sem data', g.semData)}
          {grupo('Concluídas', g.concluidas)}
        </div>
      )}
      <p className="text-xs text-slate-400">As tarefas dos projetos aparecem aqui automaticamente quando você é o responsável por elas. Clique numa delas para abrir o projeto.</p>

      <TarefaPessoalModal open={modal !== null} onClose={() => setModal(null)} item={modal?.item} aoSalvar={() => recarregar()} />
    </div>
  )
}
