import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatarCPF } from '@/lib/cpf'
import { formatDateOnlyBR } from '@/lib/utils'

/**
 * Gera o PDF do "Protocolo de Empréstimo de Patrimônio" usando o PAPEL TIMBRADO
 * oficial do CINTESP.Br como fundo — em todas as páginas. O texto fica sempre
 * dentro da área segura de impressão (fora do cabeçalho e do rodapé timbrados).
 */

const PAPEL_TIMBRADO_URL = '/papel-timbrado.png'

// Área segura de impressão (pt, página A4 = 595.28 x 841.89pt). Calculada a
// partir do PAPEL TIMBRADO oficial (docs/o cabeçalho com ícones+logo termina
// ~122pt; o rodapé com os logos dos parceiros começa ~756pt) para o texto
// nunca sobrepor o timbre.
const MARGEM = { top: 145, bottom: 745, left: 50, right: 546 }

let papelTimbradoPromise: Promise<string> | null = null

/** Busca o PAPEL TIMBRADO (public/papel-timbrado.png) e cacheia como data URL. */
function carregarPapelTimbrado(): Promise<string> {
  if (!papelTimbradoPromise) {
    papelTimbradoPromise = fetch(PAPEL_TIMBRADO_URL)
      .then((r) => {
        if (!r.ok) throw new Error('Não foi possível carregar o papel timbrado.')
        return r.blob()
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const leitor = new FileReader()
            leitor.onload = () => resolve(leitor.result as string)
            leitor.onerror = () => reject(leitor.error)
            leitor.readAsDataURL(blob)
          }),
      )
      .catch((err) => {
        papelTimbradoPromise = null
        throw err
      })
  }
  return papelTimbradoPromise
}

export interface ItemImpressao {
  numero?: string
  nome?: string
  local?: string
}

export interface DadosImpressaoConsignado {
  protocoloNo: string
  itens: ItemImpressao[]
  pesquisadorNome?: string
  pesquisadorCpf?: string
  pesquisadorArea?: string
  local?: string
  dataRetirada?: string
  dataEntregaPrevista?: string
  observacoes?: string
  /** Editáveis pelo administrador antes de imprimir. */
  entreguePor: string
  recebidoPor: string
}

