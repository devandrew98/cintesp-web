import { Bell, Menu, Moon, Sun, RefreshCw, ChevronDown, LogOut } from 'lucide-react'
import { useUI } from '@/store/ui'
import { useAuth } from '@/store/auth'
import { Avatar } from '@/components/ui/Avatar'
import { usuarios } from '@/data/mock'

const dataHoje = new Date().toLocaleDateString('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
})

export function Topbar() {
  const { theme, toggleTheme, setSidebarOpen } = useUI()
  const { session, sair } = useAuth()
  const usuarioMock = usuarios.find((u) => u.funcao.nome === 'Administrador') ?? usuarios[0]

  // Quando há login real, mostra o e-mail da sessão; senão, o usuário mock.
  const nomeExibido = session?.user.email ?? usuarioMock.nome
  const papelExibido = session ? 'Conectado' : usuarioMock.funcao.nome

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

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 py-1.5 pl-1.5 pr-2 dark:border-slate-700">
        <Avatar nome={nomeExibido} size="sm" />
        <div className="hidden max-w-[160px] text-left leading-tight sm:block">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {nomeExibido}
          </p>
          <p className="text-[11px] text-slate-400">{papelExibido}</p>
        </div>
        {session ? (
          <button
            onClick={() => sair()}
            title="Sair"
            aria-label="Sair"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </div>
    </header>
  )
}
