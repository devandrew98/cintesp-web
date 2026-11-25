import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { atualizarTarefaPessoal, criarTarefaPessoal, listarTarefasPessoais } from '@/data/afazeres'
import { listarProjetos } from '@/data/projetos'
import { atualizarTarefa, listarTarefasAtribuidas } from '@/data/tarefas'
import { usePermissoes } from '@/hooks/usePermissoes'
import { deTarefaPessoal, deTarefaProjeto, type DadosTarefaPessoal, type ItemAfazer } from '@/lib/afazeres'
import { alternarConcluida, permissoesTarefa, statusPermitidos } from '@/lib/tarefas'

/**
 * Lista unificada dos meus afazeres: tarefas particulares + tarefas dos projetos em que
 * sou o responsável. Concluir/reabrir vale para os dois tipos.
 */
export function useAfazeres() {
  const qc = useQueryClient()
  const { perfil, ehAdmin } = usePermissoes()
  const uid = perfil?.id

  const pessoais = useQuery({ queryKey: ['afazeres-tarefas'], queryFn: listarTarefasPessoais })
  const atribuidas = useQuery({ queryKey: ['afazeres-atribuidas', uid], queryFn: () => listarTarefasAtribuidas(uid!), enabled: Boolean(uid) })

  const projetos = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos })

  const itens = useMemo<ItemAfazer[]>(() => {
    const deProjeto = (atribuidas.data ?? []).map((a) => {
      const p = projetos.data?.find((x) => x.id === a.tarefa.projetoId)
      const perms = p ? permissoesTarefa(p, uid, ehAdmin) : { gestor: false, andamento: false, editar: false }
      return { ...deTarefaProjeto(a.tarefa, a.projetoTitulo), permitidos: statusPermitidos(a.tarefa.status, perms), podePrazo: perms.editar }
    })
    return [...(pessoais.data ?? []).map(deTarefaPessoal), ...deProjeto]
  }, [pessoais.data, atribuidas.data, projetos.data, uid, ehAdmin])

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
