import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Mostra UMA página de um PDF (renderizada com pdf.js, no navegador) e
 * deixa por cima um "overlay" com as mesmas dimensões, onde se desenham as
 * molduras das assinaturas. Coordenadas do overlay e do clique são sempre
 * FRAÇÕES da página (0..1, origem no canto superior esquerdo).
 */
export function PdfPaginaViewer({
  bytes,
  pagina,
  onPagina,
  onClickPagina,
  children,
}: {
  bytes: Uint8Array
  pagina: number
  onPagina: (p: number) => void
  /** Clique na página (fx, fy em frações). Se omitido, a página não é clicável. */
  onClickPagina?: (fx: number, fy: number) => void
  /** Overlay: renderizado sobre a página, num elemento `relative` do tamanho dela. Recebe a razão altura/largura da página. */
  children?: ReactNode | ((razao: number) => ReactNode)
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null)
  const [totalPaginas, setTotalPaginas] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [razao, setRazao] = useState(1.414) // altura/largura (A4 até a página carregar)

  // Abre o PDF (pdf.js é carregado só quando alguém realmente abre um documento).
  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    setErro(null)
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        pdfjs.GlobalWorkerOptions.workerSrc = worker
        // .slice(): o pdf.js "consome" o buffer que recebe; assim o original continua utilizável.
        const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
        if (cancelado) return
        pdfRef.current = doc
        setTotalPaginas(doc.numPages)
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Não foi possível abrir o PDF.')
      }
    })()
    return () => {
      cancelado = true
      pdfRef.current?.destroy?.()
      pdfRef.current = null
    }
  }, [bytes])

  // Desenha a página escolhida.
  useEffect(() => {
    const doc = pdfRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || totalPaginas === 0) return
    let cancelado = false
    ;(async () => {
      try {
        const page = await doc.getPage(Math.min(Math.max(pagina, 1), doc.numPages))
        const base = page.getViewport({ scale: 1 })
        // Largura alvo ~ 720px (o CSS reduz em telas menores); 2x pra ficar nítido em telas densas.
        const escala = (720 / base.width) * 2
        const viewport = page.getViewport({ scale: escala })
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, viewport }).promise
        if (!cancelado) {
          setRazao(viewport.height / viewport.width)
          setCarregando(false)
        }
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao desenhar a página.')
      }
    })()
    return () => {
      cancelado = true
    }
  }, [pagina, totalPaginas])

  if (erro) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
        <Button variant="secondary" icon={ChevronLeft} onClick={() => onPagina(pagina - 1)} disabled={pagina <= 1}>
          Anterior
        </Button>
        <span>
          Página {pagina} de {totalPaginas || '…'}
        </span>
        <Button
          variant="secondary"
          onClick={() => onPagina(pagina + 1)}
          disabled={pagina >= totalPaginas}
        >
          Próxima <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative mx-auto w-full max-w-[720px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-600">
        {carregando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        )}
        <canvas ref={canvasRef} className="block h-auto w-full" />
        <div
          className={`absolute inset-0 ${onClickPagina ? 'cursor-crosshair' : ''}`}
          onClick={(e) => {
            if (!onClickPagina) return
            const r = e.currentTarget.getBoundingClientRect()
            onClickPagina((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
          }}
        >
          {typeof children === 'function' ? children(razao) : children}
        </div>
      </div>
    </div>
  )
}

/** Moldura de uma assinatura sobre a página (posição em frações). */
export function MolduraAssinatura({
  x,
  y,
  largura,
  proporcao,
  razao,
  rotulo,
  cor,
}: {
  x: number
  y: number
  largura: number
  proporcao: number
  /** Razão altura/largura da página (vem do viewer). */
  razao: number
  rotulo: string
  cor: 'azul' | 'ambar'
}) {
  // Altura em % da página = largura% × proporção da imagem × (W/H da página).
  const alturaPct = (largura * 100 * proporcao) / razao
  return (
    <div
      className={`pointer-events-none absolute flex items-center justify-center rounded border-2 border-dashed text-[10px] font-semibold ${
        cor === 'azul'
          ? 'border-blue-600 bg-blue-500/15 text-blue-700'
          : 'border-amber-500 bg-amber-400/20 text-amber-700'
      }`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${largura * 100}%`, height: `${alturaPct}%` }}
    >
      {rotulo}
    </div>
  )
}
