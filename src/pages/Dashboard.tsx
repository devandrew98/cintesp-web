import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Users2,
  Clock3,
  CalendarClock,
  RefreshCw,
  ArrowRight,
  Megaphone,
  Search,
  Clock,
  LayoutGrid,
  Lightbulb,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { SectionCard } from '@/components/ui/SectionCard'
import { PersonRow } from '@/components/ui/PersonRow'
import { DonutChart } from '@/components/ui/DonutChart'
import { Badge } from '@/components/ui/Badge'
import { listarUsuarios, listarMudancas, listarAvisos } from '@/data/api'

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function DashboardPage() {
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })
  const { data: mudancas = [] } = useQuery({ queryKey: ['mudancas'], queryFn: listarMudancas })
  const { data: avisos = [] } = useQuery({ queryKey: ['avisos'], queryFn: listarAvisos })

  const ativos = usuarios.filter((u) => u.status === 'ativo')
  const disponiveis = ativos.filter((u) => u.disponibilidade === 'disponivel')
  const emAtendimento = ativos.filter((u) => u.disponibilidade === 'em_atendimento')
  const ausentes = ativos.filter((u) => u.disponibilidade === 'ausente')

  const total = ativos.length
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  const segments = [
    { label: 'Disponíveis', value: disponiveis.length, color: '#22c55e' },
    { label: 'Em atendimento', value: emAtendimento.length, color: '#f59e0b' },
    { label: 'Ausentes', value: ausentes.length, color: '#ef4444' },
  ]

  return (
    <div>
      <PageHeader
        title={`${saudacao()}, pesquisadores! 👋`}
        subtitle="Acompanhe a disponibilidade da equipe em tempo real."
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-card hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CheckCircle2} value={disponiveis.length} label="Disponíveis agora" hint={`de ${total} pesquisadores`} accent="green" />
        <StatCard icon={Users2} value={emAtendimento.length} label="Em atendimento" hint={`de ${total} pesquisadores`} accent="blue" />
        <StatCard icon={Clock3} value={ausentes.length} label="Ausentes" hint={`de ${total} pesquisadores`} accent="amber" />
        <StatCard icon={CalendarClock} value={mudancas.length} label="Mudanças hoje" hint="de turnos" accent="violet" />
      </div>

      {/* Disponíveis + Resumo */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              Disponíveis agora
            </span>
          }
          action={
            <Link to="/quadro" className="text-sm font-medium text-brand-600 hover:underline">
              Ver todos
            </Link>
          }
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {disponiveis.slice(0, 6).map((u) => (
              <PersonRow key={u.id} usuario={u} showLivreAte />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Resumo da Equipe">
          <div className="flex flex-col items-center gap-5 p-2">
            <DonutChart segments={segments} total={total} />
            <div className="w-full space-y-2.5">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {s.value} <span className="text-slate-400">({pct(s.value)}%)</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex w-full items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Ótimo! A maioria da equipe está disponível.</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Em atendimento + Ausentes + Acesso rápido */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Em atendimento
            </span>
          }
          action={<Link to="/quadro" className="text-sm font-medium text-amber-600 hover:underline">Ver todos</Link>}
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {emAtendimento.slice(0, 5).map((u) => (
              <PersonRow key={u.id} usuario={u} compactStatus />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Ausentes
            </span>
          }
          action={<Link to="/quadro" className="text-sm font-medium text-red-500 hover:underline">Ver todos</Link>}
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ausentes.slice(0, 5).map((u) => (
              <PersonRow key={u.id} usuario={u} compactStatus />
            ))}
          </div>
        </SectionCard>

        <SectionCard title={<span className="flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-brand-600" />Acesso rápido</span>}>
          <div className="grid grid-cols-2 gap-3 p-1">
            <QuickAction to="/meu-horario" icon={Clock} label="Meu Horário" tone="green" />
            <QuickAction to="/quadro" icon={LayoutGrid} label="Quadro Completo" tone="blue" />
            <QuickAction to="/busca" icon={Search} label="Buscar Pesquisador" tone="amber" />
            <QuickAction to="/avisos" icon={Megaphone} label="Avisos" tone="violet" />
          </div>
        </SectionCard>
      </div>

      {/* Mudanças + Avisos */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title={<span className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-slate-500" />Próximas mudanças de turno</span>}
          action={<Link to="/agenda" className="text-sm font-medium text-brand-600 hover:underline">Ver todas</Link>}
          bodyClassName="p-2"
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {mudancas.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{m.descricao}</p>
                  <p className="text-xs text-slate-400">{m.quando}</p>
                </div>
                <Badge tone="slate">{m.tag}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={<span className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-slate-500" />Avisos</span>}
          action={<Link to="/avisos" className="text-sm font-medium text-brand-600 hover:underline">Ver todos</Link>}
          bodyClassName="p-2"
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {avisos.filter((a) => a.status === 'ativo').slice(0, 4).map((a) => (
              <Link to="/avisos" key={a.id} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{a.titulo}</p>
                  <p className="line-clamp-1 text-xs text-slate-400">{a.descricao}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{a.publicadoHa}</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Rodapé de sincronização */}
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
        Sincronizado agora • Última atualização há poucos segundos
        <ArrowRight className="hidden h-3 w-3" />
      </div>
    </div>
  )
}

function QuickAction({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: string
  icon: typeof Clock
  label: string
  tone: 'green' | 'blue' | 'amber' | 'violet'
}) {
  const tones = {
    green: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300',
    blue: 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-300',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300',
    violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-300',
  }
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-center text-xs font-semibold transition-colors ${tones[tone]}`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  )
}
