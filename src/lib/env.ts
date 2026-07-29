/**
 * Leitura de variáveis de ambiente com suporte a DOIS momentos:
 *
 *  1. RUNTIME (produção / Docker): o container gera um `/config.js` a partir
 *     do `.env` do servidor, que define `window.__ENV__`. Assim a MESMA imagem
 *     serve qualquer ambiente — o deploy só troca o `.env`, sem rebuild.
 *  2. BUILD (desenvolvimento): quando `window.__ENV__` não traz o valor,
 *     usamos o que o Vite "assou" de `import.meta.env` (vindo do `.env` local).
 *
 * Valores vazios ou placeholders não substituídos ("${...}") são ignorados.
 */

type ChaveEnv =
  | 'VITE_SUPABASE_URL'
  | 'VITE_SUPABASE_ANON_KEY'
  | 'VITE_USE_MOCK'
  /** Endereço de incorporação da agenda do Google (Agenda do Dia). */
  | 'VITE_GOOGLE_CALENDAR_URL'

declare global {
  interface Window {
    __ENV__?: Partial<Record<ChaveEnv, string>>
  }
}

// Injetado em runtime pelo container (public/config.js → sobrescrito no start).
const runtime: Partial<Record<ChaveEnv, string>> =
  (typeof window !== 'undefined' && window.__ENV__) || {}

// "Assado" no build pelo Vite (acesso estático, para o replace funcionar).
const build: Record<ChaveEnv, string | undefined> = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_USE_MOCK: import.meta.env.VITE_USE_MOCK,
  VITE_GOOGLE_CALENDAR_URL: import.meta.env.VITE_GOOGLE_CALENDAR_URL,
}

export function envVar(nome: ChaveEnv): string | undefined {
  const r = runtime[nome]
  if (r && !r.startsWith('${')) return r
  return build[nome]
}
