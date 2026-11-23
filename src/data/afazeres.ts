import { supabase, USE_MOCK } from '@/lib/supabase'
import { validarNota, validarTarefaPessoal, type DadosNota, type DadosTarefaPessoal, type Nota, type TarefaPessoal } from '@/lib/afazeres'

/**
 * Camada de dados de MEUS AFAZERES (docs/supabase-afazeres.sql): tarefas particulares e anotações.
 * Só o dono lê e grava (RLS `dono_id = auth.uid()`). Em modo mock fica em memória.
 * (As tarefas dos projetos e os compromissos vêm de data/tarefas.ts e data/agendaEquipe.ts.)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return error?.code === '42P01' || error?.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(msg)
}

function erroAmigavel(error: any): Error {
  const msg = String(error?.message ?? error)
  if (ehTabelaAusente(error)) return new Error('Os afazeres ainda não foram ativados no banco (falta rodar docs/supabase-afazeres.sql).')
  if (/row-level security|violates row-level/i.test(msg)) return new Error('Você não tem permissão para esta operação.')
  return error instanceof Error ? error : new Error(msg)
}

const uid = () => crypto.randomUUID()

// ---------------- tarefas particulares ----------------

function mapTarefa(r: any): TarefaPessoal {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    status: r.status,
    prioridade: r.prioridade,
    dataEntrega: r.data_entrega ?? undefined,
    criadoEm: r.created_at,
    atualizadoEm: r.updated_at ?? undefined,
  }
}

const mockTarefas: TarefaPessoal[] = [
  { id: uid(), titulo: 'Revisar o relatório mensal', status: 'nao_iniciado', prioridade: 'alta', dataEntrega: new Date().toISOString().slice(0, 10), criadoEm: new Date().toISOString() },
  { id: uid(), titulo: 'Estudar referências para o artigo', status: 'em_andamento', prioridade: 'media', criadoEm: new Date().toISOString() },
]

export async function listarTarefasPessoais(): Promise<TarefaPessoal[]> {
  if (USE_MOCK || !supabase) return mockTarefas.map((t) => ({ ...t }))
  const { data, error } = await supabase.from('afazeres_tarefas').select('*').order('created_at', { ascending: true })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapTarefa)
}

export async function criarTarefaPessoal(d: DadosTarefaPessoal): Promise<void> {
  const erro = validarTarefaPessoal(d)
  if (erro) throw new Error(erro)
  if (USE_MOCK || !supabase) {
    mockTarefas.push({ ...d, titulo: d.titulo.trim(), id: uid(), criadoEm: new Date().toISOString() })
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('afazeres_tarefas').insert({
    dono_id: auth.user?.id,
    titulo: d.titulo.trim(),
    descricao: d.descricao?.trim() || null,
    status: d.status,
    prioridade: d.prioridade,
    data_entrega: d.dataEntrega || null,
  })
  if (error) throw erroAmigavel(error)
}

export async function atualizarTarefaPessoal(id: string, patch: Partial<DadosTarefaPessoal>): Promise<void> {
  if (patch.titulo !== undefined) {
    const erro = validarTarefaPessoal({ titulo: patch.titulo })
    if (erro) throw new Error(erro)
  }
  if (USE_MOCK || !supabase) {
    const t = mockTarefas.find((x) => x.id === id)
    if (!t) throw new Error('Tarefa não encontrada.')
    Object.assign(t, patch, { atualizadoEm: new Date().toISOString() })
    if (patch.titulo !== undefined) t.titulo = patch.titulo.trim()
    return
  }
  const linha: Record<string, unknown> = {}
  if (patch.titulo !== undefined) linha.titulo = patch.titulo.trim()
  if ('descricao' in patch) linha.descricao = patch.descricao?.trim() || null
  if (patch.status !== undefined) linha.status = patch.status
  if (patch.prioridade !== undefined) linha.prioridade = patch.prioridade
  if ('dataEntrega' in patch) linha.data_entrega = patch.dataEntrega || null
  const { error } = await supabase.from('afazeres_tarefas').update(linha).eq('id', id)
  if (error) throw erroAmigavel(error)
}

export async function excluirTarefaPessoal(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockTarefas.findIndex((x) => x.id === id)
    if (i >= 0) mockTarefas.splice(i, 1)
    return
  }
  const { error } = await supabase.from('afazeres_tarefas').delete().eq('id', id)
  if (error) throw erroAmigavel(error)
}

// ---------------- anotações ----------------

function mapNota(r: any): Nota {
  return { id: r.id, titulo: r.titulo ?? '', texto: r.texto ?? '', fixada: Boolean(r.fixada), criadoEm: r.created_at, atualizadoEm: r.updated_at ?? r.created_at }
}

const mockNotas: Nota[] = [
  { id: uid(), titulo: 'Ideias para a oficina', texto: 'Levar protótipos da órtese e pedir autorização para fotos.', fixada: true, criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() },
]

export async function listarNotas(): Promise<Nota[]> {
  if (USE_MOCK || !supabase) return mockNotas.map((n) => ({ ...n }))
  const { data, error } = await supabase.from('afazeres_notas').select('*').order('updated_at', { ascending: false })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapNota)
}

export async function criarNota(d: DadosNota): Promise<void> {
  const erro = validarNota(d)
  if (erro) throw new Error(erro)
  if (USE_MOCK || !supabase) {
    const agora = new Date().toISOString()
    mockNotas.unshift({ ...d, id: uid(), criadoEm: agora, atualizadoEm: agora })
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('afazeres_notas').insert({ dono_id: auth.user?.id, titulo: d.titulo.trim(), texto: d.texto.trim(), fixada: d.fixada })
  if (error) throw erroAmigavel(error)
}

export async function atualizarNota(id: string, d: Partial<DadosNota>): Promise<void> {
  if (d.titulo !== undefined && d.texto !== undefined) {
    const erro = validarNota({ titulo: d.titulo, texto: d.texto })
    if (erro) throw new Error(erro)
  }
  if (USE_MOCK || !supabase) {
    const n = mockNotas.find((x) => x.id === id)
    if (!n) throw new Error('Anotação não encontrada.')
    Object.assign(n, d, { atualizadoEm: new Date().toISOString() })
    return
  }
  const linha: Record<string, unknown> = {}
  if (d.titulo !== undefined) linha.titulo = d.titulo.trim()
  if (d.texto !== undefined) linha.texto = d.texto.trim()
  if (d.fixada !== undefined) linha.fixada = d.fixada
  const { error } = await supabase.from('afazeres_notas').update(linha).eq('id', id)
  if (error) throw erroAmigavel(error)
}

export async function excluirNota(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockNotas.findIndex((x) => x.id === id)
    if (i >= 0) mockNotas.splice(i, 1)
    return
  }
  const { error } = await supabase.from('afazeres_notas').delete().eq('id', id)
  if (error) throw erroAmigavel(error)
}
