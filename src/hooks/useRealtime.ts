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

    const invalidar = (chave: string) => () => qc.invalidateQueries({ queryKey: [chave] })

    const canal = client
      .channel('cintesp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disponibilidade' }, invalidar('usuarios'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, invalidar('usuarios'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios' }, invalidar('usuarios'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, invalidar('avisos'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mudancas_turno' }, invalidar('mudancas'))
      .subscribe()

    return () => {
      client.removeChannel(canal)
    }
  }, [qc])
}
