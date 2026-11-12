import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  WidthType,
} from 'docx'
import { MARGEM } from '@/lib/consignadoPdf'
import type { ImagemRelatorio } from '@/lib/imagem'
import { ROTULO_CATEGORIA, dataBR, documentosDe, fotosDe, rotuloHorario, rotuloTipo, type AnexoRegistro, type Registro } from '@/lib/registros'

/**
 * Relatório de visitas, eventos e oficinas em PDF ou Word, sobre o PAPEL TIMBRADO oficial do CINTESP
 * (o mesmo fundo dos ofícios e termos). O texto respeita a área segura (fora do cabeçalho e do rodapé timbrados).
 */

export interface OpcoesRelatorio {
  /** Descrição dos filtros usados (aparece no cabeçalho). */
  descricaoFiltro?: string
  incluirFotos: boolean
  /** Inclui o texto da ata/resumo de cada registro. */
  incluirAta: boolean
  /** Máximo de fotos exibidas por registro (as demais viram uma nota). */
  maxFotosPorRegistro?: number
  /** Busca e reduz uma foto; `null` = não conseguiu (a foto é omitida). */
  obterFoto?: (anexo: AnexoRegistro) => Promise<ImagemRelatorio | null>
  /** Fundo timbrado como data URL PNG; `null` = sem fundo. */
  papelTimbrado: string | null
  emitidoEm?: Date
}

const TITULO = 'RELATÓRIO DE VISITAS, EVENTOS E OFICINAS'
const MAX_FOTOS_PADRAO = 9

/** Pares rótulo/valor exibidos no cabeçalho de cada registro (só o que foi preenchido). */
export function linhasDoRegistro(r: Registro): [string, string][] {
  const linhas: [string, string | undefined][] = [
    ['Tipo', rotuloTipo(r.tipo)],
    ['Data', dataBR(r.data)],
    ['Horário', rotuloHorario(r) || undefined],
    ['Local', r.local],
    ['Instituição / público', r.instituicao],
    ['Responsável no CINTESP', r.responsavel],
    ['Participantes', r.participantes !== undefined ? String(r.participantes) : undefined],
    ['Registrado por', r.criadoPorNome],
  ]
  return linhas.filter((l): l is [string, string] => Boolean(l[1]?.trim()))
}

const textoPeriodo = (registros: Registro[]): string => {
  if (registros.length === 0) return ''
  const datas = registros.map((r) => r.data).sort()
  return datas[0] === datas[datas.length - 1] ? dataBR(datas[0]) : `${dataBR(datas[0])} a ${dataBR(datas[datas.length - 1])}`
}

