import { supabase, USE_MOCK } from '@/lib/supabase'
import { listarUsuarios } from '@/data/api'
import type { OrigemPonto, RegistroPonto, ResultadoPonto, StatusQrPesquisador, TipoPonto } from '@/types'

/**
 * Camada de dados do PONTO (QR Code).
 *
 * Toda a lógica sensível (validar token, decidir entrada/saída, carimbar o
 * horário) roda no banco, em funções SECURITY DEFINER (ver
 * docs/supabase-ponto.sql) — este arquivo só chama `supabase.rpc(...)` e
 * mapeia o resultado. O front nunca decide o tipo nem envia horário.
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

// ---------- Mock (sem banco) ----------
interface MockToken {
  token: string
  ativo: boolean
  criadoEm: string
  atualizadoEm: string
}
const mockTokens = new Map<string, MockToken>() // usuarioId -> token
let seqRegistro = 0
const mockRegistros: RegistroPonto[] = []

// ============================================================
// Admin — gerar/revogar/consultar QR Codes
// ============================================================

/** Gera (ou renova) o QR Code de um pesquisador. Devolve o token em texto puro — só aparece agora. */
export async function gerarQrPesquisador(usuarioId: string): Promise<string> {
  if (USE_MOCK || !supabase) {
    const token = `MOCK-${usuarioId}-${Date.now().toString(36)}`
    const agora = new Date().toISOString()
    mockTokens.set(usuarioId, { token, ativo: true, criadoEm: agora, atualizadoEm: agora })
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
    if (atual) atual.ativo = false
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
// Terminal — registrar ponto a partir do QR Code lido
// ============================================================

/** Registra o ponto a partir do token lido no QR Code. Terminal/entrada e saída ficam por conta do banco. */
export async function registrarPontoPorToken(
  token: string,
  terminalId = 'CINTESP-PONTO-001',
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
      .filter((r) => r.usuarioId === usuarioId)
      .sort((a, b) => b.registradoEm.localeCompare(a.registradoEm))[0]
    if (ultimo && Date.now() - new Date(ultimo.registradoEm).getTime() < 60_000) {
      throw new Error('Registro muito recente — aguarde um instante e tente novamente.')
    }
    const tipo: TipoPonto = ultimo?.tipo === 'entrada' ? 'saida' : 'entrada'
    const registradoEm = new Date().toISOString()
    mockRegistros.unshift({
      id: `ponto-mock-${seqRegistro++}`,
      usuarioId,
      usuarioNome: usuario.nome,
      usuarioFotoUrl: usuario.fotoUrl,
      tipo,
      registradoEm,
      terminalId,
      origem: 'qrcode',
      editado: false,
    })
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
    .limit(500)
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
    mockRegistros.unshift({
      id: `ponto-mock-${seqRegistro++}`,
      usuarioId: dados.usuarioId,
      usuarioNome: usuario?.nome,
      usuarioFotoUrl: usuario?.fotoUrl,
      tipo: dados.tipo,
      registradoEm: dados.registradoEm,
      terminalId: 'ADMIN-MANUAL',
      origem: 'manual' as OrigemPonto,
      editado: true,
      motivoEdicao: dados.motivo,
    })
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
