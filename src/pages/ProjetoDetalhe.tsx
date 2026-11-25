import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, Camera, ExternalLink, FolderKanban, FolderOpen, Lock, MessageCircle, MessageSquare, Pencil, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProgressoBar } from '@/components/projetos/ProgressoBar'
import { CapaEditorModal } from '@/components/projetos/CapaEditorModal'
import { ProjetoChat } from '@/components/projetos/ProjetoChat'
import { ProjetoEditarModal } from '@/components/projetos/ProjetoEditarModal'
import { GruposProjeto } from '@/components/projetos/GruposProjeto'
import { GraficosProjeto } from '@/components/projetos/graficos/GraficosProjeto'
import { excluirProjeto, listarProjetos } from '@/data/projetos'
import { listarUsuarios } from '@/data/api'
import { obterLinksProjeto } from '@/data/grupos'
import { usePermissoes } from '@/hooks/usePermissoes'
import { ehEquipeProjeto } from '@/lib/grupos'
import { ehDonoProjeto, podeNoProjeto, rotuloTRL, statusProjetoInfo } from '@/lib/projetos'
import { cn, formatDateOnlyBR, mensagemErro } from '@/lib/utils'

const CHAT_ATIVO = false

type Aba = 'tarefas' | 'graficos' | 'detalhes' | 'chat'

/**
 * Página do projeto (tela inteira): capa, título, responsável, equipe e abas
 * Plano de trabalho · Gráficos · Detalhes. Capa e edição: dono, admin ou quem eles liberarem.
 */
