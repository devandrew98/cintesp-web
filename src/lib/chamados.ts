import type { PrioridadeChamado, SetorChamado, StatusChamado } from '@/types'

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate'

/** Setores para onde um chamado pode ser direcionado. */
export const SETORES: { value: SetorChamado; label: string }[] = [
  { value: 'ti', label: 'TI' },
  { value: 'pesquisa', label: 'Pesquisa' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'outro', label: 'Outro' },
]

export const rotuloSetor = (s: SetorChamado): string =>
  SETORES.find((x) => x.value === s)?.label ?? s

/** Categorias sugeridas por setor (o campo também aceita "Outro"). */
export const CATEGORIAS_POR_SETOR: Record<SetorChamado, string[]> = {
  ti: ['Hardware', 'Software', 'Rede', 'Impressora', 'Acesso / Sistemas', 'Segurança'],
  pesquisa: ['Coleta de dados', 'Equipamento', 'Ética / Documentação', 'Publicação'],
  administrativo: ['Financeiro', 'RH', 'Documentos', 'Compras'],
  infraestrutura: ['Elétrica', 'Mobiliário', 'Limpeza', 'Manutenção'],
  outro: ['Geral'],
}

// ---------- Status ----------
export const statusChamadoInfo: Record<
  StatusChamado,
  { label: string; tone: Tone; dot: string }
> = {
  aberto: { label: 'Aberto', tone: 'green', dot: 'bg-brand-500' },
  em_andamento: { label: 'Em andamento', tone: 'blue', dot: 'bg-sky-500' },
  aguardando_usuario: { label: 'Aguardando usuário', tone: 'amber', dot: 'bg-amber-500' },
  finalizado: { label: 'Finalizado', tone: 'violet', dot: 'bg-violet-500' },
  cancelado: { label: 'Cancelado', tone: 'slate', dot: 'bg-slate-400' },
}

// ---------- Prioridade ----------
export const prioridadeChamadoInfo: Record<
  PrioridadeChamado,
  { label: string; tone: Tone }
> = {
  baixa: { label: 'Baixa', tone: 'slate' },
  media: { label: 'Média', tone: 'blue' },
  alta: { label: 'Alta', tone: 'amber' },
  urgente: { label: 'Urgente', tone: 'red' },
}

export const PRIORIDADES: PrioridadeChamado[] = ['baixa', 'media', 'alta', 'urgente']
