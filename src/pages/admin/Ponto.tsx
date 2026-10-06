import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, FileSpreadsheet, Pencil, UserCheck, UserX, Users2 } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Select, Input } from '@/components/ui/Field'
import { StatCard } from '@/components/ui/StatCard'
import { Avatar } from '@/components/ui/Avatar'
import { CorrigirPontoModal } from '@/components/admin/CorrigirPontoModal'
import { LancarPontoManualModal } from '@/components/admin/LancarPontoManualModal'
import { RelatorioMensalModal } from '@/components/admin/RelatorioMensalModal'
import { listarRegistrosPonto } from '@/data/ponto'
import { listarUsuarios } from '@/data/api'
import { agruparPorDia, type DiaFrequencia } from '@/lib/ponto'
import type { RegistroPonto } from '@/types'

type Aba = 'hoje' | 'semana' | 'mes'

function inicioDoDia(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}
function limiteDataPorAba(aba: Aba): { de: string; ate: string } {
  // O fim é o do período (não "agora"), para que faltas lançadas para dias
  // futuros do período — ou hoje à tarde — também apareçam.
  const hoje = inicioDoDia(new Date())
  if (aba === 'hoje') {
    const fimDia = new Date(hoje)
    fimDia.setDate(hoje.getDate() + 1)
    return { de: hoje.toISOString(), ate: fimDia.toISOString() }
  }
  if (aba === 'semana') {
    const inicioSemana = new Date(hoje)
    inicioSemana.setDate(hoje.getDate() - hoje.getDay()) // 0=domingo
    const fimSemana = new Date(inicioSemana)
    fimSemana.setDate(inicioSemana.getDate() + 7)
    return { de: inicioSemana.toISOString(), ate: fimSemana.toISOString() }
  }
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  return { de: inicioMes.toISOString(), ate: fimMes.toISOString() }
}

/**
 * "Administração > Registro de Ponto" — centraliza a gestão do ponto:
 * KPIs do dia, registros agrupados por dia (entrada/saída pareadas, não
 * só uma lista solta de leituras), filtro por pesquisador/período,
 * correção, lançamento manual e relatório mensal .xlsx.
 *
 * Quem registra é sempre o próprio pesquisador (QR pelo celular) — aqui só
 * se consulta, corrige (com motivo, auditado) ou lança um retroativo.
 */
