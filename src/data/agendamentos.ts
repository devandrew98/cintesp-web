import { supabase, USE_MOCK } from '@/lib/supabase'
import {
  AVALIACOES,
  CONFIG_PADRAO,
  calcularOcupados,
  chaveSlot,
  cpfNormalizado,
  validarSelecoes,
  type ConfigAgendamento,
  type DadosPessoais,
  type Selecao,
  type Triagem,
} from '@/lib/agendamento'

/**
 * Camada de dados do AGENDAMENTO (docs/supabase-agendamentos.sql).
 *
 * Parte PÚBLICA (sem login): config, blocos ocupados e envio da solicitação — só por funções
 * (RPC) que validam tudo no servidor. Parte do AVALIADOR: leitura/escrita direta nas tabelas,
 * liberada por RLS apenas a quem tem a tag "Pesquisador Avaliador".
 * Em modo mock tudo fica em memória (some ao recarregar a página).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type StatusAgendamento = 'pendente' | 'confirmado' | 'cancelado'
export type TipoAnotacao = 'anotacao' | 'prontuario' | 'relatorio'
export type TipoEvento = 'compromisso' | 'bloqueio'

export interface ItemAgendamento {
  id: string
  solicitacaoId: string
  avaliacaoId: string
  avaliacaoNome: string
  fase: 1 | 2
  data: string
  hora: string
  status: StatusAgendamento
}

export interface Solicitacao extends Omit<DadosPessoais, 'perfil'> {
  id: string
  protocolo: string
  perfil: 'Atleta' | 'Não atleta'
  triagem: Triagem
  status: StatusAgendamento
  itens: ItemAgendamento[]
  criadoEm: string
}

export interface EventoAgenda {
  id: string
  tipo: TipoEvento
  titulo: string
  data: string
  horaInicio?: string
  horaFim?: string
  diaInteiro: boolean
  notas?: string
}

export interface DadosEvento {
  tipo: TipoEvento
  titulo: string
  data: string
  horaInicio?: string
  horaFim?: string
  diaInteiro: boolean
  notas?: string
}

export interface Anotacao {
  id: string
  solicitacaoId: string
  tipo: TipoAnotacao
  texto: string
  autorNome?: string
  criadoEm: string
}

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(msg)
}

/** Mensagens do servidor já vêm em português (RAISE EXCEPTION); só tratamos os casos técnicos. */
function erroAmigavel(error: any): Error {
  const msg = String(error?.message ?? error)
  if (ehTabelaAusente(error)) return new Error('O agendamento ainda não foi ativado no banco (falta rodar docs/supabase-agendamentos.sql).')
  if (/row-level security|violates row-level|Sem permissão/i.test(msg)) return new Error('Você não tem permissão para esta operação.')
  if (/agendamento_itens_slot_unico|duplicate key/i.test(msg)) return new Error('Esse horário acabou de ser ocupado. Escolha outro.')
  return error instanceof Error ? error : new Error(msg)
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : undefined)

// ---------------------------------------------------------------------------
// Mock (memória)
// ---------------------------------------------------------------------------
let mockConfig: ConfigAgendamento = { ...CONFIG_PADRAO }
const mockSolicitacoes: Solicitacao[] = []
const mockEventos: EventoAgenda[] = []
const mockAnotacoes: Anotacao[] = []
const uid = () => crypto.randomUUID()
const protocoloMock = () => 'AG-' + uid().replace(/-/g, '').slice(0, 6).toUpperCase()

// ---------------------------------------------------------------------------
// PÚBLICO
// ---------------------------------------------------------------------------

export async function obterConfigPublica(): Promise<ConfigAgendamento> {
  if (USE_MOCK || !supabase) return { ...mockConfig }
  const { data, error } = await supabase.rpc('agendamento_config_publica')
  if (error) throw erroAmigavel(error)
  const r = (data as any[] | null)?.[0]
  if (!r) return { ...CONFIG_PADRAO }
  return {
    whatsapp: r.whatsapp ?? undefined,
    local: r.local ?? CONFIG_PADRAO.local,
    fase1Inicio: r.fase1_inicio,
    fase1Fim: r.fase1_fim,
    fase2Inicio: r.fase2_inicio,
    fase2Fim: r.fase2_fim,
    triagemLimite: r.triagem_limite ?? undefined,
    ativo: Boolean(r.ativo),
  }
}

/** Blocos já ocupados no período (chave "data|hora"). Nunca diz de quem é. */
export async function listarOcupados(de: string, ate: string): Promise<Set<string>> {
  if (USE_MOCK || !supabase) {
    const itens = mockSolicitacoes.flatMap((s) => s.itens)
    return calcularOcupados(itens, mockEventos)
  }
  const { data, error } = await supabase.rpc('agendamento_ocupados', { p_de: de, p_ate: ate })
  if (error) throw erroAmigavel(error)
  return new Set(((data as any[]) ?? []).map((r) => chaveSlot(r.data, String(r.hora).slice(0, 5))))
}

