import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer, PackageCheck, Loader2, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { registrarDevolucao } from '@/data/consignados'
import { statusConsignadoInfo, type GrupoConsignado } from '@/lib/consignados'
import { usePermissoes } from '@/hooks/usePermissoes'
import { formatarCPF } from '@/lib/cpf'
import { formatDateOnlyBR } from '@/lib/utils'
import { imprimirConsignado } from '@/lib/consignadoPdf'

/**
 * Detalhe do empréstimo (um ou mais itens do mesmo protocolo) + geração do
 * PDF do protocolo, no PAPEL TIMBRADO oficial, com "Entregue por (ADM)" e
 * "Recebido por" editáveis antes de imprimir.
 */
export function ConsignadoDetailModal({
  grupo,
  onClose,
}: {
  grupo: GrupoConsignado | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { perfil } = usePermissoes()

  const [entreguePor, setEntreguePor] = useState('')
  const [recebidoPor, setRecebidoPor] = useState('')
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [erroImpressao, setErroImpressao] = useState<string | null>(null)

  // Reabastece os campos editáveis sempre que um novo protocolo é aberto.
  useEffect(() => {
    if (!grupo) return
    setEntreguePor(perfil?.nome ?? '')
    setRecebidoPor(grupo.pesquisadorNome ?? '')
    setErroImpressao(null)
  }, [grupo, perfil?.nome])

  const devolver = useMutation({
    mutationFn: () => registrarDevolucao(grupo!.itens),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consignados'] })
      qc.invalidateQueries({ queryKey: ['patrimonio-itens'] })
      onClose()
    },
  })

  if (!grupo) return null
  const st = statusConsignadoInfo[grupo.status]
  const emUso = grupo.status === 'em_uso'
  const protocoloNo = grupo.protocolo.slice(0, 8).toUpperCase()

  async function imprimir() {
    if (!grupo) return
    setErroImpressao(null)
    setGerandoPdf(true)
    try {
      await imprimirConsignado({
        protocoloNo,
        itens: grupo.itens.map((it) => ({ numero: it.itemNumero, nome: it.itemNome, local: it.local })),
        pesquisadorNome: grupo.pesquisadorNome,
        pesquisadorCpf: grupo.pesquisadorCpf,
        pesquisadorArea: grupo.pesquisadorArea,
        local: grupo.local,
        dataRetirada: grupo.dataRetirada,
        dataEntregaPrevista: grupo.dataEntregaPrevista,
        observacoes: grupo.observacoes,
        entreguePor,
        recebidoPor,
      })
    } catch (err) {
      setErroImpressao(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.')
    } finally {
      setGerandoPdf(false)
    }
  }

  const linhasResumo: Array<{ rot: string; val: string }> = [
    { rot: 'Pesquisador', val: grupo.pesquisadorNome ?? '—' },
    { rot: 'CPF', val: grupo.pesquisadorCpf ? formatarCPF(grupo.pesquisadorCpf) : '—' },
    { rot: 'Área de atuação', val: grupo.pesquisadorArea || '—' },
    { rot: 'Local', val: grupo.local || '—' },
    { rot: 'Data de retirada', val: formatDateOnlyBR(grupo.dataRetirada) },
    { rot: 'Entrega prevista', val: formatDateOnlyBR(grupo.dataEntregaPrevista) },
    { rot: 'Devolvido em', val: formatDateOnlyBR(grupo.dataDevolucao) },
  ]

  return (
    <Modal
      open={Boolean(grupo)}
      onClose={onClose}
      size="xl"
      title={
        grupo.itens.length > 1
          ? `${grupo.itens.length} itens consignados`
          : `${grupo.itens[0]?.itemNome ?? 'Item'} · Patrimônio ${grupo.itens[0]?.itemNumero ?? '—'}`
      }
      subtitle={`Protocolo ${protocoloNo}`}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone as 'green' | 'amber'} dot>
            {st.label}
          </Badge>
          {grupo.observacoes && <span className="text-xs text-slate-400">Obs.: {grupo.observacoes}</span>}
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {linhasResumo.map((l) => (
            <div key={l.rot}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{l.rot}</dt>
              <dd className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{l.val}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Item(ns) consignado(s) — {grupo.itens.length}
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Nº Patrimônio</th>
                  <th className="px-3 py-2">Item</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {grupo.itens.map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
                      {it.itemNumero ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{it.itemNome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Campos editáveis antes de imprimir — quem entrega e quem recebe. */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            Assinaturas do formulário — confira e edite antes de imprimir
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Entregue por (Administração)">
              <Input value={entreguePor} onChange={(e) => setEntreguePor(e.target.value)} placeholder="Nome de quem entrega" />
            </Field>
            <Field label="Recebido por">
              <Input value={recebidoPor} onChange={(e) => setRecebidoPor(e.target.value)} placeholder="Nome de quem recebe" />
            </Field>
          </div>
        </div>

        {erroImpressao && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 p-3 text-sm text-red-700 dark:border-red-500/30 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {erroImpressao}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="secondary" icon={gerandoPdf ? undefined : Printer} onClick={imprimir} disabled={gerandoPdf}>
            {gerandoPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando PDF…
              </>
            ) : (
              'Imprimir formulário de consignado'
            )}
          </Button>
          {emUso && (
            <Button icon={devolver.isPending ? undefined : PackageCheck} onClick={() => devolver.mutate()} disabled={devolver.isPending}>
              {devolver.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Registrando…
                </>
              ) : (
                'Registrar devolução'
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
