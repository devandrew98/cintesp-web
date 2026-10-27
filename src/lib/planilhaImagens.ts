import JSZip from 'jszip'

/**
 * Extrai as FOTOS de uma planilha .xlsx e diz em qual LINHA cada uma está.
 *
 * O Excel guarda imagem de dois jeitos (a planilha pode ter os dois):
 *  1. FLUTUANTES — inseridas "sobre" a célula (xl/drawings/drawingN.xml). A linha é
 *     a da âncora superior da figura.
 *  2. DENTRO DA CÉLULA ("Colocar na célula") — valor rico (xl/richData + metadata.xml):
 *     célula com `vm="k"` → metadata → rdrichvalue → richValueRel → arquivo em xl/media.
 *
 * O SheetJS (que lê os textos) ignora ambos, por isso o arquivo é aberto aqui como zip.
 * Só XML por regex: funciona no navegador e no Node (testes). .xls antigo não é suportado.
 */

export interface ImagemPlanilha {
  /** Linha da planilha (1 = primeira linha), igual a `numerosLinha` de `lerPlanilha`. */
  linha: number
  /** Coluna (1 = A) onde a imagem está. */
  coluna: number
  bytes: Uint8Array
  /** Tipo MIME, só jpeg/png/webp (os demais são contados em `ignoradas`). */
  tipo: 'image/jpeg' | 'image/png' | 'image/webp'
  origem: 'flutuante' | 'na-celula'
}

export interface ImagensDaPlanilha {
  /** linha → imagens, na ordem em que aparecem (esquerda→direita, cima→baixo). */
  porLinha: Map<number, ImagemPlanilha[]>
  total: number
  /** Imagens em formato não suportado (emf, gif, bmp…) ou ilegíveis. */
  ignoradas: number
}

const TIPOS: Record<string, ImagemPlanilha['tipo']> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  jpe: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** Valor de um atributo dentro de uma tag (ignora o prefixo do namespace e a ordem). */
function attr(tag: string, nome: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)(?:[\\w]+:)?${nome}="([^"]*)"`).exec(tag)
  return m ? m[1] : undefined
}

/** Resolve um caminho relativo (`../media/a.png`) a partir do arquivo que o cita. */
function resolver(base: string, alvo: string): string {
  if (alvo.startsWith('/')) return alvo.slice(1)
  const partes = base.split('/').slice(0, -1)
  for (const p of alvo.split('/')) {
    if (p === '..') partes.pop()
    else if (p !== '.') partes.push(p)
  }
  return partes.join('/')
}

function relsDe(caminho: string): string {
  const i = caminho.lastIndexOf('/')
  return `${caminho.slice(0, i + 1)}_rels/${caminho.slice(i + 1)}.rels`
}

function letrasParaNumero(letras: string): number {
  return letras.split('').reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0)
}