/** Envia o formulário. O servidor valida tudo de novo (horários livres, regras das fases, CPF…). */
export async function solicitarAgendamento(
  pessoa: DadosPessoais,
  triagem: Triagem,
  selecoes: Selecao[],
): Promise<{ id: string; protocolo: string }> {
  if (USE_MOCK || !supabase) {
    const ocupados = calcularOcupados(mockSolicitacoes.flatMap((s) => s.itens), mockEventos)
    const erro = validarSelecoes(selecoes, mockConfig, ocupados)
    if (erro) throw new Error(erro)
    if (!mockConfig.ativo) throw new Error('Os agendamentos estão fechados no momento.')
    const cpf = cpfNormalizado(pessoa.cpf)
    if (mockSolicitacoes.some((s) => s.cpf === cpf && s.status !== 'cancelado'))
      throw new Error('Já existe uma solicitação ativa para este CPF. Fale com o pesquisador para alterá-la.')
    const id = uid()
    const protocolo = protocoloMock()
    mockSolicitacoes.unshift({
      id,
      protocolo,
      nome: pessoa.nome.trim(),
      cpf,
      endereco: pessoa.endereco.trim(),
      telefone: pessoa.telefone.trim(),
      email: pessoa.email.trim(),
      perfil: pessoa.perfil as 'Atleta' | 'Não atleta',
      deficiencia: pessoa.deficiencia.trim(),
      triagem,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      itens: AVALIACOES.map((a) => {
        const s = selecoes.find((x) => x.avaliacaoId === a.id)!
        return { id: uid(), solicitacaoId: id, avaliacaoId: a.id, avaliacaoNome: a.nome, fase: a.fase, data: s.data, hora: s.hora, status: 'pendente' as const }
      }),
    })
    return { id, protocolo }
  }
  const { data, error } = await supabase.rpc('agendamento_solicitar', {
    p_pessoa: {
      nome: pessoa.nome,
      cpf: cpfNormalizado(pessoa.cpf),
      endereco: pessoa.endereco,
      telefone: pessoa.telefone,
      email: pessoa.email,
      perfil: pessoa.perfil,
      deficiencia: pessoa.deficiencia,
    },
    p_triagem: triagem,
    p_itens: selecoes.map((s) => ({ avaliacao_id: s.avaliacaoId, data: s.data, hora: s.hora })),
  })
  if (error) throw erroAmigavel(error)
  return data as { id: string; protocolo: string }
}

// ---------------------------------------------------------------------------
// AVALIADOR
// ---------------------------------------------------------------------------

function mapItem(r: any): ItemAgendamento {
  return {
    id: r.id,
    solicitacaoId: r.solicitacao_id,
    avaliacaoId: r.avaliacao_id,
    avaliacaoNome: r.avaliacao_nome,
    fase: r.fase,
    data: r.data,
    hora: String(r.hora_inicio).slice(0, 5),
    status: r.status,
  }
}

function mapSolicitacao(r: any): Solicitacao {
  return {
    id: r.id,
    protocolo: r.protocolo,
    nome: r.nome,
    cpf: r.cpf,
    endereco: r.endereco,
    telefone: r.telefone,
    email: r.email,
    perfil: r.perfil,
    deficiencia: r.deficiencia,
    triagem: r.triagem,
    status: r.status,
    criadoEm: r.criado_em,
    itens: ((r.itens ?? []) as any[]).map(mapItem).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)),
  }
}

export async function listarSolicitacoes(): Promise<Solicitacao[]> {
  if (USE_MOCK || !supabase) return structuredClone(mockSolicitacoes)
  const { data, error } = await supabase
    .from('agendamento_solicitacoes')
    .select('*, itens:agendamento_itens(*)')
    .order('criado_em', { ascending: false })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapSolicitacao)
}

export async function definirStatusSolicitacao(id: string, status: 'confirmado' | 'cancelado'): Promise<void> {
  if (USE_MOCK || !supabase) {
    const s = mockSolicitacoes.find((x) => x.id === id)
    if (!s) return
    s.status = status
    for (const i of s.itens) if (status === 'cancelado' || i.status !== 'cancelado') i.status = status
    return
  }
  const { error } = await supabase.rpc('agendamento_definir_status', { p_id: id, p_status: status })
  if (error) throw erroAmigavel(error)
}

/** Desmarca uma avaliação (libera o horário). Se era a última, a solicitação inteira é cancelada. */
export async function cancelarItem(itemId: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    for (const s of mockSolicitacoes) {
      const i = s.itens.find((x) => x.id === itemId)
      if (!i) continue
      i.status = 'cancelado'
      if (s.itens.every((x) => x.status === 'cancelado')) s.status = 'cancelado'
    }
    return
  }
  const { error } = await supabase.rpc('agendamento_cancelar_item', { p_id: itemId })
  if (error) throw erroAmigavel(error)
}

