import { MESES, dataBR, diaDaSemana, ehDiaUtil, montarData, nomeDiaSemana, partesData, somarDias } from '@/lib/agendamento'

/**
 * Agenda da EQUIPE (substitui o Google Agenda embutido): eventos que só o administrador
 * cadastra e todos os pesquisadores veem, no estilo do Google Agenda (dia inteiro, vários dias,
 * repetição, local, link de videoconferência).
 *
 * Datas são "yyyy-mm-dd" e horas "HH:MM" (strings, sem fuso) — mesma convenção do agendamento.
 */

export type Repeticao = 'nunca' | 'diaria' | 'semanal' | 'mensal' | 'anual' | 'dias_uteis'

export interface EventoEquipe {
  id: string
  titulo: string
  descricao?: string
  local?: string
  /** Link de videoconferência (Meet, Teams, Zoom…). */
  linkVideo?: string
  /** Primeiro dia. */
  data: string
  /** Último dia (eventos de vários dias). Ausente = mesmo dia. */
  dataFim?: string
  diaInteiro: boolean
  horaInicio?: string
  horaFim?: string
  repeticao: Repeticao
  /** Última data em que a repetição vale (inclusive). Ausente = para sempre. */
  repeteAte?: string
}

/** Uma ocorrência concreta de um evento (o evento repetido gera várias). */
export interface Ocorrencia {
  evento: EventoEquipe
  /** Primeiro dia desta ocorrência. */
  data: string
  /** Último dia desta ocorrência. */
  dataFim: string
}

/** Diferença em dias entre duas datas ISO (b - a). */
export function diffDias(a: string, b: string): number {
  const pa = partesData(a)
  const pb = partesData(b)
  return Math.round((Date.UTC(pb.a, pb.m - 1, pb.d) - Date.UTC(pa.a, pa.m - 1, pa.d)) / 86_400_000)
}

/** Quantos dias a mais o evento ocupa além do primeiro (0 = um dia só). */
const duracaoEmDias = (e: EventoEquipe) => (e.dataFim && e.dataFim > e.data ? diffDias(e.data, e.dataFim) : 0)

/** Datas de início das repetições, em ordem, a partir do primeiro dia (inclusive). */
function* inicios(e: EventoEquipe, ate: string): Generator<string> {
  const { a, m, d } = partesData(e.data)
  switch (e.repeticao) {
    case 'nunca':
      yield e.data
      return
    case 'diaria':
    case 'semanal':
    case 'dias_uteis': {
      const passo = e.repeticao === 'semanal' ? 7 : 1
      for (let dia = e.data; dia <= ate; dia = somarDias(dia, passo)) {
        if (e.repeticao === 'dias_uteis' && !ehDiaUtil(dia)) continue
        yield dia
      }
      return
    }
    case 'mensal': {
      for (let k = 0; ; k++) {
        const dt = new Date(a, m - 1 + k, d)
        // Dia 31 num mês de 30 dias "estoura" para o mês seguinte: pula esse mês.
        if (dt.getDate() !== d) continue
        const iso = montarData(dt.getFullYear(), dt.getMonth() + 1, d)
        if (iso > ate) return
        yield iso
      }
    }
    case 'anual': {
      for (let k = 0; ; k++) {
        const dt = new Date(a + k, m - 1, d)
        if (dt.getMonth() !== m - 1) continue // 29/02 em ano não bissexto
        const iso = montarData(a + k, m, d)
        if (iso > ate) return
        yield iso
      }
    }
  }
}

/** Ocorrências que tocam o período [de, ate] (inclusive), ordenadas por data e horário. */
export function ocorrenciasNoPeriodo(eventos: EventoEquipe[], de: string, ate: string): Ocorrencia[] {
  const saida: Ocorrencia[] = []
  for (const evento of eventos) {
    const dur = duracaoEmDias(evento)
    const limite = evento.repeteAte && evento.repeteAte < ate ? evento.repeteAte : ate
    for (const inicio of inicios(evento, limite)) {
      const fim = somarDias(inicio, dur)
      if (fim < de) continue
      if (inicio > ate) break
      saida.push({ evento, data: inicio, dataFim: fim })
    }
  }
  return saida.sort(
    (x, y) =>
      x.data.localeCompare(y.data) ||
      Number(y.evento.diaInteiro) - Number(x.evento.diaInteiro) ||
      (x.evento.horaInicio ?? '').localeCompare(y.evento.horaInicio ?? '') ||
      x.evento.titulo.localeCompare(y.evento.titulo),
  )
}

/** Ocorrências que acontecem em um dia específico. */
export const ocorrenciasDoDia = (ocs: Ocorrencia[], iso: string) => ocs.filter((o) => o.data <= iso && iso <= o.dataFim)

const DIAS_SEMANA_LOWER = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

/** Texto da repetição, como no Google Agenda ("Semanal: cada quinta-feira"). */
export function rotuloRepeticao(r: Repeticao, data: string): string {
  const { m, d } = partesData(data)
  switch (r) {
    case 'nunca':
      return 'Não se repete'
    case 'diaria':
      return 'Todos os dias'
    case 'semanal':
      return `Semanal: cada ${DIAS_SEMANA_LOWER[diaDaSemana(data)]}`
    case 'mensal':
      return `Mensal no dia ${d}`
    case 'anual':
      return `Anual em ${d} de ${MESES[m - 1].toLowerCase()}`
    case 'dias_uteis':
      return 'Todos os dias da semana (segunda a sexta-feira)'
  }
}

export const REPETICOES: Repeticao[] = ['nunca', 'diaria', 'semanal', 'mensal', 'anual', 'dias_uteis']

/** "Dia inteiro", "09:00 – 10:30" ou "12/11 – 14/11". */
export function rotuloQuando(o: Ocorrencia): string {
  const multi = o.dataFim > o.data
  if (multi) return `${dataBR(o.data).slice(0, 5)} – ${dataBR(o.dataFim).slice(0, 5)}`
  if (o.evento.diaInteiro || !o.evento.horaInicio) return 'Dia inteiro'
  return o.evento.horaFim ? `${o.evento.horaInicio} – ${o.evento.horaFim}` : o.evento.horaInicio
}

/** "Hoje", "Amanhã" ou "Quinta-feira, 12/11/2026". */
export function rotuloDia(iso: string, hoje: string): string {
  if (iso === hoje) return 'Hoje'
  if (iso === somarDias(hoje, 1)) return 'Amanhã'
  return `${nomeDiaSemana(iso)}, ${dataBR(iso)}`
}

/** Valida o formulário; devolve a mensagem de erro ou null. */
export function validarEventoEquipe(e: Omit<EventoEquipe, 'id'>): string | null {
  if (!e.titulo.trim()) return 'Informe um título.'
  if (!e.data) return 'Informe a data.'
  if (e.dataFim && e.dataFim < e.data) return 'A data final não pode ser antes da inicial.'
  if (!e.diaInteiro) {
    if (!e.horaInicio || !e.horaFim) return 'Informe o horário de início e de fim.'
    const mesmoDia = !e.dataFim || e.dataFim === e.data
    if (mesmoDia && e.horaFim <= e.horaInicio) return 'O horário de fim precisa ser depois do início.'
  }
  if (e.repeteAte && e.repeteAte < e.data) return 'A repetição não pode terminar antes do primeiro dia.'
  if (e.linkVideo?.trim() && !/^https?:\/\//i.test(e.linkVideo.trim())) return 'O link da videoconferência deve começar com http:// ou https://.'
  return null
}
