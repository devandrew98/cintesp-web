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
