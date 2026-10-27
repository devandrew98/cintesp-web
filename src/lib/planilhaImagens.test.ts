import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { extrairImagensPlanilha } from '@/lib/planilhaImagens'
import { mapearColunasInventario } from '@/lib/inventarioPlanilha'

// PNG 1x1 válido.
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const rels = (itens: [string, string, string][]) =>
  `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${itens
    .map(([id, tipo, alvo]) => `<Relationship Id="${id}" Type="${REL}/${tipo}" Target="${alvo}"/>`)
    .join('')}</Relationships>`

const ancora = (col: number, row: number, rid: string) =>
  `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
  `<xdr:to><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
  `<xdr:pic><xdr:blipFill><a:blip r:embed="${rid}"/></xdr:blipFill></xdr:pic></xdr:twoCellAnchor>`

/** Monta um .xlsx mínimo com 2 fotos flutuantes na linha 3, uma foto "na célula" (D5) e uma .emf (ignorada). */
async function montarXlsx(): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="Itens" sheetId="1" r:id="rId1"/></sheets></workbook>')
  zip.file('xl/_rels/workbook.xml.rels', rels([['rId1', 'worksheet', 'worksheets/sheet1.xml']]))
  zip.file(
    'xl/worksheets/sheet1.xml',
    '<worksheet><sheetData><row r="5"><c r="D5" t="e" vm="1"><v>#VALUE!</v></c></row></sheetData></worksheet>',
  )
  zip.file('xl/worksheets/_rels/sheet1.xml.rels', rels([['rId1', 'drawing', '../drawings/drawing1.xml']]))
  zip.file(
    'xl/drawings/drawing1.xml',
    `<xdr:wsDr>${ancora(3, 2, 'rId1')}${ancora(3, 2, 'rId2')}${ancora(3, 9, 'rId3')}</xdr:wsDr>`,
  )
  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    rels([
      ['rId1', 'image', '../media/a.png'],
      ['rId2', 'image', '../media/b.jpeg'],
      ['rId3', 'image', '../media/c.emf'],
    ]),
  )
  // Valor rico: vm=1 → valueMetadata[0] → futureMetadata[0] → rvb i=0 → rv[0] → rel[1] → media/d.png
  zip.file(
    'xl/metadata.xml',
    '<metadata><futureMetadata name="XLRICHVALUE" count="1"><bk><extLst><ext><xlrd:rvb i="0"/></ext></extLst></bk></futureMetadata>' +
      '<valueMetadata count="1"><bk><rc t="1" v="0"/></bk></valueMetadata></metadata>',
  )
  zip.file(
    'xl/richData/rdrichvaluestructure.xml',
    '<rvStructures><s t="_localImage"><k n="CalcOrigin" t="i"/><k n="_rvRel:LocalImageIdentifier" t="i"/></s></rvStructures>',
  )
  zip.file('xl/richData/rdrichvalue.xml', '<rvData><rv s="0"><v>5</v><v>1</v></rv></rvData>') // estrutura: [CalcOrigin, Local…]
  zip.file('xl/richData/richValueRel.xml', '<richValueRels><rel r:id="rId7"/><rel r:id="rId8"/></richValueRels>')
  zip.file(
    'xl/richData/_rels/richValueRel.xml.rels',
    rels([
      ['rId7', 'image', '../media/errada.png'],
      ['rId8', 'image', '../media/d.png'],
    ]),
  )
  for (const nome of ['a.png', 'd.png', 'errada.png']) zip.file(`xl/media/${nome}`, PNG)
  zip.file('xl/media/b.jpeg', new Uint8Array([0xff, 0xd8, 0xff]))
  zip.file('xl/media/c.emf', new Uint8Array([1, 2, 3]))
  return zip.generateAsync({ type: 'uint8array' })
}

describe('extrairImagensPlanilha', () => {
  it('lê fotos flutuantes e fotos dentro da célula, cada uma na sua linha', async () => {
    const r = await extrairImagensPlanilha(await montarXlsx())
    expect(r.total).toBe(3)
    expect(r.ignoradas).toBe(1) // .emf não é suportado

    // Linhas 1-based: âncora com row=2 (0-based) → linha 3; D5 → linha 5.
    expect([...r.porLinha.keys()]).toEqual([3, 5])
    expect(r.porLinha.get(3)!.map((i) => [i.tipo, i.origem])).toEqual([
      ['image/png', 'flutuante'],
      ['image/jpeg', 'flutuante'],
    ])
    const naCelula = r.porLinha.get(5)!
    expect(naCelula).toHaveLength(1)
    expect(naCelula[0]).toMatchObject({ origem: 'na-celula', coluna: 4, tipo: 'image/png' })
    expect(naCelula[0].bytes.length).toBe(PNG.length)
  })

  it('devolve vazio (sem erro) quando a planilha não tem imagens', async () => {
    const zip = new JSZip()
    zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>')
    zip.file('xl/_rels/workbook.xml.rels', rels([['rId1', 'worksheet', 'worksheets/sheet1.xml']]))
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData/></worksheet>')
    const r = await extrairImagensPlanilha(await zip.generateAsync({ type: 'uint8array' }))
    expect(r).toMatchObject({ total: 0, ignoradas: 0 })
    expect(r.porLinha.size).toBe(0)
  })

  it('recusa arquivo que não é .xlsx', async () => {
    await expect(extrairImagensPlanilha(new Uint8Array([1, 2, 3, 4]))).rejects.toBeTruthy()
  })
})

describe('mapeamento de colunas da planilha de movimentação', () => {
  it('reconhece Favorecido, Número Doc.Fiscal e Quantidade', () => {
    const m = mapearColunasInventario(['Número Doc.Fiscal', 'Favorecido', 'Descrição do Item', 'Foto', 'Observações', 'Quantidade'])
    expect(m.numeroNotaFiscal).toBe('Número Doc.Fiscal')
    expect(m.fornecedor).toBe('Favorecido')
    expect(m.nome).toBe('Descrição do Item')
    expect(m.observacoes).toBe('Observações')
    expect(m.quantidade).toBe('Quantidade')
  })
})
