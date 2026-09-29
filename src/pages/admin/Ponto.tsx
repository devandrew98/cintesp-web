import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, Clock, LogIn, LogOut, Pencil, Users2 } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Select, Input } from '@/components/ui/Field'
import { StatCard } from '@/components/ui/StatCard'
import { Avatar } from '@/components/ui/Avatar'
import { CorrigirPontoModal } from '@/components/admin/CorrigirPontoModal'
import { LancarPontoManualModal } from '@/components/admin/LancarPontoManualModal'
import { listarRegistrosPonto } from '@/data/ponto'
import { listarUsuarios } from '@/data/api'
import { TIPO_PONTO_LABEL, TIPO_PONTO_COR, formatarDataHoraPonto } from '@/lib/ponto'
import type { RegistroPonto } from '@/types'

/** Início do dia de hoje, em ISO — usado como filtro padrão. */
function inicioDeHojeISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * "Administração > Ponto" — registros de entrada/saída lidos pelo terminal
 * de QR Code, com filtro por pesquisador/período, correção manual e
 * lançamento retroativo. Tudo aqui é só LEITURA/edição de auditoria — quem
 * decide entrada/saída na hora do registro é sempre o terminal (/ponto).
 */
export function AdminPontoPage() {
  const [usuarioFiltro, setUsuarioFiltro] = useState('')
  const [de, setDe] = useState(() => inicioDeHojeISO().slice(0, 10))
  const [ate, setAte] = useState('')
  const [corrigindo, setCorrigindo] = useState<RegistroPonto | null>(null)
  const [lancarAberto, setLancarAberto] = useState(false)

  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })

  const filtro = useMemo(
    () => ({
      usuarioId: usuarioFiltro || undefined,
      de: de ? new Date(`${de}T00:00:00`).toISOString() : undefined,
      ate: ate ? new Date(`${ate}T23:59:59`).toISOString() : undefined,
    }),
    [usuarioFiltro, de, ate],
  )

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['ponto-registros', filtro],
    queryFn: () => listarRegistrosPonto(filtro),
  })

  const kpis = useMemo(
    () => ({
      total: registros.length,
      entradas: registros.filter((r) => r.tipo === 'entrada').length,
      saidas: registros.filter((r) => r.tipo === 'saida').length,
      pessoas: new Set(registros.map((r) => r.usuarioId)).size,
    }),
    [registros],
  )

  return (
    <AdminShell
      actions={
        <Button icon={CalendarPlus} onClick={() => setLancarAberto(true)}>
          Lançar manual
        </Button>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Clock} value={kpis.total} label="Registros" hint="No período" accent="blue" />
        <StatCard icon={LogIn} value={kpis.entradas} label="Entradas" hint="No período" accent="green" />
        <StatCard icon={LogOut} value={kpis.saidas} label="Saídas" hint="No período" accent="amber" />
        <StatCard icon={Users2} value={kpis.pessoas} label="Pessoas" hint="Com registro" accent="violet" />
      </div>

      {/* Filtros */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_160px]">
        <Select value={usuarioFiltro} onChange={(e) => setUsuarioFiltro(e.target.value)}>
          <option value="">Todos os pesquisadores</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </Select>
        <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Pessoa</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Horário</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Terminal</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Carregando…
                  </td>
                </tr>
              ) : registros.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Nenhum registro no período.
                  </td>
                </tr>
              ) : (
                registros.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nome={r.usuarioNome ?? '?'} fotoUrl={r.usuarioFotoUrl} size="sm" />
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {r.usuarioNome ?? 'Pesquisador removido'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPO_PONTO_COR[r.tipo]}`}>
                        {TIPO_PONTO_LABEL[r.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatarDataHoraPonto(r.registradoEm)}
                      {r.editado && (
                        <span
                          className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                          title={r.motivoEdicao}
                        >
                          editado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.origem === 'qrcode' ? 'QR Code' : `Manual${r.criadoPorNome ? ` · ${r.criadoPorNome}` : ''}`}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.terminalId}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setCorrigindo(r)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                        aria-label={`Corrigir registro de ${r.usuarioNome}`}
                        title="Corrigir"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Mostrando {registros.length} registro(s). Horário e tipo de entrada/saída são sempre
        decididos pelo servidor no momento da leitura do QR Code — aqui só é possível corrigir um
        registro já existente ou lançar um retroativo, ambos com motivo obrigatório e auditoria.
      </p>

      <CorrigirPontoModal registro={corrigindo} open={Boolean(corrigindo)} onClose={() => setCorrigindo(null)} />
      <LancarPontoManualModal
        usuarios={usuarios.map((u) => ({ id: u.id, nome: u.nome }))}
        open={lancarAberto}
        onClose={() => setLancarAberto(false)}
      />
    </AdminShell>
  )
}
