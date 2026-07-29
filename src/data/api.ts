import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase, USE_MOCK } from '@/lib/supabase'
import { disponibilidadePorHorario } from '@/lib/horarios'
import * as mock from '@/data/mock'
import type {
  AreaAtuacao,
  Aviso,
  EventoHistorico,
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
  disp:disponibilidade(status, livre_ate, automatico),
  horarios(dia, manha_ativo, manha_inicio, manha_fim, tarde_ativo, tarde_inicio, tarde_fim, observacao)
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
    ...resolverDisponibilidade(disp, r.horarios),
  }
}

/**
 * Decide a situação exibida para o pesquisador.
 *
 * Por padrão o sistema é AUTOMÁTICO: a situação sai do horário cadastrado, de
 * modo que o quadro acompanha o dia sozinho. Quando alguém define um estado
 * manual (Parcial, Home office, Ausente), aquele valor passa a mandar —
 * é o que o campo `automatico = false` sinaliza.
 */
function resolverDisponibilidade(
  disp: any,
  horariosBrutos: any,
): Pick<Usuario, 'disponibilidade' | 'livreAte' | 'disponibilidadeAutomatica'> {
  // Sem registro, ou marcado como automático → calcula pelo horário.
  const automatico = !disp || disp.automatico !== false

  if (!automatico) {
    return {
      disponibilidade: normalizarStatus(disp.status),
      livreAte: hhmm(disp.livre_ate),
      disponibilidadeAutomatica: false,
    }
  }

  const horarios: HorarioDia[] = (horariosBrutos ?? []).map(mapHorario)
  const calculado = disponibilidadePorHorario(horarios)
  return {
    disponibilidade: calculado.status,
    livreAte: calculado.livreAte,
    disponibilidadeAutomatica: true,
  }
}

/**
 * Protege contra valores antigos no banco (ex.: 'em_atendimento', que virou
 * 'parcial'). Sem isso, uma linha não migrada quebraria a tela.
 */
function normalizarStatus(v: unknown): StatusDisponibilidade {
  const s = String(v ?? '')
  if (s === 'disponivel' || s === 'parcial' || s === 'home_office' || s === 'ausente') return s
  if (s === 'em_atendimento') return 'parcial' // valor legado
  return 'ausente'
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

/** Atualiza um aviso já publicado (só administradores, pela política do banco). */
export async function atualizarAviso(a: Aviso): Promise<Aviso> {
  if (USE_MOCK || !supabase) return a
  const { data, error } = await supabase
    .from('avisos')
    .update({
      titulo: a.titulo,
      descricao: a.descricao,
      tipo: a.tipo,
      status: a.status,
      destaque: a.destaque,
      hora: a.hora || null,
      publico_alvo: a.publicoAlvo,
    })
    .eq('id', a.id)
    .select('*')
    .single()
  if (error) throw error
  return mapAviso(data)
}

/** Remove um aviso. */
export async function excluirAviso(id: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase.from('avisos').delete().eq('id', id)
  if (error) throw error
}

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
/**
 * Define MANUALMENTE a situação de um pesquisador.
 * Ao gravar, marca `automatico = false` — a partir daí este valor prevalece
 * sobre o cálculo pelo horário, até alguém voltar para o modo automático.
 */
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
      automatico: false,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'usuario_id' },
  )
  if (error) throw error
}

/**
 * Volta a situação para o modo AUTOMÁTICO (calculada pelo horário).
 * Útil quando o estado manual (ex.: "Ausente") já não vale mais.
 */
