import { supabase } from '@/lib/supabase'

/**
 * Notificações por e-mail (via Edge Function `notificar-email`, que entrega ao
 * Google Apps Script e este envia pelo Gmail). Toda função aqui é
 * "fire-and-forget": nunca lança erro — se o envio falhar, só avisa no
 * console. O fluxo principal (enviar mensagem, publicar aviso) não pode
 * quebrar por causa de um e-mail.
 */

/** URL do app (para linkar de volta no e-mail). Vazio em SSR/build. */
function appUrl(): string | undefined {
  return typeof window !== 'undefined' ? window.location.origin : undefined
}

/**
 * Extrai a mensagem REAL devolvida pela Edge Function.
 *
 * O supabase-js embrulha qualquer resposta não-2xx num `FunctionsHttpError`
 * cuja mensagem é sempre a mesma ("Edge Function returned a non-2xx status
 * code") — não serve para diagnosticar nada. O motivo de verdade ("GAS_URL não
 * configurada", "Segredo invalido", "cota diária do Gmail insuficiente", 404 de
 * função não implantada...) vem no corpo da resposta, guardado em `error.context`.
 */
async function detalharErro(error: unknown): Promise<string> {
  const base = error instanceof Error ? error.message : String(error)
  const contexto = (error as { context?: unknown })?.context
  if (!(contexto instanceof Response)) return base
  try {
    const corpo = await contexto.clone().json()
    const detalhe = corpo?.erro ?? corpo?.error ?? corpo?.message ?? corpo?.msg
    if (detalhe) return `${detalhe} (HTTP ${contexto.status})`
  } catch {
    const texto = await contexto.clone().text().catch(() => '')
    if (texto.trim()) return `${texto.trim().slice(0, 300)} (HTTP ${contexto.status})`
  }
  return `${base} (HTTP ${contexto.status})`
}

async function invocar(tipo: string, body: Record<string, unknown>): Promise<void> {
  if (!supabase) {
    console.warn(`[email] Supabase não configurado — notificação "${tipo}" não enviada.`)
    return
  }
  const { error } = await supabase.functions.invoke('notificar-email', { body: { tipo, ...body } })
  if (error) console.warn(`[email] Falha ao notificar "${tipo}":`, await detalharErro(error))
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

/** O que a função devolve depois de mandar (ou tentar mandar) os e-mails. */
export interface ResultadoEnvio {
  enviados?: number
  falhas?: Array<{ email: string; erro: string }>
  /** Quantos envios ainda cabem HOJE na cota do Gmail da conta remetente. */
  cotaRestante?: number
}

/** Dispara um e-mail de teste (usado em Administração > Configurações). */
export async function enviarEmailTeste(
  destinatarioEmail: string,
  destinatarioNome?: string,
): Promise<ResultadoEnvio> {
  if (!supabase) throw new Error('Supabase não configurado neste ambiente (modo mock).')
  const { data, error } = await supabase.functions.invoke('notificar-email', {
    body: { tipo: 'teste', destinatarioEmail, destinatarioNome },
  })
  if (error) throw new Error(await detalharErro(error))
  return (data ?? {}) as ResultadoEnvio
}
