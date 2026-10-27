import { describe, expect, it } from 'vitest'
import {
  detectarDuplicidades,
  fotosFaltando,
  pendenciasOficio,
  quantidadeDe,
  resumoVistoria,
  validarArquivoFoto,
  validarItem,
  type ItemInventario,
} from '@/lib/inventario'

const base = (o: Partial<ItemInventario>): ItemInventario => ({
  id: 'x',
  nome: 'Notebook Dell',
  statusVistoria: 'pendente',
  fotos: [],
  criadoEm: '2026-01-01T00:00:00Z',
  atualizadoEm: '2026-01-01T00:00:00Z',
  ...o,
})

describe('validarItem', () => {
  it('só o nome é obrigatório para salvar (registro preliminar)', () => {
    expect(validarItem({ nome: 'Monitor' })).toEqual({})
    expect(validarItem({ nome: '   ' })).toHaveProperty('nome')
  })
  it('CNPJ, quando preenchido, precisa ser válido', () => {
    expect(validarItem({ nome: 'A', cnpj: '11222333000181' })).toEqual({})
    expect(validarItem({ nome: 'A', cnpj: '11222333000180' })).toHaveProperty('cnpj')
  })
})

describe('pendenciasOficio', () => {
  const completo = {
    nome: 'Notebook',
    numeroNotaFiscal: '123',
    dataEmissaoNf: '2026-03-09',
    fornecedor: 'ACME Ltda',
    cnpj: '11222333000181',
    projetoNumero: 'CNPq 4500/2025',
  }
  it('vazio quando está tudo preenchido', () => expect(pendenciasOficio(completo)).toEqual([]))
  it('lista exatamente o que falta', () => {
    expect(pendenciasOficio({ nome: 'Notebook' })).toEqual([
      'Número da nota fiscal',
      'Data de emissão da nota fiscal',
      'Empresa fornecedora',
      'CNPJ da empresa',
      'Número do projeto de pesquisa',
    ])
  })
  it('CNPJ preenchido porém inválido também bloqueia', () => {
    expect(pendenciasOficio({ ...completo, cnpj: '11222333000180' })).toEqual(['CNPJ válido'])
  })
})

describe('detectarDuplicidades', () => {
  const existentes = [
    base({ id: 'a', nome: 'Notebook Dell', numeroSerie: 'ABC-123', numeroNotaFiscal: '55' }),
    base({ id: 'b', nome: 'Monitor LG', numeroNotaFiscal: '55' }),
  ]
  it('alerta por número de série igual (ignorando maiúsculas e símbolos)', () => {
    const r = detectarDuplicidades({ nome: 'Outro nome', numeroSerie: 'abc 123' }, existentes)
    expect(r.map((d) => d.item.id)).toEqual(['a'])
    expect(r[0].motivo).toMatch(/série/)
  })
  it('alerta por mesma nota fiscal + mesma descrição', () => {
    const r = detectarDuplicidades({ nome: 'monitor  lg', numeroNotaFiscal: '55' }, existentes)
    expect(r.map((d) => d.item.id)).toEqual(['b'])
  })
  it('NÃO alerta para itens diferentes na mesma nota fiscal', () => {
    expect(detectarDuplicidades({ nome: 'Teclado', numeroNotaFiscal: '55' }, existentes)).toEqual([])
  })
  it('ignora série genérica (N/A, S/N) e o próprio item em edição', () => {
    const comNA = [base({ id: 'c', numeroSerie: 'N/A' })]
    expect(detectarDuplicidades({ nome: 'X', numeroSerie: 'N/A' }, comNA)).toEqual([])
    expect(detectarDuplicidades({ nome: 'Notebook Dell', numeroSerie: 'ABC-123' }, existentes, 'a')).toEqual([])
  })
})

describe('validarArquivoFoto', () => {
  it('aceita jpg/png/webp dentro do limite', () => {
    expect(validarArquivoFoto({ type: 'image/jpeg', size: 1_000_000 })).toBeNull()
    expect(validarArquivoFoto({ type: 'image/webp', size: 1_000_000 })).toBeNull()
  })
  it('rejeita tipo não permitido e arquivo grande demais', () => {
    expect(validarArquivoFoto({ type: 'application/pdf', size: 10 })).toMatch(/JPG, PNG ou WebP/)
    expect(validarArquivoFoto({ type: 'image/gif', size: 10 })).not.toBeNull()
    expect(validarArquivoFoto({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toMatch(/5 MB/)
    expect(validarArquivoFoto({ type: 'image/jpeg', size: 6 * 1024 * 1024 }, 30)).toBeNull()
  })
})

describe('resumoVistoria', () => {
  it('conta localizados, não localizados e pendentes', () => {
    const r = resumoVistoria([
      { statusVistoria: 'localizado' },
      { statusVistoria: 'pendente' },
      { statusVistoria: 'nao_localizado' },
      { statusVistoria: 'pendente' },
    ])
    expect(r).toEqual({ total: 4, localizados: 1, naoLocalizados: 1, pendentes: 2 })
  })
})

describe('quantidade e fotos', () => {
  it('quantidade efetiva nunca é menor que 1', () => {
    expect(quantidadeDe({})).toBe(1)
    expect(quantidadeDe({ quantidade: 0 })).toBe(1)
    expect(quantidadeDe({ quantidade: 3 })).toBe(3)
  })
  it('conta as fotos que faltam: uma por unidade', () => {
    expect(fotosFaltando({ quantidade: 3, fotos: [{}] })).toBe(2)
    expect(fotosFaltando({ quantidade: 1, fotos: [{}] })).toBe(0)
    expect(fotosFaltando({ quantidade: 2, fotos: [{}, {}, {}] })).toBe(0)
    expect(fotosFaltando({ fotos: [] })).toBe(1)
  })
  it('valida a quantidade ao salvar', () => {
    expect(validarItem({ nome: 'A', quantidade: 2 })).toEqual({})
    expect(validarItem({ nome: 'A', quantidade: 0 })).toHaveProperty('quantidade')
    expect(validarItem({ nome: 'A', quantidade: 1.5 })).toHaveProperty('quantidade')
  })
})
