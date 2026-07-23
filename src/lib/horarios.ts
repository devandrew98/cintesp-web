import type { DiaSemana } from '@/types'

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
