import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase, USE_MOCK } from '@/lib/supabase'
import * as mock from '@/data/mock'
import type {
  AreaAtuacao,
  Aviso,
  Funcao,
  HorarioDia,
  Instituicao,
  MudancaTurno,
  StatusDisponibilidade,
  Usuario,
} from '@/types'

/**
 * Camada de acesso a dados (Fase 4).
 * Cada função decide a fonte:
 *   - USE_MOCK (ou sem cliente) → dados de exemplo (mock);
 *   - senão → banco real (Supabase), mapeando as linhas para os tipos do app.
 * Assim as telas chamam sempre a mesma função, sem saber a origem.
 */

/** "há 2 horas" a partir de uma data ISO (para "publicado há..."). */
function publicadoHa(iso?: string): string | undefined {
  if (!iso) return undefined
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
}

/** "12:00:00" (time do Postgres) → "12:00". */
function hhmm(t?: string | null): string | undefined {
  return t ? t.slice(0, 5) : undefined
}

// ============================================================
// Referências: Funções, Áreas, Instituições
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapFuncao = (r: any): Funcao => ({ id: r.id, nome: r.nome, permissoes: r.permissoes ?? [] })
const mapArea = (r: any): AreaAtuacao => ({ id: r.id, nome: r.nome, cor: r.cor ?? '#6366f1' })
const mapInstituicao = (r: any): Instituicao => ({ id: r.id, nome: r.nome, sigla: r.sigla })

export async function listarFuncoes(): Promise<Funcao[]> {
  if (USE_MOCK || !supabase) return mock.funcoes
  const { data, error } = await supabase.from('funcoes').select('*').order('nome')
  if (error) throw error
  return (data ?? []).map(mapFuncao)
}

export async function listarAreas(): Promise<AreaAtuacao[]> {
  if (USE_MOCK || !supabase) return mock.areas
  const { data, error } = await supabase.from('areas_atuacao').select('*').order('nome')
  if (error) throw error
  return (data ?? []).map(mapArea)
}

export async function listarInstituicoes(): Promise<Instituicao[]> {
  if (USE_MOCK || !supabase) return mock.instituicoes
  const { data, error } = await supabase.from('instituicoes').select('*').order('nome')
  if (error) throw error
  return (data ?? []).map(mapInstituicao)
}

// ============================================================
// Usuários (com função, instituição, áreas e disponibilidade)
// ============================================================

const USUARIO_SELECT = `
  id, nome, email, telefone, foto_url, status,
  funcao:funcoes(id, nome, permissoes),
  instituicao:instituicoes(id, nome, sigla),
  areas:usuario_areas(area:areas_atuacao(id, nome, cor)),
  disp:disponibilidade(status, livre_ate)
`