export function AdminPontoPage() {
  const [aba, setAba] = useState<Aba>('hoje')
  const [usuarioFiltro, setUsuarioFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [corrigindo, setCorrigindo] = useState<RegistroPonto | null>(null)
  const [lancarAberto, setLancarAberto] = useState(false)
  const [relatorioAberto, setRelatorioAberto] = useState(false)

  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })

  const periodo = useMemo(() => limiteDataPorAba(aba), [aba])
  const filtro = useMemo(
    () => ({ usuarioId: usuarioFiltro || undefined, de: periodo.de, ate: periodo.ate }),
    [usuarioFiltro, periodo],
  )

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['ponto-registros', filtro],
    queryFn: () => listarRegistrosPonto(filtro),
  })

  const dias = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const agrupados = agruparPorDia(registros)
    if (!q) return agrupados
    return agrupados.filter((d) => d.usuarioNome.toLowerCase().includes(q))
  }, [registros, busca])

  const kpis = useMemo(() => {
    const ativos = usuarios.filter((u) => u.status === 'ativo')
    const hojeISO = new Date().toISOString().slice(0, 10)
    const presentesHoje = new Set(
      registros.filter((r) => r.tipo !== 'falta' && r.registradoEm.slice(0, 10) === hojeISO).map((r) => r.usuarioId),
    )
    return {
      total: ativos.length,
      presentes: presentesHoje.size,
      ausentes: Math.max(ativos.length - presentesHoje.size, 0),
    }
  }, [usuarios, registros])

  return (
    <AdminShell
      actions={
        <>
          <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setRelatorioAberto(true)}>
            Relatório mensal
          </Button>
          <Button icon={CalendarPlus} onClick={() => setLancarAberto(true)}>
            Lançar manual
          </Button>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users2} value={kpis.total} label="Pesquisadores" hint="Ativos na plataforma" accent="violet" />
        <StatCard icon={UserCheck} value={kpis.presentes} label="Presentes hoje" hint="Com registro hoje" accent="green" />
        <StatCard icon={UserX} value={kpis.ausentes} label="Ausentes hoje" hint="Sem registro hoje" accent="amber" />
      </div>

      {/* Abas de período + filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
          {(['hoje', 'semana', 'mes'] as Aba[]).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                aba === a
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {a === 'mes' ? 'Mês' : a}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pesquisador…" />
        </div>
        <div className="min-w-[220px]">
          <Select value={usuarioFiltro} onChange={(e) => setUsuarioFiltro(e.target.value)}>
            <option value="">Todos os pesquisadores</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Tabela agrupada por dia */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Pesquisador</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Saída</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Carregando…
                  </td>
                </tr>
              ) : dias.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Nenhum registro no período.
                  </td>
                </tr>
              ) : (
                dias.map((d) => <LinhaDia key={`${d.usuarioId}-${d.data}-${d.entrada?.id}-${d.saida?.id}`} dia={d} onCorrigir={setCorrigindo} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Mostrando {dias.length} dia(s). Horário e tipo de entrada/saída são sempre decididos pelo
        servidor no momento da leitura do QR Code — aqui só é possível corrigir um registro já
        existente, lançar um retroativo ou registrar uma falta, todos com motivo obrigatório e auditoria.
      </p>

      <CorrigirPontoModal registro={corrigindo} open={Boolean(corrigindo)} onClose={() => setCorrigindo(null)} />
      <LancarPontoManualModal
        usuarios={usuarios.map((u) => ({ id: u.id, nome: u.nome }))}
        open={lancarAberto}
        onClose={() => setLancarAberto(false)}
      />
      <RelatorioMensalModal
        usuarios={usuarios.map((u) => ({ id: u.id, nome: u.nome }))}
        open={relatorioAberto}
        onClose={() => setRelatorioAberto(false)}
      />
    </AdminShell>
  )
}

function LinhaDia({ dia, onCorrigir }: { dia: DiaFrequencia; onCorrigir: (r: RegistroPonto) => void }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar nome={dia.usuarioNome} fotoUrl={dia.entrada?.usuarioFotoUrl ?? dia.saida?.usuarioFotoUrl} size="sm" />
          <span className="font-medium text-slate-800 dark:text-slate-100">{dia.usuarioNome}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-500">
        {new Date(`${dia.data}T00:00:00`).toLocaleDateString('pt-BR')}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-700 dark:text-slate-200">
            {dia.entrada ? new Date(dia.entrada.registradoEm).toLocaleTimeString('pt-BR') : '—'}
          </span>
          {dia.entrada && (
            <button
              onClick={() => onCorrigir(dia.entrada!)}
              className="rounded p-1 text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
              title="Corrigir entrada"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-700 dark:text-slate-200">
            {dia.saida ? new Date(dia.saida.registradoEm).toLocaleTimeString('pt-BR') : '—'}
          </span>
          {dia.saida && (
            <button
              onClick={() => onCorrigir(dia.saida!)}
              className="rounded p-1 text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
              title="Corrigir saída"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {dia.falta && (
            <span
              className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300"
              title={dia.falta.motivoEdicao}
            >
              falta
            </span>
          )}
          {dia.incompleto && (
            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              incompleto
            </span>
          )}
          {dia.corrigido && !dia.falta && (
            <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              corrigido
            </span>
          )}
          {!dia.falta && (dia.entrada?.origem === 'manual' || dia.saida?.origem === 'manual') && (
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              manual
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}
