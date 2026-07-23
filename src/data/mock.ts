import type {
  AreaAtuacao,
  Aviso,
  EventoHistorico,
  Funcao,
  HorarioDia,
  Instituicao,
  MudancaTurno,
  Usuario,
} from '@/types'

// ---------- Instituições ----------
export const instituicoes: Instituicao[] = [
  { id: 'i1', nome: 'Universidade Federal de Uberlândia', sigla: 'UFU' },
  { id: 'i2', nome: 'Instituto Federal do Triângulo Mineiro', sigla: 'IFTM' },
  { id: 'i3', nome: 'Universidade de São Paulo', sigla: 'USP' },
]

// ---------- Funções / Permissões ----------
export const funcoes: Funcao[] = [
  { id: 'f1', nome: 'Administrador', permissoes: ['gerenciar_tudo', 'ver_quadro', 'editar_horarios', 'publicar_avisos'] },
  { id: 'f2', nome: 'Coordenador', permissoes: ['ver_quadro', 'editar_horarios', 'publicar_avisos'] },
  { id: 'f3', nome: 'Pesquisador', permissoes: ['ver_quadro', 'editar_meu_horario'] },
]

// ---------- Áreas de atuação ----------
export const areas: AreaAtuacao[] = [
  { id: 'a1', nome: 'Inteligência Artificial', cor: '#6366f1' },
  { id: 'a2', nome: 'Ciência de Dados', cor: '#0ea5e9' },
  { id: 'a3', nome: 'Aprendizado de Máquina', cor: '#10b981' },
  { id: 'a4', nome: 'UX / Design de Sistemas', cor: '#ec4899' },
  { id: 'a5', nome: 'Análise de Sistemas', cor: '#f59e0b' },
  { id: 'a6', nome: 'DevOps', cor: '#8b5cf6' },
  { id: 'a7', nome: 'Pesquisa Clínica', cor: '#14b8a6' },
  { id: 'a8', nome: 'Educação em Saúde', cor: '#ef4444' },
]

const A = (i: number) => areas[i]
const ufu = instituicoes[0]

