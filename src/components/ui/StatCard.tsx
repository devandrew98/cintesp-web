import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Accent = 'green' | 'blue' | 'amber' | 'violet'

const accents: Record<Accent, { ring: string; icon: string; bar: string }> = {
  green: {
    ring: 'bg-brand-50 dark:bg-brand-500/15',
    icon: 'text-brand-600 dark:text-brand-400',
    bar: 'bg-brand-500',
  },
  blue: {
    ring: 'bg-sky-50 dark:bg-sky-500/15',
    icon: 'text-sky-600 dark:text-sky-400',
    bar: 'bg-sky-500',
  },
  amber: {
    ring: 'bg-amber-50 dark:bg-amber-500/15',
    icon: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  violet: {
    ring: 'bg-violet-50 dark:bg-violet-500/15',
    icon: 'text-violet-600 dark:text-violet-400',
    bar: 'bg-violet-500',
  },
}

interface StatCardProps {
  icon: LucideIcon
  value: number | string
  label: string
  hint?: string
  accent?: Accent
}

export function StatCard({ icon: Icon, value, label, hint, accent = 'green' }: StatCardProps) {
  const a = accents[accent]
  return (
    <div className="card group relative overflow-hidden p-5">
      <div className={cn('absolute inset-x-0 top-0 h-1', a.bar)} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
          {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', a.ring)}>
          <Icon className={cn('h-5 w-5', a.icon)} />
        </div>
      </div>
    </div>
  )
}
