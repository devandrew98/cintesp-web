import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import { listarRegistrosPonto } from '@/data/ponto'
import { agruparPorDia, resumirFrequencia, exportarFrequenciaXlsx, formatarHoras } from '@/lib/ponto'
import { mensagemErro } from '@/lib/utils'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/**
 * Relatório mensal de frequência: escolhe mês/ano (+ pesquisador opcional),
 * mostra um resumo por pessoa e exporta em .xlsx (SheetJS, mesma lib já
 * usada para importar planilhas — ver src/lib/planilha.ts).
 *
 * A frequência é calculada pareando ENTRADA→SAÍDA de cada dia (não conta
 * simplesmente quantidade de leituras) — ver `agruparPorDia`/`resumirFrequencia`
 * em src/lib/ponto.ts.
 */
export function RelatorioMensalModal({
  usuarios,
  open,
  onClose,
}: {
  usuarios: { id: string; nome: string }[]
  open: boolean
  onClose: () => void
}) {
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1) // 1-12
  const [usuarioId, setUsuarioId] = useState('')
  const [exportando, setExportando] = useState(false)
  const [erroExport, setErroExport] = useState<string | null>(null)

  const periodo = useMemo(() => {
    const de = new Date(ano, mes - 1, 1).toISOString()
    const ate = new Date(ano, mes, 0, 23, 59, 59).toISOString()
    return { de, ate }
  }, [ano, mes])

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['ponto-registros', { ...periodo, usuarioId }],
    queryFn: () => listarRegistrosPonto({ de: periodo.de, ate: periodo.ate, usuarioId: usuarioId || undefined }),
    enabled: open,
  })

  const resumo = useMemo(() => resumirFrequencia(agruparPorDia(registros)), [registros])

  async function exportar() {
    setErroExport(null)
    setExportando(true)
    try {
      await exportarFrequenciaXlsx(resumo, { mes, ano })
    } catch (e) {
      setErroExport(mensagemErro(e))
    } finally {
      setExportando(false)
    }
  }

  const anos = Array.from({ length: 5 }, (_, i) => agora.getFullYear() - i)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          Relatório mensal de frequência
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button icon={FileSpreadsheet} onClick={exportar} disabled={exportando || resumo.length === 0}>
            {exportando ? 'Exportando…' : 'Exportar .xlsx'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Mês">
            <Select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ano">
            <Select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pesquisador">
            <Select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {erroExport && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {erroExport}
          </p>
        )}

        <div className="card overflow-hidden">
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Pesquisador</th>
                  <th className="px-3 py-2">Dias</th>
                  <th className="px-3 py-2">Entradas</th>
                  <th className="px-3 py-2">Saídas</th>
                  <th className="px-3 py-2">Incompletos</th>
                  <th className="px-3 py-2">Corrigidos</th>
                  <th className="px-3 py-2">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : resumo.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                      Nenhum registro neste período.
                    </td>
                  </tr>
                ) : (
                  resumo.map((r) => (
                    <tr key={r.usuarioId}>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{r.usuarioNome}</td>
                      <td className="px-3 py-2 text-slate-500">{r.diasTrabalhados}</td>
                      <td className="px-3 py-2 text-slate-500">{r.entradas}</td>
                      <td className="px-3 py-2 text-slate-500">{r.saidas}</td>
                      <td className="px-3 py-2 text-slate-500">{r.incompletos}</td>
                      <td className="px-3 py-2 text-slate-500">{r.corrigidos}</td>
                      <td className="px-3 py-2 text-slate-500">{formatarHoras(r.horasTrabalhadas)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
