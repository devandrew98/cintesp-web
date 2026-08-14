import type { CampoEditavelProjeto, StatusProjeto, TRL } from '@/types'

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate'

/** Rótulo + cor de cada status de projeto. */
export const statusProjetoInfo: Record<StatusProjeto, { label: string; tone: Tone }> = {
  planejamento: { label: 'Planejamento', tone: 'slate' },
  em_andamento: { label: 'Em andamento', tone: 'amber' },
  pausado: { label: 'Pausado', tone: 'blue' },
  concluido: { label: 'Concluído', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'red' },
}

export const STATUS_PROJETO: StatusProjeto[] = ['planejamento', 'em_andamento', 'pausado', 'concluido', 'cancelado']

/** Escala TRL (1 a 9) com a descrição oficial de cada nível. */
export const TRL_INFO: Array<{ value: TRL; label: string; descricao: string }> = [
  { value: 1, label: 'TRL 1', descricao: 'Princípios básicos observados' },
  { value: 2, label: 'TRL 2', descricao: 'Concepção da tecnologia formulada' },
  { value: 3, label: 'TRL 3', descricao: 'Prova de conceito experimental' },
  { value: 4, label: 'TRL 4', descricao: 'Validação em laboratório' },
  { value: 5, label: 'TRL 5', descricao: 'Validação em ambiente relevante' },
  { value: 6, label: 'TRL 6', descricao: 'Demonstração em ambiente relevante' },
  { value: 7, label: 'TRL 7', descricao: 'Demonstração em ambiente operacional' },
  { value: 8, label: 'TRL 8', descricao: 'Sistema completo e qualificado' },
  { value: 9, label: 'TRL 9', descricao: 'Sistema comprovado em operação real' },
]

export const rotuloTRL = (trl?: TRL): string => (trl ? TRL_INFO.find((t) => t.value === trl)?.label ?? `TRL ${trl}` : '—')

/**
 * Campos de conteúdo que o admin pode liberar para os pesquisadores
 * vinculados (não-responsáveis) editarem. Título, status e datas nunca
 * entram aqui — ficam sempre com admin + responsável.
 */
export const CAMPOS_EDITAVEIS_PROJETO: Array<{ value: CampoEditavelProjeto; label: string }> = [
  { value: 'trl', label: 'TRL (maturidade tecnológica)' },
  { value: 'progresso', label: 'Progresso (%)' },
  { value: 'dadosTecnicos', label: 'Dados técnicos' },
  { value: 'descricao', label: 'Descrição do projeto' },
  { value: 'observacoes', label: 'Observações' },
]

export const rotuloCampoEditavel = (c: CampoEditavelProjeto): string =>
  CAMPOS_EDITAVEIS_PROJETO.find((x) => x.value === c)?.label ?? c

/** Cor da barra de progresso conforme o quanto já avançou. */
export function corProgresso(progresso: number): string {
  if (progresso >= 100) return 'bg-brand-500'
  if (progresso >= 50) return 'bg-sky-500'
  if (progresso >= 20) return 'bg-amber-500'
  return 'bg-slate-400'
}
