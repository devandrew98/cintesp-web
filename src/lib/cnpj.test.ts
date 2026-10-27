import { describe, expect, it } from 'vitest'
import { cnpjValido, mascararCNPJ, normalizarCNPJ } from '@/lib/cnpj'

describe('cnpj', () => {
  it('valida CNPJs reais (com e sem máscara)', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11222333000181')).toBe(true)
    expect(cnpjValido('00.000.000/0001-91')).toBe(true) // Banco do Brasil
  })

  it('rejeita dígito verificador errado, tamanho errado e sequência repetida', () => {
    expect(cnpjValido('11.222.333/0001-80')).toBe(false)
    expect(cnpjValido('1122233300018')).toBe(false)
    expect(cnpjValido('11111111111111')).toBe(false)
    expect(cnpjValido('')).toBe(false)
    expect(cnpjValido(undefined)).toBe(false)
  })

  it('normaliza e aplica a máscara progressivamente', () => {
    expect(normalizarCNPJ('11.222.333/0001-81')).toBe('11222333000181')
    expect(mascararCNPJ('11222333000181')).toBe('11.222.333/0001-81')
    expect(mascararCNPJ('1122')).toBe('11.22')
    expect(mascararCNPJ('112223330001810000')).toBe('11.222.333/0001-81') // corta no 14º dígito
    expect(mascararCNPJ('')).toBe('')
  })
})
