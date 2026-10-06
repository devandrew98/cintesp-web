import { supabase, USE_MOCK } from '@/lib/supabase'
import { listarUsuarios } from '@/data/api'
import type {
  OrigemPonto,
  RegistroPonto,
  ResultadoPonto,
  StatusPontoToken,
  StatusQrPesquisador,
  TipoPonto,
} from '@/types'

/**
 * Camada de dados do PONTO (QR Code).
 *
 * Toda a lógica sensível (validar token, decidir entrada/saída, carimbar o
 * horário) roda no banco, em funções SECURITY DEFINER (ver
 * docs/supabase-ponto.sql e docs/supabase-ponto-autoatendimento.sql) —
 * este arquivo só chama `supabase.rpc(...)` e mapeia o resultado. O front
 * nunca decide o tipo nem envia horário.
 *
 * `ponto_registrar`/`ponto_status_token` são autorizados SÓ pelo token (o
 * pesquisador lê o QR com a câmera do próprio celular, geralmente sem estar
 * logado no app) — por isso são chamadas mesmo sem sessão Supabase.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST202' ||
    /relation .* does not exist|could not find the (table|function) .* in the schema cache/i.test(msg)
  )
}

function mapRegistro(r: any): RegistroPonto {
  return {
    id: r.id,
    usuarioId: r.usuario_id,
    usuarioNome: r.usuario?.nome ?? undefined,
    usuarioFotoUrl: r.usuario?.foto_url ?? undefined,
    tipo: r.tipo,
    registradoEm: r.registrado_em,
    terminalId: r.terminal_id,
    ip: r.ip ?? undefined,
    origem: r.origem,
    editado: r.editado ?? false,
    motivoEdicao: r.motivo_edicao ?? undefined,
    criadoPorNome: r.criado_por_usuario?.nome ?? undefined,
  }
}

// ============================================================
// Mock (sem banco) — persistido em localStorage para sobreviver a reloads
// durante o desenvolvimento local, e propagado entre abas (simula o
// Realtime do Supabase: abra /ponto numa aba e /ponto/:token noutra).
// ============================================================
interface MockToken {
  token: string
  ativo: boolean
  criadoEm: string
  atualizadoEm: string
}

const LS_TOKENS = 'cintesp:mock:ponto:tokens'
export const PONTO_MOCK_LS_REGISTROS = 'cintesp:mock:ponto:registros'

function lsGet<T>(chave: string, padrao: T): T {
  try {
    if (typeof localStorage === 'undefined') return padrao
    const raw = localStorage.getItem(chave)
    return raw ? (JSON.parse(raw) as T) : padrao
  } catch {
    return padrao
  }
}
function lsSet(chave: string, valor: unknown) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // localStorage indisponível (modo privado etc.) — mock some do reload, sem quebrar nada.
  }
}

const mockTokens = new Map<string, MockToken>(lsGet<[string, MockToken][]>(LS_TOKENS, []))
const mockRegistros: RegistroPonto[] = lsGet<RegistroPonto[]>(PONTO_MOCK_LS_REGISTROS, [])
const salvarTokens = () => lsSet(LS_TOKENS, [...mockTokens.entries()])
const salvarRegistros = () => lsSet(PONTO_MOCK_LS_REGISTROS, mockRegistros)

type OuvinteRegistroPonto = (r: RegistroPonto) => void
const mockOuvintes = new Set<OuvinteRegistroPonto>()

/** Mock apenas: assina novos registros de ponto na MESMA aba (simula o Realtime do terminal). */
export function assinarRegistrosPontoMock(cb: OuvinteRegistroPonto): () => void {
  mockOuvintes.add(cb)
  return () => mockOuvintes.delete(cb)
}
function notificarMock(r: RegistroPonto) {
  mockOuvintes.forEach((cb) => cb(r))
}

