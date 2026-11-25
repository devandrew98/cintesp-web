import { supabase, USE_MOCK } from '@/lib/supabase'
import type { CausaEfeito } from '@/lib/graficos'

/** Gráfico de causa e efeito de cada projeto (docs/supabase-projetos-permissoes.sql). */
/* eslint-disable @typescript-eslint/no-explicit-any */

const VAZIO: CausaEfeito = { efeito: '', causas: {} }
const mock = new Map<string, CausaEfeito>([
  ['proj-1', { efeito: 'Atraso nos testes do protótipo', causas: { metodo: ['Plano de testes incompleto'], maoDeObra: ['Equipe dividida em outros projetos'], material: ['Peças do fornecedor não chegaram', 'Sensor sem reserva'], maquina: ['Impressora 3D em manutenção'] } }],
])

const ehTabelaAusente = (e: any) => e?.code === '42P01' || e?.code === 'PGRST205' || /could not find the table|does not exist/i.test(String(e?.message ?? ''))

export async function obterCausaEfeito(projetoId: string): Promise<CausaEfeito> {
  if (USE_MOCK || !supabase) return mock.get(projetoId) ?? VAZIO
  const { data, error } = await supabase.from('projeto_causa_efeito').select('efeito, causas').eq('projeto_id', projetoId).maybeSingle()
  if (error) {
    if (ehTabelaAusente(error)) return VAZIO
    throw new Error(error.message)
  }
  return data ? { efeito: data.efeito ?? '', causas: data.causas ?? {} } : VAZIO
}

export async function salvarCausaEfeito(projetoId: string, d: CausaEfeito): Promise<void> {
  if (USE_MOCK || !supabase) {
    mock.set(projetoId, d)
    return
  }
  const { error } = await supabase.from('projeto_causa_efeito').upsert({ projeto_id: projetoId, efeito: d.efeito.trim(), causas: d.causas, updated_at: new Date().toISOString() })
  if (!error) return
  if (ehTabelaAusente(error)) throw new Error('Falta rodar docs/supabase-projetos-permissoes.sql no Supabase.')
  if (/row-level security/i.test(error.message)) throw new Error('Você não tem permissão para editar este gráfico.')
  throw new Error(error.message)
}
