/**
 * Reduz uma foto (ex.: do celular, 4–12 MB) para um JPEG leve antes de enviar.
 * Corrige a orientação EXIF (o navegador aplica ao decodificar) e limita o
 * maior lado. Imagens já pequenas passam direto.
 */
export async function reduzirImagem(arquivo: File, maxLado = 1600, qualidade = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  try {
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    // Já é pequena e jpeg/webp: não regrava (evita perda à toa).
    if (escala === 1 && arquivo.size <= 800 * 1024 && arquivo.type !== 'image/png') return arquivo

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.')
    ctx.fillStyle = '#ffffff' // PNG com transparência vira JPEG sobre fundo branco
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualidade))
    if (!blob) throw new Error('Não foi possível comprimir a imagem.')
    return blob
  } finally {
    bitmap.close()
  }
}

/** Foto reduzida (JPEG) com as dimensões, pronta para entrar em um relatório PDF/Word. */
export interface ImagemRelatorio {
  bytes: Uint8Array
  largura: number
  altura: number
}

/** Reduz uma imagem para caber em `maxLado` px (relatórios ficam leves). Devolve null se não der para ler. */
export async function miniaturaJpeg(dados: Blob, maxLado = 900, qualidade = 0.8): Promise<ImagemRelatorio | null> {
  try {
    const bitmap = await createImageBitmap(dados, { imageOrientation: 'from-image' })
    try {
      const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
      const largura = Math.max(1, Math.round(bitmap.width * escala))
      const altura = Math.max(1, Math.round(bitmap.height * escala))
      const canvas = document.createElement('canvas')
      canvas.width = largura
      canvas.height = altura
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, largura, altura)
      ctx.drawImage(bitmap, 0, 0, largura, altura)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualidade))
      if (!blob) return null
      return { bytes: new Uint8Array(await blob.arrayBuffer()), largura, altura }
    } finally {
      bitmap.close()
    }
  } catch {
    return null
  }
}
