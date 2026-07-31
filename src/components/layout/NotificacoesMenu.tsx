import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Megaphone, ArrowRight, Headphones, type LucideIcon } from 'lucide-react'
import { listarAvisos } from '@/data/api'
import { listarChamados } from '@/data/chamados'
import { tipoAvisoInfo } from '@/lib/avisos'
import { usePermissoes } from '@/hooks/usePermissoes'
import { cn, formatDateBR } from '@/lib/utils'

/** Quantos dias uma novidade conta no sino. */
const DIAS_RECENTES = 7
const CHAVE_VISTOS = 'cintesp:notificacoes-vistas'

interface Notif {
  id: string
  titulo: string
  sub: string
  to: string
  quando: number
  icon: LucideIcon
  box: string
}

/**
 * Sino de notificações da barra superior.
 *
 * Mostra:
 *   • avisos publicados nos últimos dias (todos);
 *   • ADMIN: novos chamados abertos;
 *   • USUÁRIO: quando o seu chamado é aceito ("em andamento").
 *
 * O que já foi visto fica no navegador (localStorage) — o contador zera ao abrir.
 */
export function NotificacoesMenu() {
  const [aberto, setAberto] = useState(false)
  const [vistos, setVistos] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_VISTOS) ?? '[]')
    } catch {
      return []
    }
  })
  const caixaRef = useRef<HTMLDivElement>(null)
  const localizacao = useLocation()
  const { ehAdmin } = usePermissoes()

  const { data: avisos = [] } = useQuery({ queryKey: ['avisos'], queryFn: listarAvisos })
  const { data: chamados = [] } = useQuery({ queryKey: ['chamados'], queryFn: listarChamados })

  const notificacoes = useMemo<Notif[]>(() => {
    const limite = Date.now() - DIAS_RECENTES * 24 * 60 * 60 * 1000
    const itens: Notif[] = []

    // Avisos recentes
    for (const a of avisos) {
      const t = new Date(a.data).getTime()
      if (a.status !== 'ativo' || t < limite) continue
      const info = tipoAvisoInfo[a.tipo]
      itens.push({ id: `av-${a.id}`, titulo: a.titulo, sub: a.publicoAlvo, to: '/avisos', quando: t, icon: info.icon, box: info.iconBox })
    }

    // Chamados
    for (const c of chamados) {
      if (ehAdmin && c.status === 'aberto') {
        const t = new Date(c.criadoEm).getTime()
        if (t < limite) continue
        itens.push({
          id: `ch-${c.id}-aberto`,
          titulo: 'Novo chamado',
          sub: `${c.titulo} — ${c.solicitanteNome ?? ''}`,
          to: '/admin/chamados',
          quando: t,
          icon: Headphones,
          box: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
        })
      }
      if (!ehAdmin && c.status === 'em_andamento') {
        const t = new Date(c.atualizadoEm ?? c.criadoEm).getTime()
        if (t < limite) continue
        itens.push({
          id: `ch-${c.id}-aceito`,
          titulo: 'Chamado aceito',
          sub: `${c.titulo}${c.responsavelNome ? ` — por ${c.responsavelNome}` : ''}`,
          to: '/abrir-chamado',
          quando: t,
          icon: Headphones,
          box: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
        })
      }
    }

    return itens.sort((a, b) => b.quando - a.quando).slice(0, 10)
  }, [avisos, chamados, ehAdmin])

  const naoVistos = notificacoes.filter((n) => !vistos.includes(n.id))

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

  useEffect(() => setAberto(false), [localizacao.pathname])

  function alternar() {
    const abrindo = !aberto
    setAberto(abrindo)
    if (abrindo && naoVistos.length > 0) {
      const novos = [...new Set([...vistos, ...notificacoes.map((n) => n.id)])]
      setVistos(novos)
      localStorage.setItem(CHAVE_VISTOS, JSON.stringify(novos.slice(-150)))
    }
  }

  return (
    <div className="relative" ref={caixaRef}>
      <button
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Notificações${naoVistos.length ? ` (${naoVistos.length} novas)` : ''}`}
        className={cn(
          'relative rounded-xl p-2.5 transition-colors',
          aberto
            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
        )}
      >
        <Bell className="h-5 w-5" />
        {naoVistos.length > 0 && (
          <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {naoVistos.length}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-900"
        >
          <header className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notificações</p>
            <p className="text-xs text-slate-400">Avisos e chamados recentes</p>
          </header>

          {notificacoes.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Nada novo por aqui.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {notificacoes.map((n) => {
                const Icone = n.icon
                return (
                  <li key={n.id}>
                    <Link
                      to={n.to}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.box)}>
                        <Icone className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {n.titulo}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {n.sub} · {formatDateBR(new Date(n.quando).toISOString())}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <Link
            to={ehAdmin ? '/admin/chamados' : '/avisos'}
            className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-3 text-sm font-medium text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
          >
            <Megaphone className="h-4 w-4" />
            {ehAdmin ? 'Ver chamados' : 'Ver avisos'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
