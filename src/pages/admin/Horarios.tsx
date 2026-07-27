import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Clock,
  Search,
  Pencil,
  X,
  Sun,
  Sunset,
  Users2,
  CalendarCheck,
  AlertTriangle,
} from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { HorarioEditor } from '@/components/admin/HorarioEditor'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { StatCard } from '@/components/ui/StatCard'
import { listarUsuarios, listarTodosHorarios, salvarHorarios } from '@/data/api'
import {
  calcularCobertura,
  diasAtivos,
  formatarHoras,
  horasSemanais,
  rotuloDia,
} from '@/lib/horarios'
import { cn } from '@/lib/utils'
import type { HorarioDia } from '@/types'

/**
 * Tela "Administração > Horários".
 *
 * Aqui o administrador enxerga e ajusta os horários de TODA a equipe:
 *   • quadro de cobertura da semana (quantas pessoas por dia/turno);
 *   • lista de pesquisadores com dias ativos e carga horária semanal;
 *   • editor do horário de qualquer pessoa (reaproveita o `HorarioEditor`).
 *
 * Diferente de "Meu Horário", onde cada um edita apenas o próprio.
 */
export function AdminHorariosPage() {
  const queryClient = useQueryClient()

  const { data: usuarios = [], isLoading: carregandoUsuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
  })
  const { data: horariosPorUsuario = {}, isLoading: carregandoHorarios } = useQuery({
    queryKey: ['horarios-todos'],
    queryFn: listarTodosHorarios,
  })

  // Salva o horário da pessoa que está sendo editada.
  const salvarMut = useMutation({
    mutationFn: ({ usuarioId, horarios }: { usuarioId: string; horarios: HorarioDia[] }) =>
      salvarHorarios(usuarioId, horarios),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['horarios-todos'] }),
  })

  const [busca, setBusca] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  // Usado para rolar até o editor quando alguém é selecionado.
  const editorRef = useRef<HTMLDivElement>(null)

  const carregando = carregandoUsuarios || carregandoHorarios

  // Apenas usuários ativos entram no planejamento de horários.
  const ativos = useMemo(() => usuarios.filter((u) => u.status === 'ativo'), [usuarios])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return ativos
    return ativos.filter(
      (u) => u.nome.toLowerCase().includes(q) || u.funcao.nome.toLowerCase().includes(q),
    )
  }, [ativos, busca])

  // Cobertura da semana, considerando só quem está ativo.
  const cobertura = useMemo(() => {
    const apenasAtivos: Record<string, HorarioDia[]> = {}
    for (const u of ativos) {
      if (horariosPorUsuario[u.id]) apenasAtivos[u.id] = horariosPorUsuario[u.id]
    }
    return calcularCobertura(apenasAtivos)
  }, [ativos, horariosPorUsuario])

  // Indicadores do topo.
  const semHorario = ativos.filter((u) => diasAtivos(horariosPorUsuario[u.id] ?? []) === 0).length
  const mediaHoras = useMemo(() => {
    const comHorario = ativos.filter((u) => (horariosPorUsuario[u.id] ?? []).length > 0)
    if (comHorario.length === 0) return 0
    const total = comHorario.reduce((s, u) => s + horasSemanais(horariosPorUsuario[u.id] ?? []), 0)
    return total / comHorario.length
  }, [ativos, horariosPorUsuario])

  // Maior cobertura da semana — serve de referência para a barra do gráfico.
  const picoCobertura = Math.max(1, ...cobertura.flatMap((c) => [c.manha, c.tarde]))

  const usuarioEditando = ativos.find((u) => u.id === editandoId) ?? null

  /** Abre o editor da pessoa e rola a tela até ele. */
  function abrirEditor(id: string) {
    setEditandoId(id)
    // Espera o editor aparecer no DOM antes de rolar.
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <AdminShell>
      {/* ---------- Indicadores ---------- */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Users2}
          value={ativos.length}
          label="Pesquisadores ativos"
          hint="No planejamento"
          accent="green"
        />
        <StatCard
          icon={CalendarCheck}
          value={formatarHoras(mediaHoras)}
          label="Média semanal"
          hint="Por pesquisador com horário"
          accent="blue"
        />
        <StatCard
          icon={AlertTriangle}
          value={semHorario}
          label="Sem horário definido"
          hint="Precisam ser configurados"
          accent={semHorario > 0 ? 'amber' : 'violet'}
        />
      </div>

      {/* ---------- Cobertura da semana ---------- */}
      <section className="card mb-6 p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Cobertura da semana</h2>
          <p className="text-sm text-slate-500">
            Quantos pesquisadores estão disponíveis em cada turno. Use para achar buracos na agenda.
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[860px] grid-cols-7 gap-3">
            {cobertura.map((c) => {
              const vazio = c.manha === 0 && c.tarde === 0
              return (
                <div
                  key={c.dia}
                  className={cn(
                    'rounded-xl border p-3 text-center',
                    vazio
                      ? 'border-dashed border-slate-200 dark:border-slate-700'
                      : 'border-slate-200 dark:border-slate-700',
                  )}
                >
                  {/* Nome curto do dia (ex.: "Segunda") */}
                  <p className="mb-2 truncate text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {rotuloDia[c.dia].replace('-feira', '')}
                  </p>

                  <BarraTurno
                    icone={Sun}
                    rotulo="Manhã"
                    valor={c.manha}
                    pico={picoCobertura}
                    cor="bg-amber-400"
                  />
                  <BarraTurno
                    icone={Sunset}
                    rotulo="Tarde"
                    valor={c.tarde}
                    pico={picoCobertura}
                    cor="bg-sky-400"
                  />

                  {vazio && (
                    <p className="mt-2 text-[11px] font-medium text-slate-400">Sem cobertura</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------- Lista de pesquisadores ---------- */}
      <section className="card mb-6">
        <header className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Horários por pesquisador</h2>
            <p className="text-sm text-slate-500">Clique em editar para ajustar a semana de alguém.</p>
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pesquisador..."
              className="pl-9"
            />
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Pesquisador</th>
                <th className="px-4 py-3">Dias ativos</th>
                <th className="px-4 py-3">Carga semanal</th>
                <th className="px-4 py-3">Semana</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {carregando ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Carregando...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Nenhum pesquisador encontrado.
                  </td>
                </tr>
              ) : (
                filtrados.map((u) => {
                  const horarios = horariosPorUsuario[u.id] ?? []
                  const dias = diasAtivos(horarios)
                  const horas = horasSemanais(horarios)
                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                        editandoId === u.id && 'bg-brand-50/60 dark:bg-brand-500/10',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar nome={u.nome} fotoUrl={u.fotoUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                              {u.nome}
                            </p>
                            <p className="truncate text-xs text-slate-400">{u.funcao.nome}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {dias === 0 ? (
                          <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            Não definido
                          </span>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300">{dias} dia(s)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {horas > 0 ? formatarHoras(horas) : '—'}
                      </td>
                      {/* Mini-visão da semana: um quadradinho por dia */}
                      <td className="px-4 py-3">
                        <MiniSemana horarios={horarios} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={Pencil}
                          onClick={() => abrirEditor(u.id)}
                        >
                          Editar
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Editor da pessoa selecionada ---------- */}
      {usuarioEditando && (
        <div ref={editorRef} className="scroll-mt-24">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar nome={usuarioEditando.nome} fotoUrl={usuarioEditando.fotoUrl} size="md" />
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  <Clock className="h-4 w-4 text-brand-600" />
                  Horário de {usuarioEditando.nome}
                </h2>
                <p className="text-sm text-slate-500">
                  As alterações valem para a semana toda, a partir do salvamento.
                </p>
              </div>
            </div>
            <Button variant="ghost" icon={X} onClick={() => setEditandoId(null)}>
              Fechar
            </Button>
          </div>

          {/* key = id do usuário → o editor recarrega ao trocar de pessoa */}
          <HorarioEditor
            key={usuarioEditando.id}
            horariosIniciais={horariosPorUsuario[usuarioEditando.id] ?? []}
            onSalvar={async (horarios) => {
              await salvarMut.mutateAsync({ usuarioId: usuarioEditando.id, horarios })
            }}
          />
        </div>
      )}
    </AdminShell>
  )
}

/** Barra horizontal de cobertura de um turno (manhã/tarde) de um dia. */
function BarraTurno({
  icone: Icone,
  rotulo,
  valor,
  pico,
  cor,
}: {
  icone: typeof Sun
  rotulo: string
  valor: number
  pico: number
  cor: string
}) {
  const largura = pico > 0 ? Math.round((valor / pico) * 100) : 0
  return (
    <div className="mb-1.5 text-left" title={`${rotulo}: ${valor} pesquisador(es)`}>
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Icone className="h-3 w-3 shrink-0" />
          {rotulo}
        </span>
        <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
          {valor}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={cn('h-full rounded-full', cor)} style={{ width: `${largura}%` }} />
      </div>
    </div>
  )
}

/**
 * Resumo visual da semana de uma pessoa: um quadradinho por dia, dividido
 * em manhã (cima) e tarde (baixo). Verde = disponível.
 */
function MiniSemana({ horarios }: { horarios: HorarioDia[] }) {
  const dias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const
  const iniciais = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

  return (
    <div className="flex gap-1">
      {dias.map((dia, i) => {
        const h = horarios.find((x) => x.dia === dia)
        return (
          <div
            key={dia}
            className="flex flex-col items-center gap-0.5"
            title={`${rotuloDia[dia]}: ${
              h?.manha?.ativo || h?.tarde?.ativo
                ? [h?.manha?.ativo && 'manhã', h?.tarde?.ativo && 'tarde'].filter(Boolean).join(' e ')
                : 'sem disponibilidade'
            }`}
          >
            <span className="text-[9px] text-slate-300">{iniciais[i]}</span>
            <div className="overflow-hidden rounded-sm">
              <div
                className={cn(
                  'h-1.5 w-3',
                  h?.manha?.ativo ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700',
                )}
              />
              <div
                className={cn(
                  'h-1.5 w-3',
                  h?.tarde?.ativo ? 'bg-sky-400' : 'bg-slate-200 dark:bg-slate-700',
                )}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
