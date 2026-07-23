import { useMemo } from 'react'
import { CheckCircle2, Users2, CalendarClock, Clock3 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { SectionCard } from '@/components/ui/SectionCard'
import { PersonRow } from '@/components/ui/PersonRow'
import { Badge } from '@/components/ui/Badge'
import { usuarios, mudancas } from '@/data/mock'

const dataHojeRaw = new Date().toLocaleDateString('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})
// "quinta-feira, 23 de julho de 2026" → "Quinta-feira, 23 de julho de 2026"
const dataHoje = dataHojeRaw.charAt(0).toUpperCase() + dataHojeRaw.slice(1)

/**
 * Tela "Agenda do Dia" (Fase 5).
 * Linha do tempo das mudanças de turno do dia + um retrato da disponibilidade
 * atual (quem está livre e até quando, e quem está em atendimento).
 */
export function AgendaPage() {
  const ativos = useMemo(() => usuarios.filter((u) => u.status === 'ativo'), [])

  // Disponíveis ordenados por quem sai mais cedo (livreAte); "dia todo" por último.
  const disponiveis = useMemo(
    () =>
      ativos
        .filter((u) => u.disponibilidade === 'disponivel')
        .sort((a, b) => (a.livreAte ?? '99:99').localeCompare(b.livreAte ?? '99:99')),
    [ativos],
  )
  const emAtendimento = useMemo(
    () => ativos.filter((u) => u.disponibilidade === 'em_atendimento'),
    [ativos],
  )

  return (
    <div>
      <PageHeader title="Agenda do Dia" subtitle={dataHoje} />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={CheckCircle2} value={disponiveis.length} label="Disponíveis agora" accent="green" />
        <StatCard icon={Users2} value={emAtendimento.length} label="Em atendimento" accent="blue" />
        <StatCard icon={CalendarClock} value={mudancas.length} label="Mudanças hoje" accent="violet" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Linha do tempo das mudanças */}
        <SectionCard
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-500" />
              Linha do tempo do dia
            </span>
          }
          bodyClassName="p-5"
        >
          {mudancas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nenhuma mudança de turno hoje.</p>
          ) : (
            <ol className="space-y-1">
              {mudancas.map((m, i) => (
                <li key={m.id} className="flex gap-4">
                  {/* Rail com bolinha */}
                  <div className="flex flex-col items-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      <Clock3 className="h-4 w-4" />
                    </span>
                    {i < mudancas.length - 1 && (
                      <span className="my-1 w-px flex-1 bg-slate-100 dark:bg-slate-800" />
                    )}
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {m.descricao}
                      </p>
                      <Badge tone="slate">{m.tag}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{m.quando}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        {/* Disponibilidade agora */}
        <div className="space-y-6">
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                Disponíveis agora
              </span>
            }
            action={<span className="text-sm font-medium text-brand-600">{disponiveis.length}</span>}
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {disponiveis.slice(0, 6).map((u) => (
                <PersonRow key={u.id} usuario={u} showLivreAte />
              ))}
              {disponiveis.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-slate-400">Ninguém disponível.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Em atendimento
              </span>
            }
            action={<span className="text-sm font-medium text-amber-600">{emAtendimento.length}</span>}
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {emAtendimento.slice(0, 5).map((u) => (
                <PersonRow key={u.id} usuario={u} compactStatus />
              ))}
              {emAtendimento.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-slate-400">Ninguém em atendimento.</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
