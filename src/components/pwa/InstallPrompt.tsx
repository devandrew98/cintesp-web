import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

/**
 * Banner "Instalar app" (Fase 6 / PWA).
 * O navegador dispara `beforeinstallprompt` quando o app é instalável; guardamos
 * o evento e mostramos um banner. Ao clicar em "Instalar", chamamos `prompt()`.
 * Fica invisível se não for instalável, se já estiver instalado, ou se o usuário
 * dispensar (a escolha é lembrada em localStorage).
 */

// Tipagem mínima do evento (não faz parte do lib.dom padrão).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISPENSADO_KEY = 'cintesp:install-dismissed'

export function InstallPrompt() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISPENSADO_KEY) === '1') return

    function onBeforeInstall(e: Event) {
      e.preventDefault() // impede o mini-infobar padrão do Chrome
      setEvento(e as BeforeInstallPromptEvent)
      setVisivel(true)
    }
    function onInstalled() {
      setVisivel(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dispensar() {
    setVisivel(false)
    localStorage.setItem(DISPENSADO_KEY, '1')
  }

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    await evento.userChoice
    setVisivel(false)
    setEvento(null)
  }

  if (!visivel) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md rounded-2xl border border-brand-200 bg-white p-4 shadow-soft dark:border-brand-500/30 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Instalar o CINTESP</p>
          <p className="text-xs text-slate-500">
            Adicione o app à tela inicial para acesso rápido, mesmo offline.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={instalar}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Instalar
            </button>
            <button
              onClick={dispensar}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Agora não
            </button>
          </div>
        </div>
        <button
          onClick={dispensar}
          aria-label="Fechar"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
