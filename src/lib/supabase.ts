import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { envVar } from './env'

/**
 * Tira espaços, aspas e quebras de linha que costumam vir junto quando o
 * valor é colado do painel do Supabase ou do campo do serviço de deploy.
 * Um espaço ou uma quebra de linha sobrando no fim da chave já é suficiente
 * para o Supabase responder "Invalid API key".
 */
function limpar(v?: string): string | undefined {
  if (!v) return undefined
  const limpo = v.trim().replace(/^["']|["']$/g, '').trim()
  return limpo || undefined
}

/**
 * Normaliza a URL do projeto: aceita tanto a URL base
 * (https://xxxx.supabase.co) quanto a que o painel mostra com "/rest/v1/"
 * no fim, removendo esse sufixo e a barra final.
 */
function normalizarUrl(u?: string): string | undefined {
  const limpo = limpar(u)
  if (!limpo) return undefined
  return limpo.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

const url = normalizarUrl(envVar('VITE_SUPABASE_URL'))
const anonKey = limpar(envVar('VITE_SUPABASE_ANON_KEY'))

/** Há chaves do Supabase configuradas? (habilita login e queries reais.) */
export const hasSupabase = Boolean(url && anonKey)

/**
 * Controla a FONTE DE DADOS das telas:
 *  - true  → dados de exemplo (mock)
 *  - false → banco real (Supabase)
 * A autenticação, quando há chaves, é sempre real (independe disto).
 */
export const USE_MOCK = envVar('VITE_USE_MOCK') === 'true' || !hasSupabase

/**
 * A chave TEM CARA de chave do Supabase?
 * Serve para avisar cedo, no console, em vez de deixar o usuário só com um
 * "Invalid API key" na tela de login, que não explica nada.
 * Formatos aceitos: JWT clássico (eyJ...) e o novo (sb_publishable_...).
 */
export function chaveAnonPareceValida(k?: string): boolean {
  if (!k) return false
  return k.startsWith('eyJ') || k.startsWith('sb_publishable_')
}

/** true quando há chave configurada, mas ela está num formato improvável. */
export const chaveSuspeita = hasSupabase && !chaveAnonPareceValida(anonKey)

if (chaveSuspeita) {
  console.error(
    [
      '[CINTESP] VITE_SUPABASE_ANON_KEY nao parece uma chave valida do Supabase.',
      'Ela deve comecar com "eyJ" (chave anon/public classica) ou "sb_publishable_".',
      'Confira em: Supabase > Project Settings > API Keys.',
      'NUNCA use a chave service_role no front.',
    ].join(' '),
  )
}

if (hasSupabase && url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
  console.warn(
    `[CINTESP] VITE_SUPABASE_URL com formato inesperado: "${url}". ` +
      'O normal e https://SEU-PROJETO.supabase.co',
  )
}

/**
 * Cliente Supabase. Existe sempre que há chaves (usado pela autenticação e,
 * quando USE_MOCK=false, pelas queries). Fica nulo em modo mock puro (sem
 * chaves), para o app rodar de exemplo sem quebrar.
 */
export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url as string, anonKey as string)
  : null
