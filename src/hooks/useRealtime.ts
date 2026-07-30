import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Assina as mudanças em tempo real do Supabase e invalida as queries
 * correspondentes — o quadro/avisos atualizam sozinhos quando outra pessoa
 * altera a disponibilidade, publica um aviso, etc.
 *
 * Requer que as tabelas estejam na publicação `supabase_realtime`
 * (Database → Replication). Sem Supabase (mock), não faz nada.
 */
export function useRealtime() {
  const qc = useQueryClient()

  useEffect(() => {
    if (!supabase) return
    const client = supabase // captura já estreitada (não-nula) para o cleanup

    const invalidar =
      (...chaves: string[]) =>
      () =>
        chaves.forEach((chave) => qc.invalidateQueries({ queryKey: [chave] }))

    const canal = client
      .channel('cintesp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disponibilidade' }, invalidar('usuarios'))
      // Mudou algo em usuarios (ex.: a função/papel de alguém) → atualiza a
      // lista E o perfil do logado, para o acesso de admin refletir na hora.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, invalidar('usuarios', 'perfil-atual', 'perfil'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios' }, invalidar('usuarios'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, invalidar('avisos'))
      // Nova leitura de aviso → atualiza os KPIs (lidos hoje / visualizações).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aviso_leituras' }, invalidar('avisos-stats'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mudancas_turno' }, invalidar('mudancas'))
      .subscribe()

    return () => {
      client.removeChannel(canal)
    }
  }, [qc])
}
