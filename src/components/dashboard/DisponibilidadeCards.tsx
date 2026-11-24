import { SectionCard } from '@/components/ui/SectionCard'
import { PersonRow } from '@/components/ui/PersonRow'
import type { Usuario } from '@/types'

/** Quem está livre agora, em home-office e ausente — cartões do Quadro de Disponibilidade. Recebe só a equipe ativa. */

export function DisponiveisAgoraCard({ ativos, className }: { ativos: Usuario[]; className?: string }) {
  const lista = ativos.filter((u) => u.disponibilidade === 'disponivel').sort((a, b) => (a.livreAte ?? '99:99').localeCompare(b.livreAte ?? '99:99'))
  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          Disponíveis agora
        </span>
      }
      action={<span className="text-sm font-medium text-brand-600">{lista.length}</span>}
    >
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {lista.slice(0, 6).map((u) => (
          <PersonRow key={u.id} usuario={u} showLivreAte />
        ))}
        {lista.length === 0 && <p className="px-2 py-8 text-center text-sm text-slate-400">Ninguém disponível agora.</p>}
      </div>
    </SectionCard>
  )
}

export function HomeOfficeCard({ ativos, className }: { ativos: Usuario[]; className?: string }) {
  const lista = ativos.filter((u) => u.disponibilidade === 'home_office')
  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Home-Office
        </span>
      }
      action={<span className="text-sm font-medium text-amber-600">{lista.length}</span>}
    >
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {lista.slice(0, 5).map((u) => (
          <PersonRow key={u.id} usuario={u} showLivreAte />
        ))}
        {lista.length === 0 && <p className="px-2 py-8 text-center text-sm text-slate-400">Ninguém em home-office agora.</p>}
      </div>
    </SectionCard>
  )
}

export function AusentesCard({ ativos, className }: { ativos: Usuario[]; className?: string }) {
  const lista = ativos.filter((u) => u.disponibilidade === 'ausente')
  return (
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Ausentes
        </span>
      }
      action={<span className="text-sm font-medium text-red-500">{lista.length}</span>}
    >
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {lista.slice(0, 5).map((u) => (
          <PersonRow key={u.id} usuario={u} compactStatus />
        ))}
        {lista.length === 0 && <p className="px-2 py-8 text-center text-sm text-slate-400">Ninguém ausente.</p>}
      </div>
    </SectionCard>
  )
}
