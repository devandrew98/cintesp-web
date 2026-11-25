import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, FolderKanban, ListTodo, Plus, SlidersHorizontal } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { LinhaAfazer } from '@/components/afazeres/LinhaAfazer'
import { TarefaPessoalModal } from '@/components/afazeres/TarefaPessoalModal'
import { useAfazeres } from '@/components/afazeres/useAfazeres'
import { filtrarPorPeriodo, prazoDoPeriodo, type ItemAfazer, type PeriodoTarefas } from '@/lib/afazeres'
import { STATUS_TAREFA, atrasada, infoPrioridade, infoStatus, type StatusTarefa } from '@/lib/tarefas'
import { cn, formatDateOnlyBR, mensagemErro } from '@/lib/utils'

const PERIODOS: { id: PeriodoTarefas; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'amanha', label: 'Amanhã' },
  { id: 'estaSemana', label: 'Esta semana' },
  { id: 'semanaQueVem', label: 'Semana que vem' },
  { id: 'semData', label: 'Sem data' },
]

type Visao = 'tabela' | 'status' | 'checklist'
const VISOES: { id: Visao; label: string }[] = [
  { id: 'tabela', label: 'Tabela' },
  { id: 'status', label: 'Por status' },
  { id: 'checklist', label: 'Checklist' },
]

const CHAVE_VISAO = 'cintesp:area-visao-tarefas'
function lerVisao(): Visao {
  try {
    const v = localStorage.getItem(CHAVE_VISAO)
    return VISOES.some((x) => x.id === v) ? (v as Visao) : 'checklist'
  } catch {
    return 'checklist'
  }
}

/** Grupo de botões (um escolhido), como no protótipo. */
function Botoes<T extends string>({ rotulo, opcoes, valor, onEscolher }: { rotulo: string; opcoes: { id: T; label: string; contagem?: number }[]; valor: T; onEscolher: (v: T) => void }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onEscolher(o.id)}
          aria-pressed={valor === o.id}
          className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors', valor === o.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}
        >
          {o.label}
          {o.contagem ? <span className={cn('rounded-full px-1.5 text-[11px] font-semibold', valor === o.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>{o.contagem}</span> : null}
        </button>
      ))}
    </div>
  )
}

/**
 * Minhas tarefas na área de trabalho: escolhe o período (Hoje, Amanhã…) e o formato (Tabela, Por status,
 * Checklist) por botões, e adiciona tarefas ali mesmo — a nova já nasce com o prazo do período escolhido.
 */
