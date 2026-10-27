import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import {
  exportarInventarioXlsx,
  mapearColunasInventario,
  montarItensImportados,
} from '@/lib/inventarioPlanilha'
import type { ItemInventario } from '@/lib/inventario'

// PNG 1x1 válido (vermelho).
const PNG_1X1 = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

const item = (o: Partial<ItemInventario>): ItemInventario => ({
  id: 'i1',
  nome: 'Notebook',
  statusVistoria: 'localizado',
  fotos: [],
  criadoEm: '2026-03-01T10:00:00Z',
  atualizadoEm: '2026-03-02T10:00:00Z',
  ...o,
})

describe('exportação .xlsx', () => {
  it('incorpora a foto principal como imagem real e grava dados fiscais e status', async () => {
    const itens = [
      item({
        id: 'a',
        nome: 'Notebook Dell',
        numeroNotaFiscal: '123',
        dataEmissaoNf: '2026-03-09',
        fornecedor: 'ACME',
        cnpj: '11222333000181',
        projetoNumero: 'P-1',
        fotos: [{ id: 'f1', caminho: 'a/f1.jpg', principal: true }],
      }),
      item({ id: 'b', nome: 'Monitor', statusVistoria: 'pendente' }),
    ]
    const { bytes, fotosEmbutidas } = await exportarInventarioXlsx(itens, async () => ({
      bytes: PNG_1X1.buffer.slice(0) as ArrayBuffer,
      extensao: 'png',
    }))
    expect(fotosEmbutidas).toBe(1)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes)
    const ws = wb.getWorksheet('Inventário')!
    expect(ws.getImages()).toHaveLength(1) // imagem de verdade, não texto/fórmula
    expect(wb.model.media).toHaveLength(1)
    expect(ws.getRow(2).getCell(4).value).toBe('123')
    expect(ws.getRow(2).getCell(5).value).toBe('09/03/2026')
    expect(ws.getRow(2).getCell(9).value).toBe('11.222.333/0001-81')
    expect(ws.getRow(2).getCell(13).value).toBe('Localizado')
    expect(ws.getRow(3).getCell(13).value).toBe('Pendente')
  })

  it('se uma foto não puder ser baixada, a linha sai sem imagem (não derruba a exportação)', async () => {
    const itens = [item({ fotos: [{ id: 'f1', caminho: 'x.jpg', principal: true }] })]
    const { fotosEmbutidas } = await exportarInventarioXlsx(itens, async () => null)
    expect(fotosEmbutidas).toBe(0)
  })
})

describe('quantidade', () => {
  it('exporta uma foto por unidade, cada uma em sua coluna, e a quantidade', async () => {
    const itens = [
      item({
        id: 'q',
        nome: 'Caixa de som',
        quantidade: 2,
        fotos: [
          { id: 'f1', caminho: 'q/1.jpg', principal: false },
          { id: 'f2', caminho: 'q/2.jpg', principal: true },
        ],
      }),
    ]
    const { bytes, fotosEmbutidas } = await exportarInventarioXlsx(itens, async () => ({
      bytes: PNG_1X1.buffer.slice(0) as ArrayBuffer,
      extensao: 'png',
    }))
    expect(fotosEmbutidas).toBe(2)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes)
    const ws = wb.getWorksheet('Inventário')!
    expect(ws.getImages()).toHaveLength(2)
    expect(ws.getRow(1).getCell(1).value).toBe('Foto 1')
    expect(ws.getRow(1).getCell(2).value).toBe('Foto 2')
    expect(ws.getRow(2).getCell(3).value).toBe(2) // Quantidade
  })

  it('importa a quantidade (inteiro ≥ 1); vazio vale 1 e ilegível avisa', () => {
    const mapa = mapearColunasInventario(['Descrição do Item', 'Quantidade de itens'])
    expect(mapa.quantidade).toBe('Quantidade de itens')
    const linhas = [
      { 'Descrição do Item': 'Caixa de som', 'Quantidade de itens': '2' },
      { 'Descrição do Item': 'Notebook', 'Quantidade de itens': '3,00' },
      { 'Descrição do Item': 'Mesa', 'Quantidade de itens': '' },
      { 'Descrição do Item': 'Cadeira', 'Quantidade de itens': 'muitas' },
      { 'Descrição do Item': 'Monitor', 'Quantidade de itens': '0' },
    ]
    const r = montarItensImportados(linhas, [2, 3, 4, 5, 6], mapa, [])
    expect(r.map((x) => x.dados.quantidade)).toEqual([2, 3, 1, 1, 1])
    expect(r[3].avisos).toContain('quantidade ilegível (usou 1)')
    expect(r[4].avisos).toContain('quantidade ilegível (usou 1)')
  })
})

describe('importação', () => {
  it('reconhece cabeçalhos comuns de planilha de inventário', () => {
    const m = mapearColunasInventario([
      'Descrição do Item',
      'Nota Fiscal',
      'Data de Emissão',
      'Nº de Série',
      'Fornecedor',
      'CNPJ',
      'Projeto',
      'Local',
      'Observações',
    ])
    expect(m.nome).toBe('Descrição do Item')
    expect(m.numeroNotaFiscal).toBe('Nota Fiscal')
    expect(m.dataEmissaoNf).toBe('Data de Emissão')
    expect(m.numeroSerie).toBe('Nº de Série')
    expect(m.fornecedor).toBe('Fornecedor')
    expect(m.cnpj).toBe('CNPJ')
    expect(m.projetoNumero).toBe('Projeto')
    expect(m.localizacao).toBe('Local')
  })

  it('importa o que dá, avisa dados ruins e ignora sem nome ou duplicado', () => {
    const mapa = mapearColunasInventario(['Item', 'NF', 'Série', 'CNPJ', 'Emissão'])
    const linhas = [
      { Item: 'Notebook', NF: '10', Série: 'S1', CNPJ: '11.222.333/0001-81', Emissão: '09/03/2026' },
      { Item: 'Monitor', NF: '10', Série: 'S2', CNPJ: '123', Emissão: 'sei lá' }, // CNPJ e data ruins → entra com aviso
      { Item: '', NF: '10', Série: 'S3', CNPJ: '', Emissão: '' }, // sem nome
      { Item: 'Notebook repetido', NF: '11', Série: 's1', CNPJ: '', Emissão: '' }, // mesma série
      { Item: 'Teclado', NF: '10', Série: '', CNPJ: '', Emissão: '' }, // mesma NF, item diferente: ok
    ]
    const r = montarItensImportados(linhas, [2, 3, 4, 5, 6], mapa, [])
    expect(r.map((x) => x.erro ?? 'ok')).toEqual(['ok', 'ok', 'Sem nome do item', 'Possível duplicado (mesmo número de série)', 'ok'])
    expect(r[0].dados.dataEmissaoNf).toBe('2026-03-09')
    expect(r[0].dados.cnpj).toBe('11222333000181')
    expect(r[1].dados.cnpj).toBeUndefined()
    expect(r[1].dados.dataEmissaoNf).toBeUndefined()
    expect(r[1].avisos).toHaveLength(2)
  })
})
