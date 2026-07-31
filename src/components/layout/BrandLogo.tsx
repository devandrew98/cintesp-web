import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Marca do CINTESP.Br.
 *
 * Usa a ARTE OFICIAL em /public:
 *   • public/logo-cintesp.png         → versão PRETA  (modo claro)
 *   • public/logo-cintesp-branca.png  → versão BRANCA (modo escuro)
 * A troca claro/escuro é automática (classes `dark:` do Tailwind).
 *
 * Enquanto esses arquivos não existirem, cai para uma marca simples recriada
 * (abaixo), para nunca aparecer imagem quebrada.
 */
export function BrandLogo({ className = 'h-11 w-auto' }: { className?: string }) {
  const [semArte, setSemArte] = useState(false)

  if (semArte) return <MarcaRecriada />

  return (
    <>
      <img
        src="/logo-cintesp.png"
        alt="CINTESP.Br"
        onError={() => setSemArte(true)}
        className={cn('block dark:hidden', className)}
      />
      <img
        src="/logo-cintesp-branca.png"
        alt="CINTESP.Br"
        onError={() => setSemArte(true)}
        className={cn('hidden dark:block', className)}
      />
    </>
  )
}

/** Símbolo recriado (estrela/órbitas) — usado só como reserva. */
export function MarcaCintesp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
        <ellipse cx="20" cy="20" rx="17" ry="6.4" transform="rotate(35 20 20)" />
        <ellipse cx="20" cy="20" rx="17" ry="6.4" transform="rotate(-35 20 20)" />
      </g>
      <path
        fill="currentColor"
        d="M20 8.5c1.1 7 4.4 10.3 11.5 11.5C24.4 21.2 21.1 24.5 20 31.5 18.9 24.5 15.6 21.2 8.5 20 15.6 18.8 18.9 15.5 20 8.5Z"
      />
    </svg>
  )
}

/** Reserva textual enquanto a arte oficial não está em /public. */
function MarcaRecriada() {
  return (
    <div className="flex items-center gap-2.5">
      <MarcaCintesp className="h-9 w-9 shrink-0 text-slate-900 dark:text-white" />
      <div className="leading-tight">
        <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
          CINTESP<span className="text-brand-600">.Br</span>
        </p>
        <p className="text-[11px] text-slate-400">Quadro de Pesquisadores</p>
      </div>
    </div>
  )
}
