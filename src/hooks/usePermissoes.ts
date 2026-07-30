import { useQuery } from '@tanstack/react-query'
import { perfilAtual } from '@/data/api'

/**
 * Permissões do usuário logado.
 *
 * Fonte da verdade: a FUNÇÃO do usuário (tabela `funcoes`), carregada junto
 * com o perfil. O administrador tem a permissão `gerenciar_tudo`, que libera
 * tudo no sistema.
 *
 * ⚠️ Importante: esconder um botão é só conforto visual. Quem realmente barra
 * a ação é o banco (políticas RLS do Supabase, função `is_admin()`), que
 * rejeita a gravação mesmo se alguém chamar a API por fora do app.
 */
export function usePermissoes() {
  const { data: perfil, isLoading: carregando } = useQuery({
    queryKey: ['perfil-atual'],
    queryFn: perfilAtual,
    // O papel muda pouco, mas quando um admin troca a função de alguém direto
    // no banco, queremos que a plataforma reflita sem exigir logout: por isso
    // refazemos ao focar a aba e mantemos a janela de "fresco" curta.
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })

  const permissoes = perfil?.funcao?.permissoes ?? []

  /** Acesso total (Administrador). */
  const ehAdmin = permissoes.includes('gerenciar_tudo')

  /**
   * Confere uma permissão específica.
   * O admin passa em qualquer verificação.
   */
  function pode(permissao: string): boolean {
    return ehAdmin || permissoes.includes(permissao)
  }

  return {
    perfil: perfil ?? null,
    permissoes,
    ehAdmin,
    pode,
    carregando,
    /** Pode publicar/editar avisos. */
    podePublicarAvisos: ehAdmin || permissoes.includes('publicar_avisos'),
    /** Pode editar o horário de QUALQUER pesquisador (não só o próprio). */
    podeEditarHorariosDeTerceiros: ehAdmin || permissoes.includes('editar_horarios'),
  }
}
