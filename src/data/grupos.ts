import { supabase, USE_MOCK } from '@/lib/supabase'
import { listarUsuarios, perfilAtual } from '@/data/api'
import { normalizarLink, validarGrupo, type DadosGrupo, type GrupoTarefas } from '@/lib/grupos'

/**
 * Camada de dados dos GRUPOS de tarefas do projeto e dos links do projeto (Drive e grupo de conversa)
 * — docs/supabase-projetos-grupos.sql. O que cada pessoa enxerga é decidido pelo banco (RLS):
 * grupo restrito só aparece para quem foi escolhido. Em modo mock fica em memória.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return error?.code === '42P01' || error?.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(msg)
}

function erroAmigavel(error: any): Error {
  const msg = String(error?.message ?? error)
  if (ehTabelaAusente(error)) return new Error('Os grupos ainda não foram ativados no banco (falta rodar docs/supabase-projetos-grupos.sql).')
  if (/row-level security|violates row-level/i.test(msg)) return new Error('Você não tem permissão para fazer isso neste grupo.')
  return error instanceof Error ? error : new Error(msg)
}

function mapGrupo(r: any): GrupoTarefas {
  return {
    id: r.id,
    projetoId: r.projeto_id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    responsavelId: r.responsavel_id ?? undefined,
    responsavelNome: r.responsavel?.nome ?? undefined,
    driveUrl: r.drive_url ?? undefined,
    restrito: Boolean(r.restrito),
    membros: (r.membros ?? []).map((m: any) => ({ usuarioId: m.usuario_id, nome: m.usuario?.nome ?? undefined })),
    ordem: r.ordem ?? 0,
    criadoPorId: r.criado_por ?? undefined,
    criadoEm: r.created_at,
  }
}

// ---------------- mock ----------------
const mg = (id: string, projetoId: string, titulo: string, extra: Partial<GrupoTarefas> = {}): GrupoTarefas => ({
  id,
  projetoId,
  titulo,
  restrito: false,
  membros: [],
  ordem: 0,
  criadoEm: new Date().toISOString(),
  ...extra,
})
const mockGrupos: GrupoTarefas[] = [
  mg('g-1', 'proj-1', 'Grupo 1: Desenvolvimento do protótipo', { responsavelId: 'u1', responsavelNome: 'João Silva', ordem: 1, descricao: 'Firmware, eletrônica e montagem do protótipo.', driveUrl: 'https://drive.google.com/drive/folders/exemplo-prototipo' }),
  mg('g-2', 'proj-1', 'Grupo 2: Testes de campo', { responsavelId: 'u2', responsavelNome: 'Mariana Souza', ordem: 2 }),
  mg('g-3', 'proj-1', 'Grupo 3: Financeiro (restrito)', { responsavelId: 'u1', responsavelNome: 'João Silva', ordem: 3, restrito: true, membros: [{ usuarioId: 'u1', nome: 'João Silva' }], descricao: 'Orçamento e compras. Só quem está neste grupo vê.' }),
  mg('g-4', 'proj-2', 'Grupo 1: Levantamento de requisitos', { responsavelId: 'u3', responsavelNome: 'Carlos Almeida', ordem: 1 }),
]
const mockLinks = new Map<string, { driveUrl?: string; grupoUrl?: string }>([['proj-1', { driveUrl: 'https://drive.google.com/drive/folders/exemplo-projeto', grupoUrl: 'https://chat.whatsapp.com/exemplo' }]])

async function nomesMock(ids: string[]): Promise<Map<string, string>> {
  const usuarios = await listarUsuarios()
  return new Map(ids.map((id) => [id, usuarios.find((u) => u.id === id)?.nome ?? '—']))
}

// ---------------- API: grupos ----------------

/** Só devolve os grupos que o usuário pode ver (o banco já filtra os restritos). */
export async function listarGrupos(projetoId: string): Promise<GrupoTarefas[]> {
  if (USE_MOCK || !supabase) return mockGrupos.filter((g) => g.projetoId === projetoId).map((g) => ({ ...g, membros: [...g.membros] })).sort((a, b) => a.ordem - b.ordem)
  const { data, error } = await supabase
    .from('projeto_grupos')
    .select('*, responsavel:responsavel_id (nome), membros:projeto_grupo_membros (usuario_id, usuario:usuario_id (nome))')
    .eq('projeto_id', projetoId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapGrupo)
}

