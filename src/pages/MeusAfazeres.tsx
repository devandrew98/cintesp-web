import { useMemo, useState } from 'react'
import { AlertCircle, CalendarClock, CalendarDays, ListTodo, StickyNote } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { MinhaAgenda } from '@/components/afazeres/MinhaAgenda'
import { Notas } from '@/components/afazeres/Notas'
import { TarefasPessoais } from '@/components/afazeres/TarefasPessoais'
import { useAfazeres } from '@/components/afazeres/useAfazeres'
import { useTodosEventos } from '@/components/agenda/Programacao'
import { usePermissoes } from '@/hooks/usePermissoes'
import { resumoAfazeres } from '@/lib/afazeres'
import { ehEventoMeu, ocorrenciasNoPeriodo } from '@/lib/agendaEquipe'
import { hojeISO } from '@/lib/agendamento'
import { cn } from '@/lib/utils'

type Aba = 'agenda' | 'tarefas' | 'notas'

const ABAS: { id: Aba; label: string; icon: typeof CalendarDays }[] = [
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'tarefas', label: 'Tarefas', icon: ListTodo },
  { id: 'notas', label: 'Anotações', icon: StickyNote },
]

/**
 * "Meus Afazeres": o centro pessoal do pesquisador — agenda individual (compromissos privados ou
 * públicos), tarefas (pessoais + as dos projetos) e anotações. Tudo que é pessoal só o dono vê.
 */
export function MeusAfazeresPage() {
  const { perfil } = usePermissoes()
  const hoje = hojeISO()
  const [aba, setAba] = useState<Aba>('agenda')
  const { itens } = useAfazeres()
  const { data: eventos = [] } = useTodosEventos()

  const resumo = useMemo(() => resumoAfazeres(itens, hoje), [itens, hoje])
  const compromissosHoje = useMemo(() => ocorrenciasNoPeriodo(eventos.filter((e) => ehEventoMeu(e, perfil?.id)), hoje, hoje).length, [eventos, perfil?.id, hoje])

  return (
    <div>
      <PageHeader title="Meus Afazeres" subtitle="Sua agenda, tarefas e anotações num lugar só. O que é pessoal, só você vê." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarClock} value={compromissosHoje} label="Meus eventos hoje" accent="violet" />
        <StatCard icon={ListTodo} value={resumo.hoje} label="Tarefas para hoje" accent="blue" />
        <StatCard icon={AlertCircle} value={resumo.atrasadas} label="Tarefas atrasadas" accent="amber" />
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={cn('-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors', aba === a.id ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200')}
          >
            <a.icon className="h-4 w-4" />
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {aba === 'agenda' && <MinhaAgenda />}
        {aba === 'tarefas' && <TarefasPessoais />}
        {aba === 'notas' && <Notas />}
      </div>
    </div>
  )
}
