import { useMemo } from 'react'
import { navSections, type NavItem } from '@/components/layout/nav'
import { usePermissoes } from '@/hooks/usePermissoes'

export interface ItemNavPermitido extends NavItem {
  /** "Administração · Chamados" para itens do bloco de admin; senão o próprio nome. */
  rotulo: string
}

/** Itens do menu que ESTA pessoa pode abrir (mesma regra da barra lateral). */
export function useItensNav(): ItemNavPermitido[] {
  const { ehAdmin, ehAvaliador, podeUsarPlataforma, pode } = usePermissoes()
  return useMemo(
    () =>
      navSections
        .filter((s) => (!s.somenteAdmin || ehAdmin) && (!s.somenteAvaliador || ehAvaliador) && (!s.somenteLiberado || podeUsarPlataforma) && (!s.permissao || pode(s.permissao)))
        .flatMap((s) => s.items.filter((i) => !i.permissao || pode(i.permissao)).map((i) => ({ ...i, rotulo: s.title ? `${s.title} · ${i.label}` : i.label }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ehAdmin, ehAvaliador, podeUsarPlataforma],
  )
}