export function MinhasTarefas({ hoje, className }: { hoje: string; className?: string }) {
  const { itens, carregando, alternar, adicionarRapida, mudar, recarregar } = useAfazeres()
  const [periodo, setPeriodo] = useState<PeriodoTarefas>('hoje')
  const [visao, setVisao] = useState<Visao>(lerVisao)
  const [titulo, setTitulo] = useState('')
  const [modal, setModal] = useState<{ item?: ItemAfazer } | null>(null)

  const lista = filtrarPorPeriodo(itens, periodo, hoje)
  const prazo = prazoDoPeriodo(periodo, hoje)
  const semDia = prazo === null

  const escolherVisao = (v: Visao) => {
    setVisao(v)
    try {
      localStorage.setItem(CHAVE_VISAO, v)
    } catch {
      /* sem localStorage: só vale nesta sessão */
    }
  }
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const t = titulo.trim()
    if (!t || semDia || adicionarRapida.isPending) return
    adicionarRapida.mutate({ titulo: t, dataEntrega: prazo ?? undefined }, { onSuccess: () => setTitulo('') })
  }
  const abrir = (i: ItemAfazer) => setModal({ item: i })
  const trocarStatus = (item: ItemAfazer, status: StatusTarefa) => mudar.mutate({ item, patch: { status } })
  const erro = adicionarRapida.error ?? mudar.error ?? alternar.error

  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-sky-500" />
          Minhas tarefas
        </span>
      }
      action={
        <Link to="/afazeres" className="text-sm font-medium text-brand-600 hover:underline">
          Ver tudo
        </Link>
      }
      bodyClassName="p-4"
    >
      <div className="flex flex-wrap gap-3">
        <Botoes rotulo="Período" opcoes={PERIODOS.map((p) => ({ ...p, contagem: filtrarPorPeriodo(itens, p.id, hoje).filter((i) => i.status !== 'concluido').length }))} valor={periodo} onEscolher={setPeriodo} />
        <Botoes rotulo="Formato" opcoes={VISOES} valor={visao} onEscolher={escolherVisao} />
      </div>

      <form onSubmit={enviar} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          disabled={semDia}
          placeholder={semDia ? 'A semana já está acabando — use "Semana que vem".' : prazo ? `Nova tarefa para ${formatDateOnlyBR(prazo)} — escreva e aperte Enter` : 'Nova tarefa sem data — escreva e aperte Enter'}
          aria-label="Nova tarefa"
          className="min-w-0 flex-1"
        />
        <Button type="submit" icon={Plus} disabled={!titulo.trim() || semDia || adicionarRapida.isPending}>
          Adicionar
        </Button>
        <Button type="button" variant="secondary" icon={SlidersHorizontal} onClick={() => setModal({})}>
          Com detalhes
        </Button>
      </form>
      {erro != null && <p className="mt-2 text-sm text-red-500">{mensagemErro(erro)}</p>}

      <div className="mt-4 min-h-[180px]">
        {carregando ? (
          <p className="py-12 text-center text-sm text-slate-400">Carregando tarefas…</p>
        ) : lista.length === 0 && visao !== 'status' ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-12 text-center text-sm text-slate-400 dark:border-slate-700">Nenhuma tarefa neste período.</p>
        ) : visao === 'tabela' ? (
          <Tabela lista={lista} hoje={hoje} onAbrir={abrir} onMudar={(item, patch) => mudar.mutate({ item, patch })} />
        ) : visao === 'status' ? (
          <PorStatus lista={lista} hoje={hoje} onAbrir={abrir} onTrocarStatus={trocarStatus} />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {lista.map((i) => (
              <LinhaAfazer key={i.chave} item={i} hoje={hoje} onAlternar={(x) => alternar.mutate(x)} onAbrir={abrir} />
            ))}
          </ul>
        )}
      </div>

      <TarefaPessoalModal open={modal !== null} item={modal?.item} dataInicial={prazo ?? undefined} onClose={() => setModal(null)} aoSalvar={() => recarregar()} />
    </SectionCard>
  )
}

