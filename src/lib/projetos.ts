import type { CampoEditavelProjeto, Projeto, StatusProjeto, TRL } from '@/types'

/**
 * Quem edita um projeto por completo: quem o criou e o responsável indicado
 * (o administrador também, mas isso é checado à parte). Todos os demais só veem.
 */
export const ehDonoProjeto = (p: Pick<Projeto, 'criadoPorId' | 'responsavelId'>, usuarioId?: string): boolean =>
  Boolean(usuarioId) && (p.criadoPorId === usuarioId || p.responsavelId === usuarioId)

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate'

/** Rótulo + cor de cada status de projeto. */
export const statusProjetoInfo: Record<StatusProjeto, { label: string; tone: Tone }> = {
  planejamento: { label: 'Planejamento', tone: 'slate' },
  em_andamento: { label: 'Em andamento', tone: 'amber' },
  pausado: { label: 'Pausado', tone: 'blue' },
  concluido: { label: 'Concluído', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'red' },
}

export const STATUS_PROJETO: StatusProjeto[] = ['planejamento', 'em_andamento', 'pausado', 'concluido', 'cancelado']

/** Escala TRL (1 a 9) com a descrição oficial de cada nível. */
export const TRL_INFO: Array<{ value: TRL; label: string; descricao: string }> = [
  { value: 1, label: 'TRL 1', descricao: 'Princípios básicos observados' },
  { value: 2, label: 'TRL 2', descricao: 'Concepção da tecnologia formulada' },
  { value: 3, label: 'TRL 3', descricao: 'Prova de conceito experimental' },
  { value: 4, label: 'TRL 4', descricao: 'Validação em laboratório' },
  { value: 5, label: 'TRL 5', descricao: 'Validação em ambiente relevante' },
  { value: 6, label: 'TRL 6', descricao: 'Demonstração em ambiente relevante' },
  { value: 7, label: 'TRL 7', descricao: 'Demonstração em ambiente operacional' },
  { value: 8, label: 'TRL 8', descricao: 'Sistema completo e qualificado' },
  { value: 9, label: 'TRL 9', descricao: 'Sistema comprovado em operação real' },
]

export const rotuloTRL = (trl?: TRL): string => (trl ? TRL_INFO.find((t) => t.value === trl)?.label ?? `TRL ${trl}` : '—')

/** Permissões que podem ser liberadas aos colaboradores, agrupadas como aparecem na tela. */
export const GRUPOS_PERMISSOES: { titulo: string; opcoes: { value: CampoEditavelProjeto; label: string }[] }[] = [
  {
    titulo: 'Grupos de tarefas',
    opcoes: [
      { value: 'gruposCriar', label: 'Criar grupos' },
      { value: 'gruposEditar', label: 'Editar grupos' },
      { value: 'gruposExcluir', label: 'Excluir grupos' },
    ],
  },
  {
    titulo: 'Tarefas',
    opcoes: [
      { value: 'tarefasCriar', label: 'Criar tarefas' },
      { value: 'tarefasEditar', label: 'Editar tarefas' },
      { value: 'tarefasAndamento', label: 'Atualizar andamento' },
      { value: 'tarefasExcluir', label: 'Excluir tarefas' },
    ],
  },
  {
    titulo: 'Dados do projeto',
    opcoes: [
      { value: 'descricao', label: 'Descrição do projeto' },
      { value: 'dadosTecnicos', label: 'Dados técnicos' },
      { value: 'observacoes', label: 'Observações' },
      { value: 'trl', label: 'TRL (maturidade tecnológica)' },
      { value: 'cronograma', label: 'Status e datas' },
      { value: 'capa', label: 'Foto de capa' },
      { value: 'links', label: 'Links do Drive e WhatsApp' },
      { value: 'causaEfeito', label: 'Gráfico de causa e efeito' },
    ],
  },
]

export const CAMPOS_EDITAVEIS_PROJETO = GRUPOS_PERMISSOES.flatMap((g) => g.opcoes)

export const rotuloCampoEditavel = (c: CampoEditavelProjeto): string =>
  CAMPOS_EDITAVEIS_PROJETO.find((x) => x.value === c)?.label ?? c

type ProjetoPermissoes = Pick<Projeto, 'criadoPorId' | 'responsavelId' | 'pesquisadores' | 'camposEditaveisMembros'>

/** ADM do projeto (criador/responsável) ou do sistema: pode tudo, e só ele reordena, conclui e confere. */
export const ehGestorProjeto = (p: Pick<Projeto, 'criadoPorId' | 'responsavelId'>, usuarioId?: string, ehAdmin = false): boolean =>
  ehAdmin || ehDonoProjeto(p, usuarioId)

/** O ADM pode tudo; o colaborador vinculado, só o que foi liberado no projeto. */
export const podeNoProjeto = (p: ProjetoPermissoes, permissao: CampoEditavelProjeto, usuarioId?: string, ehAdmin = false): boolean =>
  ehGestorProjeto(p, usuarioId, ehAdmin) ||
  (p.pesquisadores.some((v) => v.usuarioId === usuarioId) && p.camposEditaveisMembros.includes(permissao))

/** Cor da barra de progresso conforme o quanto já avançou. */
export function corProgresso(progresso: number): string {
  if (progresso >= 100) return 'bg-brand-500'
  if (progresso >= 50) return 'bg-sky-500'
  if (progresso >= 20) return 'bg-amber-500'
  return 'bg-slate-400'
}
