import { supabase, USE_MOCK } from '@/lib/supabase'
import { perfilAtual, listarUsuarios } from '@/data/api'
import { definirProgressoMock, listarProjetos } from '@/data/projetos'
import { usuarioAtual } from '@/data/mock'
import { hojeISO, somarDias } from '@/lib/agendamento'
import { resumoTarefas, validarTarefa, type DadosTarefa, type Tarefa } from '@/lib/tarefas'

/**
 * Camada de dados das TAREFAS dos projetos (docs/supabase-projetos-tarefas.sql).
 * Todos leem; criar/editar é do dono e dos pesquisadores vinculados (RLS). Em modo mock fica em memória.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return error?.code === '42P01' || error?.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(msg)
}

function erroAmigavel(error: any): Error {
  const msg = String(error?.message ?? error)
  if (ehTabelaAusente(error)) return new Error('As tarefas ainda não foram ativadas no banco (falta rodar docs/supabase-projetos-tarefas.sql).')
  if (/data_inicio|conferencia|conferida_|'ordem'/.test(msg) && /column|schema cache/i.test(msg)) return new Error('Falta rodar docs/supabase-projetos-permissoes.sql no Supabase.')
  if (/row-level security|violates row-level/i.test(msg)) return new Error('Você não tem permissão para alterar as tarefas deste projeto.')
  return error instanceof Error ? error : new Error(msg)
}

function mapTarefa(r: any): Tarefa {
  return {
    id: r.id,
    projetoId: r.projeto_id,
    grupoId: r.grupo_id ?? undefined,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    status: r.status,
    prioridade: r.prioridade,
    responsavelId: r.responsavel_id ?? undefined,
    responsavelNome: r.responsavel?.nome ?? undefined,
    responsavelFotoUrl: r.responsavel?.foto_url ?? undefined,
    dataInicio: r.data_inicio ?? undefined,
    dataEntrega: r.data_entrega ?? undefined,
    ordem: r.ordem ?? 0,
    conferencia: r.conferencia ?? undefined,
    conferidaPorNome: r.conferente?.nome ?? undefined,
    criadoPorId: r.criado_por ?? undefined,
    criadoPorNome: r.criador?.nome ?? undefined,
    criadoEm: r.created_at,
    atualizadoEm: r.updated_at ?? undefined,
  }
}

const paraLinha = (d: DadosTarefa) => ({
  titulo: d.titulo.trim(),
  descricao: d.descricao?.trim() || null,
  status: d.status,
  prioridade: d.prioridade,
  responsavel_id: d.responsavelId || null,
  data_entrega: d.dataEntrega || null,
  // Só vão quando preenchidos: antes de rodar a migração nova, as colunas não existem.
  ...(d.dataInicio ? { data_inicio: d.dataInicio } : {}),
  ...(d.conferencia ? { conferencia: d.conferencia } : {}),
})

// ---------------- mock ----------------
const hoje = hojeISO()
const mk = (projetoId: string, grupoId: string, titulo: string, status: Tarefa['status'], extra: Partial<Tarefa> = {}): Tarefa => ({
  id: crypto.randomUUID(),
  projetoId,
  grupoId,
  titulo,
  status,
  prioridade: 'media',
  criadoPorNome: 'Administrador',
  criadoEm: new Date().toISOString(),
  ...extra,
})
const mockTarefas: Tarefa[] = [
  mk('proj-1', 'g-2', 'Testar sensores ultrassônicos em campo', 'em_andamento', { prioridade: 'alta', responsavelId: 'u1', responsavelNome: 'João Silva', dataInicio: somarDias(hoje, -3), dataEntrega: somarDias(hoje, 5) }),
  mk('proj-1', 'g-2', 'Montar relatório parcial do protótipo', 'nao_iniciado', { responsavelId: 'u2', responsavelNome: 'Mariana Souza', dataInicio: somarDias(hoje, -9), dataEntrega: somarDias(hoje, -2) }),
  mk('proj-1', 'g-1', 'Aguardar chegada das peças do fornecedor', 'aguardando', { prioridade: 'baixa' }),
  mk('proj-1', 'g-1', 'Definir arquitetura do firmware', 'concluido', { responsavelId: 'u1', responsavelNome: 'João Silva', dataInicio: somarDias(hoje, -20), dataEntrega: somarDias(hoje, -10) }),
  mk('proj-2', 'g-4', 'Levantar requisitos com terapeutas', 'em_andamento', { responsavelId: 'u3', responsavelNome: 'Carlos Almeida' }),
  mk('proj-1', 'g-1', 'Revisar o plano de testes com a equipe', 'em_andamento', { prioridade: 'alta', responsavelId: usuarioAtual.id, responsavelNome: usuarioAtual.nome, dataInicio: somarDias(hoje, -6), dataEntrega: somarDias(hoje, 2) }),
]

/** Modo mock: o banco faz isso sozinho (trigger); aqui o progresso do projeto acompanha as tarefas. */
function recalcularProgressoMock(projetoId: string) {
  definirProgressoMock(projetoId, resumoTarefas(mockTarefas.filter((t) => t.projetoId === projetoId)).percentual)
}

