import { corProgresso } from '@/lib/projetos'
import { cn } from '@/lib/utils'

/** Barra de progresso simples (0–100), colorida conforme o avanço. */
export function ProgressoBar({ progresso, className }: { progresso: number; className?: string }) {
  const valor = Math.max(0, Math.min(100, progresso))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', className)}>
      <div
        className={cn('h-full rounded-full transition-all', corProgresso(valor))}
        style={{ width: `${valor}%` }}
      />
    </div>
  )
}
