import { describe, expect, it } from 'vitest'
import { equipeDoGrupo, normalizarLink, podeCriarGrupo, podeEditarGrupo, podeExcluirGrupo, podeVerGrupo, progressoGrupo, progressoProjeto, validarGrupo, type GrupoTarefas } from './grupos'
import type { Tarefa } from './tarefas'

const projeto = {
  camposEditaveisMembros: [] as never[],
  criadoPorId: 'dono',
  responsavelId: 'resp',
  pesquisadores: [
    { usuarioId: 'resp', nome: 'Resp', papel: 'responsavel' as const },
    { usuarioId: 'ana', nome: 'Ana', papel: 'membro' as const },
    { usuarioId: 'bia', nome: 'Bia', papel: 'membro' as const },
  ],
}
const grupo = (extra: Partial<GrupoTarefas> = {}): GrupoTarefas => ({ id: 'g1', projetoId: 'p', titulo: 'G', restrito: false, membros: [], ordem: 0, criadoEm: '', ...extra })
const tarefa = (grupoId: string, status: Tarefa['status']): Tarefa => ({ id: Math.random().toString(), projetoId: 'p', grupoId, titulo: 't', status, prioridade: 'media', criadoEm: '' })

describe('acesso aos grupos', () => {
  it('grupo aberto: equipe vê; quem é de fora não', () => {
    expect(podeVerGrupo(grupo(), projeto, 'ana')).toBe(true)
    expect(podeVerGrupo(grupo(), projeto, 'estranho')).toBe(false)
  })
  it('grupo restrito: só os escolhidos, o dono, o responsável do grupo e o admin', () => {
    const g = grupo({ restrito: true, membros: [{ usuarioId: 'ana' }], responsavelId: 'bia' })
    expect(podeVerGrupo(g, projeto, 'ana')).toBe(true)
    expect(podeVerGrupo(g, projeto, 'bia')).toBe(true)
    expect(podeVerGrupo(g, projeto, 'resp')).toBe(true)
    expect(podeVerGrupo(g, projeto, 'dono')).toBe(true)
    expect(podeVerGrupo(g, projeto, 'outro')).toBe(false)
    expect(podeVerGrupo(g, projeto, 'outro', true)).toBe(true)
    // vinculado ao projeto, mas não ao grupo restrito
    const g2 = grupo({ restrito: true, membros: [{ usuarioId: 'ana' }] })
    expect(podeVerGrupo(g2, projeto, 'bia')).toBe(false)
  })
  it('editar e excluir: ADM do projeto/sistema; colaborador só se liberado (e se enxergar o grupo)', () => {
    const g = grupo({ responsavelId: 'ana', criadoPorId: 'bia' })
    expect(podeEditarGrupo(g, projeto, 'dono')).toBe(true)
    expect(podeExcluirGrupo(g, projeto, 'resp')).toBe(true)
    expect(podeEditarGrupo(g, projeto, 'ana')).toBe(false)
    expect(podeExcluirGrupo(g, projeto, 'bia')).toBe(false)
    expect(podeEditarGrupo(g, projeto, 'x', true)).toBe(true)
    const liberado = { ...projeto, camposEditaveisMembros: ['gruposEditar'] as never }
    expect(podeEditarGrupo(g, liberado, 'ana')).toBe(true)
    expect(podeExcluirGrupo(g, liberado, 'ana')).toBe(false)
    expect(podeEditarGrupo(grupo({ restrito: true }), liberado, 'ana')).toBe(false)
  })
  it('cria grupos: só ADM, ou colaborador liberado', () => {
    expect(podeCriarGrupo(projeto, 'resp')).toBe(true)
    expect(podeCriarGrupo(projeto, 'ana')).toBe(false)
    expect(podeCriarGrupo({ ...projeto, camposEditaveisMembros: ['gruposCriar'] as never }, 'ana')).toBe(true)
    expect(podeCriarGrupo(projeto, 'x')).toBe(false)
  })
})

describe('equipe do grupo', () => {
  it('aberto = equipe do projeto; restrito = membros + responsável do grupo', () => {
    expect(equipeDoGrupo(grupo(), projeto).map((e) => e.id)).toEqual(['resp', 'ana', 'bia'])
    const r = grupo({ restrito: true, membros: [{ usuarioId: 'ana', nome: 'Ana' }], responsavelId: 'bia' })
    expect(equipeDoGrupo(r, projeto).map((e) => e.id)).toEqual(['ana', 'bia'])
  })
})

describe('progresso automático', () => {
  it('conta só as tarefas concluídas', () => {
    const ts = [tarefa('a', 'concluido'), tarefa('a', 'em_andamento'), tarefa('b', 'concluido'), tarefa('b', 'concluido')]
    expect(progressoGrupo(ts, 'a').percentual).toBe(50)
    expect(progressoGrupo(ts, 'b').percentual).toBe(100)
    expect(progressoGrupo(ts, 'vazio').percentual).toBe(0)
    expect(progressoProjeto(ts).percentual).toBe(75)
  })
})

describe('links', () => {
  it('completa https:// e recusa o que não é link web', () => {
    expect(normalizarLink('drive.google.com/drive/folders/abc')).toBe('https://drive.google.com/drive/folders/abc')
    expect(normalizarLink('  ')).toBeUndefined()
    expect(() => normalizarLink('javascript:alert(1)')).toThrow()
    expect(() => normalizarLink('isso nao e link')).toThrow()
  })
  it('valida o grupo', () => {
    expect(validarGrupo({ titulo: ' ' })).toMatch(/nome/)
    expect(validarGrupo({ titulo: 'ok', driveUrl: 'ftp://x.com' })).toMatch(/http/)
    expect(validarGrupo({ titulo: 'ok', driveUrl: 'drive.google.com/x' })).toBeNull()
  })
})