export function removerTarefasDoGrupoMock(grupoId: string) {
  const projetos = new Set<string>()
  for (let i = mockTarefas.length - 1; i >= 0; i--) {
    if (mockTarefas[i].grupoId === grupoId) {
      projetos.add(mockTarefas[i].projetoId)
      mockTarefas.splice(i, 1)
    }
  }
  projetos.forEach(recalcularProgressoMock)
}

['proj-1', 'proj-2'].forEach(recalcularProgressoMock)

// ---------------- API ----------------

export async function listarTarefas(projetoId: string): Promise<Tarefa[]> {
  if (USE_MOCK || !supabase) return mockTarefas.filter((t) => t.projetoId === projetoId).map((t) => ({ ...t }))
  const { data, error } = await supabase
    .from('projeto_tarefas')
    .select('*, responsavel:responsavel_id (nome, foto_url), criador:criado_por (nome)')
    .eq('projeto_id', projetoId)
    .order('created_at', { ascending: true })
  // O nome de quem conferiu vem à parte: antes da migração a coluna não existe e a lista não pode quebrar.
  const conferidas = (data ?? []).filter((r: any) => r.conferida_por)
  if (conferidas.length > 0) {
    const { data: nomes } = await supabase.from('usuarios').select('id, nome').in('id', conferidas.map((r: any) => r.conferida_por))
    for (const r of conferidas as any[]) r.conferente = nomes?.find((n: any) => n.id === r.conferida_por)
  }
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapTarefa)
}

