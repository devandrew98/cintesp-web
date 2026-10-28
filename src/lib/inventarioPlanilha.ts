import { normalizarTexto, parseData } from '@/lib/planilha'
import { cnpjValido, mascararCNPJ, normalizarCNPJ } from '@/lib/cnpj'
import {
  detectarDuplicidades,
  STATUS_VISTORIA,
  quantidadeDe,
  type DadosItemInventario,
  type ItemInventario,
  type StatusVistoria,
} from '@/lib/inventario'

/**
 * Importação/exportação do Inventário em planilha (.xlsx).
 * A leitura reaproveita `lerPlanilha` (src/lib/planilha.ts); a exportação usa
 * `exceljs` (carregado só na hora) porque o SheetJS gratuito não grava imagens.
 */

// ============================================================
// Importação
// ============================================================

export type CampoInventario =
  | 'nome'
  | 'numeroNotaFiscal'
  | 'dataEmissaoNf'
  | 'dataCompra'
  | 'numeroSerie'
  | 'quantidade'
  | 'fornecedor'
  | 'cnpj'
  | 'projetoNumero'
  | 'localizacao'
  | 'statusVistoria'
  | 'notaFiscalLink'
  | 'observacoes'

export const rotuloCampoInventario: Record<CampoInventario, string> = {
  nome: 'Nome / descrição do item',
  numeroNotaFiscal: 'Nº da nota fiscal',
  dataEmissaoNf: 'Data de emissão da NF',
  dataCompra: 'Data da compra',
  numeroSerie: 'Nº de série',
  quantidade: 'Quantidade de itens',
  fornecedor: 'Empresa fornecedora',
  cnpj: 'CNPJ',
  projetoNumero: 'Nº do projeto',
  localizacao: 'Localização',
  statusVistoria: 'Status da vistoria',
  notaFiscalLink: 'Link da nota fiscal',
  observacoes: 'Observações',
}

/** Nomes de coluna aceitos (normalizados), do mais ao menos específico. */
const SINONIMOS: Record<CampoInventario, string[]> = {
  // Antes dos demais: 'link da nota fiscal' também contém 'nota fiscal' e seria consumida como o NÚMERO da nota.
  notaFiscalLink: ['link da nota fiscal', 'link da nota', 'link nota fiscal', 'link nf', 'link do drive', 'link drive'],
  nome: ['nome do item', 'nome item', 'descricao do item', 'item', 'material', 'equipamento', 'descricao', 'nome', 'produto', 'bem'],
  numeroNotaFiscal: ['numero doc fiscal', 'numero da nota fiscal', 'n da nota fiscal', 'nota fiscal', 'numero nf', 'n nf', 'nf', 'nota'],
  dataEmissaoNf: ['data de emissao da nf', 'data de emissao', 'emissao da nf', 'emissao', 'data da nota fiscal', 'data nf'],
  dataCompra: ['data da compra', 'data de compra', 'compra'],
  quantidade: ['quantidade de itens', 'quantidade', 'qtde', 'qtd', 'quant'],
  numeroSerie: ['numero de serie', 'n de serie', 'num serie', 'serie', 'serial', 'sn'],
  fornecedor: ['empresa fornecedora', 'fornecedor', 'favorecido', 'empresa', 'razao social'],
  cnpj: ['cnpj'],
  projetoNumero: ['numero do projeto', 'n do projeto', 'projeto de pesquisa', 'projeto'],
  localizacao: ['localizacao', 'local', 'sala', 'laboratorio'],
  statusVistoria: ['status da vistoria', 'status vistoria', 'vistoria', 'situacao', 'status'],
  observacoes: ['observacoes', 'observacao', 'obs'],
}

/** Sugere qual coluna da planilha alimenta cada campo. */
export function mapearColunasInventario(colunas: string[]): Record<CampoInventario, string> {
  const usadas = new Set<string>()
  const resultado = {} as Record<CampoInventario, string>
  const norm = colunas.map((c) => ({ original: c, n: normalizarTexto(c).replace(/[º°]/g, '').replace(/[._/-]+/g, ' ').replace(/\s+/g, ' ').trim() }))

  for (const campo of Object.keys(SINONIMOS) as CampoInventario[]) {
    let achada = ''
    for (const sin of SINONIMOS[campo]) {
      const exata = norm.find((c) => !usadas.has(c.original) && c.n === sin)
      if (exata) {
        achada = exata.original
        break
      }
    }
    if (!achada) {
      for (const sin of SINONIMOS[campo]) {
        if (sin.length < 5) continue
        const parcial = norm.find((c) => !usadas.has(c.original) && c.n.includes(sin))
        if (parcial) {
          achada = parcial.original
          break
        }
      }
    }
    if (achada) usadas.add(achada)
    resultado[campo] = achada
  }
  return resultado
}

