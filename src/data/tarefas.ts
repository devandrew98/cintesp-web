import { supabase, USE_MOCK } from '@/lib/supabase'
import { perfilAtual, listarUsuarios } from '@/data/api'
import { hojeISO, somarDias } from '@/lib/agendamento'
import { validarTarefa, type DadosTarefa, type Tarefa } from '@/lib/tarefas'

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
  if (/row-level security|violates row-level/i.test(msg)) return new Error('Você não tem permissão para alterar as tarefas deste projeto.')
  return error instanceof Error ? error : new Error(msg)
}

function mapTarefa(r: any): Tarefa {
  return {
    id: r.id,
    projetoId: r.projeto_id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    status: r.status,
    prioridade: r.prioridade,
    responsavelId: r.responsavel_id ?? undefined,
    responsavelNome: r.responsavel?.nome ?? undefined,
    responsavelFotoUrl: r.responsavel?.foto_url ?? undefined,
    dataEntrega: r.data_entrega ?? undefined,
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
})

// ---------------- mock ----------------
const hoje = hojeISO()
const mk = (projetoId: string, titulo: string, status: Tarefa['status'], extra: Partial<Tarefa> = {}): Tarefa => ({
  id: crypto.randomUUID(),
  projetoId,
  titulo,
  status,
  prioridade: 'media',
  criadoPorNome: 'Administrador',
  criadoEm: new Date().toISOString(),
  ...extra,
})
const mockTarefas: Tarefa[] = [
  mk('proj-1', 'Testar sensores ultrassônicos em campo', 'em_andamento', { prioridade: 'alta', responsavelId: 'u1', responsavelNome: 'João Silva', dataEntrega: somarDias(hoje, 5) }),
  mk('proj-1', 'Montar relatório parcial do protótipo', 'nao_iniciado', { responsavelId: 'u2', responsavelNome: 'Mariana Souza', dataEntrega: somarDias(hoje, -2) }),
  mk('proj-1', 'Aguardar chegada das peças do fornecedor', 'aguardando', { prioridade: 'baixa' }),
  mk('proj-1', 'Definir arquitetura do firmware', 'concluido', { responsavelId: 'u1', responsavelNome: 'João Silva', dataEntrega: somarDias(hoje, -10) }),
  mk('proj-2', 'Levantar requisitos com terapeutas', 'em_andamento', { responsavelId: 'u3', responsavelNome: 'Carlos Almeida' }),
]

// ---------------- API ----------------

export async function listarTarefas(projetoId: string): Promise<Tarefa[]> {
  if (USE_MOCK || !supabase) return mockTarefas.filter((t) => t.projetoId === projetoId).map((t) => ({ ...t }))
  const { data, error } = await supabase
    .from('projeto_tarefas')
    .select('*, responsavel:responsavel_id (nome, foto_url), criador:criado_por (nome)')
    .eq('projeto_id', projetoId)
    .order('created_at', { ascending: true })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapTarefa)
}

export async function criarTarefa(projetoId: string, d: DadosTarefa): Promise<void> {
  const erro = validarTarefa(d)
  if (erro) throw new Error(erro)
  if (USE_MOCK || !supabase) {
    const [perfil, usuarios] = await Promise.all([perfilAtual(), listarUsuarios()])
    const resp = usuarios.find((u) => u.id === d.responsavelId)
    mockTarefas.push({ ...d, titulo: d.titulo.trim(), id: crypto.randomUUID(), projetoId, responsavelNome: resp?.nome, responsavelFotoUrl: resp?.fotoUrl, criadoPorId: perfil?.id, criadoPorNome: perfil?.nome, criadoEm: new Date().toISOString() })
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('projeto_tarefas').insert({ projeto_id: projetoId, ...paraLinha(d), criado_por: auth.user?.id ?? null })
  if (error) throw erroAmigavel(error)
}

/** Atualiza só o que veio em `patch` (ex.: arrastar para outra coluna muda só o status). */
export async function atualizarTarefa(id: string, patch: Partial<DadosTarefa>): Promise<void> {
  if (patch.titulo !== undefined) {
    const erro = validarTarefa({ titulo: patch.titulo })
    if (erro) throw new Error(erro)
  }
  if (USE_MOCK || !supabase) {
    const t = mockTarefas.find((x) => x.id === id)
    if (!t) throw new Error('Tarefa não encontrada.')
    const usuarios = patch.responsavelId !== undefined ? await listarUsuarios() : []
    Object.assign(t, patch, { atualizadoEm: new Date().toISOString() })
    if (patch.titulo !== undefined) t.titulo = patch.titulo.trim()
    if ('responsavelId' in patch) {
      const resp = usuarios.find((u) => u.id === patch.responsavelId)
      t.responsavelNome = resp?.nome
      t.responsavelFotoUrl = resp?.fotoUrl
    }
    return
  }
  const linha: Record<string, unknown> = {}
  if (patch.titulo !== undefined) linha.titulo = patch.titulo.trim()
  if ('descricao' in patch) linha.descricao = patch.descricao?.trim() || null
  if (patch.status !== undefined) linha.status = patch.status
  if (patch.prioridade !== undefined) linha.prioridade = patch.prioridade
  if ('responsavelId' in patch) linha.responsavel_id = patch.responsavelId || null
  if ('dataEntrega' in patch) linha.data_entrega = patch.dataEntrega || null
  const { error } = await supabase.from('projeto_tarefas').update(linha).eq('id', id)
  if (error) throw erroAmigavel(error)
}

export async function excluirTarefa(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockTarefas.findIndex((x) => x.id === id)
    if (i >= 0) mockTarefas.splice(i, 1)
    return
  }
  const { error } = await supabase.from('projeto_tarefas').delete().eq('id', id)
  if (error) throw erroAmigavel(error)
}