/** Título que abre o editor (tarefa pessoal) ou leva ao projeto. */
function Titulo({ item, onAbrir, className }: { item: ItemAfazer; onAbrir: (i: ItemAfazer) => void; className?: string }) {
  const classe = cn('block max-w-full break-words text-left text-sm font-medium hover:text-brand-600', item.status === 'concluido' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100', className)
  return item.origem === 'projeto' ? (
    <Link to={`/projetos/${item.projetoId}`} className={classe} title="Abrir o projeto">
      {item.titulo}
    </Link>
  ) : (
    <button type="button" onClick={() => onAbrir(item)} className={classe}>
      {item.titulo}
    </button>
  )
}

const Origem = ({ item }: { item: ItemAfazer }) =>
  item.origem === 'projeto' ? (
    <span className="flex min-w-0 items-center gap-1 text-xs text-slate-400">
      <FolderKanban className="h-3 w-3 shrink-0" />
      <span className="truncate">{item.projetoTitulo ?? 'Projeto'}</span>
    </span>
  ) : (
    <span className="text-xs text-slate-400">Pessoal</span>
  )

function Tabela({ lista, hoje, onAbrir, onMudar }: { lista: ItemAfazer[]; hoje: string; onAbrir: (i: ItemAfazer) => void; onMudar: (i: ItemAfazer, patch: { status?: StatusTarefa; dataEntrega?: string }) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
            <th className="px-3 py-2.5 font-semibold">Tarefa</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-3 py-2.5 font-semibold">Prazo</th>
            <th className="px-3 py-2.5 font-semibold">Prioridade</th>
            <th className="px-3 py-2.5 font-semibold">Origem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {lista.map((i) => (
            <tr key={i.chave}>
              <td className="max-w-[320px] px-3 py-2">
                <Titulo item={i} onAbrir={onAbrir} />
              </td>
              <td className="px-3 py-2">
                <select value={i.status} onChange={(e) => onMudar(i, { status: e.target.value as StatusTarefa })} aria-label={`Status de ${i.titulo}`} className={cn('rounded-full border-0 py-0.5 pl-2.5 pr-6 text-xs font-medium focus:ring-2 focus:ring-brand-500', infoStatus(i.status).pill)}>
                  {STATUS_TAREFA.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="date"
                  value={i.dataEntrega ?? ''}
                  onChange={(e) => onMudar(i, { dataEntrega: e.target.value || undefined })}
                  aria-label={`Prazo de ${i.titulo}`}
                  className={cn('rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-slate-200 focus:border-brand-500 dark:hover:border-slate-700', atrasada({ dataEntrega: i.dataEntrega, status: i.status }, hoje) ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300')}
                />
              </td>
              <td className="px-3 py-2">
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', infoPrioridade(i.prioridade).pill)}>{infoPrioridade(i.prioridade).label}</span>
              </td>
              <td className="max-w-[200px] px-3 py-2">
                <Origem item={i} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Quadro por status: arrastar entre colunas no computador; seletor no cartão no celular. */
function PorStatus({ lista, hoje, onAbrir, onTrocarStatus }: { lista: ItemAfazer[]; hoje: string; onAbrir: (i: ItemAfazer) => void; onTrocarStatus: (i: ItemAfazer, s: StatusTarefa) => void }) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {STATUS_TAREFA.map((col) => {
        const daColuna = lista.filter((i) => i.status === col.value)
        return (
          <section
            key={col.value}
            onDragOver={(e) => {
              if (arrastando) e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              const i = lista.find((x) => x.chave === arrastando)
              if (i && i.status !== col.value) onTrocarStatus(i, col.value)
              setArrastando(null)
            }}
            className={cn('min-w-0 rounded-2xl p-2.5', col.coluna)}
          >
            <header className="mb-2 flex items-center justify-between px-1">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', col.pill)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', col.ponto)} />
                {col.label}
              </span>
              <span className="text-xs font-medium text-slate-400">{daColuna.length}</span>
            </header>
            <div className="space-y-2">
              {daColuna.map((i) => (
                <article key={i.chave} draggable onDragStart={() => setArrastando(i.chave)} onDragEnd={() => setArrastando(null)} className={cn('cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-card active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900', arrastando === i.chave && 'opacity-50')}>
                  <Titulo item={i} onAbrir={onAbrir} />
                  <div className="mt-1.5 space-y-1">
                    <Origem item={i} />
                    {i.dataEntrega && (
                      <span className={cn('flex items-center gap-1 text-xs', atrasada({ dataEntrega: i.dataEntrega, status: i.status }, hoje) ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400')}>
                        <Calendar className="h-3 w-3" /> {formatDateOnlyBR(i.dataEntrega)}
                      </span>
                    )}
                  </div>
                  <select value={i.status} onChange={(e) => onTrocarStatus(i, e.target.value as StatusTarefa)} aria-label={`Mover ${i.titulo} para`} className="mt-2 w-full rounded-lg border border-slate-200 bg-transparent py-0.5 pl-1.5 pr-6 text-[11px] text-slate-500 dark:border-slate-700 xl:hidden">
                    {STATUS_TAREFA.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
              {daColuna.length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-400">Vazio</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}
