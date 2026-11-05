import { cpfValido, normalizarCPF } from '@/lib/cpf'

/**
 * Regras do AGENDAMENTO DE AVALIAÇÕES (formulário público + área do Pesquisador Avaliador).
 * Tudo aqui é puro (sem rede) e a MESMA regra é reforçada no banco
 * (docs/supabase-agendamentos.sql) — o front só adianta a mensagem.
 *
 * Datas são sempre "yyyy-mm-dd" e horas "HH:MM" (início do bloco de 1h), sem fuso:
 * evita o clássico bug de o dia virar o anterior por causa de UTC.
 */

// ---------------------------------------------------------------------------
// Avaliações, fases e horários
// ---------------------------------------------------------------------------

export type FaseAvaliacao = 1 | 2

export interface AvaliacaoDef {
  id: string
  nome: string
  fase: FaseAvaliacao
}

export const AVALIACOES: AvaliacaoDef[] = [
  { id: 'antropometrica', nome: 'Avaliação antropométrica', fase: 1 },
  { id: 'dinamometria', nome: 'Dinamometria isocinética', fase: 1 },
  { id: 'ergoespirometria', nome: 'Ergoespirometria', fase: 2 },
  { id: 'potencia_anaerobia', nome: 'Avaliação da potência anaeróbia', fase: 2 },
  { id: 'capacidade_aerobia', nome: 'Avaliação da capacidade aeróbia', fase: 2 },
]

export const FASES: Record<FaseAvaliacao, { titulo: string; subtitulo: string }> = {
  1: { titulo: 'Fase 1', subtitulo: 'Avaliações antropométricas e neuromusculares' },
  2: { titulo: 'Fase 2', subtitulo: 'Avaliações cardiorrespiratórias e de desempenho' },
}

/** Blocos de 1h: 08:00–12:00 e 13:00–17:00 (valor = início do bloco). */
export const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'] as const

/** Fim do bloco que começa em `hora` ("08:00" → "09:00"). */
export function fimDoBloco(hora: string): string {
  const h = Number(hora.slice(0, 2)) + 1
  return `${String(h).padStart(2, '0')}:${hora.slice(3, 5)}`
}

export const rotuloHorario = (hora: string) => `${hora} - ${fimDoBloco(hora)}`

export interface ConfigAgendamento {
  /** WhatsApp do pesquisador (só dígitos ou com máscara). */
  whatsapp?: string
  local: string
  fase1Inicio: string
  fase1Fim: string
  fase2Inicio: string
  fase2Fim: string
  /** Prazo informativo da triagem. */
  triagemLimite?: string
  /** false = formulário fechado para novas solicitações. */
  ativo: boolean
}

export const CONFIG_PADRAO: ConfigAgendamento = {
  local: 'Arena Sabiazinho',
  fase1Inicio: '2026-11-23',
  fase1Fim: '2026-12-06',
  fase2Inicio: '2026-12-07',
  fase2Fim: '2026-12-20',
  triagemLimite: '2026-11-22',
  ativo: true,
}

// ---------------------------------------------------------------------------
// Datas (strings, sem fuso)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')

export function partesData(iso: string): { a: number; m: number; d: number } {
  const [a, m, d] = iso.split('-').map(Number)
  return { a, m, d }
}

export const montarData = (a: number, m: number, d: number) => `${a}-${pad(m)}-${pad(d)}`

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(iso: string): number {
  const { a, m, d } = partesData(iso)
  return new Date(a, m - 1, d).getDay()
}

export const ehDiaUtil = (iso: string) => {
  const w = diaDaSemana(iso)
  return w >= 1 && w <= 5
}

