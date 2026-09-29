import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { Download, QrCode, RefreshCw, ShieldOff, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { gerarQrPesquisador, listarStatusQr, revogarQrPesquisador } from '@/data/ponto'
import { mensagemErro } from '@/lib/utils'
import type { Usuario } from '@/types'

/**
 * Gerar/revogar o QR Code de ponto de um pesquisador.
 *
 * O TOKEN em texto puro só existe na resposta de `gerarQrPesquisador` — o
 * banco guarda só o hash. Por isso ele só aparece nesta tela, uma vez, logo
 * depois de gerado: feche o modal e ele não pode mais ser recuperado (é
 * preciso gerar um novo, o que invalida o anterior).
 */
export function QrPontoModal({
  usuario,
  open,
  onClose,
}: {
  usuario: Usuario | null
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [tokenGerado, setTokenGerado] = useState<string | null>(null)
  const [qrImagem, setQrImagem] = useState<string | null>(null)
  const [confirmarRevogar, setConfirmarRevogar] = useState(false)

  const { data: statusLista = [] } = useQuery({ queryKey: ['ponto-qr-status'], queryFn: listarStatusQr })
  const status = usuario ? statusLista.find((s) => s.usuarioId === usuario.id) : undefined

  useEffect(() => {
    if (!open) {
      setTokenGerado(null)
      setQrImagem(null)
    }
  }, [open])

  useEffect(() => {
    if (!tokenGerado) return
    QRCode.toDataURL(tokenGerado, { width: 320, margin: 1 })
      .then(setQrImagem)
      .catch(() => setQrImagem(null))
  }, [tokenGerado])

  const gerarMut = useMutation({
    mutationFn: () => gerarQrPesquisador(usuario!.id),
    onSuccess: (token) => {
      setTokenGerado(token)
      qc.invalidateQueries({ queryKey: ['ponto-qr-status'] })
    },
  })

  const revogarMut = useMutation({
    mutationFn: () => revogarQrPesquisador(usuario!.id),
    onSuccess: () => {
      setTokenGerado(null)
      setQrImagem(null)
      qc.invalidateQueries({ queryKey: ['ponto-qr-status'] })
    },
  })

  function baixarImagem() {
    if (!qrImagem || !usuario) return
    const a = document.createElement('a')
    a.href = qrImagem
    a.download = `qr-ponto-${usuario.nome.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
  }

  if (!usuario) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <QrCode className="h-5 w-5" />
          </span>
          QR Code de Ponto — {usuario.nome}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          {status?.ativo && (
            <Button variant="danger" icon={ShieldOff} onClick={() => setConfirmarRevogar(true)}>
              Revogar
            </Button>
          )}
          <Button icon={RefreshCw} onClick={() => gerarMut.mutate()} disabled={gerarMut.isPending}>
            {status?.ativo ? 'Gerar novo (revoga o atual)' : 'Gerar QR Code'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800">
          <span className="text-slate-500">Status atual</span>
          {status?.ativo ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Ativo — gerado em {new Date(status.criadoEm).toLocaleString('pt-BR')}
            </span>
          ) : status ? (
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
              Revogado
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              Nunca gerado
            </span>
          )}
        </div>

        {(gerarMut.isError || revogarMut.isError) && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {mensagemErro(gerarMut.error ?? revogarMut.error)}
          </p>
        )}

        {qrImagem ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
            <img src={qrImagem} alt="QR Code de ponto" className="h-56 w-56 rounded-lg bg-white p-2" />
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Este código só aparece agora. Entregue-o ao pesquisador (imprima ou baixe) antes de
              fechar — depois só é possível gerar um novo (o que invalida este).
            </p>
            <Button variant="secondary" icon={Download} onClick={baixarImagem}>
              Baixar imagem
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {status?.ativo
              ? 'Já existe um QR Code ativo para esta pessoa. Gere um novo se ele foi perdido ou precisa ser trocado — o anterior deixa de funcionar na hora.'
              : 'Gere um QR Code para esta pessoa poder registrar ponto no terminal.'}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmarRevogar}
        onClose={() => setConfirmarRevogar(false)}
        onConfirm={() => revogarMut.mutate()}
        title="Revogar QR Code"
        message={`Revogar o QR Code de "${usuario.nome}"? O código impresso/entregue deixa de funcionar imediatamente. Será preciso gerar um novo para essa pessoa voltar a registrar ponto.`}
        confirmLabel="Revogar"
      />
    </Modal>
  )
}
