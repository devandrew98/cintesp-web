import { describe, expect, it } from 'vitest'
import {
  alternarConcluida,
  atrasada,
  minhasTarefas,
  ordenarTarefas,
  podeExcluirTarefa,
  podeGerenciarTarefas,
  resumoTarefas,
  tarefasDoStatus,
  validarTarefa,
  type Tarefa,
} from './tarefas'

const t = (p: Partial<Tarefa>): Tarefa => ({ id: 'x', projetoId: 'p', titulo: 'T', status: 'nao_iniciado', prioridade: 'media', criadoEm: '2026-11-01T00:00:00Z', ...p })

describe('permissões', () => {
  const proj = { criadoPorId: 'dono', responsavelId: 'resp', pesquisadores: [{ usuarioId: 'resp', papel: 'responsavel' as const }, { usuarioId: 'membro', papel: 'membro' as const }] }
  it('gerenciar: admin, criador, responsável e vinculados', () => {
    for (const u of ['dono', 'resp', 'membro']) expect(podeGerenciarTarefas(proj, u)).toBe(true)
    expect(podeGerenciarTarefas(proj, 'estranho')).toBe(false)
    expect(podeGerenciarTarefas(proj, 'estranho', true)).toBe(true)
    expect(podeGerenciarTarefas(proj, undefined)).toBe(false)
  })
  it('excluir: dono do projeto, autor da tarefa ou admin (membro comum não apaga tarefa alheia)', () => {
    const tarefa = { criadoPorId: 'membro2' }
    expect(podeExcluirTarefa(tarefa, proj, 'dono')).toBe(true)
    expect(podeExcluirTarefa(tarefa, proj, 'membro2')).toBe(true)
    expect(podeExcluirTarefa(tarefa, proj, 'membro')).toBe(false)
    expect(podeExcluirTarefa(tarefa, proj, 'membro', true)).toBe(true)
  })
})

describe('consultas', () => {
  it('atrasada: só se tem prazo vencido e não concluída', () => {
    expect(atrasada(t({ dataEntrega: '2026-11-01' }), '2026-11-10')).toBe(true)
    expect(atrasada(t({ dataEntrega: '2026-11-10' }), '2026-11-10')).toBe(false)
    expect(atrasada(t({ dataEntrega: '2026-11-01', status: 'concluido' }), '2026-11-10')).toBe(false)
    expect(atrasada(t({}), '2026-11-10')).toBe(false)
  })
  it('ordenar: por prazo, sem prazo por último', () => {
    const l = [t({ id: 'a' }), t({ id: 'b', dataEntrega: '2026-12-01' }), t({ id: 'c', dataEntrega: '2026-11-15' })]
    expect(ordenarTarefas(l).map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })
  it('por status e minhas', () => {
    const l = [t({ id: 'a', status: 'concluido', responsavelId: 'u1' }), t({ id: 'b', responsavelId: 'u2' }), t({ id: 'c', status: 'concluido' })]
    expect(tarefasDoStatus(l, 'concluido').map((x) => x.id)).toEqual(['a', 'c'])
    expect(minhasTarefas(l, 'u1').map((x) => x.id)).toEqual(['a'])
    expect(minhasTarefas(l, undefined)).toEqual([])
  })
  it('resumo', () => {
    expect(resumoTarefas([])).toEqual({ total: 0, concluidas: 0, percentual: 0 })
    expect(resumoTarefas([t({ status: 'concluido' }), t({}), t({}), t({ status: 'concluido' })])).toEqual({ total: 4, concluidas: 2, percentual: 50 })
  })
  it('checklist alterna', () => {
    expect(alternarConcluida('concluido')).toBe('nao_iniciado')
    expect(alternarConcluida('em_andamento')).toBe('concluido')
  })
  it('validar', () => {
    expect(validarTarefa({ titulo: '  ' })).toMatch(/título/)
    expect(validarTarefa({ titulo: 'ok' })).toBeNull()
  })
})
