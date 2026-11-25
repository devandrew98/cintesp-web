import { ehDonoProjeto, podeNoProjeto } from '@/lib/projetos'
import { resumoTarefas, type Tarefa } from '@/lib/tarefas'
import type { Projeto } from '@/types'

/**
 * Grupos de tarefas de um projeto (plano de trabalho). Cada grupo tem responsável, link do Drive
 * próprio e, se for "restrito", só deixa entrar quem foi escolhido (além do dono do projeto e do admin).
 * O banco (RLS) é quem garante; estas funções espelham as regras para a tela.
 */

export interface MembroGrupo {
  usuarioId: string
  nome?: string
}

export interface GrupoTarefas {
  id: string
  projetoId: string
  titulo: string
  descricao?: string
  responsavelId?: string
  responsavelNome?: string
  /** Link da pasta do Drive deste grupo (só quem vê o grupo vê o link). */
  driveUrl?: string
  /** Restrito: só os membros escolhidos (+ dono do projeto, responsável do grupo e admin) acessam. */
  restrito: boolean
  membros: MembroGrupo[]
  ordem: number
  criadoPorId?: string
  criadoEm: string
}

export interface DadosGrupo {
  titulo: string
  descricao?: string
  responsavelId?: string
  driveUrl?: string
  restrito: boolean
  membrosIds: string[]
}

type ProjetoMin = Pick<Projeto, 'criadoPorId' | 'responsavelId' | 'pesquisadores'>
type ProjetoPermissoes = ProjetoMin & Pick<Projeto, 'camposEditaveisMembros'>
type GrupoMin = Pick<GrupoTarefas, 'responsavelId' | 'criadoPorId' | 'restrito' | 'membros'>

const souEquipe = (p: ProjetoMin, uid?: string): boolean => Boolean(uid) && (ehDonoProjeto(p, uid) || p.pesquisadores.some((v) => v.usuarioId === uid))

/** Equipe do projeto (dono, vinculados) — quem enxerga o plano de trabalho. */
export const ehEquipeProjeto = (p: ProjetoMin, uid?: string, ehAdmin = false): boolean => ehAdmin || souEquipe(p, uid)

/** Vê o grupo e as tarefas dele. */
export function podeVerGrupo(g: GrupoMin, p: ProjetoMin, uid?: string, ehAdmin = false): boolean {
  if (ehAdmin) return true
  if (!uid) return false
  if (ehDonoProjeto(p, uid) || g.responsavelId === uid || g.criadoPorId === uid || g.membros.some((m) => m.usuarioId === uid)) return true
  return !g.restrito && souEquipe(p, uid)
}

/** Edita o grupo (título, acesso, link): ADM do projeto/sistema, ou colaborador liberado que vê o grupo. */
export const podeEditarGrupo = (g: GrupoMin, p: ProjetoPermissoes, uid?: string, ehAdmin = false): boolean =>
  podeVerGrupo(g, p, uid, ehAdmin) && podeNoProjeto(p, 'gruposEditar', uid, ehAdmin)

export const podeExcluirGrupo = (g: GrupoMin, p: ProjetoPermissoes, uid?: string, ehAdmin = false): boolean =>
  podeVerGrupo(g, p, uid, ehAdmin) && podeNoProjeto(p, 'gruposExcluir', uid, ehAdmin)

/** Cria grupos novos: ADM do projeto/sistema, ou colaborador liberado. */
export const podeCriarGrupo = (p: ProjetoPermissoes, uid?: string, ehAdmin = false): boolean => podeNoProjeto(p, 'gruposCriar', uid, ehAdmin)

/** Quem pode ser responsável por uma tarefa do grupo (num grupo restrito: só quem tem acesso a ele). */
export function equipeDoGrupo(g: GrupoMin, p: Pick<Projeto, 'pesquisadores'>): { id: string; nome: string }[] {
  const base = g.restrito ? g.membros.map((m) => ({ id: m.usuarioId, nome: m.nome ?? p.pesquisadores.find((v) => v.usuarioId === m.usuarioId)?.nome ?? '—' })) : p.pesquisadores.map((v) => ({ id: v.usuarioId, nome: v.nome ?? '—' }))
  if (g.restrito && g.responsavelId && !base.some((b) => b.id === g.responsavelId)) base.push({ id: g.responsavelId, nome: p.pesquisadores.find((v) => v.usuarioId === g.responsavelId)?.nome ?? '—' })
  return base
}

/** Progresso do grupo = tarefas concluídas / total (nunca manual). */
export const progressoGrupo = (tarefas: Tarefa[], grupoId: string) => resumoTarefas(tarefas.filter((t) => t.grupoId === grupoId))

/** Progresso do projeto = tarefas concluídas / total de tarefas de todos os grupos. */
export const progressoProjeto = (tarefas: Tarefa[]) => resumoTarefas(tarefas)

export function validarGrupo(d: Pick<DadosGrupo, 'titulo' | 'driveUrl'>): string | null {
  if (!d.titulo.trim()) return 'Informe o nome do grupo.'
  if (d.driveUrl?.trim()) {
    try {
      normalizarLink(d.driveUrl)
    } catch (e) {
      return (e as Error).message
    }
  }
  return null
}

/** Aceita "drive.google.com/..." e completa com https://. Só http(s). Vazio = sem link. */
export function normalizarLink(entrada?: string): string | undefined {
  const t = entrada?.trim()
  if (!t) return undefined
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  let u: URL
  try {
    u = new URL(comEsquema)
  } catch {
    throw new Error('Link inválido. Cole o endereço completo (ex.: https://drive.google.com/...).')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('O link precisa começar com http:// ou https://.')
  if (!u.hostname.includes('.')) throw new Error('Link inválido. Cole o endereço completo (ex.: https://drive.google.com/...).')
  return u.toString()
}
