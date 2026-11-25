/**
 * Assinatura de e-mail da SisLAB (Laboratório Integrador). Diferente da do CINTESP.Br, o modelo
 * tem fundo estampado e fontes próprias, que o e-mail não reproduz em HTML — então a assinatura
 * é UMA imagem: a arte oficial (fundo, logo e divisória) com os textos desenhados por cima.
 * Medidas na unidade do arquivo original (SISLAB_ASSINATURA_EMAIL.ai): 400 × 100.
 */

export interface DadosSislab {
  nome: string
  cargo: string
  /** Opcional. Ex.: "Pesquisadora Finep - SisAssistiva/MCTI". */
  vinculo: string
  laboratorio: string
  email: string
}

export type CampoSislab = Exclude<keyof DadosSislab, 'vinculo'>

export const LARGURA_SISLAB = 400
export const ALTURA_SISLAB = 100

const X_TEXTO = 193.8
const LARGURA_TEXTO = 196
const COR = '#2b4563'
const BASE = '/sislab-assinatura-base.png'
const FONTES = [
  { familia: 'SisLAB Inter', peso: '700', url: '/fontes/Inter-Bold.ttf' },
  { familia: 'SisLAB Roboto', peso: '400', url: '/fontes/Roboto-Regular.ttf' },
  { familia: 'SisLAB Roboto', peso: '500', url: '/fontes/Roboto-Medium.ttf' },
]

export const valoresPadraoSislab = (): DadosSislab => ({
  nome: '',
  cargo: '',
  vinculo: '',
  laboratorio: 'Laboratório Integrador SEDES/MCTI-UFU',
  email: '',
})

export function validarSislab(d: DadosSislab): CampoSislab[] {
  return (['nome', 'cargo', 'laboratorio', 'email'] as const).filter((c) => !d[c].trim())
}

export interface LinhaSislab {
  texto: string
  /** Linha de base, na unidade do modelo. */
  y: number
  tamanho: number
  peso: '400' | '500' | '700'
  familia: 'SisLAB Inter' | 'SisLAB Roboto'
}

/** Linhas de texto nas posições do modelo. Sem vínculo, o espaço dele fica vazio (como no original). */
export function linhasSislab(d: DadosSislab): LinhaSislab[] {
  const roboto = 'SisLAB Roboto' as const
  const linhas: LinhaSislab[] = [
    { texto: d.nome.trim().toLocaleUpperCase('pt-BR'), y: 26.8, tamanho: 14, peso: '700', familia: 'SisLAB Inter' },
    { texto: d.cargo.trim(), y: 39.3, tamanho: 9.5, peso: '500', familia: roboto },
    { texto: d.vinculo.trim(), y: 59.7, tamanho: 9, peso: '400', familia: roboto },
    { texto: d.laboratorio.trim(), y: 71.8, tamanho: 9, peso: '400', familia: roboto },
    { texto: d.email.trim(), y: 84, tamanho: 9, peso: '400', familia: roboto },
  ]
  return linhas.filter((l) => l.texto)
}

/** Reduz a fonte de um texto longo para caber, em vez de cortar. */
export const tamanhoQueCabe = (tamanho: number, larguraMedida: number, larguraMaxima = LARGURA_TEXTO): number =>
  larguraMedida > larguraMaxima ? (tamanho * larguraMaxima) / larguraMedida : tamanho

let fontesProntas: Promise<unknown> | null = null
function carregarFontes() {
  fontesProntas ??= Promise.all(
    FONTES.map(async (f) => {
      const face = new FontFace(f.familia, `url(${f.url})`, { weight: f.peso })
      document.fonts.add(await face.load())
    }),
  ).catch((e) => {
    fontesProntas = null
    throw e
  })
  return fontesProntas
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a arte da assinatura SisLAB.'))
    img.src = url
  })
}

/** Desenha a assinatura e devolve o PNG como data URI (escala 2 = 800 × 200, nítido em tela retina). */
export async function gerarImagemSislab(d: DadosSislab, escala = 2): Promise<string> {
  const [base] = await Promise.all([carregarImagem(BASE), carregarFontes()])
  const canvas = document.createElement('canvas')
  canvas.width = LARGURA_SISLAB * escala
  canvas.height = ALTURA_SISLAB * escala
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Seu navegador não permite gerar a imagem.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height)
  ctx.scale(escala, escala)
  ctx.fillStyle = COR
  ctx.textBaseline = 'alphabetic'
  for (const l of linhasSislab(d)) {
    const fonte = (t: number) => `${l.peso} ${t}px "${l.familia}", Arial, sans-serif`
    ctx.font = fonte(l.tamanho)
    ctx.font = fonte(tamanhoQueCabe(l.tamanho, ctx.measureText(l.texto).width))
    ctx.fillText(l.texto, X_TEXTO, l.y)
  }
  return canvas.toDataURL('image/png')
}

const escapar = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export const gerarTextoSislab = (d: DadosSislab): string =>
  [d.nome, d.cargo, d.vinculo, d.laboratorio, d.email].map((t) => t.trim()).filter(Boolean).join('\n')

/** HTML para colar no e-mail: a imagem embutida, com os dados no texto alternativo. */
export function gerarHtmlSislab(d: DadosSislab, imagem: string): string {
  const alt = escapar(gerarTextoSislab(d).split('\n').join(' | '))
  return `<img src="${escapar(imagem)}" alt="${alt}" width="${LARGURA_SISLAB}" height="${ALTURA_SISLAB}" style="display:block; width:${LARGURA_SISLAB}px; height:${ALTURA_SISLAB}px; border:0;" />`
}
