import { supabase, USE_MOCK } from '@/lib/supabase'
import type { Chamado, PrioridadeChamado, SetorChamado, StatusChamado } from '@/types'

/**
 * Camada de dados dos CHAMADOS.
 * O que cada pessoa vê/faz é garantido pelo banco (RLS): o solicitante só vê
 * os seus; o admin vê todos, aceita e muda o status.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const SELECT = `
  id, titulo, descricao, setor, categoria, prioridade, status,
  solicitante_id, responsavel_id, created_at, updated_at, finalizado_em,
  solicitante:solicitante_id (nome),
  responsavel:responsavel_id (nome)
`

function mapChamado(r: any): Chamado {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao,
    setor: r.setor,
    categoria: r.categoria ?? undefined,
    prioridade: r.prioridade,
    status: r.status,
    solicitanteId: r.solicitante_id,
    solicitanteNome: r.solicitante?.nome ?? undefined,
    responsavelId: r.responsavel_id ?? undefined,
    responsavelNome: r.responsavel?.nome ?? undefined,
    criadoEm: r.created_at,
    atualizadoEm: r.updated_at ?? undefined,
    finalizadoEm: r.finalizado_em ?? undefined,
  }
}

// Armazenamento em memória para o modo mock (sem banco).
const mockChamados: Chamado[] = []

// ---------- Abertura ----------
export interface NovoChamado {
  titulo: string
  descricao: string
  setor: SetorChamado
  categoria?: string
  prioridade: PrioridadeChamado
}

export async function abrirChamado(input: NovoChamado): Promise<Chamado> {
  if (USE_MOCK || !supabase) {
    const novo: Chamado = {
      id: `ch-${Date.now()}`,
      ...input,
      status: 'aberto',
      solicitanteId: 'mock',
      solicitanteNome: 'Você',
      criadoEm: new Date().toISOString(),
    }
    mockChamados.unshift(novo)
    return novo
  }
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('chamados')
    .insert({
      titulo: input.titulo,
      descricao: input.descricao,
      setor: input.setor,
      categoria: input.categoria || null,
      prioridade: input.prioridade,
      status: 'aberto',
      solicitante_id: auth.user?.id,
    })
    .select(SELECT)
    .single()
  if (error) throw error
  return mapChamado(data)
}

// ---------- Leitura ----------
export async function listarChamados(): Promise<Chamado[]> {
  if (USE_MOCK || !supabase) return [...mockChamados]
  const { data, error } = await supabase
    .from('chamados')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapChamado)
}

export async function listarMeusChamados(): Promise<Chamado[]> {
  if (USE_MOCK || !supabase) return [...mockChamados]
  const { data: auth } = await supabase.auth.getUser()
  const id = auth.user?.id
  if (!id) return []
  const { data, error } = await supabase
    .from('chamados')
    .select(SELECT)
    .eq('solicitante_id', id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapChamado)
}

// ---------- Gestão (admin) ----------

/** Admin aceita o chamado: vira responsável e o status passa a "em andamento". */
export async function aceitarChamado(id: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('chamados')
    .update({ responsavel_id: auth.user?.id, status: 'em_andamento' })
    .eq('id', id)
  if (error) throw error
}

export async function atualizarStatusChamado(id: string, status: StatusChamado): Promise<void> {
  if (USE_MOCK || !supabase) return
  const patch: Record<string, unknown> = { status }
  patch.finalizado_em = status === 'finalizado' ? new Date().toISOString() : null
  const { error } = await supabase.from('chamados').update(patch).eq('id', id)
  if (error) throw error
}

export async function excluirChamado(id: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase.from('chamados').delete().eq('id', id)
  if (error) throw error
}
