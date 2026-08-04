import { clsx, type ClassValue } from 'clsx'

/** Concatena classes condicionalmente (wrapper simples de clsx). */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Iniciais a partir do nome (ex.: "João Silva" -> "JS"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Gera uma cor estável (para avatar) a partir de uma string. */
export function colorFromString(str: string): string {
  const palette = [
    '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#ef4444', '#6366f1', '#14b8a6',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

/** Formata data ISO para "dd/MM/yyyy". */
export function formatDateBR(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

/**
 * Formata uma data "yyyy-mm-dd" (SEM hora) como "dd/mm/yyyy".
 * Faz na mão para não cair no fuso: `new Date('1990-05-15')` viraria
 * 14/05 no Brasil (UTC-3). Use para data de nascimento e afins.
 */
export function formatDateOnlyBR(iso?: string): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}/${ano}`
}

/**
 * Extrai uma mensagem legível de qualquer erro.
 * Erros do Supabase/PostgREST são OBJETOS (não `Error`), com `message`,
 * `details`, `hint` e `code` — se você fizer `String(e)` neles, sai
 * "[object Object]". Este helper junta o que houver de útil.
 */
export function mensagemErro(e: unknown): string {
  if (!e) return 'Erro desconhecido.'
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>
    const partes = [o.message, o.details, o.hint].filter(Boolean).map(String)
    if (partes.length) return partes.join(' — ')
    try {
      return JSON.stringify(e)
    } catch {
      return 'Erro desconhecido.'
    }
  }
  return String(e)
}
