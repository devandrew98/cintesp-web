import type { StatusDisponibilidade, Usuario } from '@/types'

/**
 * Filtros compartilhados pelas telas que listam pesquisadores
 * (Quadro de Disponibilidade, Pesquisadores, Busca Rápida).
 * Centralizar aqui evita repetir a mesma lógica de filtragem em cada tela.
 */
export interface FiltroUsuarios {
  busca?: string
  disponibilidade?: StatusDisponibilidade | 'todos'
  areaId?: string | 'todas'
  funcaoId?: string | 'todas'
  apenasAtivos?: boolean
}

export function filtrarUsuarios(lista: Usuario[], f: FiltroUsuarios): Usuario[] {
  const q = (f.busca ?? '').trim().toLowerCase()
  return lista.filter((u) => {
    if (f.apenasAtivos && u.status !== 'ativo') return false
    if (f.disponibilidade && f.disponibilidade !== 'todos' && u.disponibilidade !== f.disponibilidade)
      return false
    if (f.areaId && f.areaId !== 'todas' && !u.areas.some((a) => a.id === f.areaId)) return false
    if (f.funcaoId && f.funcaoId !== 'todas' && u.funcao.id !== f.funcaoId) return false
    if (q) {
      // Busca por nome, e-mail, função ou nome das áreas.
      const alvo = `${u.nome} ${u.email} ${u.funcao.nome} ${u.areas
        .map((a) => a.nome)
        .join(' ')}`.toLowerCase()
      if (!alvo.includes(q)) return false
    }
    return true
  })
}

/** Texto amigável do horário livre ("Até 12:00" ou "Livre o dia todo"). */
export function textoLivre(u: Usuario): string {
  if (u.disponibilidade !== 'disponivel') return ''
  return u.livreAte ? `Livre até ${u.livreAte}` : 'Livre o dia todo'
}
