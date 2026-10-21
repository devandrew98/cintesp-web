import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, PenLine } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PdfPaginaViewer, MolduraAssinatura } from './PdfPaginaViewer'
import { baixarPdfDocumento, concluirAssinatura, type DocumentoAssinatura } from '@/data/assinaturas'
import {
  carimbarAssinatura,
  codigoDoDocumento,
  gerarImagemAssinatura,
  hashSha256,
  PROPORCAO_ASSINATURA,
} from '@/lib/assinaturaPdf'
import type { DadosAssinatura } from '@/lib/assinaturaEmail'
import { mensagemErro } from '@/lib/utils'

/**
 * Pesquisador: confere o documento (já com a assinatura do emprestante),
 * vê onde a sua assinatura vai entrar e confirma. O app aplica a assinatura
 * no PDF, calcula o SHA-256 do arquivo final e envia.
 */
export function AssinarDocumentoModal({
  documento,
  minhaAssinatura,
  onClose,
  onEditarAssinatura,
}: {
  documento: DocumentoAssinatura | null
  minhaAssinatura: DadosAssinatura | null
  onClose: () => void
  onEditarAssinatura: () => void
}) {
  const qc = useQueryClient()
  const [pagina, setPagina] = useState(1)
  const [concordo, setConcordo] = useState(false)

  useEffect(() => {
    if (!documento) return
    setPagina(documento.posicaoPesquisador.pagina)
    setConcordo(false)
  }, [documento])

  const { data: pdf, isLoading, error } = useQuery({
    queryKey: ['assinatura-pdf', documento?.id, 'admin'],
    queryFn: () => baixarPdfDocumento(documento!.id, 'admin'),
    enabled: Boolean(documento),
    staleTime: Infinity,
  })

  const assinarMut = useMutation({
    mutationFn: async () => {
      if (!documento || !pdf || !minhaAssinatura) throw new Error('Faltam dados.')
      const imagem = await gerarImagemAssinatura(
        minhaAssinatura,
        'Pesquisador',
        new Date(),
        codigoDoDocumento(documento.id),
      )
      const final = await carimbarAssinatura(pdf, imagem, documento.posicaoPesquisador)
      const hash = await hashSha256(final)
      await concluirAssinatura(documento.id, final, hash)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assinatura-documentos'] })
      onClose()
    },
  })

  if (!documento) return null
  const pos = documento.posicaoPesquisador

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <PenLine className="h-5 w-5" />
          </span>
          {documento.titulo}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button
            icon={PenLine}
            onClick={() => assinarMut.mutate()}
            disabled={!concordo || !minhaAssinatura || !pdf || assinarMut.isPending}
          >
            {assinarMut.isPending ? 'Assinando…' : 'Assinar documento'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!minhaAssinatura && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <span>Crie a sua assinatura antes de assinar o documento.</span>
            <Button variant="secondary" onClick={onEditarAssinatura}>
              Criar minha assinatura
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {mensagemErro(error)}
          </p>
        )}

        {pdf && (
          <>
            <p className="text-center text-xs text-slate-500">
              Leia o documento. Sua assinatura vai entrar na moldura âmbar (página {pos.pagina}).
            </p>
            <PdfPaginaViewer bytes={pdf} pagina={pagina} onPagina={(p) => setPagina(Math.max(1, p))}>
              {(razao) =>
                pos.pagina === pagina && (
                  <MolduraAssinatura {...pos} proporcao={PROPORCAO_ASSINATURA} razao={razao} rotulo="Sua assinatura" cor="ambar" />
                )
              }
            </PdfPaginaViewer>

            <label className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={concordo}
                onChange={(e) => setConcordo(e.target.checked)}
              />
              Li o documento e concordo com o seu conteúdo. Estou ciente de que a assinatura será aplicada com o
              meu nome, a data e a hora.
            </label>
          </>
        )}

        {assinarMut.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {mensagemErro(assinarMut.error)}
          </p>
        )}
      </div>
    </Modal>
  )
}
