import { describe, expect, it } from 'vitest'
import { agruparAfazeres, deTarefaPessoal, deTarefaProjeto, itensDoDia, organizarNotas, resumoAfazeres, validarNota, validarTarefaPessoal, type ItemAfazer, type Nota } from './afazeres'

const it_ = (p: Partial<ItemAfazer>): ItemAfazer => ({ chave: 'pessoal:x', origem: 'pessoal', id: 'x', titulo: 'T', status: 'nao_iniciado', prioridade: 'media', criadoEm: '2026-11-01T00:00:00Z', ...p })
const HOJE = '2026-11-23'

describe('conversões', () => {
  it('chave distingue origem', () => {
    expect(deTarefaPessoal({ id: '1', titulo: 'a', status: 'nao_iniciado', prioridade: 'baixa', criadoEm: '' }).chave).toBe('pessoal:1')
    const p = deTarefaProjeto({ id: '1', projetoId: 'p', titulo: 'a', status: 'nao_iniciado', prioridade: 'baixa', criadoEm: '' }, 'Proj')
    expect(p.chave).toBe('projeto:1')
    expect(p.projetoTitulo).toBe('Proj')
  })
})

describe('agruparAfazeres', () => {
  it('separa por prazo e status', () => {
    const itens = [
      it_({ chave: 'a', dataEntrega: '2026-11-20' }),
      it_({ chave: 'b', dataEntrega: HOJE }),
      it_({ chave: 'c', dataEntrega: '2026-12-01' }),
      it_({ chave: 'd' }),
      it_({ chave: 'e', status: 'concluido', dataEntrega: '2026-11-01' }),
    ]
    const g = agruparAfazeres(itens, HOJE)
    expect(g.atrasadas.map((i) => i.chave)).toEqual(['a'])
    expect(g.hoje.map((i) => i.chave)).toEqual(['b'])
    expect(g.proximas.map((i) => i.chave)).toEqual(['c'])
    expect(g.semData.map((i) => i.chave)).toEqual(['d'])
    expect(g.concluidas.map((i) => i.chave)).toEqual(['e'])
  })
  it('ordena por prazo dentro do grupo', () => {
    const g = agruparAfazeres([it_({ chave: 'b', dataEntrega: '2026-12-10' }), it_({ chave: 'a', dataEntrega: '2026-12-01' })], HOJE)
    expect(g.proximas.map((i) => i.chave)).toEqual(['a', 'b'])
  })
})

describe('resumo e dia', () => {
  it('conta hoje, atrasadas e abertas (concluídas ficam fora)', () => {
    const itens = [it_({ chave: 'a', dataEntrega: '2026-11-20' }), it_({ chave: 'b', dataEntrega: HOJE }), it_({ chave: 'c', status: 'concluido', dataEntrega: HOJE }), it_({ chave: 'd' })]
    expect(resumoAfazeres(itens, HOJE)).toEqual({ hoje: 1, atrasadas: 1, abertas: 3 })
  })
  it('itens de um dia', () => {
    expect(itensDoDia([it_({ chave: 'a', dataEntrega: HOJE }), it_({ chave: 'b', dataEntrega: '2026-11-24' })], HOJE).map((i) => i.chave)).toEqual(['a'])
  })
})

describe('validações e notas', () => {
  it('tarefa precisa de título', () => {
    expect(validarTarefaPessoal({ titulo: ' ' })).toMatch(/título/)
    expect(validarTarefaPessoal({ titulo: 'ok' })).toBeNull()
  })
  it('nota precisa de título ou texto', () => {
    expect(validarNota({ titulo: '', texto: ' ' })).toMatch(/Escreva/)
    expect(validarNota({ titulo: '', texto: 'x' })).toBeNull()
  })
  it('organizar: fixadas primeiro, depois recentes; busca sem acento', () => {
    const n = (id: string, p: Partial<Nota>): Nota => ({ id, titulo: id, texto: '', fixada: false, criadoEm: '', atualizadoEm: '2026-11-01', ...p })
    const l = [n('a', { atualizadoEm: '2026-11-05' }), n('b', { fixada: true, atualizadoEm: '2026-11-01' }), n('c', { atualizadoEm: '2026-11-10', texto: 'Reunião' })]
    expect(organizarNotas(l).map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(organizarNotas(l, 'reuniao').map((x) => x.id)).toEqual(['c'])
  })
})
