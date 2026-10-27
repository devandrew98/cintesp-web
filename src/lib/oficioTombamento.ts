import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { carregarPapelTimbrado, MARGEM } from '@/lib/consignadoPdf'
import { mascararCNPJ } from '@/lib/cnpj'
import { pendenciasOficio, quantidadeDe, type ItemInventario } from '@/lib/inventario'

/**
 * Ofício individual de SOLICITAÇÃO DE TOMBAMENTO de um bem do inventário.
 *
 * O corpo usa o texto institucional fornecido pelo CINTESP, com os marcadores
 * substituídos pelos dados REAIS do item. Se faltar qualquer dado obrigatório,
 * o documento NÃO é gerado (nunca sai um ofício com valores em branco ou
 * inventados). Nada de número de protocolo, cargo ou assinatura inventados:
 * a linha de assinatura fica em branco, para o responsável assinar.
 */

export type DadosOficio = Pick<
  ItemInventario,
  'nome' | 'quantidade' | 'numeroNotaFiscal' | 'dataEmissaoNf' | 'numeroSerie' | 'fornecedor' | 'cnpj' | 'projetoNumero' | 'projetoNome'
>

/** Erro com a lista do que falta preencher (a tela mostra item a item). */
export class DadosOficioIncompletosError extends Error {
  constructor(public readonly campos: string[]) {
    super(`Preencha antes de gerar o ofício: ${campos.join(', ')}.`)
    this.name = 'DadosOficioIncompletosError'
  }
}

/** "2026-03-09" → "09/03/2026" (sem passar por Date: evita virar o dia por fuso). */
export function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

interface Trecho {
  t: string
  negrito?: boolean
}

/**
 * Corpo do ofício, em trechos (os dados do item e as palavras-chave em negrito).
 * Texto base fornecido pelo CINTESP — só os marcadores são trocados.
 */
export function trechosCorpoOficio(d: DadosOficio): Trecho[] {
  return [
    { t: 'ATESTO', negrito: true },
    { t: ' que o Material constante na ' },
    { t: `NOTA FISCAL nº ${d.numeroNotaFiscal!.trim()}`, negrito: true },
    { t: ', da empresa ' },
    { t: d.fornecedor!.trim(), negrito: true },
    { t: ' CNPJ ' },
    { t: mascararCNPJ(d.cnpj), negrito: true },
    { t: ' datada de ' },
    { t: dataBR(d.dataEmissaoNf!), negrito: true },
    { t: ', foi recebido e aceito, em conformidade com o projeto de Pesquisa ' },
    { t: d.projetoNumero!.trim(), negrito: true },
    { t: ' do CNPQ. ' },
    { t: 'SOLICITAMOS', negrito: true },
    { t: ' o tombamento do(s) referido(s) item(ns) constante(s) na Nota Fiscal e Ordem de Serviço descritos acima.' },
  ]
}

/** O mesmo corpo como texto simples (usado nos testes e na pré-visualização). */
export function textoCorpoOficio(d: DadosOficio): string {
  return trechosCorpoOficio(d)
    .map((x) => x.t)
    .join('')
}

/** Nome do arquivo: Oficio_Tombamento_NomeDoItem.pdf (sem acento/símbolo). */
export function nomeArquivoOficio(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
    .slice(0, 60)
  return `Oficio_Tombamento_${limpo || 'Item'}.pdf`
}

/** Desenha um parágrafo justificado com trechos em negrito; devolve o novo `y`. */
function paragrafoJustificado(doc: jsPDF, trechos: Trecho[], x: number, y: number, larguraMax: number, altura: number): number {
  const palavras: { p: string; negrito: boolean }[] = []
  for (const tr of trechos) {
    for (const p of tr.t.split(/\s+/).filter(Boolean)) palavras.push({ p, negrito: Boolean(tr.negrito) })
  }
  const larg = (p: { p: string; negrito: boolean }) => {
    doc.setFont('helvetica', p.negrito ? 'bold' : 'normal')
    return doc.getTextWidth(p.p)
  }
  doc.setFont('helvetica', 'normal')
  const espaco = doc.getTextWidth(' ')

  // Quebra em linhas.
  const linhas: { p: string; negrito: boolean }[][] = []
  let atual: { p: string; negrito: boolean }[] = []
  let usado = 0
  for (const w of palavras) {
    const lw = larg(w)
    if (atual.length > 0 && usado + espaco + lw > larguraMax) {
      linhas.push(atual)
      atual = []
      usado = 0
    }
    usado += (atual.length > 0 ? espaco : 0) + lw
    atual.push(w)
  }
  if (atual.length > 0) linhas.push(atual)

  linhas.forEach((linha, idx) => {
    const ultima = idx === linhas.length - 1
    const soma = linha.reduce((acc, w) => acc + larg(w), 0)
    const gap = !ultima && linha.length > 1 ? (larguraMax - soma) / (linha.length - 1) : espaco
    let cx = x
    for (const w of linha) {
      doc.setFont('helvetica', w.negrito ? 'bold' : 'normal')
      doc.text(w.p, cx, y)
      cx += larg(w) + gap
    }
    y += altura
  })
  return y
}

