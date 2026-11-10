import { supabase, USE_MOCK } from '@/lib/supabase'
import { hojeISO, somarDias } from '@/lib/agendamento'
import { validarEventoEquipe, type EventoEquipe } from '@/lib/agendaEquipe'

/**
 * Camada de dados da AGENDA DA EQUIPE (docs/supabase-agenda-equipe.sql).
 * Todo usuário logado lê; só o administrador grava (RLS `is_admin()`).
 * Em modo mock os eventos ficam em memória (somem ao recarregar).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type DadosEventoEquipe = Omit<EventoEquipe, 'id'>

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return error?.code === '42P01' || error?.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(msg)
}

function erroAmigavel(error: any): Error {
  const msg = String(error?.message ?? error)
  if (ehTabelaAusente(error)) return new Error('A agenda ainda não foi ativada no banco (falta rodar docs/supabase-agenda-equipe.sql).')
  if (/row-level security|violates row-level/i.test(msg)) return new Error('Só administradores podem alterar a agenda.')
  return error instanceof Error ? error : new Error(msg)
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : undefined)

function mapEvento(r: any): EventoEquipe {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    local: r.local ?? undefined,
    linkVideo: r.link_video ?? undefined,
    data: r.data,
    dataFim: r.data_fim ?? undefined,
    diaInteiro: r.dia_inteiro ?? true,
    horaInicio: hhmm(r.hora_inicio),
    horaFim: hhmm(r.hora_fim),
    repeticao: r.repeticao ?? 'nunca',
    repeteAte: r.repete_ate ?? undefined,
    paraTodos: r.para_todos ?? true,
    participantes: r.participantes ?? [],
  }
}

const paraLinha = (d: DadosEventoEquipe) => ({
  titulo: d.titulo.trim(),
  descricao: d.descricao?.trim() || null,
  local: d.local?.trim() || null,
  link_video: d.linkVideo?.trim() || null,
  data: d.data,
  data_fim: d.dataFim && d.dataFim !== d.data ? d.dataFim : null,
  dia_inteiro: d.diaInteiro,
  hora_inicio: d.diaInteiro ? null : d.horaInicio,
  hora_fim: d.diaInteiro ? null : d.horaFim,
  repeticao: d.repeticao,
  repete_ate: d.repeticao === 'nunca' ? null : d.repeteAte || null,
  para_todos: d.paraTodos,
  participantes: d.paraTodos ? [] : d.participantes,
})

/** Banco ainda sem as colunas de participantes (migração pendente): grava sem elas. */
const semParticipantes = ({ para_todos: _a, participantes: _b, ...resto }: ReturnType<typeof paraLinha>) => resto
const colunaAusente = (e: any) => /para_todos|participantes|PGRST204|42703|schema cache/i.test(String(e?.message ?? '') + String(e?.code ?? ''))

// ----- Mock -----
const uid = () => crypto.randomUUID()
const hoje = hojeISO()
const mockEventos: EventoEquipe[] = [
  { id: uid(), titulo: 'Reunião geral da equipe', descricao: 'Alinhamento mensal dos projetos.', local: 'Sala de reuniões', linkVideo: 'https://meet.google.com/abc-defg-hij', data: somarDias(hoje, 1), diaInteiro: false, horaInicio: '14:00', horaFim: '15:30', repeticao: 'semanal', paraTodos: true, participantes: [] },
  { id: uid(), titulo: 'Workshop: Inteligência Artificial em TA', local: 'Arena Sabiazinho', data: somarDias(hoje, 3), dataFim: somarDias(hoje, 4), diaInteiro: true, repeticao: 'nunca', paraTodos: true, participantes: [] },
  { id: uid(), titulo: 'Manutenção dos equipamentos', data: hoje, diaInteiro: false, horaInicio: '16:00', horaFim: '17:00', repeticao: 'nunca', paraTodos: true, participantes: [] },
  { id: uid(), titulo: 'Aniversário do CINTESP', data: somarDias(hoje, 20), diaInteiro: true, repeticao: 'anual', paraTodos: true, participantes: [] },
]

// ----- API -----
export async function listarEventosEquipe(): Promise<EventoEquipe[]> {
  if (USE_MOCK || !supabase) return structuredClone(mockEventos)
  const { data, error } = await supabase.from('agenda_eventos').select('*').order('data').order('hora_inicio')
  if (error) {
    if (ehTabelaAusente(error)) return [] // migração pendente: agenda vazia em vez de quebrar a tela
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapEvento)
}

function conferir(d: DadosEventoEquipe) {
  const erro = validarEventoEquipe(d)
  if (erro) throw new Error(erro)
}

export async function criarEventoEquipe(d: DadosEventoEquipe): Promise<void> {
  conferir(d)
  if (USE_MOCK || !supabase) {
    mockEventos.push({ id: uid(), ...d, titulo: d.titulo.trim() })
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const linha = { ...paraLinha(d), criado_por: auth.user?.id ?? null }
  let { error } = await supabase.from('agenda_eventos').insert(linha)
  if (error && colunaAusente(error)) ({ error } = await supabase.from('agenda_eventos').insert({ ...semParticipantes(paraLinha(d)), criado_por: linha.criado_por }))
  if (error) throw erroAmigavel(error)
}

export async function atualizarEventoEquipe(id: string, d: DadosEventoEquipe): Promise<void> {
  conferir(d)
  if (USE_MOCK || !supabase) {
    const i = mockEventos.findIndex((e) => e.id === id)
    if (i >= 0) mockEventos[i] = { id, ...d, titulo: d.titulo.trim() }
    return
  }
  let { error } = await supabase.from('agenda_eventos').update(paraLinha(d)).eq('id', id)
  if (error && colunaAusente(error)) ({ error } = await supabase.from('agenda_eventos').update(semParticipantes(paraLinha(d))).eq('id', id))
  if (error) throw erroAmigavel(error)
}

export async function removerEventoEquipe(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockEventos.findIndex((e) => e.id === id)
    if (i >= 0) mockEventos.splice(i, 1)
    return
  }
  const { error } = await supabase.from('agenda_eventos').delete().eq('id', id)
  if (error) throw erroAmigavel(error)
}
