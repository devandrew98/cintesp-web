import { cnpjValido, normalizarCNPJ } from '@/lib/cnpj'

/**
 * Regras puras do Inventário Patrimonial (sem banco, sem tela) — ficam aqui
 * para serem testáveis: status, pendências do ofício e alerta de duplicidade.
 */

export type StatusVistoria = 'pendente' | 'localizado' | 'nao_localizado'

export const STATUS_VISTORIA: Record<StatusVistoria, { label: string; ponto: string; texto: string }> = {
  pendente: { label: 'Pendente', ponto: 'bg-amber-400', texto: 'text-amber-700 dark:text-amber-300' },
  localizado: { label: 'Localizado', ponto: 'bg-emerald-500', texto: 'text-emerald-700 dark:text-emerald-300' },
  nao_localizado: { label: 'Não localizado', ponto: 'bg-red-500', texto: 'text-red-700 dark:text-red-300' },
}

export interface FotoInventario {
  id: string
  caminho: string
  principal: boolean
}

/** Dados editáveis de um item (tudo o que o formulário e a planilha preenchem). */
export interface DadosItemInventario {
  nome: string
  numeroNotaFiscal?: string
  /** yyyy-mm-dd */
  dataEmissaoNf?: string
  /** yyyy-mm-dd */
  dataCompra?: string
  numeroSerie?: string
  /** Unidades do item (padrão 1). Pede uma foto por unidade. */
  quantidade?: number
  fornecedor?: string
  /** Só dígitos. */
  cnpj?: string
  projetoId?: string
  projetoNumero?: string
  localizacao?: string
  observacoes?: string
  statusVistoria: StatusVistoria
}

export interface ItemInventario extends DadosItemInventario {
  id: string
  /** Título do projeto vinculado (vem do cadastro de projetos). */
  projetoNome?: string
  fotos: FotoInventario[]
  criadoEm: string
  atualizadoEm: string
}

// ---------- Fotos ----------
export const FOTO_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
export const FOTO_TAMANHO_MAX_MB = 5

/** Tamanho máximo da foto ORIGINAL aceita (ela é reduzida antes de enviar). */
export const FOTO_ORIGINAL_MAX_MB = 30

/**
 * Mensagem de erro se o arquivo não pode ser enviado; null se está ok.
 * `maxMb` padrão = limite do arquivo final guardado (o mesmo do bucket).
 */
export function validarArquivoFoto(arquivo: { type: string; size: number }, maxMb = FOTO_TAMANHO_MAX_MB): string | null {
  if (!FOTO_TIPOS_PERMITIDOS.includes(arquivo.type)) return 'Use uma imagem JPG, PNG ou WebP.'
  if (arquivo.size > maxMb * 1024 * 1024) return `A imagem deve ter no máximo ${maxMb} MB.`
  return null
}

/** Quantidade efetiva (nunca menor que 1). */
export function quantidadeDe(item: { quantidade?: number }): number {
  const q = Math.floor(Number(item.quantidade ?? 1))
  return Number.isFinite(q) && q >= 1 ? q : 1
}

/** Quantas fotos ainda faltam (uma por unidade). */
export function fotosFaltando(item: { quantidade?: number; fotos: unknown[] }): number {
  return Math.max(0, quantidadeDe(item) - item.fotos.length)
}

/** A foto principal (ou a primeira, se nenhuma estiver marcada). */
export function fotoPrincipal(item: Pick<ItemInventario, 'fotos'>): FotoInventario | undefined {
  return item.fotos.find((f) => f.principal) ?? item.fotos[0]
}

// ---------- Validação ----------