const dataUrlParaBytes = (dataUrl: string): Uint8Array => {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const bytesParaDataUrl = (bytes: Uint8Array): string => {
  let bin = ''
  const lote = 0x8000
  for (let i = 0; i < bytes.length; i += lote) bin += String.fromCharCode(...bytes.subarray(i, i + lote))
  return `data:image/jpeg;base64,${btoa(bin)}`
}

/** Escala (largura, altura) para caber dentro de (maxW, maxH) sem distorcer. */
const caber = (w: number, h: number, maxW: number, maxH: number) => {
  const e = Math.min(maxW / w, maxH / h)
  return { w: w * e, h: h * e }
}

// ===========================================================================
// PDF
// ===========================================================================

export async function gerarPdfRegistros(registros: Registro[], o: OpcoesRelatorio): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = MARGEM.right - MARGEM.left
  const centerX = pageW / 2
  const maxFotos = o.maxFotosPorRegistro ?? MAX_FOTOS_PADRAO

  // Fundo timbrado: uma vez por página (idempotente, serve também para as páginas criadas pelo autoTable).
  const pintadas = new Set<number>()
  const fundo = () => {
    const n = doc.getNumberOfPages()
    if (pintadas.has(n)) return
    pintadas.add(n)
    if (o.papelTimbrado) doc.addImage(o.papelTimbrado, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST')
  }
  fundo()

  let y = MARGEM.top
  const garantir = (altura: number) => {
    if (y + altura > MARGEM.bottom) {
      doc.addPage()
      fundo()
      y = MARGEM.top
    }
  }

  const cor = (r: number, g: number, b: number) => doc.setTextColor(r, g, b)
  /** Parágrafo com quebra automática de linha e de página. */
  const paragrafo = (texto: string, opc: { tamanho?: number; negrito?: boolean; cor?: [number, number, number]; x?: number; largura?: number; entre?: number; reservar?: number } = {}) => {
    const tamanho = opc.tamanho ?? 10
    const x = opc.x ?? MARGEM.left
    const largura = opc.largura ?? contentW
    const lh = tamanho * 1.4
    doc.setFont('helvetica', opc.negrito ? 'bold' : 'normal')
    doc.setFontSize(tamanho)
    cor(...(opc.cor ?? [30, 41, 59]))
    // Título de seção: exige espaço para ele + o que vem logo abaixo (evita título órfão no fim da página).
    garantir(lh + (opc.reservar ?? 0))
    for (const bloco of texto.split(/\r?\n/)) {
      const linhas: string[] = bloco.trim() === '' ? [''] : doc.splitTextToSize(bloco, largura)
      for (const linha of linhas) {
        garantir(lh)
        doc.text(linha, x, y + tamanho)
        y += lh
      }
    }
    y += opc.entre ?? 0
  }

  // ---- Capa / cabeçalho ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  cor(15, 23, 42)
  doc.text(TITULO, centerX, y, { align: 'center' })
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  cor(100, 106, 120)
  const periodo = textoPeriodo(registros)
  doc.text(
    `Emitido em ${(o.emitidoEm ?? new Date()).toLocaleDateString('pt-BR')}  ·  ${registros.length} registro${registros.length === 1 ? '' : 's'}${periodo ? `  ·  ${periodo}` : ''}`,
    centerX,
    y,
    { align: 'center' },
  )
  y += 12
  if (o.descricaoFiltro) {
    for (const linha of doc.splitTextToSize(o.descricaoFiltro, contentW) as string[]) {
      doc.text(linha, centerX, y + 2, { align: 'center' })
      y += 11
    }
  }
  doc.setDrawColor(203, 213, 225)
  doc.line(MARGEM.left, y + 4, MARGEM.right, y + 4)
  y += 18

  if (registros.length === 0) {
    paragrafo('Nenhum registro encontrado para os critérios selecionados.', { cor: [100, 106, 120] })
    return finalizar(doc)
  }

  // ---- Resumo ----
  paragrafo('RESUMO', { tamanho: 9.5, negrito: true, cor: [51, 65, 85], entre: 2 })
  autoTable(doc, {
    startY: y,
    margin: { top: MARGEM.top, bottom: pageH - MARGEM.bottom, left: MARGEM.left, right: pageW - MARGEM.right },
    tableWidth: contentW,
    head: [['Data', 'Tipo', 'Título', 'Local', 'Part.']],
    body: registros.map((r) => [dataBR(r.data), rotuloTipo(r.tipo), r.titulo, r.local ?? '—', r.participantes !== undefined ? String(r.participantes) : '—']),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, lineColor: [203, 213, 225], lineWidth: 0.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 56 }, 1: { cellWidth: 82 }, 3: { cellWidth: 92 }, 4: { cellWidth: 32, halign: 'center' } },
    willDrawPage: () => fundo(),
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22

  // ---- Registros ----
  for (const [i, r] of registros.entries()) {
    garantir(110)
    // Título do registro
    doc.setFillColor(240, 253, 244)
    const tituloLinhas = doc.splitTextToSize(`${i + 1}. ${r.titulo}`, contentW - 16) as string[]
    const alturaTitulo = tituloLinhas.length * 15 + 10
    garantir(alturaTitulo + 60)
    doc.roundedRect(MARGEM.left, y, contentW, alturaTitulo, 4, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    cor(22, 101, 52)
    tituloLinhas.forEach((l, k) => doc.text(l, MARGEM.left + 8, y + 15 + k * 15))
    y += alturaTitulo + 8

    // Dados
    for (const [rotulo, valor] of linhasDoRegistro(r)) {
      const linhas = doc.splitTextToSize(valor, contentW - 130) as string[]
      garantir(linhas.length * 13 + 2)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      cor(100, 116, 139)
      doc.text(rotulo, MARGEM.left + 4, y + 9)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      cor(30, 41, 59)
      linhas.forEach((l, k) => doc.text(l, MARGEM.left + 126, y + 9 + k * 13))
      y += linhas.length * 13 + 2
    }
    y += 6

    if (r.descricao?.trim()) {
      paragrafo('Descrição', { tamanho: 9.5, negrito: true, cor: [51, 65, 85], reservar: 30 })
      paragrafo(r.descricao.trim(), { entre: 6 })
    }
    if (o.incluirAta && r.ata?.trim()) {
      paragrafo('Ata / resumo', { tamanho: 9.5, negrito: true, cor: [51, 65, 85], reservar: 30 })
      paragrafo(r.ata.trim(), { entre: 6 })
    }
    const docs = documentosDe(r)
    if (docs.length > 0) {
      paragrafo('Documentos e atas anexados', { tamanho: 9.5, negrito: true, cor: [51, 65, 85], reservar: 30 })
      for (const a of docs) paragrafo(`•  ${a.nome}  (${ROTULO_CATEGORIA[a.categoria].toLowerCase()})`, { tamanho: 9.5, x: MARGEM.left + 8, largura: contentW - 8 })
      y += 6
    }

    // Fotos (grade de 3 colunas)
    const todasFotos = fotosDe(r)
    if (o.incluirFotos && todasFotos.length > 0 && o.obterFoto) {
      const lote = todasFotos.slice(0, maxFotos)
      const imagens = (await Promise.all(lote.map((f) => o.obterFoto!(f)))).filter((x): x is ImagemRelatorio => x !== null)
      if (imagens.length > 0) {
        paragrafo(`Fotos (${todasFotos.length})`, { tamanho: 9.5, negrito: true, cor: [51, 65, 85], entre: 2, reservar: 120 })
        const gap = 8
        const cw = (contentW - gap * 2) / 3
        const ch = 112
        for (let k = 0; k < imagens.length; k += 3) {
          garantir(ch + gap)
          imagens.slice(k, k + 3).forEach((img, col) => {
            const { w, h } = caber(img.largura, img.altura, cw, ch)
            const x = MARGEM.left + col * (cw + gap) + (cw - w) / 2
            doc.addImage(bytesParaDataUrl(img.bytes), 'JPEG', x, y + (ch - h) / 2, w, h, undefined, 'FAST')
          })
          y += ch + gap
        }
        if (todasFotos.length > imagens.length) paragrafo(`+ ${todasFotos.length - imagens.length} foto(s) no sistema, não exibida(s) neste relatório.`, { tamanho: 8.5, cor: [100, 106, 120] })
      }
    }

    // Separador entre registros
    y += 8
    if (i < registros.length - 1) {
      garantir(14)
      doc.setDrawColor(226, 232, 240)
      doc.line(MARGEM.left, y, MARGEM.right, y)
      y += 16
    }
  }

  return finalizar(doc)
}

function finalizar(doc: jsPDF): Uint8Array {
  const total = doc.getNumberOfPages()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 106, 120)
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.text(`Página ${p} de ${total}`, doc.internal.pageSize.getWidth() / 2, MARGEM.bottom + 8, { align: 'center' })
  }
  return new Uint8Array(doc.output('arraybuffer'))
}

