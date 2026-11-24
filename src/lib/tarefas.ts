import type { Projeto } from '@/types'

/**
 * Tarefas de um projeto (estilo Trello/Notion). Regras puras: status, prioridade, ordenação,
 * agrupamento e permissões. Datas "yyyy-mm-dd" (strings, sem fuso).
 */

export type StatusTarefa = 'nao_iniciado' | 'em_andamento' | 'aguardando' | 'concluido'
export type PrioridadeTarefa = 'baixa' | 'media' | 'alta'
export type VisaoTarefas = 'tabela' | 'status' | 'minhas' | 'checklist'

export interface Tarefa {
  id: string
  projetoId: string
  /** Grupo (plano de trabalho) a que a tarefa pertence. */
  grupoId?: string
  titulo: string
  descricao?: string
  status: StatusTarefa
  prioridade: PrioridadeTarefa
  responsavelId?: string
  responsavelNome?: string
  responsavelFotoUrl?: string
  /** Prazo de entrega ("yyyy-mm-dd"). */
  dataEntrega?: string
  criadoPorId?: string
  criadoPorNome?: string
  criadoEm: string
  atualizadoEm?: string
}

export type DadosTarefa = Pick<Tarefa, 'titulo' | 'descricao' | 'status' | 'prioridade' | 'responsavelId' | 'dataEntrega'>

export const STATUS_TAREFA: { value: StatusTarefa; label: string; pill: string; ponto: string; coluna: string }[] = [
  { value: 'nao_iniciado', label: 'Não iniciado', pill: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300', ponto: 'bg-slate-400', coluna: 'bg-slate-50 dark:bg-slate-900/60' },
  { value: 'em_andamento', label: 'Em andamento', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300', ponto: 'bg-sky-500', coluna: 'bg-sky-50/60 dark:bg-sky-500/5' },
  { value: 'aguardando', label: 'Aguardando', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300', ponto: 'bg-violet-500', coluna: 'bg-violet-50/60 dark:bg-violet-500/5' },
  { value: 'concluido', label: 'Concluído', pill: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300', ponto: 'bg-brand-500', coluna: 'bg-brand-50/60 dark:bg-brand-500/5' },
]

export const PRIORIDADES: { value: PrioridadeTarefa; label: string; pill: string }[] = [
  { value: 'baixa', label: 'Baixa', pill: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' },
  { value: 'media', label: 'Média', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  { value: 'alta', label: 'Alta', pill: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
]

export const VISOES: { value: VisaoTarefas; label: string }[] = [
  { value: 'tabela', label: 'Tabela' },
  { value: 'status', label: 'Por status' },
  { value: 'minhas', label: 'Minhas tarefas' },
  { value: 'checklist', label: 'Checklist' },
]

export const infoStatus = (s: StatusTarefa) => STATUS_TAREFA.find((x) => x.value === s) ?? STATUS_TAREFA[0]
export const infoPrioridade = (p: PrioridadeTarefa) => PRIORIDADES.find((x) => x.value === p) ?? PRIORIDADES[1]

// ---------------------------------------------------------------------------
// Permissões
// ---------------------------------------------------------------------------

/** Cria e edita tarefas: admin, dono (criador/responsável) e pesquisadores vinculados ao projeto. */
export function podeGerenciarTarefas(p: Pick<Projeto, 'criadoPorId' | 'responsavelId' | 'pesquisadores'>, usuarioId?: string, ehAdmin = false): boolean {
  if (ehAdmin) return true
  if (!usuarioId) return false
  return p.criadoPorId === usuarioId || p.responsavelId === usuarioId || p.pesquisadores.some((v) => v.usuarioId === usuarioId)
}

/** Exclui uma tarefa: admin, dono do projeto ou quem criou a tarefa. */
export const podeExcluirTarefa = (t: Pick<Tarefa, 'criadoPorId'>, p: Pick<Projeto, 'criadoPorId' | 'responsavelId'>, usuarioId?: string, ehAdmin = false): boolean =>
  ehAdmin || (Boolean(usuarioId) && (p.criadoPorId === usuarioId || p.responsavelId === usuarioId || t.criadoPorId === usuarioId))

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Passou do prazo e ainda não foi concluída. */
export const atrasada = (t: Pick<Tarefa, 'dataEntrega' | 'status'>, hoje: string): boolean => Boolean(t.dataEntrega) && t.status !== 'concluido' && t.dataEntrega! < hoje

/** Por prazo (sem prazo por último), depois pela criação. */
export function ordenarTarefas(lista: Tarefa[]): Tarefa[] {
  return [...lista].sort((a, b) => {
    if (a.dataEntrega && b.dataEntrega && a.dataEntrega !== b.dataEntrega) return a.dataEntrega.localeCompare(b.dataEntrega)
    if (a.dataEntrega && !b.dataEntrega) return -1
    if (!a.dataEntrega && b.dataEntrega) return 1
    return a.criadoEm.localeCompare(b.criadoEm)
  })
}

export const tarefasDoStatus = (lista: Tarefa[], s: StatusTarefa): Tarefa[] => ordenarTarefas(lista.filter((t) => t.status === s))
export const minhasTarefas = (lista: Tarefa[], usuarioId?: string): Tarefa[] => (usuarioId ? ordenarTarefas(lista.filter((t) => t.responsavelId === usuarioId)) : [])

export function resumoTarefas(lista: Tarefa[]): { total: number; concluidas: number; percentual: number } {
  const concluidas = lista.filter((t) => t.status === 'concluido').length
  return { total: lista.length, concluidas, percentual: lista.length === 0 ? 0 : Math.round((concluidas / lista.length) * 100) }
}

/** Alterna o item do checklist: concluído ⇄ não iniciado. */
export const alternarConcluida = (s: StatusTarefa): StatusTarefa => (s === 'concluido' ? 'nao_iniciado' : 'concluido')

export function validarTarefa(d: Pick<DadosTarefa, 'titulo'>): string | null {
  return d.titulo.trim() ? null : 'Informe o título da tarefa.'
}

const CHAVE_VISAO = 'cintesp:projeto-visao-tarefas'
export function lerVisao(): VisaoTarefas {
  try {
    const v = localStorage.getItem(CHAVE_VISAO)
    return VISOES.some((x) => x.value === v) ? (v as VisaoTarefas) : 'tabela'
  } catch {
    return 'tabela'
  }
}
export function guardarVisao(v: VisaoTarefas) {
  try {
    localStorage.setItem(CHAVE_VISAO, v)
  } catch {
    /* sem localStorage: só vale nesta sessão */
  }
}
