import { describe, expect, it } from 'vitest'
import {
  ocorrenciasDoDia,
  ocorrenciasNoPeriodo,
  rotuloQuando,
  rotuloRepeticao,
  validarEventoEquipe,
  type EventoEquipe,
} from './agendaEquipe'

const ev = (p: Partial<EventoEquipe> = {}): EventoEquipe => ({
  id: 'e1',
  titulo: 'Reunião',
  data: '2026-11-12', // quinta-feira
  diaInteiro: true,
  repeticao: 'nunca',
  ...p,
})

const datas = (eventos: EventoEquipe[], de: string, ate: string) => ocorrenciasNoPeriodo(eventos, de, ate).map((o) => o.data)

describe('ocorrenciasNoPeriodo', () => {
  it('evento único: só aparece dentro do período', () => {
    expect(datas([ev()], '2026-11-01', '2026-11-30')).toEqual(['2026-11-12'])
    expect(datas([ev()], '2026-12-01', '2026-12-31')).toEqual([])
  })

  it('evento de vários dias aparece em todos e entra por quem começou antes do período', () => {
    const e = ev({ data: '2026-11-10', dataFim: '2026-11-12' })
    const ocs = ocorrenciasNoPeriodo([e], '2026-11-11', '2026-11-30')
    expect(ocs).toHaveLength(1)
    expect(ocorrenciasDoDia(ocs, '2026-11-11')).toHaveLength(1)
    expect(ocorrenciasDoDia(ocs, '2026-11-13')).toHaveLength(0)
  })

  it('semanal: toda quinta, respeitando "repete até"', () => {
    const e = ev({ repeticao: 'semanal', repeteAte: '2026-12-03' })
    expect(datas([e], '2026-11-01', '2026-12-31')).toEqual(['2026-11-12', '2026-11-19', '2026-11-26', '2026-12-03'])
  })

  it('dias úteis pula o fim de semana', () => {
    const e = ev({ data: '2026-11-13', repeticao: 'dias_uteis' }) // sexta
    expect(datas([e], '2026-11-13', '2026-11-18')).toEqual(['2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18'])
  })

  it('mensal no dia 31 pula meses curtos', () => {
    const e = ev({ data: '2026-10-31', repeticao: 'mensal' })
    expect(datas([e], '2026-10-01', '2027-02-28')).toEqual(['2026-10-31', '2026-12-31', '2027-01-31'])
  })

  it('anual em 29/02 só em ano bissexto', () => {
    const e = ev({ data: '2024-02-29', repeticao: 'anual' })
    expect(datas([e], '2025-01-01', '2028-12-31')).toEqual(['2028-02-29'])
  })

  it('repetição com início antigo ainda aparece no período atual', () => {
    const e = ev({ data: '2025-01-02', repeticao: 'anual' })
    expect(datas([e], '2026-01-01', '2026-12-31')).toEqual(['2026-01-02'])
  })

  it('ordena: dia inteiro antes, depois por horário', () => {
    const a = ev({ id: 'a', titulo: 'B', diaInteiro: false, horaInicio: '14:00', horaFim: '15:00' })
    const b = ev({ id: 'b', titulo: 'A', diaInteiro: false, horaInicio: '09:00', horaFim: '10:00' })
    const c = ev({ id: 'c', titulo: 'C' })
    expect(ocorrenciasNoPeriodo([a, b, c], '2026-11-12', '2026-11-12').map((o) => o.evento.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('rótulos', () => {
  it('repetição', () => {
    expect(rotuloRepeticao('nunca', '2026-11-12')).toBe('Não se repete')
    expect(rotuloRepeticao('semanal', '2026-11-12')).toBe('Semanal: cada quinta-feira')
    expect(rotuloRepeticao('anual', '2026-11-12')).toBe('Anual em 12 de novembro')
    expect(rotuloRepeticao('mensal', '2026-11-12')).toBe('Mensal no dia 12')
  })
  it('quando', () => {
    const o = (p: Partial<EventoEquipe>, dataFim = '2026-11-12') => ({ evento: ev(p), data: '2026-11-12', dataFim })
    expect(rotuloQuando(o({}))).toBe('Dia inteiro')
    expect(rotuloQuando(o({ diaInteiro: false, horaInicio: '09:00', horaFim: '10:30' }))).toBe('09:00 – 10:30')
    expect(rotuloQuando(o({}, '2026-11-14'))).toBe('12/11 – 14/11')
  })
})

describe('validarEventoEquipe', () => {
  const base = { titulo: 'X', data: '2026-11-12', diaInteiro: true, repeticao: 'nunca' as const }
  it('aceita o básico', () => expect(validarEventoEquipe(base)).toBeNull())
  it('exige título', () => expect(validarEventoEquipe({ ...base, titulo: ' ' })).toMatch(/título/))
  it('fim antes do início', () => {
    expect(validarEventoEquipe({ ...base, dataFim: '2026-11-10' })).toMatch(/data final/)
    expect(validarEventoEquipe({ ...base, diaInteiro: false, horaInicio: '10:00', horaFim: '09:00' })).toMatch(/fim/)
  })
  it('link precisa ser http(s)', () => {
    expect(validarEventoEquipe({ ...base, linkVideo: 'meet.google.com/abc' })).toMatch(/http/)
    expect(validarEventoEquipe({ ...base, linkVideo: 'https://meet.google.com/abc' })).toBeNull()
  })
})