export function somarDias(iso: string, n: number): string {
  const { a, m, d } = partesData(iso)
  const dt = new Date(a, m - 1, d + n)
  return montarData(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

export function hojeISO(agora = new Date()): string {
  return montarData(agora.getFullYear(), agora.getMonth() + 1, agora.getDate())
}

export function dataBR(iso: string): string {
  const { a, m, d } = partesData(iso)
  return `${pad(d)}/${pad(m)}/${a}`
}

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
export const nomeDiaSemana = (iso: string) => DIAS_SEMANA[diaDaSemana(iso)]

/** "Segunda-feira, 23/11/2026" */
export const dataExtenso = (iso: string) => `${nomeDiaSemana(iso)}, ${dataBR(iso)}`

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function periodoDaFase(fase: FaseAvaliacao, c: ConfigAgendamento): { inicio: string; fim: string } {
  return fase === 1 ? { inicio: c.fase1Inicio, fim: c.fase1Fim } : { inicio: c.fase2Inicio, fim: c.fase2Fim }
}

// ---------------------------------------------------------------------------
// Ocupação (disponibilidade do pesquisador)
// ---------------------------------------------------------------------------

export const chaveSlot = (data: string, hora: string) => `${data}|${hora}`

export interface ItemOcupando {
  data: string
  hora: string
  status: string
}
export interface EventoOcupando {
  data: string
  horaInicio?: string
  horaFim?: string
  diaInteiro: boolean
}

/**
 * Blocos que NÃO podem ser marcados: avaliações já pedidas/confirmadas (não canceladas)
 * e qualquer compromisso/bloqueio da agenda do pesquisador que encoste no bloco.
 */
export function calcularOcupados(itens: ItemOcupando[], eventos: EventoOcupando[]): Set<string> {
  const ocupados = new Set<string>()
  for (const i of itens) if (i.status !== 'cancelado') ocupados.add(chaveSlot(i.data, i.hora.slice(0, 5)))
  for (const e of eventos) {
    for (const h of HORARIOS) {
      const encosta = e.diaInteiro || (!!e.horaInicio && !!e.horaFim && e.horaInicio < fimDoBloco(h) && e.horaFim > h)
      if (encosta) ocupados.add(chaveSlot(e.data, h))
    }
  }
  return ocupados
}

/** Todos os 8 blocos do dia estão ocupados? */
export const diaLotado = (data: string, ocupados: Set<string>) => HORARIOS.every((h) => ocupados.has(chaveSlot(data, h)))

// ---------------------------------------------------------------------------
// Seleções do solicitante
// ---------------------------------------------------------------------------

export interface Selecao {
  avaliacaoId: string
  data: string
  hora: string
}

/**
 * Valida o conjunto das 5 escolhas (mesmas regras do formulário original):
 * todas de uma vez; dias úteis dentro do período de cada fase; blocos de 1h; nada no passado;
 * nenhum bloco ocupado; avaliações da MESMA fase em dias diferentes; nunca dois no mesmo
 * dia e horário; e toda a Fase 1 antes da Fase 2. Devolve a mensagem de erro ou `null`.
 */
export function validarSelecoes(
  selecoes: Selecao[],
  config: ConfigAgendamento,
  ocupados: Set<string>,
  hoje = hojeISO(),
): string | null {
  for (const av of AVALIACOES) {
    const s = selecoes.find((x) => x.avaliacaoId === av.id)
    if (!s || !s.data || !s.hora) return `Escolha data e horário para: ${av.nome}.`
    const { inicio, fim } = periodoDaFase(av.fase, config)
    if (!ehDiaUtil(s.data)) return `${av.nome}: só são aceitos dias úteis (segunda a sexta).`
    if (s.data < inicio || s.data > fim) return `${av.nome}: a data precisa estar entre ${dataBR(inicio)} e ${dataBR(fim)}.`
    if (s.data < hoje) return `${av.nome}: a data já passou.`
    if (!(HORARIOS as readonly string[]).includes(s.hora)) return `${av.nome}: horário inválido.`
    if (ocupados.has(chaveSlot(s.data, s.hora)))
      return `${av.nome}: o horário de ${dataBR(s.data)} às ${s.hora} não está mais disponível. Escolha outro.`
  }

  for (const fase of [1, 2] as const) {
    const dias = AVALIACOES.filter((a) => a.fase === fase).map((a) => selecoes.find((s) => s.avaliacaoId === a.id)!.data)
    if (new Set(dias).size !== dias.length) return `Na ${FASES[fase].titulo}, cada avaliação deve ser em um dia diferente.`
  }

  const combos = AVALIACOES.map((a) => {
    const s = selecoes.find((x) => x.avaliacaoId === a.id)!
    return chaveSlot(s.data, s.hora)
  })
  if (new Set(combos).size !== combos.length) return 'Não é permitido agendar duas avaliações no mesmo dia e horário.'

  const datasDaFase = (f: FaseAvaliacao) =>
    AVALIACOES.filter((a) => a.fase === f).map((a) => selecoes.find((s) => s.avaliacaoId === a.id)!.data)
  if (Math.max(...datasDaFase(1).map((d) => Number(d.replaceAll('-', '')))) >= Math.min(...datasDaFase(2).map((d) => Number(d.replaceAll('-', '')))))
    return 'Todas as avaliações da Fase 1 devem acontecer antes de qualquer avaliação da Fase 2.'

  return null
}

// ---------------------------------------------------------------------------
// Dados pessoais
// ---------------------------------------------------------------------------

export interface DadosPessoais {
  nome: string
  cpf: string
  endereco: string
  telefone: string
  email: string
  perfil: '' | 'Atleta' | 'Não atleta'
  deficiencia: string
}

export const pessoaVazia = (): DadosPessoais => ({
  nome: '',
  cpf: '',
  endereco: '',
  telefone: '',
  email: '',
  perfil: '',
  deficiencia: '',
})

export const soDigitos = (v: string) => v.replace(/\D/g, '')

/** "(34) 99999-9999" a partir dos dígitos (aceita parcial, para máscara ao digitar). */
export function mascararTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function mascararCpf(v: string): string {
  const d = soDigitos(v).slice(0, 11)
  let s = d.slice(0, 3)
  if (d.length > 3) s += '.' + d.slice(3, 6)
  if (d.length > 6) s += '.' + d.slice(6, 9)
  if (d.length > 9) s += '-' + d.slice(9, 11)
  return s
}

/** Erros por campo (vazio = tudo certo). */
export function validarPessoa(p: DadosPessoais): Partial<Record<keyof DadosPessoais, string>> {
  const e: Partial<Record<keyof DadosPessoais, string>> = {}
  if (p.nome.trim().length < 3) e.nome = 'Informe o nome completo.'
  if (!cpfValido(p.cpf)) e.cpf = 'CPF inválido — confira os números.'
  if (p.endereco.trim().length < 5) e.endereco = 'Informe o endereço.'
  if (![10, 11].includes(soDigitos(p.telefone).length)) e.telefone = 'Informe o telefone com DDD.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) e.email = 'E-mail inválido.'
  if (!p.perfil) e.perfil = 'Escolha uma opção.'
  if (p.deficiencia.trim().length < 2) e.deficiencia = 'Informe o tipo de deficiência / patologia.'
  return e
}

export const cpfNormalizado = (cpf: string) => normalizarCPF(cpf)

// ---------------------------------------------------------------------------
// Triagem (anamnese) — respostas Sim/Não com detalhe só quando "Sim"
// ---------------------------------------------------------------------------

export type SimNao = '' | 'Sim' | 'Não'

export interface RespostaTriagem {
  resposta: SimNao
  /** Só vale (e só é pedido) quando a resposta é "Sim". */
  detalhe: string
}

export type ChaveQuestao =
  | 'cardio'
  | 'sintomasEsforco'
  | 'respiratoria'
  | 'lesaoMedular'
  | 'avc'
  | 'medicamentos'
  | 'ortopedica'
  | 'outrasCondicoes'

export interface QuestaoDef {
  chave: ChaveQuestao
  numero: number
  texto: string
  /** Rótulo do campo que aparece ao responder "Sim"; sem ele a questão não pede detalhe. */
  detalhe?: string
}

/** Itens 1, 3, 4, 5, 6, 7 e 9 pedem detalhe ao responder "Sim" (o 2 e o 10 não). */
export const QUESTOES: QuestaoDef[] = [
  { chave: 'cardio', numero: 1, texto: 'Você possui alguma condição cardiovascular (doença coronariana, insuficiência cardíaca, arritmia, pressão alta)?', detalhe: 'Qual(is) condição(ões)?' },
  { chave: 'sintomasEsforco', numero: 2, texto: 'Sente dor no peito, falta de ar ou tontura durante esforços?' },
  { chave: 'respiratoria', numero: 3, texto: 'Possui alguma doença respiratória (asma, DPOC, fibrose cística)?', detalhe: 'Qual(is) doença(s)?' },
  { chave: 'lesaoMedular', numero: 4, texto: 'Tem lesão medular (tetraplegia / paraplegia) ou outra condição neurológica que afete a mobilidade?', detalhe: 'Descreva a condição (nível da lesão, tempo de lesão, etc.).' },
  { chave: 'avc', numero: 5, texto: 'Já teve um AVC (derrame) ou possui alguma sequela motora?', detalhe: 'Descreva (quando foi e qual a sequela).' },
  { chave: 'medicamentos', numero: 6, texto: 'Faz uso de medicamentos de forma contínua?', detalhe: 'Quais medicamentos?' },
  { chave: 'ortopedica', numero: 7, texto: 'Possui alguma restrição ortopédica ou foi submetido(a) a cirurgia recente (nos últimos 6 meses)?', detalhe: 'Descreva a restrição ou a cirurgia (e quando foi).' },
  { chave: 'outrasCondicoes', numero: 9, texto: 'Possui alguma outra condição de saúde não mencionada acima?', detalhe: 'Qual(is) condição(ões)?' },
]

export const LOCOMOCAO_OPCOES = [
  'Deambula sem auxílio',
  'Bengala/Muleta/Andador',
  'Cadeira de rodas manual',
  'Cadeira de rodas motorizada',
  'Outro',
] as const

export interface Triagem {
  cardio: RespostaTriagem
  sintomasEsforco: RespostaTriagem
  respiratoria: RespostaTriagem
  lesaoMedular: RespostaTriagem
  avc: RespostaTriagem
  medicamentos: RespostaTriagem
  ortopedica: RespostaTriagem
  outrasCondicoes: RespostaTriagem
  /** Item 8. */
  locomocao: string
  /** Só vale quando `locomocao` é "Outro". */
  locomocaoOutro: string
  /** Item 10. */
  autorizacao: SimNao
}

const respostaVazia = (): RespostaTriagem => ({ resposta: '', detalhe: '' })

export const triagemVazia = (): Triagem => ({
  cardio: respostaVazia(),
  sintomasEsforco: respostaVazia(),
  respiratoria: respostaVazia(),
  lesaoMedular: respostaVazia(),
  avc: respostaVazia(),
  medicamentos: respostaVazia(),
  ortopedica: respostaVazia(),
  outrasCondicoes: respostaVazia(),
  locomocao: '',
  locomocaoOutro: '',
  autorizacao: '',
})

/** Descarta o que não vale: detalhe de quem respondeu "Não" e o "qual?" de quem não escolheu "Outro". */
export function normalizarTriagem(t: Triagem): Triagem {
  const limpa = { ...t }
  for (const q of QUESTOES) {
    const r = t[q.chave]
    limpa[q.chave] = { resposta: r.resposta, detalhe: r.resposta === 'Sim' && q.detalhe ? r.detalhe.trim() : '' }
  }
  limpa.locomocaoOutro = t.locomocao === 'Outro' ? t.locomocaoOutro.trim() : ''
  return limpa
}

/** Erros por questão ("locomocao", "autorizacao" ou a chave da questão). */
export function validarTriagem(t: Triagem): Record<string, string> {
  const e: Record<string, string> = {}
  for (const q of QUESTOES) {
    const r = t[q.chave]
    if (!r.resposta) e[q.chave] = 'Responda Sim ou Não.'
    else if (r.resposta === 'Sim' && q.detalhe && !r.detalhe.trim()) e[q.chave] = 'Descreva para continuar.'
  }
  if (!t.locomocao) e.locomocao = 'Escolha uma opção.'
  else if (t.locomocao === 'Outro' && !t.locomocaoOutro.trim()) e.locomocao = 'Diga qual é a outra forma de locomoção.'
  if (!t.autorizacao) e.autorizacao = 'Responda Sim ou Não.'
  else if (t.autorizacao === 'Não') e.autorizacao = 'É necessário autorizar a realização dos testes para continuar.'
  return e
}

/** Respostas que merecem atenção do avaliador (não é diagnóstico). */
export function sinaisDeAlerta(t: Triagem): string[] {
  const s: string[] = []
  if (t.cardio?.resposta === 'Sim') s.push('Condição cardiovascular')
  if (t.sintomasEsforco?.resposta === 'Sim') s.push('Dor no peito, falta de ar ou tontura em esforço')
  if (t.respiratoria?.resposta === 'Sim') s.push('Doença respiratória')
  return s
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

/** Número no formato internacional (55 + DDD + número), só dígitos; `null` se não der para usar. */
export function numeroWhatsapp(telefone?: string): string | null {
  const d = soDigitos(telefone ?? '')
  if (d.length >= 12 && d.startsWith('55')) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  return null
}

export function linkWhatsapp(telefone: string | undefined, mensagem: string): string | null {
  const n = numeroWhatsapp(telefone)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}` : null
}

export interface ItemResumo {
  avaliacaoNome: string
  data: string
  hora: string
}

const linhasItens = (itens: ItemResumo[]) =>
  [...itens]
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
    .map((i) => `• ${i.avaliacaoNome}: ${dataBR(i.data)} às ${i.hora}`)
    .join('\n')

/** Do solicitante para o pesquisador, logo depois de preencher o formulário. */
export function mensagemParaPesquisador(p: { nome: string; protocolo?: string; local: string; itens: ItemResumo[] }): string {
  const ordenados = [...p.itens].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
  const primeiro = ordenados[0]
  const abertura = primeiro
    ? `Olá, acabei de preencher o formulário de agendamento. A primeira avaliação ficou para o dia ${dataBR(primeiro.data)} às ${primeiro.hora} na ${p.local}.`
    : `Olá, acabei de preencher o formulário de agendamento na ${p.local}.`
  return [
    abertura,
    '',
    linhasItens(p.itens),
    '',
    `Meu nome é ${p.nome}.${p.protocolo ? ` Protocolo: ${p.protocolo}.` : ''}`,
  ].join('\n')
}

/** Do pesquisador para o solicitante, para confirmar o agendamento. */
export function mensagemConfirmacao(p: { nome: string; local: string; itens: ItemResumo[] }): string {
  const primeiro = p.nome.trim().split(/\s+/)[0] || 'tudo bem'
  return [
    `Olá, ${primeiro}! Passando para confirmar com você o agendamento das suas avaliações na ${p.local}:`,
    '',
    linhasItens(p.itens),
    '',
    'Está tudo certo para você? Se sim, é só responder aqui. Qualquer imprevisto, me avise com antecedência.',
  ].join('\n')
}

export function mensagemCancelamento(p: { nome: string; local: string; itens: ItemResumo[] }): string {
  const primeiro = p.nome.trim().split(/\s+/)[0] || 'tudo bem'
  return [
    `Olá, ${primeiro}! Precisei desmarcar o agendamento abaixo na ${p.local}:`,
    '',
    linhasItens(p.itens),
    '',
    'Podemos combinar um novo horário? Me diga o que fica melhor para você.',
  ].join('\n')
}
