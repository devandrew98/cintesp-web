import { useMemo } from 'react'
import { Mail, Phone, Building2, CalendarClock, Sun, Moon } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Avatar } from '@/components/ui/Avatar'
import { DisponibilidadeBadge } from '@/components/ui/Badge'
import { HorarioEditor } from '@/components/admin/HorarioEditor'
import { rotuloDia } from '@/lib/horarios'
import { usuarioAtual, horarioPadrao } from '@/data/mock'

/**
 * Tela "Meu Horário" (Fase 5).
 * Perfil do usuário logado (mock: `usuarioAtual`) + o editor de horários
 * reaproveitado da Administração para editar a própria disponibilidade.
 */
export function MeuHorarioPage() {
  const eu = usuarioAtual

  // Resumo de blocos/turnos ativos na semana (para os KPIs do topo).
  const resumo = useMemo(() => {
    const diasAtivos = horarioPadrao.filter((h) => h.manha.ativo || h.tarde.ativo).length
    const manhas = horarioPadrao.filter((h) => h.manha.ativo).length
    const tardes = horarioPadrao.filter((h) => h.tarde.ativo).length
    return { diasAtivos, manhas, tardes }
  }, [])

  return (
    <div>
      <PageHeader
        title="Meu Horário"
        subtitle="Defina os dias e turnos em que você fica disponível."
      />

      {/* Perfil */}
      <div className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar nome={eu.nome} fotoUrl={eu.fotoUrl} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{eu.nome}</h2>
              <DisponibilidadeBadge status={eu.disponibilidade} />
            </div>
            <p className="text-sm font-medium text-brand-600">{eu.funcao.nome}</p>
            <div className="mt-2 flex flex-col gap-1 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-4">
              <span className="inline-flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> {eu.email}
              </span>
              {eu.telefone && (
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {eu.telefone}
                </span>
              )}
              {eu.instituicao && (
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" /> {eu.instituicao.sigla}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs da semana */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarClock} value={resumo.diasAtivos} label="Dias disponíveis" hint="na semana" accent="green" />
        <StatCard icon={Sun} value={resumo.manhas} label="Turnos de manhã" accent="amber" />
        <StatCard icon={Moon} value={resumo.tardes} label="Turnos de tarde" accent="violet" />
      </div>

      {/* Editor de horários (reaproveitado da Administração) */}
      <HorarioEditor horariosIniciais={horarioPadrao} />

      {/* Legenda dos dias (referência rápida) */}
      <p className="mt-4 text-xs text-slate-400">
        Ative o turno, escolha o horário de início e fim e clique em{' '}
        <span className="font-medium text-slate-500">Salvar Alterações</span>. Semana:{' '}
        {Object.values(rotuloDia).slice(0, 5).join(', ')}.
      </p>
    </div>
  )
}
