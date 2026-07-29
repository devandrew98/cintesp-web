import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'
import { disponibilidadeInfo } from './Badge'
import type { Usuario } from '@/types'

interface PersonRowProps {
  usuario: Usuario
  /** Texto secundário: se ausente, usa a 1ª área de atuação. */
  subtitle?: string
  /** Mostra o horário "Até HH:MM" à direita. */
  showLivreAte?: boolean
  /** Rótulo de status compacto à direita (ex.: "Atendendo"). */
  compactStatus?: boolean
}

export function PersonRow({
  usuario,
  subtitle,
  showLivreAte,
  compactStatus,
}: PersonRowProps) {
  const info = disponibilidadeInfo[usuario.disponibilidade]
  const sub = subtitle ?? usuario.areas[0]?.nome ?? usuario.funcao.nome

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <div className="relative">
        <Avatar nome={usuario.nome} fotoUrl={usuario.fotoUrl} size="md" />
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900',
            info.dotColor,
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {usuario.nome}
        </p>
        <p className="truncate text-xs text-slate-400">{sub}</p>
      </div>

      {showLivreAte && (
        <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {usuario.livreAte ? `Até ${usuario.livreAte}` : 'Livre o dia todo'}
        </span>
      )}

      {compactStatus && (
        <span
          className={cn(
            'rounded-lg px-2 py-1 text-xs font-medium',
            usuario.disponibilidade === 'parcial'
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
              : usuario.disponibilidade === 'home_office'
                ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                : usuario.disponibilidade === 'ausente'
                  ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                  : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
          )}
        >
          {info.label}
        </span>
      )}
    </div>
  )
}
