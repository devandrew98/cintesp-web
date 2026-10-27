import { describe, expect, it } from 'vitest'
import {
  DadosOficioIncompletosError,
  dataBR,
  gerarOficioTombamento,
  nomeArquivoOficio,
  textoCorpoOficio,
  type DadosOficio,
} from '@/lib/oficioTombamento'

const dados: DadosOficio = {
  nome: 'Notebook Dell Latitude',
  numeroNotaFiscal: '12345',
  dataEmissaoNf: '2026-03-09',
  numeroSerie: 'SN-998',
  fornecedor: 'ACME Informática Ltda',
  cnpj: '11222333000181',
  projetoNumero: '400123/2025-0',
  projetoNome: 'Robótica assistiva',
}

const texto = (b: Uint8Array) => new TextDecoder('latin1').decode(b)

describe('ofício de tombamento', () => {
  it('substitui todos os marcadores do texto institucional pelos dados do item', () => {
    expect(textoCorpoOficio(dados)).toBe(
      'ATESTO que o Material constante na NOTA FISCAL nº 12345, da empresa ACME Informática Ltda CNPJ 11.222.333/0001-81 ' +
        'datada de 09/03/2026, foi recebido e aceito, em conformidade com o projeto de Pesquisa 400123/2025-0 do CNPQ. ' +
        'SOLICITAMOS o tombamento do(s) referido(s) item(ns) constante(s) na Nota Fiscal e Ordem de Serviço descritos acima.',
    )
  })

  it('formata a data no padrão brasileiro sem deslocar o dia por fuso', () => {
    expect(dataBR('2026-01-01')).toBe('01/01/2026')
    expect(dataBR('2026-12-31')).toBe('31/12/2026')
  })

  it('gera nome de arquivo descritivo, sem acentos nem símbolos', () => {
    expect(nomeArquivoOficio('Notebook Dell Latitude')).toBe('Oficio_Tombamento_NotebookDellLatitude.pdf')
    expect(nomeArquivoOficio('Câmera / Ação #2')).toBe('Oficio_Tombamento_CameraAcao2.pdf')
  })

  it('NÃO gera o PDF quando faltam dados obrigatórios — e diz quais', async () => {
    await expect(gerarOficioTombamento({ nome: 'X' }, { papelTimbrado: null })).rejects.toBeInstanceOf(
      DadosOficioIncompletosError,
    )
    try {
      await gerarOficioTombamento({ ...dados, fornecedor: '', projetoNumero: undefined }, { papelTimbrado: null })
      throw new Error('deveria falhar')
    } catch (e) {
      expect((e as DadosOficioIncompletosError).campos).toEqual(['Empresa fornecedora', 'Número do projeto de pesquisa'])
    }
  })

  it('gera um PDF A4 de verdade, com os dados reais e o número de série quando existe', async () => {
    const r = await gerarOficioTombamento(dados, { papelTimbrado: null, emitidoEm: new Date(2026, 2, 10) })
    const pdf = texto(r.bytes)
    expect(pdf.startsWith('%PDF')).toBe(true)
    expect(pdf).toMatch(/MediaBox \[0(\.0+)? 0(\.0+)? 595\.2\d* 841\.8\d*\]/) // A4 em pontos
    expect(pdf).toContain('(12345)')
    expect(pdf).toContain('SN-998')
    expect(pdf).toContain('11.222.333/0001-81')
    expect(r.nomeArquivo).toBe('Oficio_Tombamento_NotebookDellLatitude.pdf')
    expect(r.semPapelTimbrado).toBe(true) // sem fundo nos testes
  })

  it('omite a linha de número de série quando o item não tem', async () => {
    const r = await gerarOficioTombamento({ ...dados, numeroSerie: undefined }, { papelTimbrado: null })
    expect(texto(r.bytes)).not.toContain('de série')
  })
})

describe('ofício — quantidade', () => {
  it('inclui a linha de quantidade só quando há mais de uma unidade', async () => {
    const com = await gerarOficioTombamento({ ...dados, quantidade: 3 }, { papelTimbrado: null })
    const sem = await gerarOficioTombamento({ ...dados, quantidade: 1 }, { papelTimbrado: null })
    expect(texto(com.bytes)).toContain('(Quantidade)')
    expect(texto(sem.bytes)).not.toContain('(Quantidade)')
  })
})