// ----- compromissos e bloqueios -----
function mapEvento(r: any): EventoAgenda {
  return {
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    data: r.data,
    horaInicio: hhmm(r.hora_inicio),
    horaFim: hhmm(r.hora_fim),
    diaInteiro: Boolean(r.dia_inteiro),
    notas: r.notas ?? undefined,
  }
}

export async function listarEventos(): Promise<EventoAgenda[]> {
  if (USE_MOCK || !supabase) return structuredClone(mockEventos)
  const { data, error } = await supabase.from('agendamento_eventos').select('*').order('data').order('hora_inicio')
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapEvento)
}

function validarEvento(d: DadosEvento) {
  if (!d.titulo.trim()) throw new Error('Informe um título.')
  if (!d.data) throw new Error('Informe a data.')
  if (!d.diaInteiro) {
    if (!d.horaInicio || !d.horaFim) throw new Error('Informe o horário de início e de fim.')
    if (d.horaFim <= d.horaInicio) throw new Error('O horário de fim precisa ser depois do início.')
  }
}

export async function criarEvento(d: DadosEvento): Promise<void> {
  validarEvento(d)
  if (USE_MOCK || !supabase) {
    mockEventos.push({ id: uid(), ...d, titulo: d.titulo.trim() })
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('agendamento_eventos').insert({
    tipo: d.tipo,
    titulo: d.titulo.trim(),
    data: d.data,
    hora_inicio: d.diaInteiro ? null : d.horaInicio,
    hora_fim: d.diaInteiro ? null : d.horaFim,
    dia_inteiro: d.diaInteiro,
    notas: d.notas?.trim() || null,
    criado_por: auth.user?.id ?? null,
  })
  if (error) throw erroAmigavel(error)
}

export async function removerEvento(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockEventos.findIndex((e) => e.id === id)
    if (i >= 0) mockEventos.splice(i, 1)
    return
  }
  const { error } = await supabase.from('agendamento_eventos').delete().eq('id', id)
  if (error) throw erroAmigavel(error)
}

// ----- anotações / prontuário / relatório -----
function mapAnotacao(r: any): Anotacao {
  return { id: r.id, solicitacaoId: r.solicitacao_id, tipo: r.tipo, texto: r.texto, autorNome: r.autor_nome ?? undefined, criadoEm: r.criado_em }
}

export async function listarAnotacoes(solicitacaoId: string): Promise<Anotacao[]> {
  if (USE_MOCK || !supabase) return mockAnotacoes.filter((a) => a.solicitacaoId === solicitacaoId).map((a) => ({ ...a }))
  const { data, error } = await supabase
    .from('agendamento_anotacoes')
    .select('*')
    .eq('solicitacao_id', solicitacaoId)
    .order('criado_em', { ascending: false })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapAnotacao)
}

export async function criarAnotacao(solicitacaoId: string, tipo: TipoAnotacao, texto: string, autorNome?: string): Promise<void> {
  if (!texto.trim()) throw new Error('Escreva algo antes de salvar.')
  if (USE_MOCK || !supabase) {
    mockAnotacoes.unshift({ id: uid(), solicitacaoId, tipo, texto: texto.trim(), autorNome, criadoEm: new Date().toISOString() })
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('agendamento_anotacoes').insert({
    solicitacao_id: solicitacaoId,
    tipo,
    texto: texto.trim(),
    autor_id: auth.user?.id ?? null,
    autor_nome: autorNome ?? null,
  })
  if (error) throw erroAmigavel(error)
}

export async function removerAnotacao(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockAnotacoes.findIndex((a) => a.id === id)
    if (i >= 0) mockAnotacoes.splice(i, 1)
    return
  }
  const { error } = await supabase.from('agendamento_anotacoes').delete().eq('id', id)
  if (error) throw erroAmigavel(error)
}

// ----- configuração (local, WhatsApp, períodos) -----
export async function salvarConfig(c: ConfigAgendamento): Promise<void> {
  if (c.fase1Fim < c.fase1Inicio || c.fase2Fim < c.fase2Inicio) throw new Error('A data final de cada fase não pode ser antes da inicial.')
  if (c.fase2Inicio <= c.fase1Fim) throw new Error('A Fase 2 precisa começar depois do fim da Fase 1.')
  if (!c.local.trim()) throw new Error('Informe o local.')
  if (USE_MOCK || !supabase) {
    mockConfig = { ...c, local: c.local.trim() }
    return
  }
  const { error } = await supabase.from('agendamento_config').upsert({
    id: 1,
    whatsapp: c.whatsapp?.trim() || null,
    local: c.local.trim(),
    fase1_inicio: c.fase1Inicio,
    fase1_fim: c.fase1Fim,
    fase2_inicio: c.fase2Inicio,
    fase2_fim: c.fase2Fim,
    triagem_limite: c.triagemLimite || null,
    ativo: c.ativo,
  })
  if (error) throw erroAmigavel(error)
}