export function ProjetoDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { ehAdmin, perfil } = usePermissoes()
  const [editandoCapa, setEditandoCapa] = useState(false)
  const [aba, setAba] = useState<Aba>('tarefas')
  const [editando, setEditando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { data: lista = [], isLoading } = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos })
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })
  const projeto = lista.find((p) => p.id === id)
  const equipeDoProjeto = projeto ? ehEquipeProjeto(projeto, perfil?.id, ehAdmin) : false
  // Links do projeto: o banco só entrega para a equipe.
  const { data: links } = useQuery({ queryKey: ['projeto-links', id], queryFn: () => obterLinksProjeto(id!), enabled: Boolean(id) && equipeDoProjeto })

  const remover = useMutation({
    mutationFn: () => excluirProjeto(projeto!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projetos'] })
      navigate('/projetos', { replace: true })
    },
    onError: (e) => setErro(mensagemErro(e)),
  })

  if (isLoading) return <p className="py-20 text-center text-sm text-slate-400">Carregando projeto…</p>
  if (!projeto)
    return (
      <div className="card flex flex-col items-center gap-3 px-4 py-16 text-center">
        <FolderKanban className="h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">Projeto não encontrado.</p>
        <Link to="/projetos" className="text-sm font-medium text-brand-600 hover:underline">
          Voltar para Projetos
        </Link>
      </div>
    )

  const souDono = ehDonoProjeto(projeto, perfil?.id)
  const souMembro = Boolean(perfil?.id && projeto.pesquisadores.some((v) => v.usuarioId === perfil.id))
  const total = ehAdmin || souDono
  const pode = (p: Parameters<typeof podeNoProjeto>[1]) => podeNoProjeto(projeto, p, perfil?.id, ehAdmin)
  const podeEditar = total || (['trl', 'dadosTecnicos', 'descricao', 'observacoes', 'cronograma', 'links'] as const).some(pode)
  const podeCapa = pode('capa')
  const podeChat = total || souMembro
  const st = statusProjetoInfo[projeto.status]
  const tone = st.tone as 'green' | 'amber' | 'blue' | 'red' | 'slate'

  const abas: { id: Aba; label: string; icon?: typeof Users }[] = [
    { id: 'tarefas', label: 'Plano de trabalho' },
    { id: 'graficos', label: 'Gráficos' },
    { id: 'detalhes', label: 'Detalhes' },
    // Chat oculto por enquanto (o grupo de WhatsApp assumiu o papel). Para reativar: CHAT_ATIVO = true.
    ...(CHAT_ATIVO && podeChat ? [{ id: 'chat' as const, label: 'Chat', icon: MessageSquare }] : []),
  ]

  return (
    <div>
      <Link to="/projetos" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Projetos
      </Link>

      {/* Capa (proporção 4:1, a mesma da tela de ajuste) */}
      <div className="relative aspect-[4/1] min-h-[9rem] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-400">
        {projeto.capaUrl ? (
          <img src={projeto.capaUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <FolderKanban className="absolute right-6 top-1/2 h-24 w-24 -translate-y-1/2 text-white/20" />
        )}
        {podeCapa && (
          <button type="button" onClick={() => setEditandoCapa(true)} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-black/55 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-black/70">
            <Camera className="h-4 w-4" />
            Editar capa
          </button>
        )}
      </div>

      {/* Cabeçalho */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {podeEditar && (
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditando(true)}>
              Editar projeto
            </Button>
          )}
          <h1 className="break-words text-xl font-bold uppercase leading-snug text-slate-900 dark:text-white sm:text-2xl">{projeto.titulo}</h1>
          <p className="text-sm text-slate-500">Resp: {projeto.responsavelNome ?? '—'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5" /> Equipe:
            </span>
            {projeto.pesquisadores.map((p) => (
              <span key={p.usuarioId} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <Avatar nome={p.nome ?? '—'} fotoUrl={p.fotoUrl} size="sm" className="h-5 w-5 text-[9px]" />
                <span className="truncate">{p.nome ?? '—'}</span>
                {p.papel === 'responsavel' && <span className="text-slate-400">(resp.)</span>}
              </span>
            ))}
          </div>
          {equipeDoProjeto && (links?.grupoUrl || links?.driveUrl) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {links.grupoUrl && (
                <a href={links.grupoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  <MessageCircle className="h-4 w-4" /> Entrar no grupo do projeto
                </a>
              )}
              {links.driveUrl && (
                <a href={links.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <FolderOpen className="h-4 w-4" /> Acessar Google Drive do projeto <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
          <Badge tone={tone} dot>
            {st.label}
          </Badge>
          {projeto.trl && <Badge tone="violet">{rotuloTRL(projeto.trl)}</Badge>}
        </div>
      </div>

      {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}

      {/* Abas */}
      <div className="mt-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-slate-800" role="tablist">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={cn('-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors', aba === a.id ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200')}
          >
            {a.icon && <a.icon className="h-4 w-4" />}
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {aba === 'tarefas' &&
          (equipeDoProjeto ? (
            <GruposProjeto projeto={projeto} />
          ) : (
            <div className="card flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Lock className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Os grupos, as tarefas e os arquivos do projeto são só da equipe vinculada a ele.</p>
            </div>
          ))}

        {aba === 'graficos' &&
          (equipeDoProjeto ? (
            <GraficosProjeto projeto={projeto} />
          ) : (
            <div className="card flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Lock className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Os gráficos mostram as tarefas e são só da equipe vinculada ao projeto.</p>
            </div>
          ))}

        {aba === 'detalhes' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Bloco titulo="Descrição">{projeto.descricao ? <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{projeto.descricao}</p> : <Vazio />}</Bloco>
              <Bloco titulo="Dados técnicos">{projeto.dadosTecnicos ? <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{projeto.dadosTecnicos}</p> : <Vazio />}</Bloco>
              <Bloco titulo="Observações">{projeto.observacoes ? <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{projeto.observacoes}</p> : <Vazio />}</Bloco>
            </div>
            <div className="space-y-4">
              <Bloco titulo={`Progresso — ${projeto.progresso}%`}>
                <ProgressoBar progresso={projeto.progresso} />
                <p className="mt-2 text-xs text-slate-400">Calculado automaticamente pelas tarefas concluídas nos grupos do plano de trabalho.</p>
              </Bloco>
              <Bloco titulo="Datas">
                <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                  <li className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" /> Início: {formatDateOnlyBR(projeto.dataInicio)}
                  </li>
                  <li className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" /> Previsão: {formatDateOnlyBR(projeto.dataFimPrevista)}
                  </li>
                </ul>
              </Bloco>
              <Bloco titulo="Registro">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Criado por {projeto.criadoPorNome ?? '—'} em {formatDateOnlyBR(projeto.criadoEm)}
                </p>
              </Bloco>
              {!podeEditar && (
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Lock className="h-3 w-3" /> Somente leitura para você
                </p>
              )}
            </div>
          </div>
        )}

        {CHAT_ATIVO && aba === 'chat' && podeChat && <ProjetoChat projeto={projeto} />}
      </div>

      {podeCapa && <CapaEditorModal open={editandoCapa} onClose={() => setEditandoCapa(false)} projetoId={projeto.id} capaAtualUrl={projeto.capaUrl} aoSalvar={() => qc.invalidateQueries({ queryKey: ['projetos'] })} />}
      <ProjetoEditarModal projeto={projeto} open={editando} onClose={() => setEditando(false)} usuarios={usuarios} onExcluir={() => setExcluindo(true)} />
      <ConfirmDialog
        open={excluindo}
        onClose={() => setExcluindo(false)}
        onConfirm={() => remover.mutate()}
        title="Excluir projeto"
        message={`Tem certeza que deseja excluir "${projeto.titulo}"? As tarefas, o chat e o histórico serão perdidos. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</h2>
      {children}
    </section>
  )
}

const Vazio = () => <p className="text-sm text-slate-400">—</p>
