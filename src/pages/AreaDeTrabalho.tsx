import { useMemo, useState } from 'react'
import { AlertCircle, CalendarClock, CalendarDays, CalendarRange, ListTodo, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { SectionCard } from '@/components/ui/SectionCard'
import { MinhaAgenda } from '@/components/afazeres/MinhaAgenda'
import { useAfazeres } from '@/components/afazeres/useAfazeres'
import { ProgramacaoResumo, useTodosEventos } from '@/components/agenda/Programacao'
import { AcessoRapido } from '@/components/trabalho/AcessoRapido'
import { AvisosRecentes } from '@/components/trabalho/AvisosRecentes'
import { HojeCard } from '@/components/trabalho/HojeCard'
import { MeusProjetosCard } from '@/components/trabalho/MeusProjetosCard'
import { NotasRapidas } from '@/components/trabalho/NotasRapidas'
import { MinhasTarefas } from '@/components/trabalho/MinhasTarefas'
import { usePermissoes } from '@/hooks/usePermissoes'
import { agruparPorPrazo, contarDaSemana } from '@/lib/afazeres'
import { ehEventoMeu, euParticipo, ocorrenciasNoPeriodo } from '@/lib/agendaEquipe'
import { hojeISO } from '@/lib/agendamento'

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const dataExtensa = (() => {
  const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
})()

/**
 * Minha área de trabalho — a página inicial. Reúne o dia da pessoa (eventos e tarefas), as tarefas por prazo,
 * os projetos dela, anotações, a programação da equipe, avisos e um acesso rápido que ela mesma monta.
 */
export function AreaDeTrabalhoPage() {
  const { perfil } = usePermissoes()
  const uid = perfil?.id
  const hoje = hojeISO()
  const [atualizando, setAtualizando] = useState(false)
  const { itens, alternar, recarregar } = useAfazeres()
  const { data: eventos = [] } = useTodosEventos()

  // Eventos de hoje que importam para mim: os meus + os oficiais em que eu participo.
  const ocHoje = useMemo(() => ocorrenciasNoPeriodo(eventos.filter((e) => ehEventoMeu(e, uid) || (!e.donoId && euParticipo(e, uid))), hoje, hoje), [eventos, uid, hoje])
  const grupos = useMemo(() => agruparPorPrazo(itens, hoje), [itens, hoje])
  const daSemana = useMemo(() => contarDaSemana(itens, hoje), [itens, hoje])

  const primeiroNome = perfil?.nome?.trim().split(/\s+/)[0]

  function atualizar() {
    setAtualizando(true)
    setTimeout(() => window.location.reload(), 60)
  }

  return (
    <div>
      <PageHeader
        title={
          <span>
            {saudacao()}
            {primeiroNome ? (
              <>
                , <span className="text-brand-600 dark:text-brand-400">{primeiroNome}</span>
              </>
            ) : null}
            ! 👋
          </span>
        }
        subtitle={`${dataExtensa} · sua área de trabalho`}
        actions={
          <button
            onClick={atualizar}
            disabled={atualizando}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-card transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={atualizando ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {atualizando ? 'Atualizando...' : 'Atualizar'}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarClock} value={ocHoje.length} label="Eventos hoje" hint="meus e da equipe" accent="violet" />
        <StatCard icon={ListTodo} value={grupos.hoje.length} label="Tarefas hoje" hint="com prazo para hoje" accent="blue" />
        <StatCard icon={AlertCircle} value={grupos.atrasadas.length} label="Atrasadas" hint="passaram do prazo" accent="amber" />
        <StatCard icon={CalendarRange} value={daSemana} label="Esta semana" hint="tarefas até domingo" accent="green" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <HojeCard className="lg:col-span-2" ocorrencias={ocHoje} tarefas={grupos.hoje} hoje={hoje} onAlternar={(i) => alternar.mutate(i)} aoSalvarTarefa={() => recarregar()} />
        <AcessoRapido />

        <MinhasTarefas className="min-w-0 lg:col-span-3" hoje={hoje} />

        <MeusProjetosCard className="lg:col-span-2" itens={itens} />
        <ProgramacaoResumo />

        <SectionCard
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand-600" />
              Meu calendário
            </span>
          }
          bodyClassName="p-4"
        >
          <MinhaAgenda />
        </SectionCard>
        <div className="space-y-6">
          <AvisosRecentes />
          <NotasRapidas />
        </div>
      </div>
    </div>
  )
}