function novoIdMock(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ponto-mock-${Date.now()}-${Math.random()}`
}

// ============================================================
// Admin — gerar/revogar/consultar QR Codes
// ============================================================

/** Gera (ou renova) o QR Code de um pesquisador. Devolve o token em texto puro — só aparece agora. */
export async function gerarQrPesquisador(usuarioId: string): Promise<string> {
  if (USE_MOCK || !supabase) {
    const token = `MOCK-${usuarioId}-${Date.now().toString(36)}`
    const agora = new Date().toISOString()
    mockTokens.set(usuarioId, { token, ativo: true, criadoEm: agora, atualizadoEm: agora })
    salvarTokens()
    return token
  }
  const { data, error } = await supabase.rpc('ponto_gerar_qr', { p_usuario_id: usuarioId })
  if (error) throw error
  return data as string
}

/** Revoga o QR Code de um pesquisador (o código antigo deixa de funcionar). */
export async function revogarQrPesquisador(usuarioId: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const atual = mockTokens.get(usuarioId)
    if (atual) {
      atual.ativo = false
      salvarTokens()
    }
    return
  }
  const { error } = await supabase.rpc('ponto_revogar_qr', { p_usuario_id: usuarioId })
  if (error) throw error
}

/** Status do QR Code de cada pesquisador (para a tela de administração). */
export async function listarStatusQr(): Promise<StatusQrPesquisador[]> {
  if (USE_MOCK || !supabase) {
    return [...mockTokens.entries()].map(([usuarioId, t]) => ({
      usuarioId,
      ativo: t.ativo,
      criadoEm: t.criadoEm,
      atualizadoEm: t.atualizadoEm,
    }))
  }
  const { data, error } = await supabase
    .from('pesquisador_qr_tokens')
    .select('usuario_id, ativo, criado_em, atualizado_em')
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw error
  }
  return (data ?? []).map((r: any) => ({
    usuarioId: r.usuario_id,
    ativo: r.ativo,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  }))
}

// ============================================================
// Autoatendimento (celular) — status pelo token + registrar
// ============================================================

/** O que a página /ponto/:token mostra ANTES de confirmar (nome + último registro). Só pelo token — sem login. */
export async function obterStatusPorToken(token: string): Promise<StatusPontoToken> {
  if (USE_MOCK || !supabase) {
    const par = [...mockTokens.entries()].find(([, t]) => t.token === token.trim())
    if (!par || !par[1].ativo) throw new Error('QR Code inválido ou revogado.')
    const [usuarioId] = par
    const usuarios = await listarUsuarios()
    const usuario = usuarios.find((u) => u.id === usuarioId)
    if (!usuario) throw new Error('Pesquisador não encontrado.')
    if (usuario.status !== 'ativo') throw new Error('Pesquisador inativo — ponto não registrado.')
    const ultimo = [...mockRegistros]
      .filter((r) => r.usuarioId === usuarioId && r.tipo !== 'falta')
      .sort((a, b) => b.registradoEm.localeCompare(a.registradoEm))[0]
    return {
      nome: usuario.nome,
      proximoTipo: ultimo?.tipo === 'entrada' ? 'saida' : 'entrada',
      ultimoTipo: ultimo?.tipo,
      ultimoRegistradoEm: ultimo?.registradoEm,
    }
  }
  const { data, error } = await supabase.rpc('ponto_status_token', { p_token: token.trim() })
  if (error) throw error
  return {
    nome: data.nome,
    proximoTipo: data.proximoTipo,
    ultimoTipo: data.ultimoTipo ?? undefined,
    ultimoRegistradoEm: data.ultimoRegistradoEm ?? undefined,
  }
}

/** Registra o ponto a partir do token lido no QR Code. Entrada/saída e horário ficam por conta do banco. */
export async function registrarPontoPorToken(
  token: string,
  terminalId = 'AUTOATENDIMENTO',
): Promise<ResultadoPonto> {
  if (USE_MOCK || !supabase) {
    const par = [...mockTokens.entries()].find(([, t]) => t.token === token.trim())
    if (!par || !par[1].ativo) throw new Error('QR Code inválido ou revogado.')
    const [usuarioId] = par
    const usuarios = await listarUsuarios()
    const usuario = usuarios.find((u) => u.id === usuarioId)
    if (!usuario) throw new Error('Pesquisador não encontrado.')
    if (usuario.status !== 'ativo') throw new Error('Pesquisador inativo — ponto não registrado.')

    const ultimo = [...mockRegistros]
      .filter((r) => r.usuarioId === usuarioId && r.tipo !== 'falta')
      .sort((a, b) => b.registradoEm.localeCompare(a.registradoEm))[0]
    if (ultimo && Date.now() - new Date(ultimo.registradoEm).getTime() < 60_000) {
      throw new Error('Registro muito recente — aguarde um instante e tente novamente.')
    }
    const tipo: TipoPonto = ultimo?.tipo === 'entrada' ? 'saida' : 'entrada'
    const registradoEm = new Date().toISOString()
    const registro: RegistroPonto = {
      id: novoIdMock(),
      usuarioId,
      usuarioNome: usuario.nome,
      usuarioFotoUrl: usuario.fotoUrl,
      tipo,
      registradoEm,
      terminalId,
      origem: 'qrcode',
      editado: false,
    }
    mockRegistros.unshift(registro)
    salvarRegistros()
    notificarMock(registro)
    return { usuarioId, nome: usuario.nome, tipo, registradoEm }
  }

  const { data, error } = await supabase.rpc('ponto_registrar', {
    p_token: token.trim(),
    p_terminal_id: terminalId,
  })
  if (error) throw error
  return {
    usuarioId: data.usuarioId,
    nome: data.nome,
    tipo: data.tipo,
    registradoEm: data.registradoEm,
  }
}

// ============================================================
// Admin — consultar / corrigir / lançar registros
// ============================================================

export interface FiltroRegistrosPonto {
  usuarioId?: string
  de?: string // ISO
  ate?: string // ISO
}

export async function listarRegistrosPonto(filtro: FiltroRegistrosPonto = {}): Promise<RegistroPonto[]> {
  if (USE_MOCK || !supabase) {
    return mockRegistros
      .filter((r) => !filtro.usuarioId || r.usuarioId === filtro.usuarioId)
      .filter((r) => !filtro.de || r.registradoEm >= filtro.de)
      .filter((r) => !filtro.ate || r.registradoEm <= filtro.ate)
  }
  let query = supabase
    .from('ponto_registros')
    .select(
      '*, usuario:usuario_id (nome, foto_url), criado_por_usuario:criado_por (nome)',
    )
    .order('registrado_em', { ascending: false })
    .limit(2000)
  if (filtro.usuarioId) query = query.eq('usuario_id', filtro.usuarioId)
  if (filtro.de) query = query.gte('registrado_em', filtro.de)
  if (filtro.ate) query = query.lte('registrado_em', filtro.ate)

  const { data, error } = await query
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw error
  }
  return (data ?? []).map(mapRegistro)
}

/** Corrige um registro existente (horário/tipo errado). Exige motivo — fica em auditoria. */
export async function corrigirRegistroPonto(
  id: string,
  dados: { tipo: TipoPonto; registradoEm: string; motivo: string },
): Promise<void> {
  if (USE_MOCK || !supabase) {
    const r = mockRegistros.find((x) => x.id === id)
    if (!r) throw new Error('Registro não encontrado.')
    r.tipo = dados.tipo
    r.registradoEm = dados.registradoEm
    r.editado = true
    r.motivoEdicao = dados.motivo
    salvarRegistros()
    return
  }
  const { error } = await supabase.rpc('ponto_corrigir', {
    p_id: id,
    p_tipo: dados.tipo,
    p_registrado_em: dados.registradoEm,
    p_motivo: dados.motivo,
  })
  if (error) throw error
}

/** Lança um registro retroativo (pesquisador esqueceu de bater o ponto). Exige motivo. */
export async function lancarPontoManual(dados: {
  usuarioId: string
  tipo: TipoPonto
  registradoEm: string
  motivo: string
}): Promise<void> {
  if (USE_MOCK || !supabase) {
    const usuarios = await listarUsuarios()
    const usuario = usuarios.find((u) => u.id === dados.usuarioId)
    const registro: RegistroPonto = {
      id: novoIdMock(),
      usuarioId: dados.usuarioId,
      usuarioNome: usuario?.nome,
      usuarioFotoUrl: usuario?.fotoUrl,
      tipo: dados.tipo,
      registradoEm: dados.registradoEm,
      terminalId: 'ADMIN-MANUAL',
      origem: 'manual' as OrigemPonto,
      editado: true,
      motivoEdicao: dados.motivo,
    }
    mockRegistros.unshift(registro)
    salvarRegistros()
    notificarMock(registro)
    return
  }
  const { error } = await supabase.rpc('ponto_lancar_manual', {
    p_usuario_id: dados.usuarioId,
    p_tipo: dados.tipo,
    p_registrado_em: dados.registradoEm,
    p_motivo: dados.motivo,
  })
  if (error) throw error
}

// ============================================================
// Presença — quem está "dentro" agora (base da disponibilidade)
// ============================================================

/**
 * Ids dos pesquisadores com ENTRADA aberta HOJE (último registro do dia é
 * entrada, sem saída depois). É o que torna alguém "disponível": bater o
 * ponto de entrada. Devolve `null` quando não dá para saber (migração
 * `docs/supabase-ponto-falta-presenca.sql` pendente) — aí o chamador cai no
 * cálculo antigo, pelo horário.
 */
export async function listarPresentesAgora(): Promise<Set<string> | null> {
  if (USE_MOCK || !supabase) {
    const hoje = new Date().toDateString()
    const ultimoPorUsuario = new Map<string, RegistroPonto>()
    for (const r of [...mockRegistros].sort((a, b) => a.registradoEm.localeCompare(b.registradoEm))) {
      if (r.tipo === 'falta' || new Date(r.registradoEm).toDateString() !== hoje) continue
      ultimoPorUsuario.set(r.usuarioId, r)
    }
    return new Set([...ultimoPorUsuario.values()].filter((r) => r.tipo === 'entrada').map((r) => r.usuarioId))
  }
  const { data, error } = await supabase.rpc('ponto_presentes')
  if (error) {
    if (ehTabelaAusente(error)) return null
    throw error
  }
  return new Set((data ?? []).map((r: any) => (typeof r === 'string' ? r : r.ponto_presentes ?? r.usuario_id)))
}
