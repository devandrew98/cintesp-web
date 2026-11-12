import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { gerarDocxRegistros, gerarPdfRegistros, linhasDoRegistro } from './relatorioRegistros'
import type { Registro } from './registros'

const reg = (p: Partial<Registro> = {}): Registro => ({
  id: '1',
  tipo: 'visita',
  titulo: 'Visita da Escola Estadual Maria',
  data: '2026-11-05',
  horaInicio: '09:00',
  horaFim: '11:00',
  local: 'Arena Sabiazinho',
  instituicao: 'Escola Estadual Maria',
  participantes: 32,
  descricao: 'Apresentação dos projetos.\nDemonstração dos equipamentos.',
  ata: 'Foi acordada nova visita.',
  criadoPorNome: 'Ana',
  criadoEm: '2026-11-05T12:00:00Z',
  anexos: [{ id: 'a', registroId: '1', categoria: 'ata', caminho: 'x/a.pdf', nome: 'ata-visita.pdf', mime: 'application/pdf', tamanho: 10, criadoEm: '' }],
  ...p,
})

const opc = { incluirFotos: false, incluirAta: true, papelTimbrado: null }

describe('linhasDoRegistro', () => {
  it('só traz o que foi preenchido', () => {
    const l = linhasDoRegistro(reg({ local: undefined, participantes: undefined }))
    expect(l.map((x) => x[0])).toEqual(['Tipo', 'Data', 'Horário', 'Instituição / público', 'Responsável no CINTESP'].filter((r) => r !== 'Responsável no CINTESP').concat(['Registrado por']))
    expect(l.find((x) => x[0] === 'Data')?.[1]).toBe('05/11/2026')
    expect(l.find((x) => x[0] === 'Horário')?.[1]).toBe('09:00 às 11:00')
  })
})

describe('gerarPdfRegistros', () => {
  it('gera um PDF válido com vários registros', async () => {
    const bytes = await gerarPdfRegistros([reg(), reg({ id: '2', titulo: 'Oficina', tipo: 'oficina', ata: undefined })], opc)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(2000)
  })
  it('lista vazia gera o PDF com aviso', async () => {
    const bytes = await gerarPdfRegistros([], opc)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })
  it('muitos registros viram várias páginas sem quebrar', async () => {
    const muitos = Array.from({ length: 40 }, (_, i) => reg({ id: String(i), titulo: `Registro ${i} com título razoavelmente longo para quebrar linha na tabela de resumo` }))
    const bytes = await gerarPdfRegistros(muitos, opc)
    expect(bytes.length).toBeGreaterThan(5000)
  })
})

describe('gerarDocxRegistros', () => {
  it('gera um .docx (zip) com o conteúdo', async () => {
    const bytes = await gerarDocxRegistros([reg()], opc)
    expect(bytes[0]).toBe(0x50) // "PK"
    expect(bytes[1]).toBe(0x4b)
    const zip = await JSZip.loadAsync(bytes)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('Visita da Escola Estadual Maria')
    expect(xml).toContain('Foi acordada nova visita.')
    expect(xml).toContain('ata-visita.pdf')
  })
  it('respeita "incluir ata"', async () => {
    const bytes = await gerarDocxRegistros([reg()], { ...opc, incluirAta: false })
    const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml')!.async('string')
    expect(xml).not.toContain('Foi acordada nova visita.')
  })
  it('embute o papel timbrado no cabeçalho', async () => {
    // PNG 1x1 válido
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const bytes = await gerarDocxRegistros([reg()], { ...opc, papelTimbrado: png })
    const zip = await JSZip.loadAsync(bytes)
    const arquivos = Object.keys(zip.files)
    expect(arquivos.some((n) => n.startsWith('word/media/'))).toBe(true)
    const header = arquivos.find((n) => /word\/header\d*\.xml$/.test(n))!
    expect(await zip.file(header)!.async('string')).toContain('behindDoc="1"')
  })
})