export interface OficioGerado {
  bytes: Uint8Array
  nomeArquivo: string
  /** true quando o papel timbrado não pôde ser carregado (o PDF sai sem o fundo). */
  semPapelTimbrado: boolean
}

/**
 * Gera o PDF do ofício. `papelTimbrado`: data URL do fundo; `undefined` = busca o
 * oficial do projeto (public/papel-timbrado.png); `null` = sem fundo (testes).
 */
export async function gerarOficioTombamento(
  item: DadosOficio,
  opcoes: { papelTimbrado?: string | null; emitidoEm?: Date } = {},
): Promise<OficioGerado> {
  const faltam = pendenciasOficio(item)
  if (faltam.length > 0) throw new DadosOficioIncompletosError(faltam)

  let papel: string | null = null
  let semPapelTimbrado = false
  if (opcoes.papelTimbrado === undefined) {
    try {
      papel = await carregarPapelTimbrado()
    } catch {
      semPapelTimbrado = true
    }
  } else {
    papel = opcoes.papelTimbrado
    semPapelTimbrado = papel === null
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = MARGEM.right - MARGEM.left
  const centerX = pageW / 2
  if (papel) doc.addImage(papel, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST')

  let y = MARGEM.top
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('OFÍCIO — SOLICITAÇÃO DE TOMBAMENTO PATRIMONIAL', centerX, y, { align: 'center' })
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 106, 120)
  doc.text(`Emitido em ${(opcoes.emitidoEm ?? new Date()).toLocaleDateString('pt-BR')}`, centerX, y, { align: 'center' })
  y += 24

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.text('À Universidade Federal de Uberlândia — UFU', MARGEM.left, y)
  y += 24

  // Identificação do bem (a "seção complementar"): o número de série só entra se existir.
  doc.setFontSize(9.5)
  doc.setTextColor(51, 65, 85)
  doc.text('IDENTIFICAÇÃO DO BEM', MARGEM.left, y)
  y += 8
  const projeto = [item.projetoNumero!.trim(), item.projetoNome?.trim()].filter(Boolean).join(' — ')
  const linhas: [string, string][] = [
    ['Material / descrição', item.nome.trim()],
    ...(quantidadeDe(item) > 1 ? ([['Quantidade', String(quantidadeDe(item))]] as [string, string][]) : []),
    ...(item.numeroSerie?.trim() ? ([['Número de série', item.numeroSerie.trim()]] as [string, string][]) : []),
    ['Nota fiscal nº', item.numeroNotaFiscal!.trim()],
    ['Data da nota fiscal', dataBR(item.dataEmissaoNf!)],
    ['Empresa', item.fornecedor!.trim()],
    ['CNPJ', mascararCNPJ(item.cnpj)],
    ['Projeto de pesquisa', projeto],
  ]
  autoTable(doc, {
    startY: y,
    margin: { left: MARGEM.left, right: pageW - MARGEM.right },
    tableWidth: contentW,
    body: linhas,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 5, lineColor: [203, 213, 225], lineWidth: 0.5, textColor: [30, 41, 59] },
    columnStyles: { 0: { cellWidth: 125, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [71, 85, 105] } },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26

  // Corpo institucional.
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)
  y = paragrafoJustificado(doc, trechosCorpoOficio(item), MARGEM.left, y, contentW, 17)

  // Assinatura: linha em branco — sem nome nem cargo inventados.
  y += 60
  if (y > MARGEM.bottom - 30) {
    // Texto muito longo: a assinatura iria invadir o rodapé timbrado — vai para nova página.
    doc.addPage()
    if (papel) doc.addImage(papel, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST')
    y = MARGEM.top + 40
  }
  doc.setDrawColor(148, 163, 184)
  doc.line(centerX - 120, y, centerX + 120, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('Assinatura e carimbo do responsável', centerX, y, { align: 'center' })

  return {
    bytes: new Uint8Array(doc.output('arraybuffer')),
    nomeArquivo: nomeArquivoOficio(item.nome),
    semPapelTimbrado,
  }
}
