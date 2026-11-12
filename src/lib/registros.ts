/**
 * Registros institucionais: visitas, eventos, oficinas, reuniões e palestras realizados no CINTESP,
 * com fotos, documentos e atas anexados. Regras puras (filtro, validação, rótulos) — sem acesso a dados.
 * Datas são "yyyy-mm-dd" e horas "HH:MM" (strings, sem fuso).
 */

export type TipoRegistro = 'visita' | 'evento' | 'oficina' | 'reuniao' | 'palestra' | 'outro'
export type CategoriaAnexo = 'foto' | 'ata' | 'documento'

export const TIPOS_REGISTRO: { value: TipoRegistro; label: string; pill: string }[] = [
  { value: 'visita', label: 'Visita institucional', pill: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' },
  { value: 'evento', label: 'Evento', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
  { value: 'oficina', label: 'Oficina', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  { value: 'reuniao', label: 'Reunião', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' },
  { value: 'palestra', label: 'Palestra', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' },
  { value: 'outro', label: 'Outro', pill: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300' },
]

export const rotuloTipo = (t: TipoRegistro): string => TIPOS_REGISTRO.find((x) => x.value === t)?.label ?? 'Outro'
export const pillTipo = (t: TipoRegistro): string => TIPOS_REGISTRO.find((x) => x.value === t)?.pill ?? TIPOS_REGISTRO[5].pill

export const ROTULO_CATEGORIA: Record<CategoriaAnexo, string> = { foto: 'Foto', ata: 'Ata', documento: 'Documento' }

export interface AnexoRegistro {
  id: string
  registroId: string
  categoria: CategoriaAnexo
  /** Caminho no bucket `registros`. */
  caminho: string
  nome: string
  mime: string
  tamanho: number
  enviadoPorId?: string
  enviadoPorNome?: string
  criadoEm: string
}

export interface DadosRegistro {
  tipo: TipoRegistro
  titulo: string
  data: string
  horaInicio?: string
  horaFim?: string
  local?: string
  /** Instituição/grupo visitante ou organização parceira. */
  instituicao?: string
  /** Quem conduziu/acompanhou pelo CINTESP. */
  responsavel?: string
  participantes?: number
  descricao?: string
  /** Texto da ata ou resumo (vai no relatório). */
  ata?: string
}

export interface Registro extends DadosRegistro {
  id: string
  criadoPorId?: string
  criadoPorNome?: string
  criadoEm: string
  anexos: AnexoRegistro[]
}

// ---------------------------------------------------------------------------
// Permissões
// ---------------------------------------------------------------------------

/** Quem edita/exclui o registro: o criador e o administrador. Anexar fotos/documentos é de todos. */
export const podeEditarRegistro = (r: Pick<Registro, 'criadoPorId'>, usuarioId?: string, ehAdmin = false): boolean =>
  ehAdmin || (Boolean(usuarioId) && r.criadoPorId === usuarioId)

/** Apaga um anexo: quem enviou, o dono do registro ou o administrador. */
export const podeRemoverAnexo = (a: Pick<AnexoRegistro, 'enviadoPorId'>, r: Pick<Registro, 'criadoPorId'>, usuarioId?: string, ehAdmin = false): boolean =>
  ehAdmin || (Boolean(usuarioId) && (a.enviadoPorId === usuarioId || r.criadoPorId === usuarioId))

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export function validarRegistro(d: DadosRegistro): string | null {
  if (!d.titulo.trim()) return 'Informe o título.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) return 'Informe a data.'
  if (d.horaInicio && d.horaFim && d.horaFim < d.horaInicio) return 'O horário de fim não pode ser antes do início.'
  if (d.participantes !== undefined && (!Number.isInteger(d.participantes) || d.participantes < 0)) return 'Número de participantes inválido.'
  return null
}

// ---------------------------------------------------------------------------
// Arquivos
// ---------------------------------------------------------------------------

export const FOTO_ORIGINAL_MAX_MB = 25
export const DOC_MAX_MB = 25

const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  txt: 'text/plain',
  csv: 'text/csv',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export const EXTENSOES_DOCUMENTO = ['pdf', 'doc', 'docx', 'odt', 'txt', 'csv', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png']
export const ACCEPT_DOCUMENTO = EXTENSOES_DOCUMENTO.map((e) => `.${e}`).join(',')
export const ACCEPT_FOTO = 'image/jpeg,image/png,image/webp'

export const extensaoDe = (nome: string): string => (nome.includes('.') ? nome.split('.').pop()!.toLowerCase() : '')
export const mimeDoArquivo = (nome: string, tipoDoFile = ''): string => MIME_POR_EXTENSAO[extensaoDe(nome)] ?? (tipoDoFile || 'application/octet-stream')

/** Devolve a mensagem de problema ou null se o arquivo pode ser enviado. */
export function validarArquivoAnexo(nome: string, tamanho: number, tipo: string, categoria: CategoriaAnexo): string | null {
  if (categoria === 'foto') {
    if (!/^image\/(jpeg|png|webp)$/.test(tipo)) return `"${nome}": use fotos JPG, PNG ou WebP.`
    if (tamanho > FOTO_ORIGINAL_MAX_MB * 1024 * 1024) return `"${nome}": a foto passa de ${FOTO_ORIGINAL_MAX_MB} MB.`
    return null
  }
  if (!EXTENSOES_DOCUMENTO.includes(extensaoDe(nome))) return `"${nome}": formato não aceito (use ${EXTENSOES_DOCUMENTO.join(', ')}).`
  if (tamanho > DOC_MAX_MB * 1024 * 1024) return `"${nome}": o arquivo passa de ${DOC_MAX_MB} MB.`
  return null
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

// ---------------------------------------------------------------------------
// Datas e rótulos
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-11-05" → "05/11/2026" (sem passar por Date: não vira o dia por fuso). */
export function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** "09:00 às 11:00", "a partir das 09:00" ou "". */
export function rotuloHorario(r: Pick<DadosRegistro, 'horaInicio' | 'horaFim'>): string {
  if (r.horaInicio && r.horaFim) return `${r.horaInicio} às ${r.horaFim}`
  if (r.horaInicio) return `a partir das ${r.horaInicio}`
  return ''
}

export const fotosDe = (r: Pick<Registro, 'anexos'>) => r.anexos.filter((a) => a.categoria === 'foto')
export const documentosDe = (r: Pick<Registro, 'anexos'>) => r.anexos.filter((a) => a.categoria !== 'foto')

// ---------------------------------------------------------------------------
// Filtro
// ---------------------------------------------------------------------------

export interface FiltroRegistros {
  busca: string
  tipo: TipoRegistro | 'todos'
  periodo: 'tudo' | 'mes' | 'intervalo'
  mes: { ano: number; mes: number }
  de: string
  ate: string
}

export const semAcento = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function filtrarRegistros(lista: Registro[], f: FiltroRegistros): Registro[] {
  const q = semAcento(f.busca.trim())
  const prefixoMes = `${f.mes.ano}-${pad(f.mes.mes)}`
  return lista
    .filter((r) => f.tipo === 'todos' || r.tipo === f.tipo)
    .filter((r) => {
      if (f.periodo === 'mes') return r.data.startsWith(prefixoMes)
      if (f.periodo === 'intervalo') return (!f.de || r.data >= f.de) && (!f.ate || r.data <= f.ate)
      return true
    })
    .filter((r) => {
      if (!q) return true
      const texto = [r.titulo, r.local, r.instituicao, r.responsavel, r.descricao, r.ata, rotuloTipo(r.tipo), ...r.anexos.map((a) => a.nome)].filter(Boolean).join(' ')
      return semAcento(texto).includes(q)
    })
    .sort((a, b) => b.data.localeCompare(a.data) || (b.horaInicio ?? '').localeCompare(a.horaInicio ?? '') || a.titulo.localeCompare(b.titulo))
}

/** Texto curto dos filtros ativos, usado no cabeçalho do relatório. */
export function descreverFiltro(f: FiltroRegistros): string {
  const partes: string[] = []
  if (f.periodo === 'mes') partes.push(`Período: ${MESES[f.mes.mes - 1]} de ${f.mes.ano}`)
  if (f.periodo === 'intervalo' && (f.de || f.ate)) partes.push(`Período: ${f.de ? dataBR(f.de) : 'início'} a ${f.ate ? dataBR(f.ate) : 'hoje'}`)
  if (f.tipo !== 'todos') partes.push(`Tipo: ${rotuloTipo(f.tipo)}`)
  if (f.busca.trim()) partes.push(`Busca: "${f.busca.trim()}"`)
  return partes.join(' · ')
}

export const filtroVazio = (hoje = new Date()): FiltroRegistros => ({
  busca: '',
  tipo: 'todos',
  periodo: 'tudo',
  mes: { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 },
  de: '',
  ate: '',
})

export const filtroAtivo = (f: FiltroRegistros): boolean => f.busca.trim() !== '' || f.tipo !== 'todos' || f.periodo !== 'tudo'

/** "Relatorio_Visitas_Eventos_2026-11-12.pdf" */
export function nomeArquivoRelatorio(ext: 'pdf' | 'docx', hoje = new Date()): string {
  return `Relatorio_Visitas_Eventos_${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}.${ext}`
}
