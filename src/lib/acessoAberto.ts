import type { RegistroPonto } from '@/types'

/**
 * Acesso "esquecido aberto": a ÚLTIMA marcação de presença da pessoa é uma entrada de um dia
 * anterior (sem saída depois). Passou da meia-noite e o ponto continua aberto.
 *
 * @param hoje        "yyyy-mm-dd" de hoje (horário local)
 * @param paraDiaLocal converte o instante ISO do registro no "yyyy-mm-dd" local
 */
export function acessoEsquecidoAberto(
  registros: RegistroPonto[],
  hoje: string,
  paraDiaLocal: (iso: string) => string,
): RegistroPonto | null {
  const presencas = registros.filter((r) => r.tipo === 'entrada' || r.tipo === 'saida').sort((a, b) => a.registradoEm.localeCompare(b.registradoEm))
  const ultimo = presencas[presencas.length - 1]
  if (!ultimo || ultimo.tipo !== 'entrada') return null
  return paraDiaLocal(ultimo.registradoEm) < hoje ? ultimo : null
}