// ===========================================================================
// Word (.docx)
// ===========================================================================

const FONTE = 'Arial'
const TW = 20 // twips por ponto
const LARGURA_TWIPS = Math.round((MARGEM.right - MARGEM.left) * TW)
const BORDA_FINA = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
const SEM_BORDA = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

const run = (text: string, extra: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, font: FONTE, size: (extra.size ?? 10.5) * 2, bold: extra.bold, color: extra.color })

const par = (texto: string, extra: { bold?: boolean; size?: number; color?: string; after?: number; before?: number; centro?: boolean; indent?: number } = {}) =>
  new Paragraph({
    children: [run(texto, extra)],
    spacing: { after: extra.after ?? 80, before: extra.before ?? 0 },
    alignment: extra.centro ? AlignmentType.CENTER : AlignmentType.LEFT,
    indent: extra.indent ? { left: extra.indent } : undefined,
  })

const celula = (children: Paragraph[], largura: number, opc: { fundo?: string; borda?: typeof BORDA_FINA } = {}) =>
  new TableCell({
    children,
    width: { size: largura, type: WidthType.DXA },
    shading: opc.fundo ? { type: ShadingType.CLEAR, fill: opc.fundo, color: 'auto' } : undefined,
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    borders: { top: opc.borda ?? SEM_BORDA, bottom: opc.borda ?? SEM_BORDA, left: opc.borda ?? SEM_BORDA, right: opc.borda ?? SEM_BORDA },
  })

