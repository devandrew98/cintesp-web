import { supabase, USE_MOCK } from '@/lib/supabase'
import type { Chamado, PrioridadeChamado, SetorChamado, StatusChamado } from '@/types'

/**
 * Camada de dados dos CHAMADOS.
 * O que cada pessoa vê/faz é garantido pelo banco (RLS): o solicitante só vê
 * os seus; o admin vê todos, aceita e muda o status.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const SELECT = `
  id, titulo, descricao, setor, categoria, prioridade, status, anexo_url,
  solicitante_id, responsavel_id, created_at, updated_at, finalizado_em,
  solicitante:solicitante_id (nome, foto_url, email),
  responsavel:responsavel_id (nome, foto_url)
`

// Mesmo select SEM a coluna `anexo_url` — plano B para bancos onde a migração
// dos chamados (docs/supabase-atualizacoes.sql) ainda não foi rodada.
const SELECT_SEM_ANEXO = SELECT.replace('status, anexo_url,', 'status,')

/**
 * A coluna/relacionamento pedido não existe no banco? (migração pendente)
 * Cobre tanto o "column does not exist" (42703) quanto o aviso do PostgREST
 * "Could not find the 'X' column ... in the schema cache".
 */
function ehColunaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /could not find .* column|column .* does not exist|schema cache/i.test(msg)
  )
}

/** Lê chamados tentando com `anexo_url` e, se a coluna faltar, sem ela. */
async function selecionarChamados(
  construir: (select: string) => PromiseLike<{ data: any; error: any }>,
): Promise<{ data: any; error: any }> {
  let r = await construir(SELECT)
  if (r.error && ehColunaAusente(r.error)) r = await construir(SELECT_SEM_ANEXO)
  return r
}

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
    solicitanteFotoUrl: r.solicitante?.foto_url ?? undefined,
    solicitanteEmail: r.solicitante?.email ?? undefined,
    responsavelId: r.responsavel_id ?? undefined,
    responsavelNome: r.responsavel?.nome ?? undefined,
    anexoUrl: r.anexo_url ?? undefined,
    criadoEm: r.created_at,
    atualizadoEm: r.updated_at ?? undefined,
    finalizadoEm: r.finalizado_em ?? undefined,
  }
}

// Armazenamento em memória para o modo mock (sem banco).
const mockChamados: Chamado[] = []

// ---------- Anexo (Storage) ----------
/**
 * Envia um anexo do chamado (imagem/PDF) para o Storage e devolve a URL pública.
 * Requer o bucket público `chamado-anexos` (ver docs/supabase-chamados.sql).
 */
export async function enviarAnexoChamado(arquivo: File): Promise<string> {
  if (USE_MOCK || !supabase) return URL.createObjectURL(arquivo)
  const { data: auth } = await supabase.auth.getUser()
  const ext = (arquivo.name.split('.').pop() || 'bin').toLowerCase()
  const caminho = `${auth.user?.id ?? 'anon'}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('chamado-anexos')
    .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type || undefined })
  if (error) throw error
  const { data: pub } = supabase.storage.from('chamado-anexos').getPublicUrl(caminho)
  return pub.publicUrl
}

// ---------- Abertura ----------
export interface NovoChamado {
  titulo: string
  descricao: string
  setor: SetorChamado
  categoria?: string
  prioridade: PrioridadeChamado
  anexoUrl?: string
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
  const base = {
    titulo: input.titulo,
    descricao: input.descricao,
    setor: input.setor,
    categoria: input.categoria || null,
    prioridade: input.prioridade,
    status: 'aberto' as const,
    solicitante_id: auth.user?.id,
  }
  // Só manda `anexo_url` quando há anexo — assim o campo é REALMENTE opcional.
  const payload = input.anexoUrl ? { ...base, anexo_url: input.anexoUrl } : base

  let r = await supabase.from('chamados').insert(payload).select(SELECT).single()
  // Banco sem a coluna `anexo_url`: abre o chamado mesmo assim (sem o anexo).
  if (r.error && ehColunaAusente(r.error)) {
    r = await supabase.from('chamados').insert(base).select(SELECT_SEM_ANEXO).single()
  }
  if (r.error) throw r.error
  return mapChamado(r.data)
}

// ---------- Leitura ----------
export async function listarChamados(): Promise<Chamado[]> {
  if (USE_MOCK || !supabase) return [...mockChamados]
  const r = await selecionarChamados((sel) =>
    supabase!.from('chamados').select(sel).order('created_at', { ascending: false }),
  )
  if (r.error) throw r.error
  return (r.data ?? []).map(mapChamado)
}

export async function listarMeusChamados(): Promise<Chamado[]> {
  if (USE_MOCK || !supabase) return [...mockChamados]
  const { data: auth } = await supabase.auth.getUser()
  const id = auth.user?.id
  if (!id) return []
  const r = await selecionarChamados((sel) =>
    supabase!.from('chamados').select(sel).eq('solicitante_id', id).order('created_at', { ascending: false }),
  )
  if (r.error) throw r.error
  return (r.data ?? []).map(mapChamado)
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

// ============================================================
// Chat do chamado (mensagens)
// ============================================================

export interface MensagemChamado {
  id: string
  chamadoId: string
  autorId?: string
  autorNome?: string
  autorFotoUrl?: string
  corpo: string
  criadoEm: string
}

const mockMensagens: MensagemChamado[] = []

/** A tabela ainda não existe? (migração docs/supabase-chamado-mensagens.sql) */
function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table .* in the schema cache/i.test(msg)
  )
}

/** Mensagens (conversa) de um chamado, em ordem cronológica. */
export async function listarMensagensChamado(chamadoId: string): Promise<MensagemChamado[]> {
  if (USE_MOCK || !supabase) return mockMensagens.filter((m) => m.chamadoId === chamadoId)
  const { data, error } = await supabase
    .from('chamado_mensagens')
    .select('id, chamado_id, autor_id, corpo, created_at, autor:autor_id (nome, foto_url)')
    .eq('chamado_id', chamadoId)
    .order('created_at', { ascending: true })
  if (error) {
    if (ehTabelaAusente(error)) return [] // migração pendente: não quebra a tela
    throw error
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    chamadoId: r.chamado_id,
    autorId: r.autor_id ?? undefined,
    autorNome: r.autor?.nome ?? undefined,
    autorFotoUrl: r.autor?.foto_url ?? undefined,
    corpo: r.corpo,
    criadoEm: r.created_at,
  }))
}

/** Envia uma mensagem no chamado (o banco barra se estiver finalizado). */
export async function enviarMensagemChamado(chamadoId: string, corpo: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    mockMensagens.push({
      id: `m-${Date.now()}`,
      chamadoId,
      corpo,
      autorNome: 'Você',
      criadoEm: new Date().toISOString(),
    })
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('chamado_mensagens')
    .insert({ chamado_id: chamadoId, autor_id: auth.user?.id, corpo })
  if (error) throw error
}
