import { describe, expect, it } from 'vitest'
import { acessoEsquecidoAberto } from './acessoAberto'
import type { RegistroPonto } from '@/types'

const reg = (id: string, tipo: RegistroPonto['tipo'], registradoEm: string): RegistroPonto =>
  ({ id, usuarioId: 'u1', tipo, registradoEm, terminalId: 't', origem: 'terminal', editado: false }) as unknown as RegistroPonto

const dia = (iso: string) => iso.slice(0, 10)

describe('acessoEsquecidoAberto', () => {
  it('entrada de ontem sem saída → aviso', () => {
    const r = acessoEsquecidoAberto([reg('1', 'entrada', '2026-11-09T13:00:00')], '2026-11-10', dia)
    expect(r?.id).toBe('1')
  })
  it('entrada de hoje sem saída ainda é normal', () => {
    expect(acessoEsquecidoAberto([reg('1', 'entrada', '2026-11-10T08:00:00')], '2026-11-10', dia)).toBeNull()
  })
  it('entrada e saída de ontem → sem aviso', () => {
    expect(acessoEsquecidoAberto([reg('1', 'entrada', '2026-11-09T08:00:00'), reg('2', 'saida', '2026-11-09T17:00:00')], '2026-11-10', dia)).toBeNull()
  })
  it('só considera o último registro e ignora faltas', () => {
    const rs = [reg('1', 'entrada', '2026-11-08T08:00:00'), reg('2', 'saida', '2026-11-08T17:00:00'), reg('3', 'falta', '2026-11-09T12:00:00')]
    expect(acessoEsquecidoAberto(rs, '2026-11-10', dia)).toBeNull()
  })
  it('sem registros → null', () => expect(acessoEsquecidoAberto([], '2026-11-10', dia)).toBeNull())
})
