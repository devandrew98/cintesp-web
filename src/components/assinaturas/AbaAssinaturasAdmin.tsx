import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, ExternalLink, FileSignature, Loader2, PenLine, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/Badge'
import { NovoDocumentoAssinaturaModal } from './NovoDocumentoAssinaturaModal'
import { MinhaAssinaturaModal } from './MinhaAssinaturaModal'
import { useMinhaAssinatura } from './useMinhaAssinatura'
import {
  baixarPdfDocumento,
  excluirDocumentoAssinatura,
  listarDocumentosAssinatura,
  type DocumentoAssinatura,
} from '@/data/assinaturas'
import { baixarArquivo } from '@/lib/assinaturaPdf'
import { usePermissoes } from '@/hooks/usePermissoes'
import { mensagemErro } from '@/lib/utils'
import type { Usuario } from '@/types'

/** Pasta do Google Drive onde o administrador guarda os documentos assinados (subida manual). */
const PASTA_DRIVE_URL = 'https://drive.google.com/drive/folders/1SKvYwyfPCwyB9Iap-7FSVAtdRLQ8dZPB'

/**
 * Administração > Consignados > aba "Assinaturas": todos os documentos
 * enviados para assinatura, com status e download do PDF. O arquivo assinado
 * é subido no Google Drive manualmente (link "Suba pro Google Drive").
 * O botão "Novo documento" é aberto pelo cabeçalho da página (prop `novoAberto`).
 */
export function AbaAssinaturasAdmin({
  pesquisadores,
  novoAberto,
  onFecharNovo,
}: {
  pesquisadores: Usuario[]
  novoAberto: boolean
  onFecharNovo: () => void
}) {
  const qc = useQueryClient()
  const { perfil } = usePermissoes()
  const { data: minhaAssinatura = null } = useMinhaAssinatura(perfil?.id)
  const [editandoAssinatura, setEditandoAssinatura] = useState(false)
  const [excluir, setExcluir] = useState<DocumentoAssinatura | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['assinatura-documentos'],
    queryFn: listarDocumentosAssinatura,
  })

  const excluirMut = useMutation({
    mutationFn: excluirDocumentoAssinatura,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assinatura-documentos'] })
      setExcluir(null)
    },
    onError: (e) => setErro(mensagemErro(e)),
  })

  async function baixar(d: DocumentoAssinatura) {
    setErro(null)
    try {
      const bytes = await baixarPdfDocumento(d.id, d.status === 'assinado' ? 'final' : 'admin')
      baixarArquivo(bytes, `${d.titulo}${d.status === 'assinado' ? ' (assinado)' : ' (aguardando)'}.pdf`)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <span>
          Suba o termo em PDF, posicione as assinaturas e escolha o pesquisador. O documento aparece só na conta
          dele, em <strong>Assinar documentos</strong>.
        </span>
        <Button variant="secondary" icon={PenLine} onClick={() => setEditandoAssinatura(true)} disabled={!perfil}>
          {minhaAssinatura ? 'Minha assinatura' : 'Criar minha assinatura'}
        </Button>
      </div>

      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Pesquisador</th>
                <th className="px-4 py-3">Enviado</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : documentos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    <FileSignature className="mx-auto mb-2 h-6 w-6" />
                    Nenhum documento enviado para assinatura ainda.
                  </td>
                </tr>
              ) : (
                documentos.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{d.titulo}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.pesquisadorNome ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(d.criadoEm).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {d.status === 'assinado' ? (
                          <Badge tone="green">Assinado</Badge>
                        ) : (
                          <Badge tone="amber">Aguardando pesquisador</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => baixar(d)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                          title="Baixar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {d.status === 'assinado' && (
                          <a
                            href={PASTA_DRIVE_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                            title="Abre a pasta do Drive — baixe o PDF assinado e arraste para lá"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Suba pro Google Drive
                          </a>
                        )}
                        <button
                          onClick={() => setExcluir(d)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {perfil && (
        <MinhaAssinaturaModal
          usuarioId={perfil.id}
          inicial={minhaAssinatura}
          nomePadrao={perfil.nome}
          emailPadrao={perfil.email}
          open={editandoAssinatura}
          onClose={() => setEditandoAssinatura(false)}
        />
      )}
      {perfil && (
        <NovoDocumentoAssinaturaModal
          open={novoAberto}
          onClose={onFecharNovo}
          pesquisadores={pesquisadores}
          minhaAssinatura={minhaAssinatura}
          adminId={perfil.id}
          onCriarMinhaAssinatura={() => setEditandoAssinatura(true)}
        />
      )}
      <ConfirmDialog
        open={Boolean(excluir)}
        onClose={() => setExcluir(null)}
        onConfirm={() => excluir && excluirMut.mutate(excluir.id)}
        title="Excluir documento"
        message={
          <>
            Excluir <strong>{excluir?.titulo}</strong>? O PDF e o registro de assinatura serão apagados do app. Baixe o PDF
            antes se precisar guardá-lo.
          </>
        }
      />
    </div>
  )
}