export async function voltarDisponibilidadeAutomatica(usuarioId: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase.from('disponibilidade').upsert(
    {
      usuario_id: usuarioId,
      status: 'disponivel',
      livre_ate: null,
      automatico: true,
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

// ============================================================
// Edição de usuários (Administração)
// ============================================================

/** Campos editáveis do cadastro de um usuário. */
export interface DadosUsuario {
  nome: string
  telefone?: string
  instituicaoId?: string
  status: 'ativo' | 'inativo'
}

/** Atualiza os dados cadastrais de um usuário. */
export async function atualizarUsuario(id: string, dados: DadosUsuario): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase
    .from('usuarios')
    .update({
      nome: dados.nome,
      telefone: dados.telefone || null,
      instituicao_id: dados.instituicaoId || null,
      status: dados.status,
    })
    .eq('id', id)
  if (error) throw error
  await registrarHistorico(id, `Dados cadastrais atualizados`)
}

/** Troca a função (papel) de um usuário. */
export async function atualizarFuncaoUsuario(id: string, funcaoId: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase.from('usuarios').update({ funcao_id: funcaoId }).eq('id', id)
  if (error) throw error

  const { data } = await supabase.from('funcoes').select('nome').eq('id', funcaoId).single()
  await registrarHistorico(id, `Função alterada para ${data?.nome ?? 'outra função'}`)
}

/**
 * Define as áreas de atuação de um usuário.
 * Estratégia simples e segura: apaga os vínculos atuais e grava os novos.
 */
export async function atualizarAreasUsuario(id: string, areaIds: string[]): Promise<void> {
  if (USE_MOCK || !supabase) return

  const { error: erroApagar } = await supabase.from('usuario_areas').delete().eq('usuario_id', id)
  if (erroApagar) throw erroApagar

  if (areaIds.length > 0) {
    const linhas = areaIds.map((areaId) => ({ usuario_id: id, area_id: areaId }))
    const { error } = await supabase.from('usuario_areas').insert(linhas)
    if (error) throw error
  }
  await registrarHistorico(id, `Áreas de atuação atualizadas (${areaIds.length})`)
}

// ============================================================
// Histórico de alterações (auditoria por usuário)
// ============================================================

/**
 * Registra uma linha no histórico do usuário.
 * Falha silenciosamente: perder um registro de auditoria não pode derrubar
 * a operação principal que o usuário acabou de fazer.
 */
export async function registrarHistorico(usuarioAlvoId: string, descricao: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  try {
    const { data: auth } = await supabase.auth.getUser()
    let autor = auth.user?.email ?? 'Sistema'
    if (auth.user?.id) {
      const { data } = await supabase.from('usuarios').select('nome').eq('id', auth.user.id).single()
      if (data?.nome) autor = data.nome
    }
    await supabase
      .from('historico_alteracoes')
      .insert({ usuario_alvo_id: usuarioAlvoId, autor, descricao })
  } catch {
    // silencioso de propósito (ver comentário acima)
  }
}

/** Histórico de alterações de um usuário, do mais recente para o mais antigo. */
export async function listarHistorico(usuarioId: string): Promise<EventoHistorico[]> {
  if (USE_MOCK || !supabase) return mock.historico

  const { data, error } = await supabase
    .from('historico_alteracoes')
    .select('*')
    .eq('usuario_alvo_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error

  return (data ?? []).map((r: any) => ({
    id: r.id,
    data: new Date(r.created_at).toLocaleString('pt-BR'),
    autor: r.autor,
    descricao: r.descricao,
  }))
}

// ============================================================
// Vínculo de pesquisadores com instituições
// ============================================================

/**
 * Define quais usuários pertencem a uma instituição.
 * Quem saiu da lista fica sem instituição; quem entrou passa a apontar para ela.
 */
export async function definirUsuariosDaInstituicao(
  instituicaoId: string,
  usuarioIds: string[],
): Promise<void> {
  if (USE_MOCK || !supabase) return

  // 1) Desvincula quem estava nela e não está mais na lista.
  const { error: erroLimpar } = await supabase
    .from('usuarios')
    .update({ instituicao_id: null })
    .eq('instituicao_id', instituicaoId)
  if (erroLimpar) throw erroLimpar

  // 2) Vincula os selecionados.
  if (usuarioIds.length > 0) {
    const { error } = await supabase
      .from('usuarios')
      .update({ instituicao_id: instituicaoId })
      .in('id', usuarioIds)
    if (error) throw error
  }
}
