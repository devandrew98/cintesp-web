import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Clock, Settings, Loader2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/store/auth'
import { usePermissoes } from '@/hooks/usePermissoes'
import { cn } from '@/lib/utils'

/**
 * Menu do usuário na barra superior.
 *
 * Clicar no nome/foto abre um menu com os dados de quem está logado, atalhos
 * e a opção de **sair da plataforma** (encerra a sessão e volta para /login).
 *
 * Fecha sozinho ao clicar fora, apertar Esc ou mudar de página.
 */
export function UserMenu() {
  const { session, sair } = useAuth()
  const { perfil, ehAdmin } = usePermissoes()
  const navegar = useNavigate()
  const localizacao = useLocation()

  const [aberto, setAberto] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const caixaRef = useRef<HTMLDivElement>(null)

  const nome = perfil?.nome ?? session?.user.email ?? 'Usuário'
  const papel = perfil?.funcao?.nome ?? (session ? 'Conectado' : '—')
  const email = perfil?.email ?? session?.user.email

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!aberto) return
    function aoClicarFora(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false)
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  // Fecha ao navegar para outra página.
  useEffect(() => setAberto(false), [localizacao.pathname])

  /** Encerra a sessão e leva para a tela de login. */
  async function sairDaPlataforma() {
    setSaindo(true)
    try {
      await sair()
    } finally {
      setSaindo(false)
      setAberto(false)
      // replace: evita voltar para dentro do app pelo botão "voltar" do navegador.
      navegar('/login', { replace: true })
    }
  }

  return (
    <div className="relative" ref={caixaRef}>
      {/* Botão que abre o menu */}
      <button
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={cn(
          'flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-2 transition-colors',
          aberto
            ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
        )}
      >
        <Avatar nome={nome} fotoUrl={perfil?.fotoUrl} size="sm" />
        <div className="hidden max-w-[160px] text-left leading-tight sm:block">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{nome}</p>
          <p className="truncate text-[11px] text-slate-400">{papel}</p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            aberto && 'rotate-180',
          )}
        />
      </button>

      {/* Menu suspenso */}
      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Cabeçalho com os dados de quem está logado */}
          <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <Avatar nome={nome} fotoUrl={perfil?.fotoUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {nome}
              </p>
              {email && <p className="truncate text-xs text-slate-400">{email}</p>}
              <span className="mt-1 inline-block rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {papel}
              </span>
            </div>
          </div>

          {/* Atalhos */}
          <div className="p-1.5">
            <Link
              to="/meu-horario"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Clock className="h-4 w-4 text-slate-400" />
              Meu Horário
            </Link>
            {/* Configurações fica na Administração: só admin enxerga */}
            {ehAdmin && (
              <Link
                to="/admin/configuracoes"
                role="menuitem"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                Configurações
              </Link>
            )}
          </div>

          {/* Sair */}
          <div className="border-t border-slate-100 p-1.5 dark:border-slate-800">
            <button
              onClick={sairDaPlataforma}
              disabled={saindo}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              {saindo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {saindo ? 'Saindo...' : 'Sair da plataforma'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