function statusDeTexto(v: string): StatusVistoria {
  const t = normalizarTexto(v)
  if (t.startsWith('nao') || t.includes('nao localiz') || t.includes('extravi')) return 'nao_localizado'
  if (t.startsWith('localiz') || t.startsWith('encontr')) return 'localizado'
  return 'pendente'
}

export interface LinhaImportacao {
  linha: number
  dados: DadosItemInventario
  /** Motivo de NÃO importar (sem nome, repetido…). */
  erro?: string
  /** Avisos que não impedem a importação (data ilegível, CNPJ inválido…). */
  avisos: string[]
}

/**
 * Converte as linhas lidas em itens. Dados inválidos opcionais (CNPJ/data) são
 * descartados com aviso — o item entra e o campo fica para ser completado depois.
 * Já cadastrado (mesma série, ou mesma NF + descrição) é ignorado.
 */
export function montarItensImportados(
  linhas: Array<Record<string, string>>,
  numerosLinha: number[],
  mapa: Record<CampoInventario, string>,
  existentes: ItemInventario[],
): LinhaImportacao[] {
  const pega = (l: Record<string, string>, c: CampoInventario) => (mapa[c] ? (l[mapa[c]] ?? '').trim() : '')
  const jaVistos: ItemInventario[] = []

  return linhas.map((l, i) => {
    const avisos: string[] = []
    const dataEmissao = parseData(pega(l, 'dataEmissaoNf'))
    const dataCompra = parseData(pega(l, 'dataCompra'))
    if (pega(l, 'dataEmissaoNf') && !dataEmissao) avisos.push('data da NF ilegível')
    if (pega(l, 'dataCompra') && !dataCompra) avisos.push('data da compra ilegível')

    // Quantidade: inteiro ≥ 1 (aceita "2", "2,0", "2.00"); vazio = 1; ilegível = 1 com aviso.
    const qBruta = pega(l, 'quantidade')
    let quantidade = 1
    if (qBruta) {
      const n = Number(qBruta.replace(',', '.'))
      if (Number.isFinite(n) && n >= 1 && n <= 9999) quantidade = Math.floor(n)
      else avisos.push('quantidade ilegível (usou 1)')
    }

    let cnpj: string | undefined = normalizarCNPJ(pega(l, 'cnpj')) || undefined
    if (cnpj && !cnpjValido(cnpj)) {
      avisos.push('CNPJ inválido (não importado)')
      cnpj = undefined
    }

    const dados: DadosItemInventario = {
      nome: pega(l, 'nome'),
      numeroNotaFiscal: pega(l, 'numeroNotaFiscal') || undefined,
      dataEmissaoNf: dataEmissao || undefined,
      dataCompra: dataCompra || undefined,
      numeroSerie: pega(l, 'numeroSerie') || undefined,
      quantidade,
      fornecedor: pega(l, 'fornecedor') || undefined,
      cnpj,
      projetoNumero: pega(l, 'projetoNumero') || undefined,
      localizacao: pega(l, 'localizacao') || undefined,
      observacoes: pega(l, 'observacoes') || undefined,
      statusVistoria: statusDeTexto(pega(l, 'statusVistoria')),
    }
    const link = pega(l, 'notaFiscalLink')
    if (link) {
      if (/^https?:\/\/\S+$/i.test(link)) dados.notaFiscalLink = link
      else avisos.push('link da nota ilegível (não importado)')
    }

    let erro: string | undefined
    if (!dados.nome) erro = 'Sem nome do item'
    else {
      const dup = detectarDuplicidades(dados, [...existentes, ...jaVistos])
      if (dup.length > 0) erro = `Possível duplicado (${dup[0].motivo})`
    }
    if (!erro) {
      jaVistos.push({ ...dados, id: `import-${i}`, fotos: [], criadoEm: '', atualizadoEm: '' })
    }
    return { linha: numerosLinha[i], dados, erro, avisos }
  })
}

// ============================================================
// Exportação
// ============================================================