// ---------- Usuários ----------
export const usuarios: Usuario[] = [
  { id: 'u1', nome: 'João Silva', email: 'joao.silva@cintesp.org.br', telefone: '(34) 98765-4321', funcao: funcoes[2], instituicao: ufu, areas: [A(0), A(1)], status: 'ativo', disponibilidade: 'disponivel', livreAte: '12:00' },
  { id: 'u2', nome: 'Mariana Souza', email: 'mariana.souza@cintesp.org.br', telefone: '(34) 99111-2233', funcao: funcoes[2], instituicao: ufu, areas: [A(3)], status: 'ativo', disponibilidade: 'disponivel' },
  { id: 'u3', nome: 'Carlos Almeida', email: 'carlos.almeida@cintesp.org.br', telefone: '(34) 99222-3344', funcao: funcoes[2], instituicao: ufu, areas: [A(4)], status: 'ativo', disponibilidade: 'disponivel', livreAte: '14:00' },
  { id: 'u4', nome: 'Larissa Martins', email: 'larissa.martins@cintesp.org.br', telefone: '(34) 99333-4455', funcao: funcoes[1], instituicao: ufu, areas: [A(3), A(0)], status: 'ativo', disponibilidade: 'disponivel' },
  { id: 'u5', nome: 'Rafael Costa', email: 'rafael.costa@cintesp.org.br', telefone: '(34) 99444-5566', funcao: funcoes[2], instituicao: ufu, areas: [A(5), A(1)], status: 'ativo', disponibilidade: 'disponivel', livreAte: '13:00' },
  { id: 'u6', nome: 'Ana Rodrigues', email: 'ana.rodrigues@cintesp.org.br', telefone: '(34) 99555-6677', funcao: funcoes[2], instituicao: ufu, areas: [A(7)], status: 'ativo', disponibilidade: 'disponivel', livreAte: '17:00' },
  { id: 'u7', nome: 'Lucas Almeida', email: 'lucas.almeida@cintesp.org.br', telefone: '(34) 99666-7788', funcao: funcoes[2], instituicao: ufu, areas: [A(4)], status: 'ativo', disponibilidade: 'disponivel', livreAte: '12:30' },
  { id: 'u8', nome: 'Maria Souza', email: 'maria.souza@cintesp.org.br', telefone: '(34) 99777-8899', funcao: funcoes[1], instituicao: ufu, areas: [A(3)], status: 'ativo', disponibilidade: 'em_atendimento' },
  { id: 'u9', nome: 'Carlos Lima', email: 'carlos.lima@cintesp.org.br', telefone: '(34) 99888-9900', funcao: funcoes[2], instituicao: ufu, areas: [A(4)], status: 'ativo', disponibilidade: 'em_atendimento' },
  { id: 'u10', nome: 'Fernanda Alves', email: 'fernanda.alves@cintesp.org.br', telefone: '(34) 99000-1122', funcao: funcoes[2], instituicao: ufu, areas: [A(5)], status: 'ativo', disponibilidade: 'em_atendimento' },
  { id: 'u11', nome: 'Bruno Santos', email: 'bruno.santos@cintesp.org.br', telefone: '(34) 98123-4567', funcao: funcoes[2], instituicao: ufu, areas: [A(5), A(6)], status: 'ativo', disponibilidade: 'em_atendimento' },
  { id: 'u12', nome: 'Juliana Pereira', email: 'juliana.pereira@cintesp.org.br', telefone: '(34) 98234-5678', funcao: funcoes[2], instituicao: ufu, areas: [A(1)], status: 'ativo', disponibilidade: 'ausente' },
  { id: 'u13', nome: 'Pedro Martins', email: 'pedro.martins@cintesp.org.br', telefone: '(34) 98345-6789', funcao: funcoes[2], instituicao: ufu, areas: [A(7)], status: 'ativo', disponibilidade: 'ausente' },
  { id: 'u14', nome: 'Isabela Torres', email: 'isabela.torres@cintesp.org.br', telefone: '(34) 98456-7890', funcao: funcoes[2], instituicao: ufu, areas: [A(7)], status: 'inativo', disponibilidade: 'ausente' },
  { id: 'u15', nome: 'Rafael Mendes', email: 'rafael.mendes@cintesp.org.br', telefone: '(34) 98567-8901', funcao: funcoes[2], instituicao: ufu, areas: [A(6)], status: 'ativo', disponibilidade: 'disponivel', livreAte: '16:00' },
  { id: 'u16', nome: 'Camila Ferreira', email: 'camila.ferreira@cintesp.org.br', telefone: '(34) 98678-9012', funcao: funcoes[2], instituicao: ufu, areas: [A(0), A(2)], status: 'ativo', disponibilidade: 'disponivel' },
  { id: 'u17', nome: 'Gustavo Rocha', email: 'gustavo.rocha@cintesp.org.br', telefone: '(34) 98789-0123', funcao: funcoes[2], instituicao: ufu, areas: [A(1)], status: 'ativo', disponibilidade: 'em_atendimento' },
  { id: 'u18', nome: 'Beatriz Nunes', email: 'beatriz.nunes@cintesp.org.br', telefone: '(34) 98890-1234', funcao: funcoes[2], instituicao: ufu, areas: [A(4)], status: 'ativo', disponibilidade: 'disponivel', livreAte: '15:00' },
  { id: 'u19', nome: 'Administrador', email: 'admin@cintesp.org.br', telefone: '(34) 3200-0000', funcao: funcoes[0], instituicao: ufu, areas: [A(0)], status: 'ativo', disponibilidade: 'disponivel' },
]

// ---------- Usuário "logado" (mock) ----------
// Representa quem está usando o app agora (usado em "Meu Horário" e na Topbar).
// Na Fase 4 isto vem da sessão do Supabase Auth.
export const usuarioAtual: Usuario =
  usuarios.find((u) => u.funcao.nome === 'Administrador') ?? usuarios[0]

// ---------- Mudanças de turno ----------
export const mudancas: MudancaTurno[] = [
  { id: 'm1', usuarioId: 'u1', usuarioNome: 'João Silva', descricao: 'João Silva sairá do atendimento', quando: 'Hoje, 12:00', tag: 'Manhã → Tarde' },
  { id: 'm2', usuarioId: 'u8', usuarioNome: 'Maria Souza', descricao: 'Maria Souza inicia atendimento', quando: 'Hoje, 13:00', tag: 'Tarde' },
  { id: 'm3', usuarioId: 'u6', usuarioNome: 'Ana Rodrigues', descricao: 'Ana Rodrigues encerra atendimento', quando: 'Hoje, 17:00', tag: 'Tarde' },
  { id: 'm4', usuarioId: 'u13', usuarioNome: 'Pedro Martins', descricao: 'Pedro Martins ficará indisponível amanhã', quando: 'Amanhã • Todo o dia', tag: 'Ausência' },
]

// ---------- Avisos ----------
const hoje = new Date()
const iso = (offsetDias: number) => {
  const d = new Date(hoje)
  d.setDate(d.getDate() - offsetDias)
  return d.toISOString()
}

