import { supabase, USE_MOCK } from '@/lib/supabase'

/**
 * Camada de dados dos CONSIGNADOS (patrimônio + empréstimos).
 * Tudo é gerido pelo administrador (garantido por RLS no banco).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type StatusItem = 'disponivel' | 'em_uso' | 'manutencao' | 'baixado'
export type StatusConsignado = 'em_uso' | 'devolvido'

export interface ItemPatrimonio {
  id: string
  numeroPatrimonio: string
  nome: string
  categoria?: string
  descricao?: string
  localPadrao?: string
  status: StatusItem
  observacoes?: string
  /** Empréstimo ativo (preenchido por `listarItens`). */
  emprestimo?: {
    consignadoId: string
    pesquisadorNome?: string
    local?: string
    dataEntregaPrevista?: string
  }
}

export interface Consignado {
  id: string
  /** Agrupa vários itens emprestados juntos no mesmo protocolo/formulário. */
  protocolo?: string
  itemId?: string
  itemNumero?: string
  itemNome?: string
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

// ---------- Mock (sem banco) ----------
const mockItens: ItemPatrimonio[] = []
const mockConsignados: Consignado[] = []

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table .* in the schema cache/i.test(msg)
  )
}

// ---------- Mapeadores ----------
function mapItem(r: any): ItemPatrimonio {
  return {
    id: r.id,
    numeroPatrimonio: r.numero_patrimonio,
    nome: r.nome,
    categoria: r.categoria ?? undefined,
    descricao: r.descricao ?? undefined,
    localPadrao: r.local_padrao ?? undefined,
    status: r.status ?? 'disponivel',
    observacoes: r.observacoes ?? undefined,
  }
}

function mapConsignado(r: any): Consignado {
  return {
    id: r.id,
    protocolo: r.protocolo ?? undefined,
    itemId: r.item_id ?? undefined,
    itemNumero: r.item_numero ?? undefined,
    itemNome: r.item_nome ?? undefined,
    pesquisadorId: r.pesquisador_id ?? undefined,
    pesquisadorNome: r.pesquisador_nome ?? undefined,
    pesquisadorCpf: r.pesquisador_cpf ?? undefined,
    pesquisadorArea: r.pesquisador_area ?? undefined,
    dataRetirada: r.data_retirada,
    dataEntregaPrevista: r.data_entrega_prevista ?? undefined,
    dataDevolucao: r.data_devolucao ?? undefined,
    local: r.local ?? undefined,
    status: r.status ?? 'em_uso',
    observacoes: r.observacoes ?? undefined,
    criadoEm: r.created_at ?? undefined,
  }
}

// ============================================================
// Itens de patrimônio (inventário)
// ============================================================

export interface DadosItem {
  numeroPatrimonio: string
  nome: string
  categoria?: string
  descricao?: string
  localPadrao?: string
  status?: StatusItem
  observacoes?: string
}

/** Lista os itens, já com o empréstimo ativo (quem está com ele) embutido. */
export async function listarItens(): Promise<ItemPatrimonio[]> {
  if (USE_MOCK || !supabase) return [...mockItens]
  const { data, error } = await supabase.from('patrimonio_itens').select('*').order('nome')
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw error
  }
  const itens = (data ?? []).map(mapItem)

  // Empréstimos ativos → anexa "quem está com o item".
  const { data: ativos } = await supabase
    .from('consignados')
    .select('id, item_id, pesquisador_nome, local, data_entrega_prevista')
    .eq('status', 'em_uso')
  const porItem = new Map<string, any>()
  for (const c of ativos ?? []) if (c.item_id) porItem.set(c.item_id, c)

  return itens.map((it) => {
    const c = porItem.get(it.id)
    return c
      ? {
          ...it,
          status: 'em_uso' as StatusItem,
          emprestimo: {
            consignadoId: c.id,
            pesquisadorNome: c.pesquisador_nome ?? undefined,
            local: c.local ?? undefined,
            dataEntregaPrevista: c.data_entrega_prevista ?? undefined,
          },
        }
      : it
  })
}

export async function criarItem(d: DadosItem): Promise<void> {
  if (USE_MOCK || !supabase) {
    mockItens.unshift({ id: `it-${Date.now()}`, status: 'disponivel', ...d })
    return
  }
  const { error } = await supabase.from('patrimonio_itens').insert({
    numero_patrimonio: d.numeroPatrimonio.trim(),
    nome: d.nome.trim(),
    categoria: d.categoria || null,
    descricao: d.descricao || null,
    local_padrao: d.localPadrao || null,
    status: d.status || 'disponivel',
    observacoes: d.observacoes || null,
  })
  if (error) throw error
}

