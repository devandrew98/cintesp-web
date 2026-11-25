import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { atualizarTarefaPessoal, criarTarefaPessoal, listarTarefasPessoais } from '@/data/afazeres'
import { atualizarTarefa, listarTarefasAtribuidas } from '@/data/tarefas'
import { usePermissoes } from '@/hooks/usePermissoes'
import { deTarefaPessoal, deTarefaProjeto, type DadosTarefaPessoal, type ItemAfazer } from '@/lib/afazeres'
import { alternarConcluida } from '@/lib/tarefas'

/**
 * Lista unificada dos meus afazeres: tarefas particulares + tarefas dos projetos em que
 * sou o responsável. Concluir/reabrir vale para os dois tipos.
 */
export function useAfazeres() {
  const qc = useQueryClient()
  const { perfil } = usePermissoes()
  const uid = perfil?.id

  const pessoais = useQuery({ queryKey: ['afazeres-tarefas'], queryFn: listarTarefasPessoais })
  const atribuidas = useQuery({ queryKey: ['afazeres-atribuidas', uid], queryFn: () => listarTarefasAtribuidas(uid!), enabled: Boolean(uid) })

  const itens = useMemo<ItemAfazer[]>(
    () => [...(pessoais.data ?? []).map(deTarefaPessoal), ...(atribuidas.data ?? []).map((a) => deTarefaProjeto(a.tarefa, a.projetoTitulo))],
    [pessoais.data, atribuidas.data],
  )

  const recarregar = (item?: ItemAfazer) => {
    qc.invalidateQueries({ queryKey: ['afazeres-tarefas'] })
    qc.invalidateQueries({ queryKey: ['afazeres-atribuidas'] })
    if (item?.projetoId) qc.invalidateQueries({ queryKey: ['tarefas', item.projetoId] })
  }

  const alternar = useMutation({
    mutationFn: (item: ItemAfazer) => {
      const status = alternarConcluida(item.status)
      return item.origem === 'pessoal' ? atualizarTarefaPessoal(item.id, { status }) : atualizarTarefa(item.id, { status })
    },
    onSuccess: (_d, item) => recarregar(item),
  })

  const adicionarRapida = useMutation({
    mutationFn: (nova: string | { titulo: string; dataEntrega?: string }) =>
      criarTarefaPessoal({ ...(typeof nova === 'string' ? { titulo: nova } : nova), status: 'nao_iniciado', prioridade: 'media' }),
    onSuccess: () => recarregar(),
  })

  /** Muda status ou prazo direto na lista (vale para tarefa pessoal e de projeto). */
  const mudar = useMutation({
    mutationFn: ({ item, patch }: { item: ItemAfazer; patch: Partial<Pick<DadosTarefaPessoal, 'status' | 'dataEntrega'>> }) =>
      item.origem === 'pessoal' ? atualizarTarefaPessoal(item.id, patch) : atualizarTarefa(item.id, patch),
    onSuccess: (_d, v) => {
      recarregar(v.item)
      qc.invalidateQueries({ queryKey: ['projetos'] })
    },
  })

  return {
    itens,
    carregando: pessoais.isLoading || atribuidas.isLoading,
    alternar,
    adicionarRapida,
    mudar,
    recarregar,
  }
}
