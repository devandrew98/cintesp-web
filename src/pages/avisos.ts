import { AlertTriangle, CalendarDays, GraduationCap, Megaphone, type LucideIcon } from 'lucide-react'
import type { StatusAviso, TipoAviso } from '@/types'

type Tone = 'green' | 'amber' | 'blue' | 'violet' | 'slate'

export const tipoAvisoInfo: Record<
  TipoAviso,
  { label: string; icon: LucideIcon; tone: Tone; pill: string; iconBox: string }
> = {
  importante: {
    label: 'Importante',
    icon: AlertTriangle,
    tone: 'green',
    pill: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
    iconBox: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  },
  reuniao: {
    label: 'Reunião',
    icon: CalendarDays,
    tone: 'amber',
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    iconBox: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  },
  treinamento: {
    label: 'Treinamento',
    icon: GraduationCap,
    tone: 'blue',
    pill: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    iconBox: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  },
  geral: {
    label: 'Geral',
    icon: Megaphone,
    tone: 'violet',
    pill: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    iconBox: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  },
}

export const statusAvisoInfo: Record<StatusAviso, { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'green' },
  programado: { label: 'Programado', tone: 'amber' },
  arquivado: { label: 'Arquivado', tone: 'slate' },
}

/**
 * Opções prontas de público-alvo, para o admin não precisar digitar.
 * "Outro" libera um campo livre (ex.: uma área específica ou um local).
 */
export const PUBLICOS_ALVO = [
  'Todos',
  'Pesquisadores',
  'Administradores',
  'Coordenação',
] as const

/** Valor especial que, no seletor, libera o campo de texto livre. */
export const PUBLICO_OUTRO = '__outro__'

interface AvisoCompartilhavel {
  titulo: string
  descricao: string
  data: string
  hora?: string
  publicoAlvo?: string
}

/** Monta o TEXTO do aviso (com emojis e link inline) para o WhatsApp. */
export function textoWhatsApp(aviso: AvisoCompartilhavel): string {
  const quando = new Date(aviso.data).toLocaleDateString('pt-BR')
  const linhas = [
    `*${aviso.titulo}*`,
    '',
    aviso.descricao,
    '',
    `📅 ${quando}${aviso.hora ? ` às ${aviso.hora}` : ''}`,
    aviso.publicoAlvo ? `👥 ${aviso.publicoAlvo}` : '',
    '',
    '_CINTESP — Quadro de Pesquisadores_',
  ].filter(Boolean)
  return linhas.join('\n')
}

/** Link `wa.me` (usado como fallback quando não há Web Share). */
export function linkWhatsApp(aviso: AvisoCompartilhavel): string {
  return `https://wa.me/?text=${encodeURIComponent(textoWhatsApp(aviso))}`
}

/** Está num celular/tablet? (decide como compartilhar) */
function ehDispositivoMovel(): boolean {
  if (typeof navigator === 'undefined') return false
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uaData && typeof uaData.mobile === 'boolean') return uaData.mobile
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

/**
 * Compartilha o aviso no WhatsApp.
 *
 *   • CELULAR: usa a Web Share API (navigator.share) com o texto COMPLETO —
 *     assim o WhatsApp recebe tudo (emojis + link), sem "engolir" o texto.
 *   • DESKTOP: vai DIRETO pro WhatsApp (wa.me / WhatsApp Web), sem abrir a
 *     bandeja de compartilhamento do Windows.
 */
export async function compartilharWhatsApp(aviso: AvisoCompartilhavel): Promise<void> {
  const texto = textoWhatsApp(aviso)
  const nav = typeof navigator !== 'undefined' ? navigator : undefined

  if (ehDispositivoMovel() && nav && typeof nav.share === 'function') {
    try {
      await nav.share({ text: texto })
      return
    } catch (e) {
      // Usuário cancelou → não faz nada. Outro erro → cai para o link.
      if ((e as { name?: string })?.name === 'AbortError') return
    }
  }

  // Desktop (ou sem Web Share): abre o WhatsApp Web direto.
  window.open(linkWhatsApp(aviso), '_blank', 'noopener,noreferrer')
}
