import { cnpjValido } from '@/lib/cnpj'

/**
 * Nota fiscal ANEXADA ao item: validação do arquivo e leitura dos dados.
 *
 * Lê (sem API, sem custo, tudo no navegador):
 *  • XML da NF-e — exato (é o arquivo oficial);
 *  • PDF do DANFE com texto — a chave de acesso de 44 dígitos dá número, CNPJ e mês de
 *    emissão com segurança; nome do emitente e dia de emissão saem do texto do DANFE.
 *  • PDF escaneado/foto: anexa, mas não há texto para ler (sem OCR) — preenche-se à mão.
 *
 * Chave de acesso: cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) nNF(9) tpEmis(1) cNF(8) DV(1)
 */

export const NOTA_TAMANHO_MAX_MB = 10
export const NOTA_TIPOS_ACEITOS = ['application/pdf', 'text/xml', 'application/xml', 'image/jpeg', 'image/png']
const EXTENSOES = ['pdf', 'xml', 'jpg', 'jpeg', 'png']

export function extensaoDaNota(nomeArquivo: string): string {
  return nomeArquivo.split('.').pop()?.toLowerCase() ?? ''
}

/** Mensagem de erro se o arquivo não serve como nota fiscal; null se está ok. */
export function validarArquivoNota(arquivo: { name: string; type: string; size: number }): string | null {
  const ext = extensaoDaNota(arquivo.name)
  if (!EXTENSOES.includes(ext) || (arquivo.type && !NOTA_TIPOS_ACEITOS.includes(arquivo.type))) {
    return 'Anexe a nota em PDF, XML, JPG ou PNG.'
  }
  if (arquivo.size > NOTA_TAMANHO_MAX_MB * 1024 * 1024) return `O arquivo deve ter no máximo ${NOTA_TAMANHO_MAX_MB} MB.`
  return null
}

/** Tipo MIME a gravar no storage a partir da extensão (o navegador às vezes manda vazio para .xml). */
export function tipoDaNota(nomeArquivo: string): string {
  switch (extensaoDaNota(nomeArquivo)) {
    case 'pdf':
      return 'application/pdf'
    case 'xml':
      return 'text/xml'
    case 'png':
      return 'image/png'
    default:
      return 'image/jpeg'
  }
}

// ---------------------------------------------------------------------------
// Chave de acesso
// ---------------------------------------------------------------------------