export async function extrairImagensPlanilha(
  arquivo: ArrayBuffer | Uint8Array,
  nomeAba?: string,
): Promise<ImagensDaPlanilha> {
  const zip = await JSZip.loadAsync(arquivo)
  const texto = async (caminho: string) => (await zip.file(caminho)?.async('string')) ?? null

  /** id → destino, lendo um arquivo .rels. */
  const lerRels = async (caminhoRels: string, base: string) => {
    const xml = await texto(caminhoRels)
    const mapa = new Map<string, string>()
    for (const m of xml?.matchAll(/<Relationship\b[^>]*>/g) ?? []) {
      const id = attr(m[0], 'Id')
      const alvo = attr(m[0], 'Target')
      if (id && alvo) mapa.set(id, resolver(base, alvo))
    }
    return mapa
  }

  // ---- 1) Qual arquivo de aba? ----
  const workbook = await texto('xl/workbook.xml')
  if (!workbook) throw new Error('Arquivo .xlsx inválido.')
  const relsWb = await lerRels('xl/_rels/workbook.xml.rels', 'xl/workbook.xml')
  const abas = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    nome: (attr(m[0], 'name') ?? '').replace(/&amp;/g, '&'),
    rid: attr(m[0], 'id') ?? '',
  }))
  const aba = abas.find((a) => a.nome === nomeAba) ?? abas[0]
  const caminhoAba = aba ? relsWb.get(aba.rid) : undefined
  const resultado: ImagensDaPlanilha = { porLinha: new Map(), total: 0, ignoradas: 0 }
  if (!caminhoAba) return resultado
  const xmlAba = await texto(caminhoAba)
  if (!xmlAba) return resultado

  const achadas: ImagemPlanilha[] = []
  const guardar = async (caminhoMedia: string | undefined, linha: number, coluna: number, origem: ImagemPlanilha['origem']) => {
    if (!caminhoMedia) return
    const ext = caminhoMedia.split('.').pop()?.toLowerCase() ?? ''
    const tipo = TIPOS[ext]
    const f = zip.file(caminhoMedia)
    if (!tipo || !f) {
      resultado.ignoradas++
      return
    }
    achadas.push({ linha, coluna, bytes: await f.async('uint8array'), tipo, origem })
  }

  // ---- 2) Imagens flutuantes (drawing) ----
  const relsAba = await lerRels(relsDe(caminhoAba), caminhoAba)
  const caminhoDrawing = [...relsAba.values()].find((c) => /\/drawings\/[^/]+\.xml$/.test(c))
  if (caminhoDrawing) {
    const xmlDrawing = await texto(caminhoDrawing)
    const relsDrawing = await lerRels(relsDe(caminhoDrawing), caminhoDrawing)
    for (const bloco of xmlDrawing?.match(/<xdr:(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g) ?? []) {
      const embed = /<a:blip\b[^>]*r:embed="([^"]+)"/.exec(bloco)?.[1]
      const de = /<xdr:from>\s*<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/.exec(bloco)
      if (!embed || !de) continue // não é figura (forma, gráfico…) ou sem âncora
      await guardar(relsDrawing.get(embed), Number(de[2]) + 1, Number(de[1]) + 1, 'flutuante')
    }
  }

  // ---- 3) Imagens dentro da célula (valor rico) ----
  const celulasVm = [...xmlAba.matchAll(/<c\b[^>]*\bvm="(\d+)"[^>]*>/g)].map((m) => ({
    ref: /\br="([A-Z]+)(\d+)"/.exec(m[0]),
    vm: Number(m[1]),
  }))
  if (celulasVm.length > 0) {
    const metadata = await texto('xl/metadata.xml')
    const valores = await texto('xl/richData/rdrichvalue.xml')
    const estrutura = await texto('xl/richData/rdrichvaluestructure.xml')
    const listaRel = await texto('xl/richData/richValueRel.xml')
    const relsRich = await lerRels('xl/richData/_rels/richValueRel.xml.rels', 'xl/richData/richValueRel.xml')

    if (metadata && valores && listaRel) {
      // valueMetadata: vm (1-based) → índice no futureMetadata.
      const vmParaFuturo = [...(/<valueMetadata\b[\s\S]*?<\/valueMetadata>/.exec(metadata)?.[0].matchAll(/<bk>[\s\S]*?<\/bk>/g) ?? [])].map(
        (b) => Number(/<rc\b[^>]*\bv="(\d+)"/.exec(b[0])?.[1] ?? -1),
      )
      // futureMetadata XLRICHVALUE: índice → rvb i (posição em rdrichvalue).
      const futuro = /<futureMetadata\b[^>]*name="XLRICHVALUE"[\s\S]*?<\/futureMetadata>/.exec(metadata)?.[0] ?? ''
      const rvbs = [...futuro.matchAll(/<bk>[\s\S]*?<\/bk>/g)].map((b) => Number(/<xlrd:rvb\b[^>]*\bi="(\d+)"/.exec(b[0])?.[1] ?? -1))
      // estrutura: em qual posição está a chave da imagem.
      const estruturas = [...(estrutura?.matchAll(/<s\b[^>]*>[\s\S]*?<\/s>/g) ?? [])].map((s) =>
        [...s[0].matchAll(/<k\b[^>]*>/g)].map((k) => attr(k[0], 'n')),
      )
      const rvs = [...valores.matchAll(/<rv\b([^>]*)>([\s\S]*?)<\/rv>/g)].map((m) => ({
        s: Number(attr(m[1], 's') ?? 0),
        v: [...m[2].matchAll(/<v>([^<]*)<\/v>/g)].map((x) => x[1]),
      }))
      const rids = [...listaRel.matchAll(/<rel\b[^>]*>/g)].map((m) => attr(m[0], 'id'))

      for (const c of celulasVm) {
        if (!c.ref) continue
        const futuroIdx = vmParaFuturo[c.vm - 1] ?? c.vm - 1
        const rv = rvs[rvbs[futuroIdx] ?? futuroIdx]
        if (!rv) continue
        const pos = (estruturas[rv.s] ?? []).indexOf('_rvRel:LocalImageIdentifier')
        const relIdx = Number(rv.v[pos >= 0 ? pos : 0])
        const rid = rids[relIdx]
        await guardar(rid ? relsRich.get(rid) : undefined, Number(c.ref[2]), letrasParaNumero(c.ref[1]), 'na-celula')
      }
    }
  }

  // ---- 4) Agrupa por linha, em ordem estável ----
  achadas.sort((a, b) => a.linha - b.linha || a.coluna - b.coluna)
  for (const img of achadas) {
    const lista = resultado.porLinha.get(img.linha) ?? []
    lista.push(img)
    resultado.porLinha.set(img.linha, lista)
  }
  resultado.total = achadas.length
  return resultado
}
