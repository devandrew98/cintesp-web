import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase, USE_MOCK } from '@/lib/supabase'
import * as mock from '@/data/mock'
import type { Aviso } from '@/types'

/**
 * Camada de acesso a dados (Fase 4).
 * Cada função decide a fonte:
 *   - USE_MOCK (ou sem cliente) → dados de exemplo (mock);
 *   - senão → banco real (Supabase), mapeando as linhas para os tipos do app.
 * Assim as telas chamam sempre a mesma função, sem saber a origem.
 */

/** "há 2 horas" a partir de uma data ISO (para "publicado há..."). */
function publicadoHa(iso?: string): string | undefined {
  if (!iso) return undefined
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
}

/** "12:00:00" (time do Postgres) → "12:00". */
function hhmm(t?: string | null): string | undefined {
  return t ? t.slice(0, 5) : undefined
}

// ============================================================
// Avisos
// ============================================================

/** Linha da tabela `avisos` (snake_case) → tipo `Aviso` do app. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAviso(row: any): Aviso {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    tipo: row.tipo,
    status: row.status,
    destaque: row.destaque ?? false,
    data: row.data ?? row.created_at,
    hora: hhmm(row.hora),
    publicoAlvo: row.publico_alvo ?? '',
    visualizacoes: row.visualizacoes ?? 0,
    publicadoHa: publicadoHa(row.created_at ?? row.data),
  }
}

export async function listarAvisos(): Promise<Aviso[]> {
  if (USE_MOCK || !supabase) return mock.avisos
  const { data, error } = await supabase
    .from('avisos')
    .select('*')
    .order('data', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapAviso)
}

/** Cria um aviso. Recebe o objeto montado pelo formulário. */
export async function criarAviso(a: Aviso): Promise<Aviso> {
  if (USE_MOCK || !supabase) return a // modo mock: devolve como veio
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('avisos')
    .insert({
      titulo: a.titulo,
      descricao: a.descricao,
      tipo: a.tipo,
      status: a.status,
      destaque: a.destaque,
      hora: a.hora || null,
      publico_alvo: a.publicoAlvo,
      autor_id: userData.user?.id ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapAviso(data)
}
