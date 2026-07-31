// ============================================================
// Catálogo de permissões do sistema.
// Centraliza os "ids" técnicos usados nas funções (ver data/mock.ts)
// e dá a cada um um rótulo amigável + descrição para exibir na UI.
// Na Fase 4 (Supabase) isto vira a base das políticas RLS por função.
// ============================================================

export interface PermissaoDef {
  id: string
  label: string
  descricao: string
}

/** Todas as permissões que uma função pode conceder. */
export const PERMISSOES: PermissaoDef[] = [
  { id: 'gerenciar_tudo', label: 'Gerenciar tudo', descricao: 'Acesso total ao sistema (administração completa).' },
  { id: 'ver_quadro', label: 'Ver quadro', descricao: 'Acessar a plataforma (quadro, avisos, etc.). Sem isto, é apenas Participante.' },
  { id: 'editar_horarios', label: 'Editar horários', descricao: 'Editar os horários de qualquer pesquisador.' },
  { id: 'editar_meu_horario', label: 'Editar meu horário', descricao: 'Editar apenas o próprio horário.' },
  { id: 'publicar_avisos', label: 'Publicar avisos', descricao: 'Criar e publicar avisos para a equipe.' },
  { id: 'abrir_chamado', label: 'Abrir chamado', descricao: 'Abrir chamados de suporte (todos os usuários já podem).' },
]

/**
 * Converte um id de permissão no seu rótulo amigável.
 * Se for um id desconhecido, mostra o próprio id com "_" trocado por espaço.
 */
export function rotuloPermissao(id: string): string {
  return PERMISSOES.find((p) => p.id === id)?.label ?? id.replace(/_/g, ' ')
}
