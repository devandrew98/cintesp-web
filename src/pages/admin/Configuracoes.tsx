import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Moon, Sun, Bell, Mail, CalendarClock, Info, Database, Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useUI } from '@/store/ui'
import { USE_MOCK } from '@/lib/supabase'
import { enviarEmailTeste } from '@/lib/email'
import { usePermissoes } from '@/hooks/usePermissoes'
import { mensagemErro, cn } from '@/lib/utils'

/** Versão do app exibida em "Sobre" (mantida em sincronia com o ROADMAP). */
const VERSAO = 'v1.2.0'

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

  // Teste do envio real de e-mail (Edge Function `notificar-email` + Resend).
  // Por padrão manda para o e-mail do ADMIN logado — quem está testando recebe.
  // `null` = "ainda não digitou nada"; ao digitar, o valor do campo manda.
  const { perfil } = usePermissoes()
  const [emailTeste, setEmailTeste] = useState<string | null>(null)
  const destinoTeste = emailTeste ?? perfil?.email ?? ''
  const testeEmail = useMutation({
    mutationFn: () => enviarEmailTeste(destinoTeste.trim(), perfil?.nome),
  })

  // Lê do supabase.ts (que considera as variáveis injetadas em runtime).
  const usandoMock = USE_MOCK

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

        {/* Envio real de e-mail — testa a Edge Function `notificar-email` (Apps Script) */}
        <Secao
          titulo="Envio de e-mail"
          descricao='Dispara um e-mail de teste pela mesma função usada para avisar "chamado respondido" e "aviso publicado".'
        >
          <div className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Enviar e-mail de teste para
              </label>
              <Input
                type="email"
                value={destinoTeste}
                onChange={(e) => setEmailTeste(e.target.value)}
                placeholder="voce@exemplo.com"
              />
              <p className="mt-1 text-xs text-slate-500">
                Já vem com o e-mail do administrador logado. Pode trocar por outro endereço.
              </p>
            </div>
            <Button
              icon={testeEmail.isPending ? undefined : Send}
              disabled={testeEmail.isPending || !destinoTeste.trim()}
              onClick={() => testeEmail.mutate()}
              className="shrink-0"
            >
              {testeEmail.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                'Enviar teste'
              )}
            </Button>
          </div>

          {testeEmail.isSuccess && (
            <p className="flex items-start gap-1.5 pb-3.5 text-sm text-brand-700 dark:text-brand-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                E-mail enviado! Confira a caixa de entrada (e o spam) de {destinoTeste}.
                {typeof testeEmail.data?.cotaRestante === 'number' && (
                  <>
                    {' '}
                    Ainda cabem <strong>{testeEmail.data.cotaRestante}</strong> envios hoje.
                  </>
                )}
              </span>
            </p>
          )}
          {testeEmail.isError && (
            <p className="flex items-start gap-1.5 pb-3.5 text-sm text-red-600 dark:text-red-400">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Falha ao enviar: {mensagemErro(testeEmail.error)} — confira se a Edge Function{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">notificar-email</code> está implantada, se
                os secrets <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GAS_URL</code> e{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GAS_SEGREDO</code> foram configurados e se
                o web app do Apps Script está publicado para "Qualquer pessoa" (veja{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">docs/notificacoes-email.md</code>).
              </span>
            </p>
          )}
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
    <div className="flex min-h-[3.5rem] items-center justify-between gap-4 py-3.5">
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
        // inline-flex + align-middle evita o deslocamento por linha de base que
        // fazia os interruptores parecerem desalinhados entre si.
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full align-middle transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        ativo ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700',
      )}
    >
      <span
        className={cn(
          'h-5 w-5 rounded-full bg-white shadow transition-transform',
          ativo ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
