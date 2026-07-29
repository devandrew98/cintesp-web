import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Megaphone, ArrowRight } from 'lucide-react'
import { listarAvisos } from '@/data/api'
import { tipoAvisoInfo } from '@/lib/avisos'
import { cn, formatDateBR } from '@/lib/utils'

/** Quantos dias um aviso conta como "novidade" no sino. */
const DIAS_RECENTES = 7

/**
 * Sino de notificações da barra superior.
 *
 * Antes era um número fixo que não abria nada. Agora mostra os avisos
 * publicados nos últimos dias e leva para a tela de Avisos.
 *
 * Os avisos já vistos ficam guardados no próprio navegador (localStorage),
 * então o contador zera depois que a pessoa abre o sino — sem precisar de
 * uma tabela de "lidos" no banco.
 */
const CHAVE_VISTOS = 'cintesp:avisos-vistos'

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

  const { data: avisos = [] } = useQuery({ queryKey: ['avisos'], queryFn: listarAvisos })

  // Avisos ativos e recentes, do mais novo para o mais antigo.
  const recentes = useMemo(() => {
    const limite = Date.now() - DIAS_RECENTES * 24 * 60 * 60 * 1000
    return avisos
      .filter((a) => a.status === 'ativo' && new Date(a.data).getTime() >= limite)
      .sort((a, b) => +new Date(b.data) - +new Date(a.data))
      .slice(0, 6)
  }, [avisos])

  // O contador mostra só o que ainda não foi visto.
  const naoVistos = recentes.filter((a) => !vistos.includes(a.id))

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

  useEffect(() => setAberto(false), [localizacao.pathname])

  /** Ao abrir, marca os recentes como vistos (zera o contador). */
  function alternar() {
    const abrindo = !aberto
    setAberto(abrindo)
    if (abrindo && naoVistos.length > 0) {
      const novos = [...new Set([...vistos, ...recentes.map((a) => a.id)])]
      setVistos(novos)
      localStorage.setItem(CHAVE_VISTOS, JSON.stringify(novos.slice(-100)))
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
            <p className="text-xs text-slate-400">
              Avisos publicados nos últimos {DIAS_RECENTES} dias
            </p>
          </header>

          {recentes.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Nenhum aviso recente por aqui.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {recentes.map((a) => {
                const info = tipoAvisoInfo[a.tipo]
                const Icone = info.icon
                return (
                  <li key={a.id}>
                    <Link
                      to="/avisos"
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          info.iconBox,
                        )}
                      >
                        <Icone className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {a.titulo}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {a.publicadoHa ?? formatDateBR(a.data)}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <Link
            to="/avisos"
            className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-3 text-sm font-medium text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
          >
            <Megaphone className="h-4 w-4" />
            Ver todos os avisos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
