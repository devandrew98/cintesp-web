import { describe, expect, it } from 'vitest'
import { gerarHtmlSislab, linhasSislab, tamanhoQueCabe, validarSislab, valoresPadraoSislab } from './assinaturaSislab'

const dados = { ...valoresPadraoSislab(), nome: 'maria da conceição', cargo: 'Designer', email: 'maria@ufu.br' }

describe('assinatura SisLAB', () => {
  it('exige nome, cargo, laboratório e e-mail; vínculo é opcional', () => {
    expect(validarSislab(valoresPadraoSislab())).toEqual(['nome', 'cargo', 'email'])
    expect(validarSislab(dados)).toEqual([])
  })
  it('nome em maiúsculas e posições fixas, com ou sem vínculo', () => {
    const sem = linhasSislab(dados)
    expect(sem[0].texto).toBe('MARIA DA CONCEIÇÃO')
    expect(sem.map((l) => l.y)).toEqual([26.8, 39.3, 71.8, 84])
    expect(linhasSislab({ ...dados, vinculo: 'Pesquisadora Finep' }).map((l) => l.y)).toEqual([26.8, 39.3, 59.7, 71.8, 84])
  })
  it('texto longo diminui em vez de ser cortado', () => {
    expect(tamanhoQueCabe(9, 100, 196)).toBe(9)
    expect(tamanhoQueCabe(14, 392, 196)).toBe(7)
  })
  it('escapa o texto alternativo', () => {
    const html = gerarHtmlSislab({ ...dados, nome: '"><script>' }, 'data:image/png;base64,AA')
    expect(html).not.toContain('<script>')
    expect(html).toContain('width="400"')
  })
})