export async function criarTarefa(projetoId: string, grupoId: string, d: DadosTarefa): Promise<void> {
  const erro = validarTarefa(d)
  if (erro) throw new Error(erro)
  if (USE_MOCK || !supabase) {
    const [perfil, usuarios] = await Promise.all([perfilAtual(), listarUsuarios()])
    const resp = usuarios.find((u) => u.id === d.responsavelId)
    const ordem = Math.max(0, ...mockTarefas.filter((t) => t.grupoId === grupoId).map((t) => t.ordem ?? 0)) + 1
    mockTarefas.push({ ...d, ordem, titulo: d.titulo.trim(), id: crypto.randomUUID(), projetoId, grupoId, responsavelNome: resp?.nome, responsavelFotoUrl: resp?.fotoUrl, criadoPorId: perfil?.id, criadoPorNome: perfil?.nome, criadoEm: new Date().toISOString() })
    recalcularProgressoMock(projetoId)
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('projeto_tarefas').insert({ projeto_id: projetoId, grupo_id: grupoId, ...paraLinha(d), criado_por: auth.user?.id ?? null })
  if (error) throw erroAmigavel(error)
}

/** Atualiza só o que veio em `patch` (ex.: arrastar para outra coluna muda só o status). */
export async function atualizarTarefa(id: string, patch: Partial<DadosTarefa>): Promise<void> {
  if (patch.titulo !== undefined) {
    const erro = validarTarefa({ titulo: patch.titulo, dataInicio: patch.dataInicio, dataEntrega: patch.dataEntrega })
    if (erro) throw new Error(erro)
  }
  if (USE_MOCK || !supabase) {
    const t = mockTarefas.find((x) => x.id === id)
    if (!t) throw new Error('Tarefa não encontrada.')
    const usuarios = patch.responsavelId !== undefined ? await listarUsuarios() : []
    Object.assign(t, patch, { atualizadoEm: new Date().toISOString() })
    if (t.status !== 'concluido') t.conferencia = undefined
    if ('conferencia' in patch || !t.conferencia) t.conferidaPorNome = t.conferencia ? (await perfilAtual())?.nome : undefined
    if (patch.titulo !== undefined) t.titulo = patch.titulo.trim()
    if ('responsavelId' in patch) {
      const resp = usuarios.find((u) => u.id === patch.responsavelId)
      t.responsavelNome = resp?.nome
      t.responsavelFotoUrl = resp?.fotoUrl
    }
    recalcularProgressoMock(t.projetoId)
    return
  }
  const linha: Record<string, unknown> = {}
  if (patch.titulo !== undefined) linha.titulo = patch.titulo.trim()
  if ('descricao' in patch) linha.descricao = patch.descricao?.trim() || null
  if (patch.status !== undefined) linha.status = patch.status
  if (patch.prioridade !== undefined) linha.prioridade = patch.prioridade
  if ('responsavelId' in patch) linha.responsavel_id = patch.responsavelId || null
  if ('dataInicio' in patch) linha.data_inicio = patch.dataInicio || null
  if ('dataEntrega' in patch) linha.data_entrega = patch.dataEntrega || null
  if ('conferencia' in patch) linha.conferencia = patch.conferencia || null
  const { error } = await supabase.from('projeto_tarefas').update(linha).eq('id', id)
  if (error) throw erroAmigavel(error)
}

export async function excluirTarefa(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockTarefas.findIndex((x) => x.id === id)
    if (i >= 0) {
      const [t] = mockTarefas.splice(i, 1)
      recalcularProgressoMock(t.projetoId)
    }
    return
  }
  const { error } = await supabase.from('projeto_tarefas').delete().eq('id', id)
  if (error) throw erroAmigavel(error)
}

/** Grava a ordem das tarefas de um grupo (posição = índice na lista). Só o ADM (banco garante). */
export async function reordenarTarefas(ids: string[]): Promise<void> {
  if (USE_MOCK || !supabase) {
    ids.forEach((id, i) => {
      const t = mockTarefas.find((x) => x.id === id)
      if (t) t.ordem = i + 1
    })
    return
  }
  for (const [i, id] of ids.entries()) {
    const { error } = await supabase.from('projeto_tarefas').update({ ordem: i + 1 }).eq('id', id)
    if (error) throw erroAmigavel(error)
  }
}

/** Tarefas de QUALQUER projeto atribuídas a este usuário (para o Meus Afazeres), com o nome do projeto. */
export async function listarTarefasAtribuidas(usuarioId: string): Promise<{ tarefa: Tarefa; projetoTitulo?: string }[]> {
  if (USE_MOCK || !supabase) {
    const projetos = await listarProjetos()
    return mockTarefas.filter((t) => t.responsavelId === usuarioId).map((t) => ({ tarefa: { ...t }, projetoTitulo: projetos.find((p) => p.id === t.projetoId)?.titulo }))
  }
  const { data, error } = await supabase
    .from('projeto_tarefas')
    .select('*, responsavel:responsavel_id (nome, foto_url), criador:criado_por (nome), projeto:projeto_id (titulo)')
    .eq('responsavel_id', usuarioId)
    .order('created_at', { ascending: true })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map((r: any) => ({ tarefa: mapTarefa(r), projetoTitulo: r.projeto?.titulo ?? undefined }))
}
