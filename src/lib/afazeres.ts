import { atrasada, ordenarTarefas, type PrioridadeTarefa, type StatusTarefa, type Tarefa } from '@/lib/tarefas'

/**
 * Meus Afazeres: tarefas pessoais + tarefas dos projetos atribuídas ao usuário, e anotações.
 * Regras puras (conversão, agrupamento por prazo, busca). Datas "yyyy-mm-dd" (strings, sem fuso).
 */

export type OrigemAfazer = 'pessoal' | 'projeto'

/** Tarefa particular (só o dono vê). */
export interface TarefaPessoal {
  id: string
  titulo: string
  descricao?: string
  status: StatusTarefa
  prioridade: PrioridadeTarefa
  dataEntrega?: string
  criadoEm: string
  atualizadoEm?: string
}

export type DadosTarefaPessoal = Pick<TarefaPessoal, 'titulo' | 'descricao' | 'status' | 'prioridade' | 'dataEntrega'>

/** Item da lista unificada (pessoal ou de projeto). */
export interface ItemAfazer {
  /** Única na lista: "pessoal:<id>" ou "projeto:<id>". */
  chave: string
  origem: OrigemAfazer
  id: string
  titulo: string
  descricao?: string
  status: StatusTarefa
  prioridade: PrioridadeTarefa
  dataEntrega?: string
  projetoId?: string
  projetoTitulo?: string
  criadoEm: string
}

export const deTarefaPessoal = (t: TarefaPessoal): ItemAfazer => ({
  chave: `pessoal:${t.id}`,
  origem: 'pessoal',
  id: t.id,
  titulo: t.titulo,
  descricao: t.descricao,
  status: t.status,
  prioridade: t.prioridade,
  dataEntrega: t.dataEntrega,
  criadoEm: t.criadoEm,
})

export const deTarefaProjeto = (t: Tarefa, projetoTitulo?: string): ItemAfazer => ({
  chave: `projeto:${t.id}`,
  origem: 'projeto',
  id: t.id,
  titulo: t.titulo,
  descricao: t.descricao,
  status: t.status,
  prioridade: t.prioridade,
  dataEntrega: t.dataEntrega,
  projetoId: t.projetoId,
  projetoTitulo,
  criadoEm: t.criadoEm,
})

export interface GruposAfazeres {
  atrasadas: ItemAfazer[]
  hoje: ItemAfazer[]
  proximas: ItemAfazer[]
  semData: ItemAfazer[]
  concluidas: ItemAfazer[]
}

/** Separa por prazo. Cada lista sai ordenada (prazo, depois criação). */
export function agruparAfazeres(itens: ItemAfazer[], hoje: string): GruposAfazeres {
  const g: GruposAfazeres = { atrasadas: [], hoje: [], proximas: [], semData: [], concluidas: [] }
  for (const i of itens) {
    if (i.status === 'concluido') g.concluidas.push(i)
    else if (!i.dataEntrega) g.semData.push(i)
    else if (i.dataEntrega < hoje) g.atrasadas.push(i)
    else if (i.dataEntrega === hoje) g.hoje.push(i)
    else g.proximas.push(i)
  }
  const ordem = (l: ItemAfazer[]) => ordenarPorPrazo(l)
  return { atrasadas: ordem(g.atrasadas), hoje: ordem(g.hoje), proximas: ordem(g.proximas), semData: ordem(g.semData), concluidas: ordem(g.concluidas).reverse() }
}

/** Reaproveita a ordenação das tarefas de projeto (prazo; sem prazo por último; criação). */
export function ordenarPorPrazo(l: ItemAfazer[]): ItemAfazer[] {
  const idx = new Map(l.map((i) => [i.chave, i]))
  const base = ordenarTarefas(l.map((i) => ({ id: i.chave, projetoId: '', titulo: i.titulo, status: i.status, prioridade: i.prioridade, dataEntrega: i.dataEntrega, criadoEm: i.criadoEm })))
  return base.map((t) => idx.get(t.id)!)
}

export const itensDoDia = (itens: ItemAfazer[], iso: string): ItemAfazer[] => ordenarPorPrazo(itens.filter((i) => i.dataEntrega === iso))

export function resumoAfazeres(itens: ItemAfazer[], hoje: string): { hoje: number; atrasadas: number; abertas: number } {
  const abertas = itens.filter((i) => i.status !== 'concluido')
  return {
    hoje: abertas.filter((i) => i.dataEntrega === hoje).length,
    atrasadas: abertas.filter((i) => atrasada({ dataEntrega: i.dataEntrega, status: i.status }, hoje)).length,
    abertas: abertas.length,
  }
}

export function validarTarefaPessoal(d: Pick<DadosTarefaPessoal, 'titulo'>): string | null {
  return d.titulo.trim() ? null : 'Informe o título da tarefa.'
}

// ---------------------------------------------------------------------------
// Anotações
// ---------------------------------------------------------------------------

export interface Nota {
  id: string
  titulo: string
  texto: string
  fixada: boolean
  criadoEm: string
  atualizadoEm: string
}

export type DadosNota = Pick<Nota, 'titulo' | 'texto' | 'fixada'>

export function validarNota(d: Pick<DadosNota, 'titulo' | 'texto'>): string | null {
  return d.titulo.trim() || d.texto.trim() ? null : 'Escreva um título ou um texto.'
}

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Fixadas primeiro; depois a mais recentemente editada. `busca` olha título e texto (sem acento). */
export function organizarNotas(notas: Nota[], busca = ''): Nota[] {
  const q = semAcento(busca.trim())
  return notas
    .filter((n) => !q || semAcento(`${n.titulo} ${n.texto}`).includes(q))
    .sort((a, b) => Number(b.fixada) - Number(a.fixada) || b.atualizadoEm.localeCompare(a.atualizadoEm))
}