/** Dígito verificador da chave (módulo 11, pesos 2..9 da direita para a esquerda). */
export function digitoVerificadorChave(base43: string): number {
  let soma = 0
  let peso = 2
  for (let i = base43.length - 1; i >= 0; i--) {
    soma += Number(base43[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/** 44 dígitos, mês plausível, CNPJ do emitente válido e dígito verificador correto. */
export function chaveNfeValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false
  if (digitoVerificadorChave(chave.slice(0, 43)) !== Number(chave[43])) return false
  const mes = Number(chave.slice(4, 6))
  return mes >= 1 && mes <= 12 && cnpjValido(chave.slice(6, 20))
}

/** Procura uma chave VÁLIDA no texto (aceita os blocos de 4 dígitos do DANFE). */
export function acharChaveNoTexto(texto: string): string | null {
  const candidatas = texto.match(/(?<!\d)(?:\d{4}[\s.]?){10}\d{4}(?!\d)/g) ?? []
  for (const c of candidatas) {
    const chave = c.replace(/\D/g, '')
    if (chaveNfeValida(chave)) return chave
  }
  return null
}

// ---------------------------------------------------------------------------
// Dados extraídos
// ---------------------------------------------------------------------------

export interface DadosDaNota {
  origem: 'xml' | 'pdf'
  chave?: string
  /** Número da nota, sem zeros à esquerda. */
  numero?: string
  /** yyyy-mm-dd */
  emissao?: string
  fornecedor?: string
  /** 14 dígitos. */
  cnpj?: string
  /** Quem comprou (destinatário) — só para conferência na tela. */
  destinatario?: string
}

function decodificar(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

const tag = (xml: string, nome: string) => {
  const m = new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`).exec(xml)
  return m ? decodificar(m[1]) : undefined
}

/** XML da NF-e (nfeProc ou NFe). Regex em vez de DOMParser: funciona igual no navegador e nos testes. */
export function extrairDadosDeXml(xml: string): DadosDaNota | null {
  const chave =
    /<infNFe\b[^>]*\bId="NFe(\d{44})"/.exec(xml)?.[1] ?? /<chNFe>(\d{44})<\/chNFe>/.exec(xml)?.[1] ?? undefined
  const ide = /<ide>([\s\S]*?)<\/ide>/.exec(xml)?.[1] ?? ''
  const emit = /<emit>([\s\S]*?)<\/emit>/.exec(xml)?.[1]
  const dest = /<dest>([\s\S]*?)<\/dest>/.exec(xml)?.[1]
  const nNF = tag(ide, 'nNF')
  if (!emit && !nNF && !chave) return null

  const dataBruta = tag(ide, 'dhEmi') ?? tag(ide, 'dEmi')
  const cnpj = emit ? tag(emit, 'CNPJ') : undefined
  return {
    origem: 'xml',
    chave,
    numero: nNF ? String(Number(nNF)) : undefined,
    emissao: /^(\d{4}-\d{2}-\d{2})/.exec(dataBruta ?? '')?.[1],
    fornecedor: emit ? tag(emit, 'xNome') : undefined,
    cnpj: cnpj && cnpjValido(cnpj) ? cnpj : undefined,
    destinatario: dest ? tag(dest, 'xNome') : undefined,
  }
}

/** Texto de um DANFE (PDF). O que não puder ser lido com segurança fica de fora (nunca chuta). */
export function extrairDadosDeTexto(texto: string): DadosDaNota | null {
  const plano = texto.replace(/\s+/g, ' ')
  const chave = acharChaveNoTexto(plano) ?? undefined

  let emissao: string | undefined
  const datas = [...plano.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)].map((m) => ({ iso: `${m[3]}-${m[2]}-${m[1]}`, indice: m.index ?? 0, mm: m[2], aaaa: m[3] }))
  const rotulo = /DATA\s+(?:DA|DE)\s+EMISS[ÃA]O/i.exec(plano)
  if (rotulo) {
    const depois = datas.find((d) => d.indice > (rotulo.index ?? 0) && d.indice - (rotulo.index ?? 0) < 120)
    emissao = depois?.iso
  }
  if (!emissao && chave) {
    // O mês/ano de emissão está na chave: pega a primeira data do DANFE que bate com ele.
    const aamm = chave.slice(2, 6)
    emissao = datas.find((d) => d.aaaa.slice(2) + d.mm === aamm)?.iso
  }

  const fornecedor = /RECEBEMOS\s+DE\s+(.+?)\s+OS\s+PRODUTOS/i.exec(plano)?.[1]?.trim()
  if (!chave && !emissao && !fornecedor) return null
  return {
    origem: 'pdf',
    chave,
    numero: chave ? String(Number(chave.slice(25, 34))) : undefined,
    emissao,
    fornecedor,
    cnpj: chave ? chave.slice(6, 20) : undefined,
  }
}

/** Texto de todas as páginas de um PDF (só PDFs com texto; imagem escaneada devolve vazio). */
export async function lerTextoPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  try {
    let texto = ''
    for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
      const conteudo = await (await doc.getPage(p)).getTextContent()
      texto += conteudo.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join('') + '\n'
    }
    return texto
  } finally {
    await (doc as unknown as { destroy?: () => Promise<void> }).destroy?.()
  }
}

/**
 * Lê a nota anexada e devolve o que conseguiu extrair, ou `null` se o arquivo não tem dados
 * legíveis (imagem, PDF escaneado, XML que não é de NF-e). Nunca lança por conteúdo ilegível.
 */
export async function lerDadosDaNota(arquivo: File): Promise<DadosDaNota | null> {
  try {
    const ext = extensaoDaNota(arquivo.name)
    if (ext === 'xml') return extrairDadosDeXml(await arquivo.text())
    if (ext === 'pdf') return extrairDadosDeTexto(await lerTextoPdf(new Uint8Array(await arquivo.arrayBuffer())))
  } catch {
    // arquivo corrompido ou protegido: segue como "sem dados legíveis"
  }
  return null
}
