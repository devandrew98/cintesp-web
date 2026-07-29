import type { BlocoHorario, DiaSemana, HorarioDia } from '@/types'

/**
 * Helpers relacionados a horários de disponibilidade.
 * Centraliza rótulos dos dias e as opções de horário usadas nos <select>
 * do editor de horários (Administração > Horários).
 */

// Rótulo "bonito" para cada dia da semana (o back-end guarda o enum curto).
export const rotuloDia: Record<DiaSemana, string> = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
  domingo: 'Domingo',
}

// Ordem em que os dias aparecem no editor (semana útil primeiro).
export const ordemDias: DiaSemana[] = [
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
  'domingo',
]

/**
 * Gera as opções de horário (ex.: "06:00", "06:30", ... "20:00").
 * @param inicio hora inicial (padrão 6h)
 * @param fim    hora final (padrão 20h)
 * @param passo  intervalo em minutos (padrão 30)
 */
export function gerarOpcoesHorario(inicio = 6, fim = 20, passo = 30): string[] {
  const opcoes: string[] = []
  for (let min = inicio * 60; min <= fim * 60; min += passo) {
    const h = String(Math.floor(min / 60)).padStart(2, '0')
    const m = String(min % 60).padStart(2, '0')
    opcoes.push(`${h}:${m}`)
  }
  return opcoes
}

// Lista pronta para reutilizar (evita regerar a cada render).
export const opcoesHorario = gerarOpcoesHorario()

// ============================================================
// Cálculos usados na tela "Administração > Horários"
// ============================================================

/** "09:30" → 570 (minutos desde a meia-noite). */
function paraMinutos(hhmm: string): number {
  const [h, m] = (hhmm || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Duração de um bloco em minutos. Devolve 0 se estiver desligado ou se o
 * fim vier antes do início (dado inconsistente não vira hora negativa).
 */
function duracaoBloco(bloco: BlocoHorario): number {
  if (!bloco?.ativo) return 0
  const minutos = paraMinutos(bloco.fim) - paraMinutos(bloco.inicio)
  return minutos > 0 ? minutos : 0
}

/** Total de horas semanais de um horário (manhã + tarde de todos os dias). */
export function horasSemanais(horarios: HorarioDia[]): number {
  const minutos = (horarios ?? []).reduce(
    (total, h) => total + duracaoBloco(h.manha) + duracaoBloco(h.tarde),
    0,
  )
  return minutos / 60
}

/** Quantos dias da semana têm pelo menos um turno ligado. */
export function diasAtivos(horarios: HorarioDia[]): number {
  return (horarios ?? []).filter((h) => h.manha?.ativo || h.tarde?.ativo).length
}

/** Formata horas decimais para exibição: 7.5 → "7h30". */
export function formatarHoras(horas: number): string {
  const total = Math.round(horas * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

// ============================================================
// Disponibilidade calculada a partir do horário
// ============================================================

/** Converte o dia da semana do JavaScript (0=domingo) para o nosso enum. */
const DIA_DA_SEMANA: DiaSemana[] = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
]

/**
 * Descobre a situação do pesquisador AGORA, olhando só o horário cadastrado.
 *
 * Dentro de um turno ligado (manhã ou tarde) → `disponivel`.
 * Fora disso (inclusive fim de semana e intervalo de almoço) → `ausente`.
 *
 * É isso que faz o quadro se atualizar sozinho ao longo do dia, sem ninguém
 * precisar clicar em nada.
 *
 * @param horarios horários da semana da pessoa
 * @param agora    momento de referência (padrão: agora)
 */
export function disponibilidadePorHorario(
  horarios: HorarioDia[] | undefined,
  agora: Date = new Date(),
): { status: 'disponivel' | 'ausente'; livreAte?: string } {
  if (!horarios || horarios.length === 0) return { status: 'ausente' }

  const doDia = horarios.find((h) => h.dia === DIA_DA_SEMANA[agora.getDay()])
  if (!doDia) return { status: 'ausente' }

  const minutosAgora = agora.getHours() * 60 + agora.getMinutes()

  // Verifica manhã e tarde; o turno que estiver valendo define o "livre até".
  for (const bloco of [doDia.manha, doDia.tarde]) {
    if (!bloco?.ativo) continue
    const inicio = paraMinutos(bloco.inicio)
    const fim = paraMinutos(bloco.fim)
    if (minutosAgora >= inicio && minutosAgora < fim) {
      return { status: 'disponivel', livreAte: bloco.fim }
    }
  }

  return { status: 'ausente' }
}

/** Quantas pessoas cobrem cada turno de cada dia. */
export interface CoberturaDia {
  dia: DiaSemana
  manha: number
  tarde: number
}

/**
 * Monta o quadro de cobertura da semana: para cada dia, quantas pessoas
 * estão disponíveis de manhã e à tarde.
 *
 * @param horariosPorUsuario mapa id do usuário → horários da semana
 */
export function calcularCobertura(
  horariosPorUsuario: Record<string, HorarioDia[]>,
): CoberturaDia[] {
  return ordemDias.map((dia) => {
    let manha = 0
    let tarde = 0
    for (const horarios of Object.values(horariosPorUsuario)) {
      const doDia = horarios?.find((h) => h.dia === dia)
      if (doDia?.manha?.ativo) manha++
      if (doDia?.tarde?.ativo) tarde++
    }
    return { dia, manha, tarde }
  })
}
