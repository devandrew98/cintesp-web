import type { ReactNode } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { AdminTabs } from './AdminTabs'

/**
 * "Casca" comum de todas as telas de Administração: título padrão + a barra
 * de abas. Assim todas as sub-telas (Usuários, Funções, etc.) compartilham o
 * mesmo cabeçalho e navegação, mudando apenas o conteúdo (children).
 */
export function AdminShell({
  actions,
  children,
}: {
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <PageHeader
        title="Administração"
        subtitle="Gerencie usuários, funções e horários da equipe."
        actions={actions}
      />
      <AdminTabs />
      {children}
    </div>
  )
}
