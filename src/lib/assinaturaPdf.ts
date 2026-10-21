import html2canvas from 'html2canvas'
import { PDFDocument } from 'pdf-lib'
import type { DadosAssinatura } from '@/lib/assinaturaEmail'

/**
 * Onde a assinatura entra no PDF. Tudo em FRAÇÕES da página (0..1), com a
 * origem no canto superior esquerdo — assim vale para qualquer tamanho de
 * tela/zoom e para páginas de tamanhos diferentes.
 */
export interface PosicaoAssinatura {
  /** Página, começando em 1. */
  pagina: number
  /** Canto esquerdo da assinatura, fração da LARGURA da página. */
  x: number
  /** Topo da assinatura, fração da ALTURA da página. */
  y: number
  /** Largura da assinatura, fração da largura da página. */
  largura: number
  /** true = `y` é a BASE do carimbo (ele "senta" em cima de uma linha), não o topo. */
  base?: boolean
}

/** Largura padrão de uma assinatura nova (30% da página). */
export const LARGURA_ASSINATURA_PADRAO = 0.3

/** Proporção (altura/largura) da imagem gerada — usada para desenhar a moldura antes de assinar. */
export const PROPORCAO_ASSINATURA = 0.34

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/**
 * Gera a imagem (PNG) da assinatura de documento: o "cartão" do assinante
 * (mesmos dados da assinatura de e-mail) + papel + data/hora + código.
 * Renderiza num elemento fora da tela e tira o print com html2canvas — o
 * mesmo caminho do "Baixar PNG" da assinatura de e-mail.
 */
export async function gerarImagemAssinatura(
  dados: DadosAssinatura,
  papel: 'Emprestante' | 'Pesquisador',
  quando: Date,
  codigoDocumento: string,
): Promise<{ dataUri: string; largura: number; altura: number }> {
  const dataHora = `${quando.toLocaleDateString('pt-BR')} ${quando.toLocaleTimeString('pt-BR')}`
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed; left:-10000px; top:0; z-index:-1;'
  container.innerHTML =
    `<div style="display:inline-flex; flex-direction:column; gap:6px; padding:16px 22px; background:#ffffff; ` +
    `border:2px solid #001F3E; border-radius:10px; font-family:'Public Sans', Arial, sans-serif; color:#001F3E;">` +
    `<div style="font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#475569; white-space:nowrap;">` +
    `Assinado digitalmente · ${papel}</div>` +
    `<div style="display:flex; align-items:center; gap:16px;">` +
    (dados.logoUrl ? `<img src="${escapar(dados.logoUrl)}" alt="" style="height:64px; width:auto; flex:none;" />` : '') +
    `<div style="display:flex; flex-direction:column; gap:3px;">` +
    `<div style="font-size:20px; line-height:24px; font-weight:700; white-space:nowrap;">${escapar(dados.nome)}</div>` +
    (dados.cargo ? `<div style="font-size:14px; color:#334155; white-space:nowrap;">${escapar(dados.cargo)}</div>` : '') +
    (dados.organizacao ? `<div style="font-size:14px; color:#334155; white-space:nowrap;">${escapar(dados.organizacao)}</div>` : '') +
    (dados.email ? `<div style="font-size:14px; white-space:nowrap;">${escapar(dados.email)}</div>` : '') +
    `</div></div>` +
    `<div style="font-size:12px; color:#475569; white-space:nowrap;">${dataHora} · Doc. ${escapar(codigoDocumento)}</div>` +
    `</div>`
  document.body.appendChild(container)
  try {
    const alvo = container.firstElementChild as HTMLElement
    const canvas = await html2canvas(alvo, { scale: 2, backgroundColor: null })
    return { dataUri: canvas.toDataURL('image/png'), largura: canvas.width, altura: canvas.height }
  } finally {
    container.remove()
  }
}

/** Código curto e legível do documento (8 primeiros caracteres do id, maiúsculos). */
export function codigoDoDocumento(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

/**
 * Aplica a imagem da assinatura numa página do PDF e devolve o PDF novo.
 * O PDF original NÃO é alterado (pdf-lib monta um documento novo em memória).
 */
export async function carimbarAssinatura(
  pdf: ArrayBuffer | Uint8Array,
  imagem: { dataUri: string; largura: number; altura: number },
  pos: PosicaoAssinatura,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf)
  const indice = Math.min(Math.max(Math.round(pos.pagina), 1), doc.getPageCount()) - 1
  const pagina = doc.getPage(indice)
  const { width: W, height: H } = pagina.getSize()

  const png = await doc.embedPng(imagem.dataUri)
  const largura = Math.min(pos.largura * W, W)
  const altura = largura * (imagem.altura / imagem.largura)

  // Mantém dentro da página, mesmo se a posição estiver na borda.
  const x = Math.min(Math.max(pos.x * W, 0), W - largura)
  const topoBruto = pos.base ? pos.y * H - altura : pos.y * H
  const topo = Math.min(Math.max(topoBruto, 0), H - altura)
  pagina.drawImage(png, { x, y: H - topo - altura, width: largura, height: altura })

  return doc.save()
}

/** SHA-256 em hexadecimal — impressão digital do PDF final. */
export async function hashSha256(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const copia = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes
  const digest = await crypto.subtle.digest('SHA-256', copia as ArrayBuffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Baixa bytes como arquivo no navegador. */
export function baixarArquivo(bytes: ArrayBuffer | Uint8Array, nome: string, tipo = 'application/pdf') {
  const blob = new Blob([bytes as BlobPart], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
