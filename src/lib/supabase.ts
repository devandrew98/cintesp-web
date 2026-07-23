import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Normaliza a URL do projeto: aceita tanto a URL base
 * (https://xxxx.supabase.co) quanto a que o painel mostra com "/rest/v1/"
 * no fim, removendo esse sufixo e a barra final.
 */
function normalizarUrl(u?: string): string | undefined {
  if (!u) return undefined
  return u.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

const url = normalizarUrl(import.meta.env.VITE_SUPABASE_URL)
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Há chaves do Supabase configuradas? (habilita login e queries reais.) */
export const hasSupabase = Boolean(url && anonKey)

/**
 * Controla a FONTE DE DADOS das telas:
 *  - true  → dados de exemplo (mock)
 *  - false → banco real (Supabase)
 * A autenticação, quando há chaves, é sempre real (independe disto).
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !hasSupabase

/**
 * Cliente Supabase. Existe sempre que há chaves (usado pela autenticação e,
 * quando USE_MOCK=false, pelas queries). Fica nulo em modo mock puro (sem
 * chaves), para o app rodar de exemplo sem quebrar.
 */
export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url as string, anonKey as string)
  : null