export async function atualizarItem(id: string, d: DadosItem): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase
    .from('patrimonio_itens')
    .update({
      numero_patrimonio: d.numeroPatrimonio.trim(),
      nome: d.nome.trim(),
      categoria: d.categoria || null,
      descricao: d.descricao || null,
      local_padrao: d.localPadrao || null,
      status: d.status || 'disponivel',
      observacoes: d.observacoes || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function excluirItem(id: string): Promise<void> {
  if (USE_MOCK || !supabase) return
  const { error } = await supabase.from('patrimonio_itens').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// Consignados (empréstimos)
// ============================================================

export interface ItemConsignadoInput {
  itemId: string
  itemNumero?: string
  itemNome?: string
}

export interface NovoConsignado {
  /** Um ou mais itens emprestados juntos — todos ficam no mesmo protocolo. */
  itens: ItemConsignadoInput[]
  pesquisadorId?: string
  pesquisadorNome?: string
  pesquisadorCpf?: string
  pesquisadorArea?: string
  dataRetirada: string
  dataEntregaPrevista?: string
  local?: string
  observacoes?: string
}

export async function listarConsignados(): Promise<Consignado[]> {
  if (USE_MOCK || !supabase) return [...mockConsignados]
  const { data, error } = await supabase
    .from('consignados')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw error
  }
  return (data ?? []).map(mapConsignado)
}

/**
 * Registra um empréstimo (um ou mais itens juntos) e marca os itens como
 * "em uso". Todos os itens ficam sob o mesmo `protocolo`, para aparecerem
 * juntos no formulário impresso.
 */
export async function criarConsignado(input: NovoConsignado): Promise<void> {
  const protocolo = crypto.randomUUID()

  if (USE_MOCK || !supabase) {
    input.itens.forEach((it, i) => {
      mockConsignados.unshift({
        id: `cs-${Date.now()}-${i}`,
        protocolo,
        status: 'em_uso',
        itemId: it.itemId,
        itemNumero: it.itemNumero,
        itemNome: it.itemNome,
        pesquisadorId: input.pesquisadorId,
        pesquisadorNome: input.pesquisadorNome,
        pesquisadorCpf: input.pesquisadorCpf,
        pesquisadorArea: input.pesquisadorArea,
        dataRetirada: input.dataRetirada,
        dataEntregaPrevista: input.dataEntregaPrevista,
        local: input.local,
        observacoes: input.observacoes,
      })
      const mockIt = mockItens.find((x) => x.id === it.itemId)
      if (mockIt) mockIt.status = 'em_uso'
    })
    return
  }

  const linhas = input.itens.map((it) => ({
    protocolo,
    item_id: it.itemId,
    item_numero: it.itemNumero || null,
    item_nome: it.itemNome || null,
    pesquisador_id: input.pesquisadorId || null,
    pesquisador_nome: input.pesquisadorNome || null,
    pesquisador_cpf: input.pesquisadorCpf || null,
    pesquisador_area: input.pesquisadorArea || null,
    data_retirada: input.dataRetirada,
    data_entrega_prevista: input.dataEntregaPrevista || null,
    local: input.local || null,
    observacoes: input.observacoes || null,
    status: 'em_uso',
  }))
  const { error } = await supabase.from('consignados').insert(linhas)
  if (error) throw error
  // Itens passam a "em uso".
  const itemIds = input.itens.map((it) => it.itemId)
  await supabase.from('patrimonio_itens').update({ status: 'em_uso' }).in('id', itemIds)
}

/** Registra a devolução de um grupo de empréstimos (mesmo protocolo): fecha e libera os itens. */
export async function registrarDevolucao(consignados: Consignado[]): Promise<void> {
  const hoje = new Date().toISOString().slice(0, 10)

  if (USE_MOCK || !supabase) {
    for (const consignado of consignados) {
      const c = mockConsignados.find((x) => x.id === consignado.id)
      if (c) {
        c.status = 'devolvido'
        c.dataDevolucao = hoje
      }
      if (consignado.itemId) {
        const it = mockItens.find((x) => x.id === consignado.itemId)
        if (it) it.status = 'disponivel'
      }
    }
    return
  }

  const ids = consignados.map((c) => c.id)
  const { error } = await supabase
    .from('consignados')
    .update({ status: 'devolvido', data_devolucao: hoje })
    .in('id', ids)
  if (error) throw error

  const itemIds = consignados.map((c) => c.itemId).filter((id): id is string => Boolean(id))
  if (itemIds.length > 0) {
    await supabase.from('patrimonio_itens').update({ status: 'disponivel' }).in('id', itemIds)
  }
}