export const avisos: Aviso[] = [
  { id: 'av1', titulo: 'Reunião geral da equipe', descricao: 'Reunião mensal da equipe para alinhamento de projetos e metas.', tipo: 'reuniao', status: 'ativo', destaque: false, data: iso(0), hora: '15:00', publicoAlvo: 'Todos os pesquisadores', autor: 'Administrador', publicadoHa: 'há 2h', visualizacoes: 42 },
  { id: 'av2', titulo: 'Atualização no quadro de disponibilidade', descricao: 'Lembre-se de manter seus horários atualizados para melhor organização da equipe.', tipo: 'importante', status: 'ativo', destaque: true, data: iso(1), hora: '09:30', publicoAlvo: 'Todos os pesquisadores', autor: 'Administrador', publicadoHa: 'há 1 dia', visualizacoes: 88 },
  { id: 'av3', titulo: 'Workshop: Inteligência Artificial em TA', descricao: 'Inscrições abertas para o workshop que acontecerá no dia 05/06.', tipo: 'treinamento', status: 'ativo', destaque: false, data: iso(2), hora: '10:00', publicoAlvo: 'Área de IA e Dados', autor: 'Coordenação', publicadoHa: 'há 2 dias', visualizacoes: 31 },
  { id: 'av4', titulo: 'Parabéns aos aniversariantes do mês!', descricao: 'Desejamos um ótimo aniversário aos colegas que fazem aniversário em maio.', tipo: 'geral', status: 'ativo', destaque: false, data: iso(3), hora: '08:00', publicoAlvo: 'Todos os pesquisadores', autor: 'RH', publicadoHa: 'há 3 dias', visualizacoes: 120 },
  { id: 'av5', titulo: 'Feriado - Corpus Christi', descricao: 'Não haverá expediente no dia 30/05 (sexta-feira) devido ao feriado de Corpus Christi.', tipo: 'importante', status: 'ativo', destaque: false, data: iso(4), publicoAlvo: 'Todos os pesquisadores', autor: 'Administrador', publicadoHa: 'há 4 dias', visualizacoes: 95 },
  { id: 'av6', titulo: 'Reunião de Planejamento Estratégico', descricao: 'Participe da reunião para definição das metas do próximo semestre.', tipo: 'reuniao', status: 'programado', destaque: true, data: iso(-7), hora: '14:00', publicoAlvo: 'Sala de Reuniões / Online', autor: 'Coordenação', visualizacoes: 12 },
  { id: 'av7', titulo: 'Treinamento: Novo Sistema de Chamados', descricao: 'Treinamento obrigatório para utilização do novo sistema de chamados.', tipo: 'treinamento', status: 'programado', destaque: true, data: iso(-12), hora: '10:00', publicoAlvo: 'Lab. Informática', autor: 'TI', visualizacoes: 8 },
]

// ---------- Horários (exemplo do usuário selecionado no Admin) ----------
export const horarioPadrao: HorarioDia[] = [
  { dia: 'segunda', manha: { ativo: true, inicio: '09:00', fim: '12:00' }, tarde: { ativo: true, inicio: '13:30', fim: '17:30' }, observacao: 'Atendimento presencial' },
  { dia: 'terca', manha: { ativo: true, inicio: '09:00', fim: '12:00' }, tarde: { ativo: true, inicio: '13:30', fim: '17:30' }, observacao: '-' },
  { dia: 'quarta', manha: { ativo: true, inicio: '09:00', fim: '12:00' }, tarde: { ativo: true, inicio: '13:30', fim: '17:30' }, observacao: 'Reuniões externas à tarde' },
  { dia: 'quinta', manha: { ativo: true, inicio: '09:00', fim: '12:00' }, tarde: { ativo: true, inicio: '13:30', fim: '17:30' }, observacao: '-' },
  { dia: 'sexta', manha: { ativo: true, inicio: '09:00', fim: '12:00' }, tarde: { ativo: false, inicio: '13:30', fim: '17:30' }, observacao: 'Home office (manhã)' },
]

// ---------- Histórico de alterações ----------
export const historico: EventoHistorico[] = [
  { id: 'h1', data: '27/05/2025 10:30', autor: 'Administrador', descricao: 'Administrador atualizou os horários de disponibilidade' },
  { id: 'h2', data: '15/05/2025 14:22', autor: 'João Silva', descricao: 'João Silva atualizou seus horários' },
  { id: 'h3', data: '02/04/2025 09:15', autor: 'Administrador', descricao: 'Administrador alterou a função para Pesquisador' },
]

// ---------- Agregações úteis para o Dashboard ----------
export const resumo = {
  get total() {
    return usuarios.filter((u) => u.status === 'ativo').length
  },
  get disponiveis() {
    return usuarios.filter((u) => u.status === 'ativo' && u.disponibilidade === 'disponivel').length
  },
  get emAtendimento() {
    return usuarios.filter((u) => u.status === 'ativo' && u.disponibilidade === 'em_atendimento').length
  },
  get ausentes() {
    return usuarios.filter((u) => u.status === 'ativo' && u.disponibilidade === 'ausente').length
  },
}