/** Monta o PDF completo (fundo timbrado + todos os dados do protocolo). */
export async function gerarPdfConsignado(dados: DadosImpressaoConsignado): Promise<jsPDF> {
  const papel = await carregarPapelTimbrado()

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = MARGEM.right - MARGEM.left
  const centerX = pageW / 2

  const desenharFundo = () => doc.addImage(papel, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST')

  // Papel timbrado como fundo de toda página (a 1ª aqui; as seguintes via
  // willDrawPage do autoTable ou nas quebras manuais abaixo).
  desenharFundo()

  let y = MARGEM.top

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('PROTOCOLO DE EMPRÉSTIMO DE PATRIMÔNIO', centerX, y, { align: 'center' })
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 106, 120)
  doc.text(
    `Protocolo nº ${dados.protocoloNo}   ·   Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
    centerX,
    y,
    { align: 'center' },
  )
  y += 12
  doc.setDrawColor(203, 213, 225)
  doc.line(MARGEM.left, y, MARGEM.right, y)
  y += 22

  // Responsável (quem recebe)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(51, 65, 85)
  doc.text('RESPONSÁVEL (QUEM RECEBE)', MARGEM.left, y)
  y += 16

  // Grade de 2 colunas com quebra de linha própria — evita que um valor
  // longo (ex.: várias áreas de atuação) invada a coluna vizinha.
  const colGap = 20
  const colWidth = (contentW - colGap) / 2
  const col2X = MARGEM.left + colWidth + colGap
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  const linhaCampos = (esquerda: string, direita?: string) => {
    const linhasEsq = doc.splitTextToSize(esquerda, colWidth)
    doc.text(linhasEsq, MARGEM.left, y)
    let linhasDir: string[] = []
    if (direita) {
      linhasDir = doc.splitTextToSize(direita, colWidth)
      doc.text(linhasDir, col2X, y)
    }
    y += Math.max(linhasEsq.length, linhasDir.length, 1) * 13 + 4
  }
  linhaCampos(`Nome: ${dados.pesquisadorNome || '—'}`, `CPF: ${dados.pesquisadorCpf ? formatarCPF(dados.pesquisadorCpf) : '—'}`)
  linhaCampos(`Área de atuação: ${dados.pesquisadorArea || '—'}`, `Local de uso: ${dados.local || '—'}`)
  linhaCampos(
    `Data de retirada: ${formatDateOnlyBR(dados.dataRetirada)}`,
    `Entrega prevista: ${formatDateOnlyBR(dados.dataEntregaPrevista)}`,
  )
  y += 8

  // Item(ns) consignado(s) — tabela central do protocolo.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(51, 65, 85)
  const plural = dados.itens.length > 1
  doc.text(`ITE${plural ? 'NS' : 'M'} CONSIGNADO${plural ? 'S' : ''} (${dados.itens.length})`, MARGEM.left, y)
  y += 8

  autoTable(doc, {
    startY: y,
    margin: { top: MARGEM.top, left: MARGEM.left, right: pageW - MARGEM.right, bottom: pageH - MARGEM.bottom },
    tableWidth: contentW,
    head: [['', 'Nº Patrimônio', 'Item', 'Local']],
    body: dados.itens.map((it) => ['', it.numero || '—', it.nome || '—', it.local || dados.local || '—']),
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: 6,
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: { 0: { cellWidth: 28, halign: 'center' } },
    // Quadradinho de conferência desenhado (a fonte padrão não tem o glifo "✓").
    didDrawCell: (data) => {
      if (data.column.index === 0 && data.section === 'body') {
        const tam = 9
        const cx = data.cell.x + data.cell.width / 2 - tam / 2
        const cy = data.cell.y + data.cell.height / 2 - tam / 2
        doc.setDrawColor(148, 163, 184)
        doc.rect(cx, cy, tam, tam)
      }
    },
    // Se a lista de itens estourar a página, o timbre precisa continuar
    // aparecendo nas páginas seguintes (a 1ª já foi desenhada acima).
    willDrawPage: (data) => {
      if (data.pageNumber > 1) desenharFundo()
    },
  })

  // jspdf-autotable anota `lastAutoTable` na instância em tempo de execução;
  // não faz parte dos tipos oficiais do pacote.
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24

  // Garante que a declaração + assinaturas não fiquem cortadas no rodapé.
  const alturaBlocoFinal = 150
  if (y + alturaBlocoFinal > MARGEM.bottom) {
    doc.addPage()
    desenharFundo()
    y = MARGEM.top
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  const declaracao =
    'Declaro ter recebido o(s) item(ns) descrito(s) acima em bom estado de conservação e me ' +
    'responsabilizo pela sua guarda, uso adequado e devolução no prazo indicado. O(s) item(ns) ' +
    'permanece(m) consignado(s) ao responsável até a emissão do respectivo protocolo de devolução.'
  const linhasDeclaracao = doc.splitTextToSize(declaracao, contentW)
  doc.text(linhasDeclaracao, MARGEM.left, y)
  y += linhasDeclaracao.length * 12 + 8

  if (dados.observacoes) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(51, 65, 85)
    doc.text('Observações:', MARGEM.left, y)
    y += 13
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    const linhasObs = doc.splitTextToSize(dados.observacoes, contentW)
    doc.text(linhasObs, MARGEM.left, y)
    y += linhasObs.length * 12 + 8
  }

  // Assinaturas: "Entregue por (Administração)" e "Recebido por" — editáveis
  // pelo administrador antes de gerar o PDF.
  y += 34
  const assW = (contentW - 30) / 2
  const assCol1X = MARGEM.left
  const assCol2X = MARGEM.left + assW + 30

  doc.setDrawColor(148, 163, 184)
  doc.line(assCol1X, y, assCol1X + assW, y)
  doc.line(assCol2X, y, assCol2X + assW, y)
  y += 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(30, 41, 59)
  doc.text('Entregue por (Administração)', assCol1X + assW / 2, y, { align: 'center' })
  doc.text('Recebido por', assCol2X + assW / 2, y, { align: 'center' })
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(dados.entreguePor || '—', assCol1X + assW / 2, y, { align: 'center' })
  doc.text(dados.recebidoPor || '—', assCol2X + assW / 2, y, { align: 'center' })

  return doc
}

/**
 * Gera o PDF e abre numa nova aba pronta para imprimir/salvar.
 * A aba é aberta ANTES do fetch assíncrono do timbre para não ser barrada
 * pelo bloqueador de pop-up do navegador.
 */
export async function imprimirConsignado(dados: DadosImpressaoConsignado): Promise<void> {
  const janela = window.open('', '_blank')
  try {
    const doc = await gerarPdfConsignado(dados)
    const url = doc.output('bloburl') as unknown as string
    if (janela) {
      janela.location.href = url
    } else {
      // Pop-up bloqueado: baixa o arquivo diretamente.
      doc.save(`protocolo-${dados.protocoloNo}.pdf`)
    }
  } catch (err) {
    janela?.close()
    throw err
  }
}
