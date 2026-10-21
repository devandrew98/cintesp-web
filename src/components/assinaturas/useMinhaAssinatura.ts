import { useQuery } from '@tanstack/react-query'
import { carregarMinhaAssinatura } from '@/data/assinaturas'
import { chaveMinhaAssinatura } from './MinhaAssinaturaModal'

/** Assinatura salva do usuário logado (null = ainda não criou). */
export function useMinhaAssinatura(usuarioId?: string) {
  return useQuery({
    queryKey: chaveMinhaAssinatura(usuarioId),
    queryFn: () => carregarMinhaAssinatura(usuarioId!),
    enabled: Boolean(usuarioId),
    staleTime: 60_000,
  })
}
