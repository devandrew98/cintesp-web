import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSignature, Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { PdfPaginaViewer, MolduraAssinatura } from './PdfPaginaViewer'
import { criarDocumentoParaAssinar } from '@/data/assinaturas'
import {
  carimbarAssinatura,
  codigoDoDocumento,
  gerarImagemAssinatura,
  LARGURA_ASSINATURA_PADRAO,
  PROPORCAO_ASSINATURA,
  type PosicaoAssinatura,
} from '@/lib/assinaturaPdf'
import type { DadosAssinatura } from '@/lib/assinaturaEmail'
import { mensagemErro } from '@/lib/utils'
import type { Usuario } from '@/types'

type Alvo = 'emprestante' | 'pesquisador'

const TAMANHO_MAX_MB = 15

/**
 * Admin: sobe o PDF do termo, escolhe o pesquisador e posiciona DUAS
 * assinaturas — a dele (emprestante, aplicada na hora) e a do pesquisador
 * (só a moldura: ele aplica depois, em "Assinar documentos").
 */
export function NovoDocumentoAssinaturaModal({
  open,
  onClose,
  pesquisadores,
  minhaAssinatura,
  adminId,
  onCriarMinhaAssinatura,
}: {
  open: boolean
  onClose: () => void
  pesquisadores: Usuario[]
  /** Assinatura salva do administrador (null = ainda não criou). */
  minhaAssinatura: DadosAssinatura | null
  adminId: string
  onCriarMinhaAssinatura: () => void
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pdf, setPdf] = useState<Uint8Array | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [titulo, setTitulo] = useState('')
  const [pesquisadorId, setPesquisadorId] = useState('')
  const [pagina, setPagina] = useState(1)
  const [alvo, setAlvo] = useState<Alvo>('emprestante')
  const [posEmprestante, setPosEmprestante] = useState<PosicaoAssinatura | null>(null)
  const [posPesquisador, setPosPesquisador] = useState<PosicaoAssinatura | null>(null)
  const [largura, setLargura] = useState(LARGURA_ASSINATURA_PADRAO)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)

  useEffect(() => {
    if (open) return
    setPdf(null)
    setNomeArquivo('')
    setTitulo('')
    setPesquisadorId('')
    setPagina(1)
    setAlvo('emprestante')
    setPosEmprestante(null)
    setPosPesquisador(null)
    setLargura(LARGURA_ASSINATURA_PADRAO)
    setErroArquivo(null)
  }, [open])

  async function escolherArquivo(file: File) {
    setErroArquivo(null)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErroArquivo('Envie um arquivo PDF.')
      return
    }
    if (file.size > TAMANHO_MAX_MB * 1024 * 1024) {
      setErroArquivo(`O PDF deve ter no máximo ${TAMANHO_MAX_MB} MB.`)
      return
    }
    setPdf(new Uint8Array(await file.arrayBuffer()))
    setNomeArquivo(file.name)
    setTitulo((t) => t || file.name.replace(/\.pdf$/i, ''))
    setPagina(1)
    setPosEmprestante(null)
    setPosPesquisador(null)
  }

  /** Clique na página: centraliza a moldura ativa no ponto clicado (sem sair da página). */
  function posicionar(fx: number, fy: number, razao: number) {
    const altura = (largura * PROPORCAO_ASSINATURA) / razao
    const x = Math.min(Math.max(fx - largura / 2, 0), 1 - largura)
    const y = Math.min(Math.max(fy - altura / 2, 0), 1 - altura)
    const pos = { pagina, x, y, largura }
    if (alvo === 'emprestante') setPosEmprestante(pos)
    else setPosPesquisador(pos)
  }

  const pesquisadoresOrdenados = useMemo(
    () => [...pesquisadores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [pesquisadores],
  )

  const criarMut = useMutation({
    mutationFn: async () => {
      if (!pdf || !minhaAssinatura || !posEmprestante || !posPesquisador) throw new Error('Faltam dados.')
      const id = crypto.randomUUID()
      const imagem = await gerarImagemAssinatura(minhaAssinatura, 'Emprestante', new Date(), codigoDoDocumento(id))
      const pdfComAdmin = await carimbarAssinatura(pdf, imagem, posEmprestante)
      await criarDocumentoParaAssinar({
        id,
        titulo,
        pesquisadorId,
        posicaoPesquisador: posPesquisador,
        pdfComAdmin,
        criadoPor: adminId,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assinatura-documentos'] })
      onClose()
    },
  })

  const pronto = Boolean(
    pdf && titulo.trim() && pesquisadorId && minhaAssinatura && posEmprestante && posPesquisador,
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <FileSignature className="h-5 w-5" />
          </span>
          Novo documento para assinar
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => criarMut.mutate()} disabled={!pronto || criarMut.isPending}>
            {criarMut.isPending ? 'Assinando e enviando…' : 'Assinar e enviar ao pesquisador'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {!minhaAssinatura && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <span>Você ainda não criou a sua assinatura. Ela é aplicada no documento como emprestante.</span>
            <Button variant="secondary" onClick={onCriarMinhaAssinatura}>
              Criar minha assinatura
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Título do documento">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Termo de empréstimo — Notebook Dell" />
          </Field>
          <Field label="Pesquisador que vai assinar" hint="O documento aparece só na conta dele.">
            <Select value={pesquisadorId} onChange={(e) => setPesquisadorId(e.target.value)}>
              <option value="">Selecione…</option>
              {pesquisadoresOrdenados.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void escolherArquivo(f)
              e.target.value = ''
            }}
          />
          <Button variant="secondary" icon={Upload} onClick={() => inputRef.current?.click()}>
            {pdf ? 'Trocar PDF' : 'Escolher PDF'}
          </Button>
          {nomeArquivo && <span className="text-sm text-slate-500">{nomeArquivo}</span>}
          {erroArquivo && <span className="text-sm text-red-500">{erroArquivo}</span>}
        </div>

        {pdf && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
                {(
                  [
                    ['emprestante', 'Minha assinatura (emprestante)'],
                    ['pesquisador', 'Assinatura do pesquisador'],
                  ] as [Alvo, string][]
                ).map(([a, rotulo]) => (
                  <button
                    key={a}
                    onClick={() => setAlvo(a)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      alvo === a ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                Tamanho
                <input
                  type="range"
                  min={0.15}
                  max={0.6}
                  step={0.01}
                  value={largura}
                  onChange={(e) => setLargura(Number(e.target.value))}
                />
              </label>
            </div>
            <p className="text-center text-xs text-slate-500">
              Clique na página para posicionar:{' '}
              <strong className={alvo === 'emprestante' ? 'text-blue-600' : 'text-amber-600'}>
                {alvo === 'emprestante' ? 'sua assinatura (azul)' : 'assinatura do pesquisador (âmbar)'}
              </strong>
              . Dá pra mudar de página e posicionar cada uma onde quiser.
            </p>

            <PdfPaginaViewer
              bytes={pdf}
              pagina={pagina}
              onPagina={(p) => setPagina(Math.max(1, p))}
              onClickPagina={undefined}
            >
              {(razao) => (
                <div
                  className="absolute inset-0 cursor-crosshair"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    posicionar((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, razao)
                  }}
                >
                  {posEmprestante?.pagina === pagina && (
                    <MolduraAssinatura {...posEmprestante} proporcao={PROPORCAO_ASSINATURA} razao={razao} rotulo="Emprestante" cor="azul" />
                  )}
                  {posPesquisador?.pagina === pagina && (
                    <MolduraAssinatura {...posPesquisador} proporcao={PROPORCAO_ASSINATURA} razao={razao} rotulo="Pesquisador" cor="ambar" />
                  )}
                </div>
              )}
            </PdfPaginaViewer>

            <p className="text-center text-xs text-slate-400">
              {posEmprestante ? `Emprestante: página ${posEmprestante.pagina}` : 'Emprestante: não posicionada'} ·{' '}
              {posPesquisador ? `Pesquisador: página ${posPesquisador.pagina}` : 'Pesquisador: não posicionada'}
            </p>
          </div>
        )}

        {criarMut.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {mensagemErro(criarMut.error)}
          </p>
        )}
      </div>
    </Modal>
  )
}
