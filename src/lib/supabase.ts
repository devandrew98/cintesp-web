import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** true quando o app deve usar dados de exemplo em vez do banco real. */
export const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === 'true' || !url || !anonKey

/**
 * Cliente Supabase. Fica nulo enquanto estamos em modo mock (sem chaves),
 * para não quebrar o boot. Assim que você preencher o .env e definir
 * VITE_USE_MOCK=false, este cliente passa a apontar para o banco real.
 */
export const supabase: SupabaseClient | null =
  USE_MOCK ? null : createClient(url, anonKey)