export async function criarGrupo(projetoId: string, d: DadosGrupo): Promise<string> {
  const erro = validarGrupo(d)
  if (erro) throw new Error(erro)
  const driveUrl = normalizarLink(d.driveUrl)
  if (USE_MOCK || !supabase) {
    const perfil = await perfilAtual()
    const responsavelId = d.responsavelId || perfil?.id
    const nomes = await nomesMock([...(responsavelId ? [responsavelId] : []), ...d.membrosIds])
    const g = mg(`g-${Date.now()}`, projetoId, d.titulo.trim(), {
      descricao: d.descricao?.trim() || undefined,
      responsavelId,
      responsavelNome: responsavelId ? nomes.get(responsavelId) : undefined,
      driveUrl,
      restrito: d.restrito,
      membros: d.restrito ? d.membrosIds.map((id) => ({ usuarioId: id, nome: nomes.get(id) })) : [],
      ordem: Math.max(0, ...mockGrupos.filter((x) => x.projetoId === projetoId).map((x) => x.ordem)) + 1,
      criadoPorId: perfil?.id,
    })
    mockGrupos.push(g)
    return g.id
  }
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id ?? null
  const { data: ult } = await supabase.from('projeto_grupos').select('ordem').eq('projeto_id', projetoId).order('ordem', { ascending: false }).limit(1)
  const { data, error } = await supabase
    .from('projeto_grupos')
    .insert({
      projeto_id: projetoId,
      titulo: d.titulo.trim(),
      descricao: d.descricao?.trim() || null,
      responsavel_id: d.responsavelId || uid,
      drive_url: driveUrl ?? null,
      restrito: d.restrito,
      ordem: (ult?.[0]?.ordem ?? 0) + 1,
      criado_por: uid,
    })
    .select('id')
    .single()
  if (error) throw erroAmigavel(error)
  await gravarMembros(data.id, d.restrito ? d.membrosIds : [])
  return data.id
}

async function gravarMembros(grupoId: string, ids: string[]): Promise<void> {
  if (!supabase) return
  const { error: eDel } = await supabase.from('projeto_grupo_membros').delete().eq('grupo_id', grupoId)
  if (eDel) throw erroAmigavel(eDel)
  const unicos = Array.from(new Set(ids))
  if (unicos.length === 0) return
  const { error } = await supabase.from('projeto_grupo_membros').insert(unicos.map((usuario_id) => ({ grupo_id: grupoId, usuario_id })))
  if (error) throw erroAmigavel(error)
}

export async function atualizarGrupo(id: string, d: DadosGrupo): Promise<void> {
  const erro = validarGrupo(d)
  if (erro) throw new Error(erro)
  const driveUrl = normalizarLink(d.driveUrl)
  if (USE_MOCK || !supabase) {
    const g = mockGrupos.find((x) => x.id === id)
    if (!g) throw new Error('Grupo não encontrado.')
    const nomes = await nomesMock([...(d.responsavelId ? [d.responsavelId] : []), ...d.membrosIds])
    Object.assign(g, {
      titulo: d.titulo.trim(),
      descricao: d.descricao?.trim() || undefined,
      responsavelId: d.responsavelId || undefined,
      responsavelNome: d.responsavelId ? nomes.get(d.responsavelId) : undefined,
      driveUrl,
      restrito: d.restrito,
      membros: d.restrito ? d.membrosIds.map((uid) => ({ usuarioId: uid, nome: nomes.get(uid) })) : [],
    })
    return
  }
  const { error } = await supabase
    .from('projeto_grupos')
    .update({ titulo: d.titulo.trim(), descricao: d.descricao?.trim() || null, responsavel_id: d.responsavelId || null, drive_url: driveUrl ?? null, restrito: d.restrito })
    .eq('id', id)
  if (error) throw erroAmigavel(error)
  await gravarMembros(id, d.restrito ? d.membrosIds : [])
}

/** Exclui o grupo e as tarefas dele. */
export async function excluirGrupo(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockGrupos.findIndex((x) => x.id === id)
    if (i >= 0) mockGrupos.splice(i, 1)
    const { removerTarefasDoGrupoMock } = await import('@/data/tarefas')
    removerTarefasDoGrupoMock(id)
    return
  }
  const { error } = await supabase.from('projeto_grupos').delete().eq('id', id)
  if (error) throw erroAmigavel(error)
}

/** Grava a ordem dos grupos do projeto (posição = índice na lista). Só o ADM (banco garante). */
export async function reordenarGrupos(ids: string[]): Promise<void> {
  if (USE_MOCK || !supabase) {
    ids.forEach((id, i) => {
      const g = mockGrupos.find((x) => x.id === id)
      if (g) g.ordem = i + 1
    })
    return
  }
  for (const [i, id] of ids.entries()) {
    const { error } = await supabase.from('projeto_grupos').update({ ordem: i + 1 }).eq('id', id)
    if (error) throw erroAmigavel(error)
  }
}

// ---------------- API: links do projeto (só a equipe vê) ----------------

export interface LinksProjeto {
  driveUrl?: string
  grupoUrl?: string
}

export async function obterLinksProjeto(projetoId: string): Promise<LinksProjeto> {
  if (USE_MOCK || !supabase) return { ...(mockLinks.get(projetoId) ?? {}) }
  const { data, error } = await supabase.from('projeto_links').select('drive_url, grupo_url').eq('projeto_id', projetoId).maybeSingle()
  if (error) {
    if (ehTabelaAusente(error)) return {}
    throw erroAmigavel(error)
  }
  return { driveUrl: data?.drive_url ?? undefined, grupoUrl: data?.grupo_url ?? undefined }
}

export async function salvarLinksProjeto(projetoId: string, l: LinksProjeto): Promise<void> {
  const driveUrl = normalizarLink(l.driveUrl)
  const grupoUrl = normalizarLink(l.grupoUrl)
  if (USE_MOCK || !supabase) {
    mockLinks.set(projetoId, { driveUrl, grupoUrl })
    return
  }
  const { error } = await supabase.from('projeto_links').upsert({ projeto_id: projetoId, drive_url: driveUrl ?? null, grupo_url: grupoUrl ?? null, updated_at: new Date().toISOString() })
  if (error) throw erroAmigavel(error)
}
