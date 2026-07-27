// ============================================================
// Modelo de domínio do CINTESP — reflete o schema do Supabase.
// ============================================================

export type StatusDisponibilidade = 'disponivel' | 'em_atendimento' | 'ausente'
export type StatusUsuario = 'ativo' | 'inativo'
export type TipoAviso = 'importante' | 'reuniao' | 'treinamento' | 'geral'
export type StatusAviso = 'ativo' | 'programado' | 'arquivado'
export type DiaSemana =
  | 'segunda'
  | 'terca'
  | 'quarta'
  | 'quinta'
  | 'sexta'
  | 'sabado'
  | 'domingo'

export interface Instituicao {
  id: string
  nome: string
  sigla: string
}

export interface Funcao {
  id: string
  nome: string
  permissoes: string[]
}

export interface AreaAtuacao {
  id: string
  nome: string
  cor: string
}

export interface Usuario {
  id: string
  nome: string
  email: string
  telefone?: string
  fotoUrl?: string
  funcao: Funcao
  instituicao?: Instituicao
  areas: AreaAtuacao[]
  status: StatusUsuario
  // Estado de disponibilidade "ao vivo" (vem de uma tabela/realtime separada)
  disponibilidade: StatusDisponibilidade
  livreAte?: string // "12:00" ou undefined (dia todo)
}

export interface BlocoHorario {
  ativo: boolean
  inicio: string // "09:00"
  fim: string // "12:00"
}

export interface HorarioDia {
  dia: DiaSemana
  manha: BlocoHorario
  tarde: BlocoHorario
  observacao?: string
}

export interface MudancaTurno {
  id: string
  usuarioId: string
  usuarioNome: string
  descricao: string
  quando: string // ex.: "Hoje, 12:00"
  tag: string // ex.: "Manhã → Tarde"
}

export interface Aviso {
  id: string
  titulo: string
  descricao: string
  tipo: TipoAviso
  status: StatusAviso
  destaque: boolean
  data: string // ISO
  hora?: string
  publicoAlvo: string
  autor?: string
  publicadoHa?: string
  visualizacoes?: number
}

export interface EventoHistorico {
  id: string
  data: string
  autor: string
  descricao: string
}

// ============================================================
// Participantes (alunos) — dados vindos de planilha.
// Diferente de "Usuario": participante NÃO tem login no sistema.
// ============================================================

export type StatusParticipante = 'ativo' | 'inativo' | 'concluido' | 'trancado'

export interface Participante {
  id: string
  nome: string
  cpf?: string // somente dígitos
  dataNascimento?: string // ISO (yyyy-mm-dd)
  curso?: string
  turma?: string
  matricula?: string
  instituicaoId?: string
  email?: string
  telefone?: string
  endereco?: string
  cep?: string
  cidade?: string
  estado?: string
  status: StatusParticipante
  observacoes?: string
  /** Colunas da planilha sem campo próprio, preservadas como JSON. */
  dadosExtras?: Record<string, string>
  criadoEm?: string
}

/** Status de uma importação de planilha. */
export type StatusImportacao = 'concluida' | 'parcial' | 'falhou'

/** Registro de auditoria de cada planilha importada. */
export interface Importacao {
  id: string
  arquivo: string
  totalLinhas: number
  criados: number
  atualizados: number
  ignorados: number
  erros: number
  status: StatusImportacao
  autorNome?: string
  criadoEm: string
}
