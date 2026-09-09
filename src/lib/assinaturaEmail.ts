/**
 * Geração da assinatura de e-mail — HTML 100% baseado em tabelas, com
 * estilos inline, para ficar compatível com Gmail/Outlook (que ignoram ou
 * cortam <style> e boa parte do CSS moderno).
 */

export interface DadosAssinatura {
  logoUrl: string
  nome: string
  cargo: string
  organizacao: string
  email: string
}

/** Campos obrigatórios pra gerar uma assinatura válida. */
export type CampoAssinatura = 'nome' | 'cargo' | 'organizacao' | 'email'

const AZUL_CORPORATIVO = '#001F3E'
const CINZA_SECUNDARIO = '#334155'
const FONTE = "Arial, 'Public Sans', Helvetica, sans-serif"

/** URL absoluta da logo padrão (precisa ser http(s) — e-mail não aceita caminho relativo). */
export function logoPadraoUrl(): string {
  const origem = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origem}/logo-cintesp-assinatura.png`
}

export function valoresPadraoAssinatura(): DadosAssinatura {
  return {
    logoUrl: logoPadraoUrl(),
    nome: '',
    cargo: '',
    organizacao: 'Centro Brasileiro de Referência em Inovação Tecnológica Assistiva',
    email: '',
  }
}

/** Quais campos obrigatórios estão vazios. */
export function validarAssinatura(d: DadosAssinatura): CampoAssinatura[] {
  const campos: CampoAssinatura[] = []
  if (!d.nome.trim()) campos.push('nome')
  if (!d.cargo.trim()) campos.push('cargo')
  if (!d.organizacao.trim()) campos.push('organizacao')
  if (!d.email.trim()) campos.push('email')
  return campos
}

function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Monta o HTML da assinatura (tabelas + estilo inline, pronto pra colar num cliente de e-mail). */
export function gerarHtmlAssinatura(d: DadosAssinatura): string {
  const nome = escaparHtml(d.nome.trim())
  const cargo = escaparHtml(d.cargo.trim())
  const organizacao = escaparHtml(d.organizacao.trim())
  const email = d.email.trim()
  const emailTexto = escaparHtml(email)
  const logoUrl = escaparHtml(d.logoUrl.trim() || logoPadraoUrl())

  return (
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-family:${FONTE};">` +
    `<tr>` +
    `<td valign="middle" style="padding:0;">` +
    `<img src="${logoUrl}" alt="${organizacao || 'CINTESP.Br'}" width="110" style="display:block; width:110px; max-width:110px; border:0; outline:none; text-decoration:none;" />` +
    `</td>` +
    `<td width="20" style="padding:0; font-size:1px; line-height:1px;">&nbsp;</td>` +
    `<td valign="middle" style="padding:0; border-left:2px solid #E2E8F0; padding-left:20px;">` +
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0">` +
    `<tr><td style="font-family:${FONTE}; font-size:16px; line-height:20px; font-weight:bold; color:${AZUL_CORPORATIVO}; padding:0 0 3px 0;">${nome}</td></tr>` +
    `<tr><td style="font-family:${FONTE}; font-size:13px; line-height:18px; color:${CINZA_SECUNDARIO}; padding:0 0 7px 0;">${cargo}</td></tr>` +
    `<tr><td style="font-family:${FONTE}; font-size:13px; line-height:18px; color:${CINZA_SECUNDARIO}; padding:0 0 5px 0;">${organizacao}</td></tr>` +
    `<tr><td style="font-family:${FONTE}; font-size:13px; line-height:18px;"><a href="mailto:${email}" style="color:${AZUL_CORPORATIVO}; text-decoration:none;">${emailTexto}</a></td></tr>` +
    `</table>` +
    `</td>` +
    `</tr>` +
    `</table>`
  )
}

/** Versão em texto puro (fallback do clipboard e de clientes sem HTML). */
export function gerarTextoAssinatura(d: DadosAssinatura): string {
  return [d.nome, d.cargo, d.organizacao, d.email].filter(Boolean).join('\n')
}
