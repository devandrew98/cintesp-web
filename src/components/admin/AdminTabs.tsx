import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Barra de abas do módulo de Administração (topo da tela, como no print 2).
 * Cada aba é uma rota (/admin/...). A aba ativa é destacada automaticamente
 * pelo NavLink conforme a URL atual.
 */

const abas = [
  { label: 'Usuários', to: '/admin/usuarios' },
  { label: 'Funções', to: '/admin/funcoes' },
  { label: 'Horários', to: '/admin/horarios' },
  { label: 'Áreas de Atuação', to: '/admin/areas' },
  { label: 'Instituições', to: '/admin/instituicoes' },
  { label: 'Configurações', to: '/admin/configuracoes' },
]

export function AdminTabs() {
  return (
    <div className="mb-6 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      <nav className="flex min-w-max gap-1">
        {abas.map((aba) => (
          <NavLink
            key={aba.to}
            to={aba.to}
            className={({ isActive }) =>
              cn(
                // Aba: sublinhado verde quando ativa, texto cinza quando inativa.
                'relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'text-brand-700 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
              )
            }
          >
            {({ isActive }) => (
              <>
                {aba.label}
                {isActive && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-600" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
