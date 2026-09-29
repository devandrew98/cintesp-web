import type { TipoPonto } from '@/types'

/** Rótulo amigável de cada tipo de registro. */
export const TIPO_PONTO_LABEL: Record<TipoPonto, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
}

/** Cores (badge) por tipo de registro. */
export const TIPO_PONTO_COR: Record<TipoPonto, string> = {
  entrada: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  saida: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}

/** Formata um ISO completo como "dd/mm/aaaa às HH:MM:SS". */
export function formatarDataHoraPonto(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`
}

/** Só o horário, "HH:MM:SS". */
export function formatarHoraPonto(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR')
}

/** Converte um Date local para o formato aceito por `<input type="datetime-local">`. */
export function paraDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Converte o valor de um `<input type="datetime-local">` de volta para ISO. */
export function deDatetimeLocal(valor: string): string {
  return new Date(valor).toISOString()
}
