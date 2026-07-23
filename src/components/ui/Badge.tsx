import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { StatusDisponibilidade } from '@/types'

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate'

const tones: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  className?: string
}

export function Badge({ children, tone = 'slate', dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

// ---- Helpers de disponibilidade ----
export const disponibilidadeInfo: Record<
  StatusDisponibilidade,
  { label: string; tone: Tone; dotColor: string }
> = {
  disponivel: { label: 'Disponível', tone: 'green', dotColor: 'bg-brand-500' },
  em_atendimento: { label: 'Em atendimento', tone: 'amber', dotColor: 'bg-amber-500' },
  ausente: { label: 'Ausente', tone: 'red', dotColor: 'bg-red-500' },
}

export function DisponibilidadeBadge({ status }: { status: StatusDisponibilidade }) {
  const info = disponibilidadeInfo[status]
  return (
    <Badge tone={info.tone} dot>
      {info.label}
    </Badge>
  )
}