/** Erros que IMPEDEM salvar (o resto só vira pendência do ofício). */
export function validarItem(d: Pick<DadosItemInventario, 'nome' | 'cnpj' | 'quantidade'>): Record<string, string> {
  const erros: Record<string, string> = {}
  if (d.quantidade !== undefined && (!Number.isInteger(d.quantidade) || d.quantidade < 1 || d.quantidade > 9999))
    erros.quantidade = 'A quantidade deve ser um número inteiro de 1 a 9999.'
  if (!d.nome?.trim()) erros.nome = 'Informe o nome/descrição do item.'
  if (d.cnpj && !cnpjValido(d.cnpj)) erros.cnpj = 'CNPJ inválido — confira os dígitos.'
  return erros
}

/** Campos que faltam para gerar o ofício (vazio = pode gerar). */
export function pendenciasOficio(
  item: Pick<DadosItemInventario, 'nome' | 'numeroNotaFiscal' | 'dataEmissaoNf' | 'fornecedor' | 'cnpj' | 'projetoNumero'>,
): string[] {
  const falta: string[] = []
  if (!item.nome?.trim()) falta.push('Nome do item')
  if (!item.numeroNotaFiscal?.trim()) falta.push('Número da nota fiscal')
  if (!item.dataEmissaoNf) falta.push('Data de emissão da nota fiscal')
  if (!item.fornecedor?.trim()) falta.push('Empresa fornecedora')
  if (!item.cnpj?.trim()) falta.push('CNPJ da empresa')
  else if (!cnpjValido(item.cnpj)) falta.push('CNPJ válido')
  if (!item.projetoNumero?.trim()) falta.push('Número do projeto de pesquisa')
  return falta
}

// ---------- Duplicidade ----------

function normalizar(texto: string | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Números de série "vazios" que não identificam nada. */
const SERIE_GENERICA = /^(n\/?a|s\/?n|sem( numero)?|nao (possui|tem|consta)|-+|0+)$/i

export interface PossivelDuplicado {
  item: ItemInventario
  motivo: string
}

/**
 * Possíveis duplicidades de um item contra a lista existente. É só ALERTA — nunca
 * bloqueia: uma nota fiscal pode ter vários bens (mesma NF, nomes diferentes = ok).
 *  • mesmo número de série (forte);
 *  • mesma nota fiscal + mesma descrição.
 */
export function detectarDuplicidades(
  dados: Pick<DadosItemInventario, 'nome' | 'numeroSerie' | 'numeroNotaFiscal'>,
  existentes: ItemInventario[],
  idAtual?: string,
): PossivelDuplicado[] {
  const achados: PossivelDuplicado[] = []
  const serie = normalizar(dados.numeroSerie).replace(/ /g, '')
  const nf = normalizar(dados.numeroNotaFiscal)
  const nome = normalizar(dados.nome)
  const serieUtil = serie.length > 0 && !SERIE_GENERICA.test(dados.numeroSerie?.trim() ?? '')

  for (const outro of existentes) {
    if (outro.id === idAtual) continue
    const serieOutro = normalizar(outro.numeroSerie).replace(/ /g, '')
    if (serieUtil && serieOutro === serie) {
      achados.push({ item: outro, motivo: 'mesmo número de série' })
    } else if (nf && nome && normalizar(outro.numeroNotaFiscal) === nf && normalizar(outro.nome) === nome) {
      achados.push({ item: outro, motivo: 'mesma nota fiscal e mesma descrição' })
    }
  }
  return achados
}

/** Quantos itens já foram localizados / ainda faltam (para o resumo da vistoria). */
export function resumoVistoria(itens: Pick<ItemInventario, 'statusVistoria'>[]) {
  const total = itens.length
  const localizados = itens.filter((i) => i.statusVistoria === 'localizado').length
  const naoLocalizados = itens.filter((i) => i.statusVistoria === 'nao_localizado').length
  return { total, localizados, naoLocalizados, pendentes: total - localizados - naoLocalizados }
}

/** Normaliza o CNPJ antes de gravar (só dígitos; vazio vira undefined). */
export function limparCnpj(valor: string | undefined): string | undefined {
  const d = normalizarCNPJ(valor)
  return d || undefined
}
