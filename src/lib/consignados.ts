import type { Consignado, StatusItem, StatusConsignado } from '@/data/consignados'

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

/** Um protocolo de empréstimo, com um ou mais itens agrupados. */
export interface GrupoConsignado {
  protocolo: string
  /** Uma linha (item) por empréstimo — todas do mesmo protocolo. */
  itens: Consignado[]
  pesquisadorId?: string
  pesquisadorNome?: string
  pesquisadorCpf?: string
  pesquisadorArea?: string
  dataRetirada: string
  dataEntregaPrevista?: string
  dataDevolucao?: string
  local?: string
  status: StatusConsignado
  observacoes?: string
  criadoEm?: string
}

/**
 * Agrupa os empréstimos (1 linha por item no banco) pelo protocolo, para
 * exibir e imprimir juntos os itens de um mesmo formulário. Empréstimos
 * antigos, sem protocolo, viram grupos de 1 item (chave = próprio id).
 */
export function agruparConsignadosPorProtocolo(consignados: Consignado[]): GrupoConsignado[] {
  const porProtocolo = new Map<string, Consignado[]>()
  for (const c of consignados) {
    const chave = c.protocolo || c.id
    const lista = porProtocolo.get(chave)
    if (lista) lista.push(c)
    else porProtocolo.set(chave, [c])
  }

  return Array.from(porProtocolo.entries()).map(([protocolo, itens]) => {
    const base = itens[0]
    return {
      protocolo,
      itens,
      pesquisadorId: base.pesquisadorId,
      pesquisadorNome: base.pesquisadorNome,
      pesquisadorCpf: base.pesquisadorCpf,
      pesquisadorArea: base.pesquisadorArea,
      dataRetirada: base.dataRetirada,
      dataEntregaPrevista: base.dataEntregaPrevista,
      dataDevolucao: base.dataDevolucao,
      local: base.local,
      status: itens.some((i) => i.status === 'em_uso') ? 'em_uso' : 'devolvido',
      observacoes: base.observacoes,
      criadoEm: base.criadoEm,
    }
  })
}
