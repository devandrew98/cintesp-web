/** Regras puras dos gráficos do projeto (Gantt, barras, causa e efeito). Datas "yyyy-mm-dd". */
import type { GrupoTarefas } from '@/lib/grupos'
import { ordenarTarefas, type Tarefa } from '@/lib/tarefas'

const DIA = 86_400_000
const emDias = (d: string): number => Math.round(Date.parse(`${d}T00:00:00Z`) / DIA)
const deDias = (n: number): string => new Date(n * DIA).toISOString().slice(0, 10)

export interface BarraGantt {
  tarefa: Tarefa
  /** Dias desde o começo do gráfico. */
  desloc: number
  /** Duração em dias (mínimo 1, contando o primeiro e o último). */
  dias: number
}

export interface Gantt {
  inicio: string
  totalDias: number
  grupos: { id: string; titulo: string; barras: BarraGantt[] }[]
  /** Posição de hoje (dias desde o começo) ou null se estiver fora do período. */
  hoje: number | null
  meses: { desloc: number; dias: number; rotulo: string }[]
  semData: Tarefa[]
}

/** Período de uma tarefa: com uma data só, ela vale como início e fim. */
function periodo(t: Tarefa): [number, number] | null {
  const ini = t.dataInicio ?? t.dataEntrega
  const fim = t.dataEntrega ?? t.dataInicio
  return ini && fim ? [emDias(ini), Math.max(emDias(ini), emDias(fim))] : null
}

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function montarGantt(grupos: Pick<GrupoTarefas, 'id' | 'titulo'>[], tarefas: Tarefa[], hoje: string): Gantt | null {
  const datadas = tarefas.map(periodo).filter((p): p is [number, number] => p !== null)
  if (datadas.length === 0) return null
  const ini = Math.min(...datadas.map((p) => p[0])) - 2
  const fim = Math.max(...datadas.map((p) => p[1])) + 2
  const totalDias = fim - ini + 1

  const meses: Gantt['meses'] = []
  for (let d = ini; d <= fim; d++) {
    const iso = deDias(d)
    const rotulo = `${NOMES_MES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`
    const ultimo = meses[meses.length - 1]
    if (ultimo?.rotulo === rotulo) ultimo.dias++
    else meses.push({ desloc: d - ini, dias: 1, rotulo })
  }

  const h = emDias(hoje) - ini
  return {
    inicio: deDias(ini),
    totalDias,
    meses,
    hoje: h >= 0 && h < totalDias ? h : null,
    semData: tarefas.filter((t) => !periodo(t)),
    grupos: grupos
      .map((g) => ({
        id: g.id,
        titulo: g.titulo,
        barras: ordenarTarefas(tarefas.filter((t) => t.grupoId === g.id)).flatMap((t) => {
          const p = periodo(t)
          return p ? [{ tarefa: t, desloc: p[0] - ini, dias: p[1] - p[0] + 1 }] : []
        }),
      }))
      .filter((g) => g.barras.length > 0),
  }
}

/** Abertas e concluídas por responsável, quem tem mais tarefas primeiro. */
export function porResponsavel(tarefas: Tarefa[]): { nome: string; concluidas: number; abertas: number }[] {
  const mapa = new Map<string, { nome: string; concluidas: number; abertas: number }>()
  for (const t of tarefas) {
    const chave = t.responsavelId ?? ''
    const linha = mapa.get(chave) ?? { nome: t.responsavelNome ?? 'Sem responsável', concluidas: 0, abertas: 0 }
    if (t.status === 'concluido') linha.concluidas++
    else linha.abertas++
    mapa.set(chave, linha)
  }
  return [...mapa.values()].sort((a, b) => b.concluidas + b.abertas - (a.concluidas + a.abertas) || a.nome.localeCompare(b.nome))
}

// ---------------- causa e efeito (Ishikawa) ----------------

export const CATEGORIAS_CAUSA = [
  { id: 'metodo', label: 'Método' },
  { id: 'maoDeObra', label: 'Mão de obra' },
  { id: 'material', label: 'Material' },
  { id: 'medida', label: 'Medida' },
  { id: 'meioAmbiente', label: 'Meio ambiente' },
  { id: 'maquina', label: 'Máquina' },
] as const

export type CategoriaCausa = (typeof CATEGORIAS_CAUSA)[number]['id']
export const MAX_CAUSAS = 5

export interface CausaEfeito {
  efeito: string
  causas: Partial<Record<CategoriaCausa, string[]>>
}

/** Uma causa por linha; ignora linhas vazias e respeita o limite que cabe no desenho. */
export const linhasParaCausas = (texto: string): string[] =>
  texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_CAUSAS)

/** Quebra um texto em linhas curtas para o desenho; o excesso vira reticências. */
export function quebrarTexto(texto: string, porLinha: number, maxLinhas: number): string[] {
  const linhas: string[] = []
  for (const palavra of texto.trim().split(/\s+/).filter(Boolean)) {
    const atual = linhas[linhas.length - 1]
    if (atual !== undefined && `${atual} ${palavra}`.length <= porLinha) linhas[linhas.length - 1] = `${atual} ${palavra}`
    else linhas.push(palavra)
  }
  const cortar = (l: string) => (l.length > porLinha ? `${l.slice(0, porLinha - 1)}…` : l)
  if (linhas.length <= maxLinhas) return linhas.map(cortar)
  const visiveis = linhas.slice(0, maxLinhas).map(cortar)
  visiveis[maxLinhas - 1] = `${visiveis[maxLinhas - 1].slice(0, porLinha - 1)}…`
  return visiveis
}
