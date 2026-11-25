import { describe, expect, it } from 'vitest'
import { agruparAfazeres, agruparPorPrazo, filtrarPorPeriodo, prazoDoPeriodo, contarDaSemana, fimDaSemana, deTarefaPessoal, deTarefaProjeto, itensDoDia, organizarNotas, resumoAfazeres, validarNota, validarTarefaPessoal, type ItemAfazer, type Nota } from './afazeres'

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

describe('agruparPorPrazo (área de trabalho)', () => {
  // 2026-11-24 é terça-feira: a semana termina no domingo 29/11.
  const hoje = '2026-11-24'
  const mk = (id: string, dataEntrega?: string, status: ItemAfazer['status'] = 'nao_iniciado'): ItemAfazer => ({ chave: `pessoal:${id}`, origem: 'pessoal', id, titulo: id, status, prioridade: 'media', dataEntrega, criadoEm: '2026-01-01' })
  it('separa atrasadas, hoje, amanhã, esta semana, semana que vem, depois e sem data', () => {
    const g = agruparPorPrazo([mk('a', '2026-11-20'), mk('b', hoje), mk('c', '2026-11-25'), mk('d', '2026-11-29'), mk('e', '2026-11-30'), mk('f', '2026-12-06'), mk('g', '2026-12-07'), mk('h'), mk('feita', hoje, 'concluido')], hoje)
    expect(g.atrasadas.map((i) => i.id)).toEqual(['a'])
    expect(g.hoje.map((i) => i.id)).toEqual(['b'])
    expect(g.amanha.map((i) => i.id)).toEqual(['c'])
    expect(g.estaSemana.map((i) => i.id)).toEqual(['d'])
    expect(g.semanaQueVem.map((i) => i.id)).toEqual(['e', 'f'])
    expect(g.depois.map((i) => i.id)).toEqual(['g'])
    expect(g.semData.map((i) => i.id)).toEqual(['h'])
  })
  it('fim da semana e contagem', () => {
    expect(fimDaSemana('2026-11-24')).toBe('2026-11-29')
    expect(fimDaSemana('2026-11-29')).toBe('2026-11-29')
    expect(fimDaSemana('2026-11-30')).toBe('2026-12-06')
    expect(contarDaSemana([mk('a', hoje), mk('b', '2026-11-29'), mk('c', '2026-11-30'), mk('d', '2026-11-20')], hoje)).toBe(2)
  })
})

describe('períodos de Minhas tarefas', () => {
  const hoje = '2026-11-24' // terça
  const mk = (id: string, dataEntrega?: string, status: ItemAfazer['status'] = 'nao_iniciado'): ItemAfazer => ({ chave: `pessoal:${id}`, origem: 'pessoal', id, titulo: id, status, prioridade: 'media', dataEntrega, criadoEm: '2026-01-01' })
  const lista = [mk('atrasada', '2026-11-20'), mk('velhaFeita', '2026-11-20', 'concluido'), mk('hoje', hoje), mk('feitaHoje', hoje, 'concluido'), mk('amanha', '2026-11-25'), mk('sexta', '2026-11-27'), mk('prox', '2026-12-01'), mk('solta')]
  const ids = (p: Parameters<typeof filtrarPorPeriodo>[1]) => filtrarPorPeriodo(lista, p, hoje).map((i) => i.id)
  it('filtra cada período; hoje traz as atrasadas em aberto', () => {
    expect(ids('hoje')).toEqual(['atrasada', 'hoje', 'feitaHoje'])
    expect(ids('amanha')).toEqual(['amanha'])
    expect(ids('estaSemana')).toEqual(['sexta'])
    expect(ids('semanaQueVem')).toEqual(['prox'])
    expect(ids('semData')).toEqual(['solta'])
  })
  it('prazo de uma tarefa nova em cada período', () => {
    expect(prazoDoPeriodo('hoje', hoje)).toBe(hoje)
    expect(prazoDoPeriodo('estaSemana', hoje)).toBe('2026-11-29')
    expect(prazoDoPeriodo('estaSemana', '2026-11-28')).toBeNull()
    expect(prazoDoPeriodo('semanaQueVem', hoje)).toBe('2026-11-30')
    expect(prazoDoPeriodo('semData', hoje)).toBeUndefined()
  })
})