function mapUsuario(r: any): Usuario {
  // disponibilidade vem como array (0/1) por ser tabela filha via FK.
  const disp = Array.isArray(r.disp) ? r.disp[0] : r.disp
  return {
    id: r.id,
    nome: r.nome,
    email: r.email,
    telefone: r.telefone ?? undefined,
    fotoUrl: r.foto_url ?? undefined,
    funcao: r.funcao ? mapFuncao(r.funcao) : { id: '', nome: '—', permissoes: [] },
    instituicao: r.instituicao ? mapInstituicao(r.instituicao) : undefined,
    areas: (r.areas ?? []).map((ua: any) => ua.area).filter(Boolean).map(mapArea),
    status: r.status,
    disponibilidade: disp?.status ?? 'ausente',
    livreAte: hhmm(disp?.livre_ate),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listarUsuarios(): Promise<Usuario[]> {
  if (USE_MOCK || !supabase) return mock.usuarios
  const { data, error } = await supabase.from('usuarios').select(USUARIO_SELECT).order('nome')
  if (error) throw error
  return (data ?? []).map(mapUsuario)
}

// ============================================================
// Avisos
// ============================================================

/** Linha da tabela `avisos` (snake_case) → tipo `Aviso` do app. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAviso(row: any): Aviso {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    tipo: row.tipo,
    status: row.status,
    destaque: row.destaque ?? false,
    data: row.data ?? row.created_at,
    hora: hhmm(row.hora),
    publicoAlvo: row.publico_alvo ?? '',
    visualizacoes: row.visualizacoes ?? 0,
    publicadoHa: publicadoHa(row.created_at ?? row.data),
  }
}

export async function listarAvisos(): Promise<Aviso[]> {
  if (USE_MOCK || !supabase) return mock.avisos
  const { data, error } = await supabase
    .from('avisos')
    .select('*')
    .order('data', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapAviso)
}

/** Cria um aviso. Recebe o objeto montado pelo formulário. */
export async function criarAviso(a: Aviso): Promise<Aviso> {
  if (USE_MOCK || !supabase) return a // modo mock: devolve como veio
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('avisos')
    .insert({
      titulo: a.titulo,
      descricao: a.descricao,
      tipo: a.tipo,
      status: a.status,
      destaque: a.destaque,
      hora: a.hora || null,
      publico_alvo: a.publicoAlvo,
      autor_id: userData.user?.id ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapAviso(data)
}

// ============================================================
// Mudanças de turno
// ============================================================

export async function listarMudancas(): Promise<MudancaTurno[]> {
  if (USE_MOCK || !supabase) return mock.mudancas
  const { data, error } = await supabase
    .from('mudancas_turno')
    .select('id, usuario_id, descricao, quando, tag, usuarios(nome)')
    .order('created_at', { ascending: true })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    usuarioId: r.usuario_id,
    usuarioNome: r.usuarios?.nome ?? '',
    descricao: r.descricao,
    quando: r.quando,
    tag: r.tag ?? '',
  }))
}

// ============================================================
// Perfil do usuário logado, horários e disponibilidade
// ============================================================

/** Perfil (Usuario) do usuário atualmente logado. */
export async function perfilAtual(): Promise<Usuario | null> {
  if (USE_MOCK || !supabase) return mock.usuarioAtual
  const { data: auth } = await supabase.auth.getUser()
  const id = auth.user?.id
  if (!id) return null
  const { data, error } = await supabase.from('usuarios').select(USUARIO_SELECT).eq('id', id).single()
  if (error) throw error
  return mapUsuario(data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHorario(r: any): HorarioDia {
  return {
    dia: r.dia,
    manha: {
      ativo: r.manha_ativo ?? false,
      inicio: hhmm(r.manha_inicio) ?? '09:00',
      fim: hhmm(r.manha_fim) ?? '12:00',
    },
    tarde: {
      ativo: r.tarde_ativo ?? false,
      inicio: hhmm(r.tarde_inicio) ?? '13:30',
      fim: hhmm(r.tarde_fim) ?? '17:30',
    },
    observacao: r.observacao ?? '',
  }
}

/**
 * Horários de TODOS os usuários de uma vez, agrupados por id de usuário.
 *
 * Usado na tela "Administração > Horários" para montar o quadro de cobertura
 * da semana sem precisar de uma consulta por pessoa.
 */
export async function listarTodosHorarios(): Promise<Record<string, HorarioDia[]>> {
  const porUsuario: Record<string, HorarioDia[]> = {}

  if (USE_MOCK || !supabase) {
    // Sem banco: todo mundo usa o mesmo horário de exemplo.
    for (const u of mock.usuarios) porUsuario[u.id] = mock.horarioPadrao
    return porUsuario
  }

  const { data, error } = await supabase.from('horarios').select('*')
  if (error) throw error
  for (const linha of data ?? []) {
    const id = linha.usuario_id as string
    if (!porUsuario[id]) porUsuario[id] = []
    porUsuario[id].push(mapHorario(linha))
  }
  return porUsuario
}

/** Horários semanais de um usuário. */
export async function listarHorarios(usuarioId: string): Promise<HorarioDia[]> {
  if (USE_MOCK || !supabase) return mock.horarioPadrao
  const { data, error } = await supabase.from('horarios').select('*').eq('usuario_id', usuarioId)
  if (error) throw error
  return (data ?? []).map(mapHorario)
}

/** Salva (upsert) os horários semanais de um usuário. */
export async function salvarHorarios(usuarioId: string, horarios: HorarioDia[]): Promise<void> {
  if (USE_MOCK || !supabase) return
  const rows = horarios.map((h) => ({
    usuario_id: usuarioId,
    dia: h.dia,
    manha_ativo: h.manha.ativo,
    manha_inicio: h.manha.inicio,
    manha_fim: h.manha.fim,
    tarde_ativo: h.tarde.ativo,
    tarde_inicio: h.tarde.inicio,
    tarde_fim: h.tarde.fim,
    observacao: h.observacao || null,
  }))
  const { error } = await supabase.from('horarios').upsert(rows, { onConflict: 'usuario_id,dia' })
  if (error) throw error
}

/** Atualiza a disponibilidade "ao vivo" de um usuário. */
export async function atualizarDisponibilidade(
  usuarioId: string,
  status: StatusDisponibilidade,
  livreAte?: string,
): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase.from('disponibilidade').upsert(
    {
      usuario_id: usuarioId,
      status,
      livre_ate: livreAte || null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'usuario_id' },
  )
  if (error) throw error
}

// ============================================================
// CRUD de Administração (Funções, Áreas, Instituições)
// ============================================================

export async function salvarFuncao(f: Funcao): Promise<Funcao> {
  if (USE_MOCK || !supabase) return f
  const payload = { nome: f.nome, permissoes: f.permissoes }
  const novo = f.id.startsWith('f-') || !f.id // id local => insert
  const q = novo
    ? supabase.from('funcoes').insert(payload)
    : supabase.from('funcoes').update(payload).eq('id', f.id)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return mapFuncao(data)
}

export async function excluirFuncao(id: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase.from('funcoes').delete().eq('id', id)
  if (error) throw error
}

export async function salvarArea(a: AreaAtuacao): Promise<AreaAtuacao> {
  if (USE_MOCK || !supabase) return a
  const payload = { nome: a.nome, cor: a.cor }
  const novo = a.id.startsWith('a-') || !a.id
  const q = novo
    ? supabase.from('areas_atuacao').insert(payload)
    : supabase.from('areas_atuacao').update(payload).eq('id', a.id)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return mapArea(data)
}

export async function excluirArea(id: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase.from('areas_atuacao').delete().eq('id', id)
  if (error) throw error
}

export async function salvarInstituicao(i: Instituicao): Promise<Instituicao> {
  if (USE_MOCK || !supabase) return i
  const payload = { nome: i.nome, sigla: i.sigla }
  const novo = i.id.startsWith('i-') || !i.id
  const q = novo
    ? supabase.from('instituicoes').insert(payload)
    : supabase.from('instituicoes').update(payload).eq('id', i.id)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return mapInstituicao(data)
}

export async function excluirInstituicao(id: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase.from('instituicoes').delete().eq('id', id)
  if (error) throw error
}
