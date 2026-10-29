import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

const LIMITE = 80 // px de arrasto para disparar
const MAX = 120

/** Algum ancestral rolável (modal, lista) já foi rolado? Aí o gesto é rolagem, não "puxar para atualizar". */
function ancestralRolado(el: EventTarget | null): boolean {
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    if (n.scrollTop > 0) return true
  }
  return false
}

const noApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/**
 * "Puxar para atualizar" no app instalado (atalho do celular), que não tem a barra do navegador.
 * Recarrega a página como no navegador — o que também busca a versão nova do app.
 */
export function PullToRefresh() {
  const [puxado, setPuxado] = useState(0)
  const [atualizando, setAtualizando] = useState(false)
  const inicio = useRef<number | null>(null)
  const atual = useRef(0)

  useEffect(() => {
    if (!noApp()) return

    const aoTocar = (e: TouchEvent) => {
      const modalAberto = document.body.style.overflow === 'hidden'
      inicio.current = window.scrollY <= 0 && !modalAberto && !ancestralRolado(e.target) ? e.touches[0].clientY : null
    }
    const aoMover = (e: TouchEvent) => {
      if (inicio.current === null) return
      const d = e.touches[0].clientY - inicio.current
      if (d <= 0) {
        atual.current = 0
        setPuxado(0)
        return
      }
      atual.current = Math.min(MAX, d * 0.5)
      setPuxado(atual.current)
    }
    const aoSoltar = () => {
      if (inicio.current === null) return
      inicio.current = null
      if (atual.current >= LIMITE * 0.5) {
        setAtualizando(true)
        setPuxado(LIMITE * 0.5)
        window.location.reload()
      } else {
        setPuxado(0)
      }
      atual.current = 0
    }

    document.addEventListener('touchstart', aoTocar, { passive: true })
    document.addEventListener('touchmove', aoMover, { passive: true })
    document.addEventListener('touchend', aoSoltar)
    document.addEventListener('touchcancel', aoSoltar)
    return () => {
      document.removeEventListener('touchstart', aoTocar)
      document.removeEventListener('touchmove', aoMover)
      document.removeEventListener('touchend', aoSoltar)
      document.removeEventListener('touchcancel', aoSoltar)
    }
  }, [])

  if (puxado <= 0 && !atualizando) return null
  const pronto = puxado >= LIMITE * 0.5
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center"
      style={{ transform: `translateY(${Math.max(puxado - 36, -36) + 8}px)` }}
      aria-hidden
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        {atualizando ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        ) : (
          <RefreshCw className="h-5 w-5 text-brand-600 transition-transform" style={{ transform: `rotate(${pronto ? 180 : puxado * 3}deg)` }} />
        )}
      </div>
    </div>
  )
}
