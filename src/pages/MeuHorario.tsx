import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Phone, Building2, CalendarClock, Sun, Moon, Check, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Avatar } from '@/components/ui/Avatar'
import { DisponibilidadeBadge, disponibilidadeInfo } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { HorarioEditor } from '@/components/admin/HorarioEditor'
import { usePermissoes } from '@/hooks/usePermissoes'
import { opcoesHorario } from '@/lib/horarios'
import { cn } from '@/lib/utils'
import {
  perfilAtual,
  listarHorarios,
  salvarHorarios,
  atualizarDisponibilidade,
} from '@/data/api'
import type { StatusDisponibilidade } from '@/types'

const STATUS: StatusDisponibilidade[] = ['disponivel', 'parcial', 'home_office', 'ausente']

/**
 * Tela "Meu Horário" (Fase 4).
 * Perfil do usuário logado + controle da PRÓPRIA disponibilidade (status e
 * "livre até") e editor do próprio horário semanal, tudo salvo no Supabase.
 */
export function MeuHorarioPage() {
  const queryClient = useQueryClient()
  const { data: eu, isLoading } = useQuery({ queryKey: ['perfil'], queryFn: perfilAtual })
  const { data: horarios = [], isLoading: carregandoHorarios } = useQuery({
    queryKey: ['horarios', eu?.id],
    queryFn: () => listarHorarios(eu!.id),
    enabled: !!eu,
  })

  // Só a administração define horários e disponibilidade (regra do CINTESP).
  const { ehAdmin } = usePermissoes()

  // Estado local da disponibilidade (sincroniza quando o perfil carrega).
  const [status, setStatus] = useState<StatusDisponibilidade>('ausente')
  const [livreAte, setLivreAte] = useState('')
  useEffect(() => {
    if (eu) {
      setStatus(eu.disponibilidade)
      setLivreAte(eu.livreAte ?? '')
    }
  }, [eu])

  const salvarDisp = useMutation({
    mutationFn: () => atualizarDisponibilidade(eu!.id, status, status === 'disponivel' ? livreAte : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfil'] })
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
    },
  })

  async function salvarMeuHorario(h: typeof horarios) {
    if (!eu) return
    await salvarHorarios(eu.id, h)
    queryClient.invalidateQueries({ queryKey: ['horarios', eu.id] })
  }

  const resumo = useMemo(() => {
    const diasAtivos = horarios.filter((h) => h.manha.ativo || h.tarde.ativo).length
    const manhas = horarios.filter((h) => h.manha.ativo).length
    const tardes = horarios.filter((h) => h.tarde.ativo).length
    return { diasAtivos, manhas, tardes }
  }, [horarios])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando seu perfil…
      </div>
    )
  }

  if (!eu) {
    return (
      <div className="card px-6 py-16 text-center text-sm text-slate-400">
        Não foi possível carregar seu perfil.
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Meu Horário"
        subtitle="Defina sua disponibilidade agora e os dias/turnos da semana."
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

      {/* Minha disponibilidade agora */}
      <div className="card mb-6 p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white">Minha disponibilidade agora</h3>
        <p className="mb-4 text-sm text-slate-500">Isto aparece no quadro da equipe em tempo real.</p>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS.map((s) => {
            const info = disponibilidadeInfo[s]
            const ativo = status === s
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
                  ativo
                    ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', info.dotColor)} />
                {info.label}
              </button>
            )
          })}

          {status === 'disponivel' && (
            <label className="ml-1 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              Livre até
              <select
                value={livreAte}
                onChange={(e) => setLivreAte(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">o dia todo</option>
                {opcoesHorario.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          )}

          <Button
            className="ml-auto"
            icon={salvarDisp.isSuccess && !salvarDisp.isPending ? Check : undefined}
            disabled={salvarDisp.isPending}
            onClick={() => salvarDisp.mutate()}
          >
            {salvarDisp.isPending ? 'Salvando…' : 'Salvar disponibilidade'}
          </Button>
        </div>
      </div>

      {/* KPIs da semana */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarClock} value={resumo.diasAtivos} label="Dias disponíveis" hint="na semana" accent="green" />
        <StatCard icon={Sun} value={resumo.manhas} label="Turnos de manhã" accent="amber" />
        <StatCard icon={Moon} value={resumo.tardes} label="Turnos de tarde" accent="violet" />
      </div>

      {/* Editor de horários (persiste no banco) */}
      {carregandoHorarios ? (
        <div className="card flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando horários…
        </div>
      ) : (
        <HorarioEditor
          key={eu.id}
          horariosIniciais={horarios}
          onSalvar={ehAdmin ? salvarMeuHorario : undefined}
          somenteLeitura={!ehAdmin}
        />
      )}
    </div>
  )
}
