import { useState, type ReactNode } from 'react'
import { Moon, Sun, Bell, Mail, CalendarClock, Info, Database } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { useUI } from '@/store/ui'
import { cn } from '@/lib/utils'

/** Versão do app exibida em "Sobre" (mantida em sincronia com o ROADMAP). */
const VERSAO = 'v0.6.0'

/**
 * Tela "Administração > Configurações" (Fase 6).
 * Aparência (tema claro/escuro, já persistido no `useUI`), preferências de
 * notificação (mock) e informações "Sobre" o app.
 */
export function AdminConfiguracoesPage() {
  const { theme, toggleTheme } = useUI()

  // Preferências de notificação — em mock ficam só no estado local.
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(false)
  const [notifTurno, setNotifTurno] = useState(true)

  const usandoMock = import.meta.env.VITE_USE_MOCK !== 'false'

  return (
    <AdminShell>
      <div className="max-w-3xl space-y-6">
        {/* Aparência */}
        <Secao titulo="Aparência" descricao="Personalize a aparência do sistema.">
          <LinhaConfig
            icone={theme === 'dark' ? Moon : Sun}
            titulo="Tema escuro"
            descricao="Alterna entre o tema claro e escuro (fica salvo neste dispositivo)."
          >
            <Toggle ativo={theme === 'dark'} onChange={toggleTheme} />
          </LinhaConfig>
        </Secao>

        {/* Notificações */}
        <Secao titulo="Notificações" descricao="Escolha como quer ser avisado.">
          <LinhaConfig icone={Mail} titulo="Avisos por e-mail" descricao="Receber novos avisos no e-mail.">
            <Toggle ativo={notifEmail} onChange={() => setNotifEmail((v) => !v)} />
          </LinhaConfig>
          <LinhaConfig icone={Bell} titulo="Notificações push" descricao="Alertas no navegador/celular.">
            <Toggle ativo={notifPush} onChange={() => setNotifPush((v) => !v)} />
          </LinhaConfig>
          <LinhaConfig
            icone={CalendarClock}
            titulo="Mudanças de turno"
            descricao="Avisar quando alguém muda de turno ou fica ausente."
          >
            <Toggle ativo={notifTurno} onChange={() => setNotifTurno((v) => !v)} />
          </LinhaConfig>
        </Secao>

        {/* Sobre */}
        <Secao titulo="Sobre" descricao="Informações do sistema.">
          <LinhaConfig icone={Info} titulo="Versão" descricao="Versão atual do CINTESP Web.">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {VERSAO}
            </span>
          </LinhaConfig>
          <LinhaConfig
            icone={Database}
            titulo="Fonte de dados"
            descricao="De onde o app está lendo os dados agora."
          >
            <span
              className={cn(
                'rounded-lg px-2.5 py-1 text-sm font-medium',
                usandoMock
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
              )}
            >
              {usandoMock ? 'Dados de exemplo (mock)' : 'Supabase (banco real)'}
            </span>
          </LinhaConfig>
        </Secao>
      </div>
    </AdminShell>
  )
}

/* ---------- Blocos de UI reutilizados nesta tela ---------- */

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao: string
  children: ReactNode
}) {
  return (
    <section className="card p-5">
      <div className="mb-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">{titulo}</h3>
        <p className="text-sm text-slate-500">{descricao}</p>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
    </section>
  )
}

function LinhaConfig({
  icone: Icone,
  titulo,
  descricao,
  children,
}: {
  icone: typeof Bell
  titulo: string
  descricao: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <Icone className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{titulo}</p>
          <p className="text-xs text-slate-500">{descricao}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** Interruptor liga/desliga reutilizável. */
function Toggle({ ativo, onChange }: { ativo: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={ativo}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        ativo ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          ativo ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