const dataBRCurta = (iso?: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

/**
 * Gera o .xlsx do inventário (dados fiscais, status e FOTO PRINCIPAL embutida na
 * célula como imagem de verdade). `baixarFotoBytes` busca os bytes de cada foto;
 * se uma foto falhar, a linha sai sem imagem (não derruba a exportação).
 */
export async function exportarInventarioXlsx(
  itens: ItemInventario[],
  baixarFotoBytes: (caminho: string) => Promise<{ bytes: ArrayBuffer; extensao: 'jpeg' | 'png' } | null>,
  /** caminho do arquivo anexado → link temporário, usado quando o item não tem link do Drive. */
  linksNotasAnexadas: Map<string, string> = new Map(),
): Promise<{ bytes: ArrayBuffer; fotosEmbutidas: number }> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CINTESP.Br'
  const ws = wb.addWorksheet('Inventário')

  // Uma coluna de foto por unidade (o item com mais fotos define quantas colunas).
  const maxFotos = Math.max(1, ...itens.map((i) => i.fotos.length))
  const colunasFoto = Array.from({ length: maxFotos }, (_, k) => ({
    header: maxFotos > 1 ? `Foto ${k + 1}` : 'Foto',
    key: `foto${k}`,
    width: 14,
  }))

  ws.columns = [
    ...colunasFoto,
    { header: 'Quantidade', key: 'qtd', width: 12 },
    { header: 'Item', key: 'nome', width: 38 },
    { header: 'Nota fiscal', key: 'nf', width: 16 },
    { header: 'Emissão da NF', key: 'emissao', width: 14 },
    { header: 'Data da compra', key: 'compra', width: 14 },
    { header: 'Nº de série', key: 'serie', width: 20 },
    { header: 'Fornecedor', key: 'fornecedor', width: 30 },
    { header: 'CNPJ', key: 'cnpj', width: 20 },
    { header: 'Nº do projeto', key: 'projetoNum', width: 16 },
    { header: 'Projeto', key: 'projeto', width: 30 },
    { header: 'Localização', key: 'local', width: 24 },
    { header: 'Status da vistoria', key: 'status', width: 18 },
    { header: 'Observações', key: 'obs', width: 36 },
    { header: 'Cadastrado em', key: 'criado', width: 14 },
    { header: 'Atualizado em', key: 'atualizado', width: 14 },
    { header: 'Nota fiscal (link)', key: 'notaLink', width: 26 },
  ]
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).alignment = { vertical: 'middle' }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const ALTURA_FOTO = 64 // pt (≈ 85 px)
  let fotosEmbutidas = 0

  for (let i = 0; i < itens.length; i++) {
    const it = itens[i]
    const linha = ws.addRow({
      qtd: quantidadeDe(it),
      nome: it.nome,
      nf: it.numeroNotaFiscal ?? '',
      emissao: dataBRCurta(it.dataEmissaoNf),
      compra: dataBRCurta(it.dataCompra),
      serie: it.numeroSerie ?? '',
      fornecedor: it.fornecedor ?? '',
      cnpj: it.cnpj ? mascararCNPJ(it.cnpj) : '',
      projetoNum: it.projetoNumero ?? '',
      projeto: it.projetoNome ?? '',
      local: it.localizacao ?? '',
      status: STATUS_VISTORIA[it.statusVistoria].label,
      obs: it.observacoes ?? '',
      criado: dataBRCurta(it.criadoEm),
      atualizado: dataBRCurta(it.atualizadoEm),
      notaLink: '',
    })
    // Coluna do link da nota: Drive (permanente) ou o arquivo anexado (link temporário). Sem nenhum dos dois, fica vazia.
    const urlNota = it.notaFiscalLink ?? (it.notaFiscalCaminho ? linksNotasAnexadas.get(it.notaFiscalCaminho) : undefined)
    if (urlNota) {
      const celula = linha.getCell('notaLink')
      celula.value = {
        text: it.notaFiscalLink ? 'Abrir nota fiscal (Drive)' : 'Abrir nota fiscal (link temporário)',
        hyperlink: urlNota,
      }
      celula.font = { color: { argb: 'FF1D4ED8' }, underline: true }
    }
    linha.alignment = { vertical: 'middle', wrapText: true }

    // Principal primeiro, depois as demais, cada uma na sua coluna.
    const ordenadas = [...it.fotos].sort((a, b) => Number(b.principal) - Number(a.principal))
    for (let k = 0; k < ordenadas.length; k++) {
      const foto = await baixarFotoBytes(ordenadas[k].caminho)
      if (!foto) continue
      linha.height = ALTURA_FOTO + 6
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const idImagem = wb.addImage({ buffer: foto.bytes as any, extension: foto.extensao })
      // Âncora na célula (índices base 0: coluna k, linha i+1 por causa do cabeçalho).
      ws.addImage(idImagem, { tl: { col: k + 0.1, row: i + 1.05 }, ext: { width: 80, height: ALTURA_FOTO - 4 } })
      fotosEmbutidas++
    }
  }

  const bytes = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  return { bytes, fotosEmbutidas }
}
