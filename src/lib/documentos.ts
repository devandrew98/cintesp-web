import { FileText, FileSpreadsheet, FileImage, FileArchive, File as FileGenerico, type LucideIcon } from 'lucide-react'
import type { CategoriaDocumento, DepartamentoDocumento } from '@/types'

/** Categorias de documento (o que é). */
export const CATEGORIAS_DOCUMENTO: Array<{ value: CategoriaDocumento; label: string }> = [
  { value: 'formulario', label: 'Formulário' },
  { value: 'manual', label: 'Manual' },
  { value: 'politica', label: 'Política' },
  { value: 'modelo', label: 'Modelo / Template' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'ata', label: 'Ata de Reunião' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'outro', label: 'Outro' },
]

/** Departamentos responsáveis (quem disponibilizou / a quem se aplica). */
export const DEPARTAMENTOS_DOCUMENTO: Array<{ value: DepartamentoDocumento; label: string }> = [
  { value: 'geral', label: 'Geral (todos os departamentos)' },
  { value: 'administracao', label: 'Administração' },
  { value: 'pesquisa', label: 'Pesquisa' },
  { value: 'rh', label: 'Recursos Humanos' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'ti', label: 'TI' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'comunicacao', label: 'Comunicação' },
]

export const rotuloCategoria = (c: CategoriaDocumento): string =>
  CATEGORIAS_DOCUMENTO.find((x) => x.value === c)?.label ?? c

export const rotuloDepartamento = (d: DepartamentoDocumento): string =>
  DEPARTAMENTOS_DOCUMENTO.find((x) => x.value === d)?.label ?? d

/** Ícone a partir do nome do arquivo ou do tipo MIME. */
export function iconePorArquivo(nomeOuTipo?: string): LucideIcon {
  const s = (nomeOuTipo ?? '').toLowerCase()
  if (/\.(xlsx?|csv)$/.test(s) || s.includes('spreadsheet') || s.includes('csv')) return FileSpreadsheet
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(s) || s.startsWith('image/')) return FileImage
  if (/\.(zip|rar|7z|tar|gz)$/.test(s)) return FileArchive
  if (/\.pdf$/.test(s) || s.includes('pdf')) return FileText
  return FileGenerico
}

/** Bytes → "2.4 MB" (formato compacto, pt-BR). */
export function formatarTamanhoArquivo(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—'
  const unidades = ['B', 'KB', 'MB', 'GB']
  let valor = bytes
  let i = 0
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024
    i++
  }
  return `${valor.toFixed(i > 0 && valor < 10 ? 1 : 0)} ${unidades[i]}`
}