export async function gerarDocxRegistros(registros: Registro[], o: OpcoesRelatorio): Promise<Uint8Array> {
  const maxFotos = o.maxFotosPorRegistro ?? MAX_FOTOS_PADRAO
  const filhos: (Paragraph | Table)[] = []

  filhos.push(par(TITULO, { bold: true, size: 14, centro: true, after: 60 }))
  const periodo = textoPeriodo(registros)
  filhos.push(
    par(`Emitido em ${(o.emitidoEm ?? new Date()).toLocaleDateString('pt-BR')}  ·  ${registros.length} registro${registros.length === 1 ? '' : 's'}${periodo ? `  ·  ${periodo}` : ''}`, {
      size: 9,
      color: '646A78',
      centro: true,
      after: o.descricaoFiltro ? 20 : 200,
    }),
  )
  if (o.descricaoFiltro) filhos.push(par(o.descricaoFiltro, { size: 9, color: '646A78', centro: true, after: 200 }))

  if (registros.length === 0) {
    filhos.push(par('Nenhum registro encontrado para os critérios selecionados.', { color: '646A78' }))
  } else {
    // Resumo
    filhos.push(par('RESUMO', { bold: true, size: 9.5, color: '334155', after: 60 }))
    const col = [1100, 1700, 4016, 2200, 900]
    const cabecalho = ['Data', 'Tipo', 'Título', 'Local', 'Part.']
    filhos.push(
      new Table({
        width: { size: LARGURA_TWIPS, type: WidthType.DXA },
        columnWidths: col,
        rows: [
          new TableRow({ tableHeader: true, children: cabecalho.map((t, i) => celula([par(t, { bold: true, size: 8.5, color: '166534', after: 0 })], col[i], { fundo: 'DCFCE7', borda: BORDA_FINA })) }),
          ...registros.map(
            (r) =>
              new TableRow({
                cantSplit: true,
                children: [dataBR(r.data), rotuloTipo(r.tipo), r.titulo, r.local ?? '—', r.participantes !== undefined ? String(r.participantes) : '—'].map((t, i) =>
                  celula([par(t, { size: 8.5, after: 0 })], col[i], { borda: BORDA_FINA }),
                ),
              }),
          ),
        ],
      }),
    )
    filhos.push(par('', { after: 160 }))

    for (const [i, r] of registros.entries()) {
      // Título
      filhos.push(
        new Paragraph({
          children: [run(`${i + 1}. ${r.titulo}`, { bold: true, size: 11.5, color: '166534' })],
          shading: { type: ShadingType.CLEAR, fill: 'F0FDF4', color: 'auto' },
          spacing: { before: i === 0 ? 0 : 240, after: 100 },
          keepNext: true,
        }),
      )
      // Dados
      const dados = linhasDoRegistro(r)
      filhos.push(
        new Table({
          width: { size: LARGURA_TWIPS, type: WidthType.DXA },
          columnWidths: [2400, LARGURA_TWIPS - 2400],
          rows: dados.map(
            ([rotulo, valor]) =>
              new TableRow({
                cantSplit: true,
                children: [
                  celula([par(rotulo, { bold: true, size: 9, color: '475569', after: 0 })], 2400, { fundo: 'F1F5F9', borda: BORDA_FINA }),
                  celula([par(valor, { size: 10, after: 0 })], LARGURA_TWIPS - 2400, { borda: BORDA_FINA }),
                ],
              }),
          ),
        }),
      )
      filhos.push(par('', { after: 100 }))

      const blocoTexto = (titulo: string, texto: string) => {
        filhos.push(par(titulo, { bold: true, size: 9.5, color: '334155', after: 40 }))
        for (const linha of texto.split(/\r?\n/)) filhos.push(par(linha, { after: 60 }))
        filhos.push(par('', { after: 60 }))
      }
      if (r.descricao?.trim()) blocoTexto('Descrição', r.descricao.trim())
      if (o.incluirAta && r.ata?.trim()) blocoTexto('Ata / resumo', r.ata.trim())

      const docs = documentosDe(r)
      if (docs.length > 0) {
        filhos.push(par('Documentos e atas anexados', { bold: true, size: 9.5, color: '334155', after: 40 }))
        for (const a of docs) filhos.push(par(`•  ${a.nome}  (${ROTULO_CATEGORIA[a.categoria].toLowerCase()})`, { size: 9.5, indent: 200, after: 30 }))
        filhos.push(par('', { after: 60 }))
      }

      const todasFotos = fotosDe(r)
      if (o.incluirFotos && todasFotos.length > 0 && o.obterFoto) {
        const imagens = (await Promise.all(todasFotos.slice(0, maxFotos).map((f) => o.obterFoto!(f)))).filter((x): x is ImagemRelatorio => x !== null)
        if (imagens.length > 0) {
          filhos.push(par(`Fotos (${todasFotos.length})`, { bold: true, size: 9.5, color: '334155', after: 40 }))
          const larg = Math.floor(LARGURA_TWIPS / 3)
          const linhasFotos: TableRow[] = []
          for (let k = 0; k < imagens.length; k += 3) {
            const grupo = imagens.slice(k, k + 3)
            linhasFotos.push(
              new TableRow({
                cantSplit: true,
                children: [0, 1, 2].map((c) => {
                  const img = grupo[c]
                  if (!img) return celula([par('', { after: 0 })], larg)
                  const { w, h } = caber(img.largura, img.altura, 200, 140)
                  return celula(
                    [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 40 },
                        children: [new ImageRun({ type: 'jpg', data: img.bytes, transformation: { width: Math.round(w), height: Math.round(h) } })],
                      }),
                    ],
                    larg,
                  )
                }),
              }),
            )
          }
          filhos.push(new Table({ width: { size: larg * 3, type: WidthType.DXA }, columnWidths: [larg, larg, larg], rows: linhasFotos }))
          if (todasFotos.length > imagens.length) filhos.push(par(`+ ${todasFotos.length - imagens.length} foto(s) no sistema, não exibida(s) neste relatório.`, { size: 8.5, color: '646A78' }))
          filhos.push(par('', { after: 60 }))
        }
      }
    }
  }

  // Papel timbrado como imagem flutuante atrás do texto, no cabeçalho (repete em todas as páginas).
  const cabecalhoFundo = o.papelTimbrado
    ? new Header({
        children: [
          new Paragraph({
            spacing: { after: 0, before: 0 },
            children: [
              new ImageRun({
                type: 'png',
                data: dataUrlParaBytes(o.papelTimbrado),
                transformation: { width: 794, height: 1123 },
                floating: {
                  horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                  verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
                  behindDocument: true,
                  allowOverlap: true,
                  wrap: { type: TextWrappingType.NONE },
                },
              }),
            ],
          }),
        ],
      })
    : new Header({ children: [new Paragraph({})] })

  const documento = new Document({
    creator: 'CINTESP.Br',
    title: TITULO,
    styles: { default: { document: { run: { font: FONTE, size: 21 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: Math.round(MARGEM.top * TW),
              bottom: Math.round((841.89 - MARGEM.bottom) * TW),
              left: Math.round(MARGEM.left * TW),
              right: Math.round((595.28 - MARGEM.right) * TW),
              header: 0,
              footer: 0,
            },
          },
        },
        headers: { default: cabecalhoFundo },
        children: filhos,
      },
    ],
  })

  return new Uint8Array(await Packer.toArrayBuffer(documento))
}
