import { describe, expect, it } from 'vitest'
import { linhasParaCausas, montarGantt, porResponsavel, quebrarTexto, MAX_CAUSAS } from './graficos'
import { moverNaOrdem, ordenarTarefas, permissoesTarefa, statusPermitidos, validarTarefa, type Tarefa } from './tarefas'

const mk = (id: string, extra: Partial<Tarefa> = {}): Tarefa => ({ id, projetoId: 'p', grupoId: 'g', titulo: id, status: 'nao_iniciado', prioridade: 'media', criadoEm: id, ...extra })

describe('gantt', () => {
  it('sem nenhuma data não há gráfico', () => {
    expect(montarGantt([{ id: 'g', titulo: 'G' }], [mk('a')], '2026-01-10')).toBeNull()
  })
  it('posiciona as barras e separa as sem data', () => {
    const g = montarGantt([{ id: 'g', titulo: 'G' }], [mk('a', { dataInicio: '2026-01-10', dataEntrega: '2026-01-12' }), mk('b', { dataEntrega: '2026-02-01' }), mk('c')], '2026-01-11')!
    expect(g.inicio).toBe('2026-01-08')
    expect(g.grupos[0].barras.map((b) => [b.desloc, b.dias])).toEqual([[2, 3], [24, 1]])
    expect(g.hoje).toBe(3)
    expect(g.semData.map((t) => t.id)).toEqual(['c'])
    expect(g.meses.reduce((s, m) => s + m.dias, 0)).toBe(g.totalDias)
  })
})

describe('barras e causa e efeito', () => {
  it('conta por responsável', () => {
    expect(porResponsavel([mk('a', { responsavelId: '1', responsavelNome: 'Ana', status: 'concluido' }), mk('b', { responsavelId: '1', responsavelNome: 'Ana' }), mk('c')])).toEqual([
      { nome: 'Ana', concluidas: 1, abertas: 1 },
      { nome: 'Sem responsável', concluidas: 0, abertas: 1 },
    ])
  })
  it('uma causa por linha, com limite, e texto quebrado', () => {
    expect(linhasParaCausas(' a \n\nb')).toEqual(['a', 'b'])
    expect(linhasParaCausas('1\n2\n3\n4\n5\n6')).toHaveLength(MAX_CAUSAS)
    expect(quebrarTexto('atraso na entrega do protótipo final', 12, 2)).toEqual(['atraso na', 'entrega do…'])
  })
})

describe('permissões e ordem das tarefas', () => {
  const projeto = { criadoPorId: 'dono', responsavelId: 'resp', pesquisadores: [{ usuarioId: 'ana', papel: 'membro' as const }], camposEditaveisMembros: [] as never[] }
  it('colaborador só consulta, a não ser que liberem', () => {
    expect(permissoesTarefa(projeto, 'ana')).toEqual({ gestor: false, criar: false, editar: false, andamento: false, excluir: false })
    expect(permissoesTarefa(projeto, 'resp').gestor).toBe(true)
    expect(permissoesTarefa({ ...projeto, camposEditaveisMembros: ['tarefasCriar'] as never }, 'ana').criar).toBe(true)
    expect(permissoesTarefa({ ...projeto, camposEditaveisMembros: ['tarefasCriar'] as never }, 'de-fora').criar).toBe(false)
  })
  it('só o ADM conclui ou reabre', () => {
    expect(statusPermitidos('em_andamento', { gestor: false, andamento: true })).not.toContain('concluido')
    expect(statusPermitidos('concluido', { gestor: false, andamento: true })).toEqual(['concluido'])
    expect(statusPermitidos('em_andamento', { gestor: false, andamento: false })).toEqual(['em_andamento'])
    expect(statusPermitidos('concluido', { gestor: true, andamento: true })).toHaveLength(4)
  })
  it('a ordem definida vale mais que o prazo', () => {
    const ts = [mk('a', { ordem: 2, dataEntrega: '2026-01-01' }), mk('b', { ordem: 1, dataEntrega: '2026-03-01' })]
    expect(ordenarTarefas(ts).map((t) => t.id)).toEqual(['b', 'a'])
    expect(moverNaOrdem(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(moverNaOrdem(['a', 'b'], 'a', -1)).toEqual(['a', 'b'])
  })
  it('entrega antes do início é recusada', () => {
    expect(validarTarefa({ titulo: 'x', dataInicio: '2026-02-02', dataEntrega: '2026-02-01' })).toMatch(/início/)
  })
})
