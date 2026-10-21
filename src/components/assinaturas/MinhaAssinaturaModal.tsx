import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PenLine } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { AssinaturaLogoInput } from '@/components/assinatura/AssinaturaLogoInput'
import { AssinaturaPreview } from '@/components/assinatura/AssinaturaPreview'
import {
  gerarHtmlAssinatura,
  LOGO_PADRAO_CAMINHO,
  urlParaDataUri,
  validarAssinatura,
  valoresPadraoAssinatura,
  type DadosAssinatura,
} from '@/lib/assinaturaEmail'
import { salvarMinhaAssinatura } from '@/data/assinaturas'
import { mensagemErro } from '@/lib/utils'

/** Chave do react-query com a assinatura salva do usuário. */
export const chaveMinhaAssinatura = (usuarioId?: string) => ['minha-assinatura', usuarioId]

/**
 * Edita a assinatura visual que vai nos documentos (a mesma ideia da
 * "Assinatura de E-mail": logo, nome, cargo, organização, e-mail). Fica
 * salva na conta; ao assinar um PDF, o app usa estes dados + data/hora.
 */
export function MinhaAssinaturaModal({
  usuarioId,
  inicial,
  nomePadrao,
  emailPadrao,
  open,
  onClose,
}: {
  usuarioId: string
  /** Assinatura já salva (null = primeira vez). */
  inicial: DadosAssinatura | null
  nomePadrao?: string
  emailPadrao?: string
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [dados, setDados] = useState<DadosAssinatura>(valoresPadraoAssinatura)
  const [mostrarErros, setMostrarErros] = useState(false)

  // Ao abrir: carrega o que já existe; na primeira vez, sugere nome/e-mail do perfil e a logo padrão embutida.
  useEffect(() => {
    if (!open) return
    setMostrarErros(false)
    if (inicial) {
      setDados(inicial)
      return
    }
    setDados({ ...valoresPadraoAssinatura(), nome: nomePadrao ?? '', email: emailPadrao ?? '' })
    urlParaDataUri(LOGO_PADRAO_CAMINHO)
      .then((uri) => setDados((d) => (d.logoUrl === LOGO_PADRAO_CAMINHO ? { ...d, logoUrl: uri } : d)))
      .catch(() => undefined)
  }, [open, inicial, nomePadrao, emailPadrao])

  const faltando = validarAssinatura(dados)

  const salvarMut = useMutation({
    mutationFn: () => salvarMinhaAssinatura(usuarioId, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaveMinhaAssinatura(usuarioId) })
      onClose()
    },
  })

  function salvar() {
    if (faltando.length > 0) {
      setMostrarErros(true)
      return
    }
    salvarMut.mutate()
  }

  const erro = (campo: (typeof faltando)[number]) => mostrarErros && faltando.includes(campo)
  const classeErro = 'border-red-400 focus:border-red-500 focus:ring-red-500/20'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <PenLine className="h-5 w-5" />
          </span>
          Minha assinatura
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvarMut.isPending}>
            {salvarMut.isPending ? 'Salvando…' : 'Salvar assinatura'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <AssinaturaLogoInput logoUrl={dados.logoUrl} onChange={(logoUrl) => setDados((d) => ({ ...d, logoUrl }))} />
        <Field label="Nome completo">
          <Input
            value={dados.nome}
            onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))}
            className={erro('nome') ? classeErro : undefined}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cargo / Função">
            <Input
              value={dados.cargo}
              onChange={(e) => setDados((d) => ({ ...d, cargo: e.target.value }))}
              placeholder="Ex.: Pesquisador"
              className={erro('cargo') ? classeErro : undefined}
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={dados.email}
              onChange={(e) => setDados((d) => ({ ...d, email: e.target.value }))}
              className={erro('email') ? classeErro : undefined}
            />
          </Field>
        </div>
        <Field label="Organização">
          <Input
            value={dados.organizacao}
            onChange={(e) => setDados((d) => ({ ...d, organizacao: e.target.value }))}
            className={erro('organizacao') ? classeErro : undefined}
          />
        </Field>
        {mostrarErros && faltando.length > 0 && (
          <p className="text-sm text-red-500">Preencha todos os campos para salvar a assinatura.</p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Pré-visualização</p>
          <AssinaturaPreview html={gerarHtmlAssinatura(dados)} />
          <p className="mt-2 text-xs text-slate-400">
            No documento, a assinatura sai num quadro com “Assinado digitalmente”, a data/hora e um código do
            documento.
          </p>
        </div>

        {salvarMut.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {mensagemErro(salvarMut.error)}
          </p>
        )}
      </div>
    </Modal>
  )
}
