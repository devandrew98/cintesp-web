import { ehDispositivoMovel } from '@/lib/avisos'

/**
 * WhatsApp da "Aniversariantes do mês": mensagem direto pro aniversariante
 * (link `wa.me/<numero>`) e compartilhamento no grupo (admin, sem número —
 * a pessoa escolhe o grupo na hora).
 */

/** Normaliza um telefone BR pra link wa.me: só dígitos, sempre com código do país (55). */
export function normalizarNumeroWhatsApp(bruto?: string): string | null {
  if (!bruto) return null
  const digitos = bruto.replace(/\D/g, '')
  if (!digitos) return null
  // Já vem com código do país? (55 + DDD + 8/9 dígitos = 12 ou 13 dígitos no total)
  if (digitos.length === 12 || digitos.length === 13) return digitos
  return `55${digitos}`
}

/** Link `wa.me` pronto. Sem número, abre o WhatsApp pra escolher pra quem mandar. */
export function linkWhatsApp(numero: string | null, mensagem: string): string {
  const base = numero ? `https://wa.me/${numero}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(mensagem)}`
}

/** Mensagem padrão pro aniversariante (editável antes de enviar). */
export function mensagemPadraoAniversario(nome: string): string {
  const primeiroNome = nome.trim().split(/\s+/)[0] || nome
  return `Feliz aniversário, ${primeiroNome}! 🎉🎂 Desejamos tudo de bom nesse novo ciclo! Um abraço da equipe CINTESP.Br. 💚`
}

/** Mensagem padrão pra compartilhar no grupo (admin). */
export function mensagemPadraoGrupo(nome: string, ehHoje: boolean): string {
  const primeiroNome = nome.trim().split(/\s+/)[0] || nome
  return ehHoje
    ? `🎂🎉 Hoje é aniversário de *${nome}*! Vamos deixar uma mensagem de parabéns por aqui? 🥳`
    : `🎂 Lembrete: *${nome}* (${primeiroNome}) faz aniversário em breve — não esqueçam de parabenizar! 🎉`
}

/** Manda direto pro contato do aniversariante (link wa.me com número). */
export function enviarWhatsAppPessoa(numero: string, mensagem: string): void {
  window.open(linkWhatsApp(numero, mensagem), '_blank', 'noopener,noreferrer')
}

/**
 * Compartilha no grupo (sem contato fixo): no celular usa a Web Share API
 * (deixa a pessoa escolher o grupo certo no app do WhatsApp); no desktop
 * abre o WhatsApp Web direto com o texto pronto.
 */
export async function compartilharWhatsAppGrupo(mensagem: string): Promise<void> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (ehDispositivoMovel() && nav && typeof nav.share === 'function') {
    try {
      await nav.share({ text: mensagem })
      return
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
    }
  }
  window.open(linkWhatsApp(null, mensagem), '_blank', 'noopener,noreferrer')
}
