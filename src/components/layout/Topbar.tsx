import { Bell, Menu, Moon, Sun, RefreshCw } from 'lucide-react'
import { useUI } from '@/store/ui'
import { UserMenu } from './UserMenu'

const dataHoje = new Date().toLocaleDateString('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
})

/**
 * Barra superior: data de hoje, tema claro/escuro, notificações e o menu do
 * usuário (que concentra os dados da conta e a saída da plataforma).
 */
export function Topbar() {
  const { theme, toggleTheme, setSidebarOpen } = useUI()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 lg:px-6">
      <button
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500 sm:flex dark:border-slate-700">
        <RefreshCw className="h-3.5 w-3.5" />
        <span className="capitalize">{dataHoje}</span>
      </div>

      <div className="flex-1" />

      <button
        onClick={toggleTheme}
        className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Alternar tema"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <button
        className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          3
        </span>
      </button>

      {/* Menu do usuário: dados da conta, atalhos e sair da plataforma */}
      <UserMenu />
    </header>
  )
}
