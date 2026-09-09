/**
 * Geração da assinatura de e-mail — HTML 100% baseado em tabelas, com
 * estilos inline, para ficar compatível com Gmail/Outlook (que ignoram ou
 * cortam <style> e boa parte do CSS moderno).
 *
 * A logo SEMPRE vai embutida como data URI (base64) dentro do próprio HTML
 * — nunca como link externo. Um `<img src="https://...">` só aparece pro
 * destinatário se o servidor que hospeda a imagem estiver de pé E o
 * cliente de e-mail permitir carregar imagem externa; o Outlook, em
 * particular, costuma bloquear isso por padrão. Com a imagem embutida, a
 * assinatura funciona sempre, em qualquer cliente.
 */

export interface DadosAssinatura {
  /** Sempre uma data URI (data:image/...;base64,...) depois de carregada. */
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
const FONTE = "'Public Sans', Arial, Helvetica, sans-serif"

/** Caminho (no /public) do arquivo da logo padrão do CINTESP.Br. */
export const LOGO_PADRAO_CAMINHO = '/logo-cintesp-assinatura.png'

export function valoresPadraoAssinatura(): DadosAssinatura {
  return {
    logoUrl: LOGO_PADRAO_CAMINHO,
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

/** Converte um Blob/File em data URI (base64), para embutir a imagem no HTML. */
export function blobParaDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(leitor.result as string)
    leitor.onerror = () => reject(leitor.error ?? new Error('Falha ao ler o arquivo.'))
    leitor.readAsDataURL(blob)
  })
}

/** Busca uma URL (mesma origem) e devolve como data URI. Usado pra embutir a logo padrão. */
export async function urlParaDataUri(url: string): Promise<string> {
  const resposta = await fetch(url)
  if (!resposta.ok) throw new Error(`Não foi possível carregar "${url}" (HTTP ${resposta.status}).`)
  const blob = await resposta.blob()
  return blobParaDataUri(blob)
}

/** Monta o HTML da assinatura (tabelas + estilo inline, pronto pra colar num cliente de e-mail). */
export function gerarHtmlAssinatura(d: DadosAssinatura): string {
  const nome = escaparHtml(d.nome.trim())
  const cargo = escaparHtml(d.cargo.trim())
  const organizacao = escaparHtml(d.organizacao.trim())
  const email = d.email.trim()
  const emailTexto = escaparHtml(email)
  const logoUrl = escaparHtml(d.logoUrl.trim() || LOGO_PADRAO_CAMINHO)

  return (
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-family:${FONTE};">` +
    `<tr>` +
    `<td valign="middle" style="padding:0;">` +
    `<img src="${logoUrl}" alt="${organizacao || 'CINTESP.Br'}" width="110" style="display:block; width:110px; max-width:110px; border:0; outline:none; text-decoration:none;" />` +
    `</td>` +
    `<td width="24" style="padding:0; font-size:1px; line-height:1px;">&nbsp;</td>` +
    `<td valign="middle" style="padding:0;">` +
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

export const PNG_ASSINATURA_LARGURA = 380
export const PNG_ASSINATURA_ALTURA = 75

/**
 * HTML compacto (flexbox, não precisa ser compatível com e-mail) usado só
 * pra tirar o "print" da assinatura em PNG, no tamanho exato exigido
 * (380×75). Como a altura é bem menor que a versão normal, o layout aqui é
 * mais apertado e não usa exatamente o mesmo espaçamento da tabela de e-mail.
 */
export function gerarHtmlAssinaturaCompacta(d: DadosAssinatura): string {
  const nome = escaparHtml(d.nome.trim())
  const cargo = escaparHtml(d.cargo.trim())
  const emailTexto = escaparHtml(d.email.trim())
  const logoUrl = escaparHtml(d.logoUrl.trim() || LOGO_PADRAO_CAMINHO)

  // Só 3 linhas aqui (sem a organização): em 75px de altura, o nome completo
  // "Centro Brasileiro de..." quebra em 2 linhas e fica apertado — e a
  // logo já mostra "CINTESP.Br" + a tagline, então repetir o nome por
  // extenso é redundante nesse formato compacto.
  return (
    `<div style="box-sizing:border-box; width:${PNG_ASSINATURA_LARGURA}px; height:${PNG_ASSINATURA_ALTURA}px; overflow:hidden; ` +
    `display:flex; align-items:center; gap:14px; padding:8px 12px; background:#ffffff; font-family:${FONTE};">` +
    `<img src="${logoUrl}" alt="" style="height:58px; width:auto; max-width:95px; flex:none; object-fit:contain;" />` +
    `<div style="min-width:0; display:flex; flex-direction:column; justify-content:center; gap:3px;">` +
    `<div style="font-size:15px; line-height:17px; font-weight:700; color:${AZUL_CORPORATIVO}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${nome}</div>` +
    `<div style="font-size:11px; line-height:13px; color:${CINZA_SECUNDARIO}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cargo}</div>` +
    `<div style="font-size:11px; line-height:13px; color:${AZUL_CORPORATIVO};">${emailTexto}</div>` +
    `</div>` +
    `</div>`
  )
}
