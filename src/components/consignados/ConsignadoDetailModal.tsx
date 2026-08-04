import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer, PackageCheck, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { registrarDevolucao, type Consignado } from '@/data/consignados'
import { statusConsignadoInfo } from '@/lib/consignados'
import { usePermissoes } from '@/hooks/usePermissoes'
import { formatarCPF } from '@/lib/cpf'
import { formatDateOnlyBR } from '@/lib/utils'

/**
 * Detalhe do empréstimo + PROTOCOLO imprimível (com assinaturas).
 * "Imprimir formulário de consignado" abre a impressão só do protocolo.
 * "Registrar devolução" fecha o empréstimo e libera o item.
 */
export function ConsignadoDetailModal({
  consignado,
  onClose,
}: {
  consignado: Consignado | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { perfil } = usePermissoes()

  const devolver = useMutation({
    mutationFn: () => registrarDevolucao(consignado!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consignados'] })
      qc.invalidateQueries({ queryKey: ['patrimonio-itens'] })
      onClose()
    },
  })

  if (!consignado) return null
  const st = statusConsignadoInfo[consignado.status]
  const emUso = consignado.status === 'em_uso'
  const protocoloNo = consignado.id.slice(0, 8).toUpperCase()

  const linhasResumo: Array<{ rot: string; val: string }> = [
    { rot: 'Nº do patrimônio', val: consignado.itemNumero ?? '—' },
    { rot: 'Item', val: consignado.itemNome ?? '—' },
    { rot: 'Pesquisador', val: consignado.pesquisadorNome ?? '—' },
    { rot: 'CPF', val: consignado.pesquisadorCpf ? formatarCPF(consignado.pesquisadorCpf) : '—' },
    { rot: 'Área de atuação', val: consignado.pesquisadorArea || '—' },
    { rot: 'Local', val: consignado.local || '—' },
    { rot: 'Data de retirada', val: formatDateOnlyBR(consignado.dataRetirada) },
    { rot: 'Entrega prevista', val: formatDateOnlyBR(consignado.dataEntregaPrevista) },
    { rot: 'Devolvido em', val: formatDateOnlyBR(consignado.dataDevolucao) },
  ]

  return (
    <Modal
      open={Boolean(consignado)}
      onClose={onClose}
      size="xl"
      title={`${consignado.itemNome ?? 'Item'} · Patrimônio ${consignado.itemNumero ?? '—'}`}
      subtitle={`Protocolo ${protocoloNo}`}
    >
      <div className="space-y-5">
        {/* Resumo (não vai para a impressão) */}
        <div className="nao-imprimir space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone as 'green' | 'amber'} dot>
              {st.label}
            </Badge>
            {consignado.observacoes && (
              <span className="text-xs text-slate-400">Obs.: {consignado.observacoes}</span>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {linhasResumo.map((l) => (
              <div key={l.rot}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{l.rot}</dt>
                <dd className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{l.val}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Imprimir formulário de consignado
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

        {/* ---------- PROTOCOLO (isto é o que imprime) ---------- */}
        <div className="area-impressao rounded-2xl border border-slate-200 p-6 text-slate-900 dark:border-slate-700 dark:text-slate-100">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-300 pb-3">
            <div>
              <p className="text-lg font-extrabold tracking-tight">
                CINTESP<span className="text-brand-600">.Br</span>
              </p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Centro Brasileiro de Referência em Inovação Tecnológica Assistiva
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Protocolo nº <strong>{protocoloNo}</strong></p>
              <p>Emitido em {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <h2 className="mb-4 text-center text-base font-bold uppercase tracking-wide">
            Protocolo de Empréstimo de Patrimônio
          </h2>

          {/* Responsável */}
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Responsável (quem recebe)
          </p>
          <div className="mb-4 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <p><span className="text-slate-500">Nome:</span> {consignado.pesquisadorNome ?? '__________________'}</p>
            <p><span className="text-slate-500">CPF:</span> {consignado.pesquisadorCpf ? formatarCPF(consignado.pesquisadorCpf) : '____________'}</p>
            <p className="sm:col-span-2"><span className="text-slate-500">Área de atuação:</span> {consignado.pesquisadorArea || '__________________'}</p>
          </div>

          {/* Checklist do item */}
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Item(ns) consignado(s)
          </p>
          <table className="mb-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="w-8 py-1.5">✓</th>
                <th className="py-1.5">Nº Patrimônio</th>
                <th className="py-1.5">Item</th>
                <th className="py-1.5">Local</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-2">
                  <span className="inline-block h-4 w-4 rounded border border-slate-400 align-middle" />
                </td>
                <td className="py-2 font-medium">{consignado.itemNumero ?? '—'}</td>
                <td className="py-2">{consignado.itemNome ?? '—'}</td>
                <td className="py-2">{consignado.local || '—'}</td>
              </tr>
            </tbody>
          </table>

          {/* Prazos */}
          <div className="mb-4 grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <p><span className="text-slate-500">Data de retirada:</span> {formatDateOnlyBR(consignado.dataRetirada)}</p>
            <p><span className="text-slate-500">Entrega prevista:</span> {formatDateOnlyBR(consignado.dataEntregaPrevista)}</p>
          </div>

          <p className="mb-8 text-xs leading-relaxed text-slate-600">
            Declaro ter recebido o(s) item(ns) descrito(s) acima em bom estado de conservação e me
            responsabilizo pela sua guarda, uso adequado e devolução no prazo indicado. O item
            permanece consignado ao responsável até a emissão do respectivo protocolo de devolução.
          </p>

          {/* Assinaturas */}
          <div className="grid grid-cols-1 gap-8 pt-6 sm:grid-cols-2">
            <div className="text-center">
              <div className="mb-1 border-t border-slate-400" />
              <p className="text-sm font-medium">Entregue por (Administração)</p>
              <p className="text-xs text-slate-500">{perfil?.nome ?? '—'}</p>
            </div>
            <div className="text-center">
              <div className="mb-1 border-t border-slate-400" />
              <p className="text-sm font-medium">Recebido por</p>
              <p className="text-xs text-slate-500">{consignado.pesquisadorNome ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
