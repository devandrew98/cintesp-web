import { Users } from 'lucide-react'

export function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
        <Users className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-slate-900 dark:text-white">CINTESP</p>
        <p className="text-[11px] text-slate-400">Quadro de Pesquisadores</p>
      </div>
    </div>
  )
}
