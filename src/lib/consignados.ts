import type { StatusItem, StatusConsignado } from '@/data/consignados'

/** Rótulo + tom (Badge) para o status do ITEM. */
export const statusItemInfo: Record<StatusItem, { label: string; tone: string }> = {
  disponivel: { label: 'ITEM DISPONÍVEL', tone: 'green' },
  em_uso: { label: 'ITEM EM USO', tone: 'amber' },
  manutencao: { label: 'EM MANUTENÇÃO', tone: 'blue' },
  baixado: { label: 'BAIXADO', tone: 'slate' },
}

/** Rótulo + tom para o status do EMPRÉSTIMO. */
export const statusConsignadoInfo: Record<StatusConsignado, { label: string; tone: string }> = {
  em_uso: { label: 'Em uso', tone: 'amber' },
  devolvido: { label: 'Devolvido', tone: 'green' },
}

/** Categorias sugeridas de patrimônio. */
export const CATEGORIAS_ITEM = [
  'Notebook',
  'Monitor',
  'Câmera',
  'Computador',
  'Celular / Tablet',
  'Equipamento',
  'Mobiliário',
  'Outro',
]
