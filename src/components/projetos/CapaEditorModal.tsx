import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ImagePlus, Minus, Move, Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { atualizarCapaProjeto } from '@/data/projetos'
import { mensagemErro } from '@/lib/utils'

/** Proporção da capa (largura:altura) e tamanho final gravado. */
const PROPORCAO = 4
const SAIDA_W = 1800
const SAIDA_H = SAIDA_W / PROPORCAO

type Pos = { x: number; y: number }

/**
 * Ajuste da foto de capa: escolher a imagem, ARRASTAR para posicionar e usar o zoom para recortar.
 * O que aparece na moldura é exatamente o que vira a capa. Dá para reajustar a capa atual.
 */
export function CapaEditorModal({ open, onClose, projetoId, capaAtualUrl, aoSalvar }: { open: boolean; onClose: () => void; projetoId: string; capaAtualUrl?: string; aoSalvar: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const molduraRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const arrasto = useRef<{ px: number; py: number; x0: number; y0: number } | null>(null)

  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [largura, setLargura] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 }) // deslocamento do centro da imagem em px da moldura
  const [erro, setErro] = useState<string | null>(null)
  const [semCors, setSemCors] = useState(false)

  const altura = largura / PROPORCAO

  // Abre com a capa atual (se der para ler) ou vazio.
  useEffect(() => {
    if (!open) return
    setErro(null)
    setSemCors(false)
    setZoom(1)
    setPos({ x: 0, y: 0 })
    setNatural(null)
    setSrc(capaAtualUrl ?? null)
  }, [open, capaAtualUrl])

  useEffect(() => {
    return () => {
      if (src?.startsWith('blob:') && src !== capaAtualUrl) URL.revokeObjectURL(src)
    }
  }, [src, capaAtualUrl])

  // Mede a moldura (responsiva).
  useEffect(() => {
    if (!open) return
    const el = molduraRef.current
    if (!el) return
    const medir = () => setLargura(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, src])

  const base = natural && largura ? Math.max(largura / natural.w, altura / natural.h) : 1
  const escala = base * zoom

  /** Mantém a imagem sempre cobrindo a moldura (sem bordas vazias). */
  const limitar = useCallback(
    (p: Pos, z = zoom): Pos => {
      if (!natural || !largura) return p
      const s = Math.max(largura / natural.w, altura / natural.h) * z
      const maxX = Math.max(0, (natural.w * s - largura) / 2)
      const maxY = Math.max(0, (natural.h * s - altura) / 2)
      return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) }
    },
    [natural, largura, altura, zoom],
  )

  const mudarZoom = (z: number) => {
    const novo = Math.max(1, Math.min(4, z))
    setZoom(novo)
    setPos((p) => limitar(p, novo))
  }

  const escolher = (f?: File) => {
    if (!f) return
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setErro('Use uma imagem JPG, PNG ou WebP.')
      return
    }
    setErro(null)
    setSemCors(false)
    setZoom(1)
    setPos({ x: 0, y: 0 })
    setNatural(null)
    setSrc(URL.createObjectURL(f))
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const img = imgRef.current
      if (!img || !natural || !largura) throw new Error('Escolha uma imagem primeiro.')
      const canvas = document.createElement('canvas')
      canvas.width = SAIDA_W
      canvas.height = SAIDA_H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.')
      const k = SAIDA_W / largura
      const w = natural.w * escala * k
      const h = natural.h * escala * k
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, SAIDA_W, SAIDA_H)
      ctx.drawImage(img, SAIDA_W / 2 + pos.x * k - w / 2, SAIDA_H / 2 + pos.y * k - h / 2, w, h)
      let blob: Blob | null
      try {
        blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.88))
      } catch {
        throw new Error('Não foi possível reajustar a capa atual. Escolha o arquivo da imagem de novo.')
      }
      if (!blob) throw new Error('Não foi possível reajustar a capa atual. Escolha o arquivo da imagem de novo.')
      await atualizarCapaProjeto(projetoId, blob)
    },
    onSuccess: () => {
      aoSalvar()
      onClose()
    },
    onError: (e) => setErro(mensagemErro(e)),
  })

  const comoArrastar = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!natural) return
      e.currentTarget.setPointerCapture(e.pointerId)
      arrasto.current = { px: e.clientX, py: e.clientY, x0: pos.x, y0: pos.y }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const a = arrasto.current
      if (!a) return
      setPos(limitar({ x: a.x0 + e.clientX - a.px, y: a.y0 + e.clientY - a.py }))
    },
    onPointerUp: () => {
      arrasto.current = null
    },
    onPointerCancel: () => {
      arrasto.current = null
    },
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <ImagePlus className="h-5 w-5" />
          </span>
          Foto de capa
        </span>
      }
      subtitle="Arraste a imagem para posicionar e use o zoom para recortar. A moldura mostra como a capa vai ficar."
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !natural} className="w-full sm:w-auto">
            {salvar.isPending ? 'Salvando…' : 'Salvar capa'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = '' }} />

        {src ? (
          <div
            ref={molduraRef}
            {...comoArrastar}
            className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-slate-200 active:cursor-grabbing dark:bg-slate-800"
            style={{ aspectRatio: `${PROPORCAO} / 1` }}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              crossOrigin={src.startsWith('blob:') ? undefined : 'anonymous'}
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => {
                // A capa atual não pôde ser lida pelo navegador (CORS): pede o arquivo de novo.
                setSemCors(true)
                setSrc(null)
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={natural ? { width: natural.w * escala, height: natural.h * escala, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` } : { opacity: 0 }}
            />
            {natural && (
              <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[11px] text-white">
                <Move className="h-3 w-3" /> Arraste
              </span>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-12 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700" style={{ aspectRatio: `${PROPORCAO} / 1` }}>
            <ImagePlus className="h-8 w-8" />
            Escolher uma imagem (JPG, PNG ou WebP)
          </button>
        )}

        {src && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[200px] flex-1 items-center gap-2">
              <button type="button" onClick={() => mudarZoom(zoom - 0.2)} aria-label="Diminuir zoom" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Minus className="h-4 w-4" />
              </button>
              <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => mudarZoom(Number(e.target.value))} aria-label="Zoom" className="h-2 flex-1 accent-brand-600" />
              <button type="button" onClick={() => mudarZoom(zoom + 0.2)} aria-label="Aumentar zoom" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }) }}>
              Centralizar
            </Button>
            <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => inputRef.current?.click()}>
              Trocar imagem
            </Button>
          </div>
        )}

        {semCors && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Não foi possível abrir a capa atual para reajustar. Escolha o arquivo da imagem de novo.</p>}
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
