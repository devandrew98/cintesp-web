import { describe, expect, it } from 'vitest'
import {
  descreverFiltro,
  filtrarRegistros,
  filtroVazio,
  nomeArquivoRelatorio,
  podeEditarRegistro,
  podeRemoverAnexo,
  validarArquivoAnexo,
  validarRegistro,
  type Registro,
} from './registros'

const r = (p: Partial<Registro>): Registro => ({
  id: 'x',
  tipo: 'visita',
  titulo: 'Visita',
  data: '2026-11-10',
  criadoEm: '2026-11-10T10:00:00Z',
  anexos: [],
  ...p,
})

const lista: Registro[] = [
  r({ id: '1', titulo: 'Visita da Escola Estadual', data: '2026-11-05', instituicao: 'Escola Estadual Maria' }),
  r({ id: '2', tipo: 'oficina', titulo: 'Oficina de impressão 3D', data: '2026-10-20', local: 'Arena Sabiazinho' }),
  r({ id: '3', tipo: 'evento', titulo: 'Feira de Tecnologia', data: '2026-11-25', ata: 'Foram discutidas ações de extensão' }),
]
const ids = (l: Registro[]) => l.map((x) => x.id)

describe('filtrarRegistros', () => {
  const base = filtroVazio(new Date(2026, 10, 12))
  it('sem filtro: todos, do mais recente ao mais antigo', () => expect(ids(filtrarRegistros(lista, base))).toEqual(['3', '1', '2']))
  it('por mês', () => expect(ids(filtrarRegistros(lista, { ...base, periodo: 'mes' }))).toEqual(['3', '1']))
  it('por intervalo (extremos inclusos)', () => {
    expect(ids(filtrarRegistros(lista, { ...base, periodo: 'intervalo', de: '2026-10-20', ate: '2026-11-05' }))).toEqual(['1', '2'])
    expect(ids(filtrarRegistros(lista, { ...base, periodo: 'intervalo', de: '2026-11-06' }))).toEqual(['3'])
  })
  it('por tipo', () => expect(ids(filtrarRegistros(lista, { ...base, tipo: 'oficina' }))).toEqual(['2']))
  it('busca ignora acento e maiúscula, e olha ata/instituição/local', () => {
    expect(ids(filtrarRegistros(lista, { ...base, busca: 'ACOES' }))).toEqual(['3'])
    expect(ids(filtrarRegistros(lista, { ...base, busca: 'maria' }))).toEqual(['1'])
    expect(ids(filtrarRegistros(lista, { ...base, busca: 'sabiazinho' }))).toEqual(['2'])
  })
  it('combina filtros', () => expect(ids(filtrarRegistros(lista, { ...base, periodo: 'mes', busca: 'feira' }))).toEqual(['3']))
})

describe('descreverFiltro', () => {
  it('lista só o que está ativo', () => {
    const base = filtroVazio(new Date(2026, 10, 12))
    expect(descreverFiltro(base)).toBe('')
    expect(descreverFiltro({ ...base, periodo: 'mes', tipo: 'evento', busca: 'x' })).toBe('Período: novembro de 2026 · Tipo: Evento · Busca: "x"')
  })
})

describe('validarRegistro', () => {
  const ok = { tipo: 'visita' as const, titulo: 'A', data: '2026-11-10' }
  it('aceita o básico', () => expect(validarRegistro(ok)).toBeNull())
  it('exige título e data', () => {
    expect(validarRegistro({ ...ok, titulo: ' ' })).toMatch(/título/)
    expect(validarRegistro({ ...ok, data: '' })).toMatch(/data/)
  })
  it('horário e participantes', () => {
    expect(validarRegistro({ ...ok, horaInicio: '10:00', horaFim: '09:00' })).toMatch(/fim/)
    expect(validarRegistro({ ...ok, participantes: -1 })).toMatch(/participantes/)
  })
})

describe('permissões', () => {
  it('editar: criador ou admin', () => {
    expect(podeEditarRegistro({ criadoPorId: 'a' }, 'a')).toBe(true)
    expect(podeEditarRegistro({ criadoPorId: 'a' }, 'b')).toBe(false)
    expect(podeEditarRegistro({ criadoPorId: 'a' }, 'b', true)).toBe(true)
  })
  it('remover anexo: quem enviou, dono do registro ou admin', () => {
    expect(podeRemoverAnexo({ enviadoPorId: 'b' }, { criadoPorId: 'a' }, 'b')).toBe(true)
    expect(podeRemoverAnexo({ enviadoPorId: 'b' }, { criadoPorId: 'a' }, 'a')).toBe(true)
    expect(podeRemoverAnexo({ enviadoPorId: 'b' }, { criadoPorId: 'a' }, 'c')).toBe(false)
    expect(podeRemoverAnexo({ enviadoPorId: 'b' }, { criadoPorId: 'a' }, 'c', true)).toBe(true)
  })
})

describe('validarArquivoAnexo', () => {
  it('foto: só imagem comum', () => {
    expect(validarArquivoAnexo('a.jpg', 1000, 'image/jpeg', 'foto')).toBeNull()
    expect(validarArquivoAnexo('a.pdf', 1000, 'application/pdf', 'foto')).toMatch(/fotos/)
  })
  it('documento: extensão e tamanho', () => {
    expect(validarArquivoAnexo('ata.docx', 1000, '', 'ata')).toBeNull()
    expect(validarArquivoAnexo('x.exe', 1000, '', 'documento')).toMatch(/formato/)
    expect(validarArquivoAnexo('ata.pdf', 30 * 1024 * 1024, '', 'ata')).toMatch(/25 MB/)
  })
})

it('nomeArquivoRelatorio', () => expect(nomeArquivoRelatorio('pdf', new Date(2026, 10, 12))).toBe('Relatorio_Visitas_Eventos_2026-11-12.pdf'))
