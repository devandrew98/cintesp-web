import { supabase } from '@/lib/supabase'

/**
 * Notificações por e-mail (via Edge Function `notificar-email`, que usa o
 * Resend). Toda função aqui é "fire-and-forget": nunca lança erro — se o
 * envio falhar, só avisa no console. O fluxo principal (enviar mensagem,
 * publicar aviso) não pode quebrar por causa de um e-mail.
 */

/** URL do app (para linkar de volta no e-mail). Vazio em SSR/build. */
function appUrl(): string | undefined {
  return typeof window !== 'undefined' ? window.location.origin : undefined
}

async function invocar(tipo: string, body: Record<string, unknown>): Promise<void> {
  if (!supabase) {
    console.warn(`[email] Supabase não configurado — notificação "${tipo}" não enviada.`)
    return
  }
  const { error } = await supabase.functions.invoke('notificar-email', { body: { tipo, ...body } })
  if (error) console.warn(`[email] Falha ao notificar "${tipo}":`, error.message ?? error)
}

/** Admin (ou responsável) respondeu um chamado → avisa quem abriu. */
export async function notificarChamadoRespondido(dados: {
  destinatarioNome?: string
  destinatarioEmail?: string
  chamadoId: string
  chamadoTitulo: string
  respondenteNome?: string
  mensagem: string
}): Promise<void> {
  if (!dados.destinatarioEmail) return
  await invocar('chamado_respondido', { ...dados, appUrl: appUrl() })
}

/** Um aviso foi publicado → avisa a lista de destinatários (usuários ativos). */
export async function notificarAvisoPublicado(dados: {
  destinatarios: Array<{ nome?: string; email: string }>
  avisoTitulo: string
  avisoDescricao: string
  avisoTipo?: string
  autorNome?: string
}): Promise<void> {
  if (dados.destinatarios.length === 0) return
  await invocar('aviso_publicado', { ...dados, appUrl: appUrl() })
}

/** Dispara um e-mail de teste (usado em Administração > Configurações). */
export async function enviarEmailTeste(destinatarioEmail: string, destinatarioNome?: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado neste ambiente (modo mock).')
  const { error } = await supabase.functions.invoke('notificar-email', {
    body: { tipo: 'teste', destinatarioEmail, destinatarioNome },
  })
  if (error) throw error
}
