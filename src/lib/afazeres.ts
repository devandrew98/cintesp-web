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
  /** Tarefa de projeto: para quais status posso levar. Ausente = qualquer um (tarefa pessoal). */
  permitidos?: StatusTarefa[]
  /** false = não posso mudar o prazo. */
  podePrazo?: boolean
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

export interface GruposPrazo {
  atrasadas: ItemAfazer[]
  hoje: ItemAfazer[]
  amanha: ItemAfazer[]
  /** Depois de amanhã até o domingo desta semana. */
  estaSemana: ItemAfazer[]
  /** Segunda a domingo da semana seguinte. */
  semanaQueVem: ItemAfazer[]
  depois: ItemAfazer[]
  semData: ItemAfazer[]
}

const somar = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Domingo da semana de `iso` (a semana vai de segunda a domingo). Se já é domingo, é o próprio dia. */
export const fimDaSemana = (iso: string): string => somar(iso, (7 - new Date(`${iso}T12:00:00`).getDay()) % 7)

/** Tarefas ABERTAS separadas por prazo: atrasadas, hoje, amanhã, esta semana, semana que vem, depois e sem data. */
export function agruparPorPrazo(itens: ItemAfazer[], hoje: string): GruposPrazo {
  const amanha = somar(hoje, 1)
  const fimSemana = fimDaSemana(hoje)
  const fimProxima = somar(fimSemana, 7)
  const g: GruposPrazo = { atrasadas: [], hoje: [], amanha: [], estaSemana: [], semanaQueVem: [], depois: [], semData: [] }
  for (const i of itens) {
    if (i.status === 'concluido') continue
    const d = i.dataEntrega
    if (!d) g.semData.push(i)
    else if (d < hoje) g.atrasadas.push(i)
    else if (d === hoje) g.hoje.push(i)
    else if (d === amanha) g.amanha.push(i)
    else if (d <= fimSemana) g.estaSemana.push(i)
    else if (d <= fimProxima) g.semanaQueVem.push(i)
    else g.depois.push(i)
  }
  return {
    atrasadas: ordenarPorPrazo(g.atrasadas),
    hoje: ordenarPorPrazo(g.hoje),
    amanha: ordenarPorPrazo(g.amanha),
    estaSemana: ordenarPorPrazo(g.estaSemana),
    semanaQueVem: ordenarPorPrazo(g.semanaQueVem),
    depois: ordenarPorPrazo(g.depois),
    semData: ordenarPorPrazo(g.semData),
  }
}

/** Abertas com prazo de hoje até o domingo desta semana (inclui hoje). */
export const contarDaSemana = (itens: ItemAfazer[], hoje: string): number => {
  const fim = fimDaSemana(hoje)
  return itens.filter((i) => i.status !== 'concluido' && i.dataEntrega && i.dataEntrega >= hoje && i.dataEntrega <= fim).length
}

export type PeriodoTarefas = 'passadas' | 'hoje' | 'amanha' | 'estaSemana' | 'semanaQueVem' | 'semData'

/** Tarefas de um período (inclui as concluídas, para as colunas de status). "Hoje" também traz as atrasadas em aberto. */
export function filtrarPorPeriodo(itens: ItemAfazer[], periodo: PeriodoTarefas, hoje: string): ItemAfazer[] {
  const amanha = somar(hoje, 1)
  const fim = fimDaSemana(hoje)
  const dentro = (i: ItemAfazer): boolean => {
    const d = i.dataEntrega
    if (periodo === 'semData') return !d
    if (!d) return false
    if (periodo === 'passadas') return d < hoje
    if (periodo === 'hoje') return d === hoje || (d < hoje && i.status !== 'concluido')
    if (periodo === 'amanha') return d === amanha
    if (periodo === 'estaSemana') return d > amanha && d <= fim
    return d > fim && d <= somar(fim, 7)
  }
  const lista = ordenarPorPrazo(itens.filter(dentro))
  return periodo === 'passadas' ? lista.reverse() : lista // passadas: a mais recente primeiro
}

/** Prazo de uma tarefa criada dentro de um período. `null` = não dá para criar nele (passado, ou a semana acabou). */
export function prazoDoPeriodo(periodo: PeriodoTarefas, hoje: string): string | undefined | null {
  if (periodo === 'semData') return undefined
  if (periodo === 'passadas') return null
  if (periodo === 'hoje') return hoje
  if (periodo === 'amanha') return somar(hoje, 1)
  const fim = fimDaSemana(hoje)
  if (periodo === 'estaSemana') return fim > somar(hoje, 1) ? fim : null
  return somar(fim, 1)
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
