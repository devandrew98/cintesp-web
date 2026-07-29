import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Phone, Building2, Pencil, Plus, Clock, History, Check, Save } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { HorarioEditor } from './HorarioEditor'
import { EditarUsuarioModal } from './EditarUsuarioModal'
import { SelecionarAreasModal } from './SelecionarAreasModal'
import { cn } from '@/lib/utils'
import { rotuloPermissao } from '@/lib/permissoes'
import {
  atualizarAreasUsuario,
  atualizarFuncaoUsuario,
  atualizarUsuario,
  listarFuncoes,
  listarHistorico,
  listarHorarios,
  salvarHorarios,
  type DadosUsuario,
} from '@/data/api'
import type { Usuario } from '@/types'

// Abas internas do detalhe do usuário.
type SubAba = 'informacoes' | 'funcao' | 'horarios' | 'areas' | 'historico'

const subAbas: Array<{ id: SubAba; label: string }> = [
  { id: 'informacoes', label: 'Informações' },
  { id: 'funcao', label: 'Função e Permissões' },
  { id: 'horarios', label: 'Horários' },
  { id: 'areas', label: 'Áreas de Atuação' },
  { id: 'historico', label: 'Histórico' },
]

/**
 * Painel direito da tela de Usuários: cabeçalho com os dados do pesquisador
 * selecionado e as sub-abas (Informações / Função / Horários / Áreas / Histórico).
 *
 * Todas as abas gravam no banco de verdade — cada alteração também vai para o
 * histórico do usuário, para ficar registrado quem mudou o quê.
 */
export function UserDetail({ usuario }: { usuario: Usuario }) {
  const [aba, setAba] = useState<SubAba>('informacoes')
  const [editando, setEditando] = useState(false)
  const queryClient = useQueryClient()

  /** Recarrega a lista de usuários e o histórico após qualquer alteração. */
  const recarregar = () => {
    queryClient.invalidateQueries({ queryKey: ['usuarios'] })
    queryClient.invalidateQueries({ queryKey: ['historico', usuario.id] })
    queryClient.invalidateQueries({ queryKey: ['perfil-atual'] })
  }

  const salvarDadosMut = useMutation({
    mutationFn: (dados: DadosUsuario) => atualizarUsuario(usuario.id, dados),
    onSuccess: () => {
      recarregar()
      setEditando(false)
    },
  })

  return (
    <div className="space-y-6">
      {/* ---------- Cabeçalho do perfil ---------- */}
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar nome={usuario.nome} fotoUrl={usuario.fotoUrl} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{usuario.nome}</h2>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    usuario.status === 'ativo'
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  {usuario.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-sm font-medium text-brand-600">{usuario.funcao.nome}</p>
              {/* Contatos */}
              <div className="mt-2 flex flex-col gap-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> {usuario.email}
                </span>
                {usuario.telefone && (
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {usuario.telefone}
                  </span>
                )}
                {usuario.instituicao && (
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" /> {usuario.instituicao.sigla} —{' '}
                    {usuario.instituicao.nome}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button variant="secondary" icon={Pencil} onClick={() => setEditando(true)}>
            Editar Dados
          </Button>
        </div>

        {/* ---------- Sub-abas ---------- */}
        <div className="mt-5 flex gap-1 overflow-x-auto border-t border-slate-100 pt-3 dark:border-slate-800">
          {subAbas.map((s) => (
            <button
              key={s.id}
              onClick={() => setAba(s.id)}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                aba === s.id
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Conteúdo da aba selecionada ---------- */}
      {aba === 'informacoes' && <AbaInformacoes usuario={usuario} />}
      {aba === 'funcao' && <AbaFuncao key={usuario.id} usuario={usuario} onSalvo={recarregar} />}
      {aba === 'horarios' && <AbaHorarios key={usuario.id} usuario={usuario} />}
      {aba === 'areas' && <AbaAreas key={usuario.id} usuario={usuario} onSalvo={recarregar} />}
      {aba === 'historico' && <AbaHistorico usuarioId={usuario.id} />}

      {/* Modal de edição dos dados cadastrais */}
      {editando && (
        <EditarUsuarioModal
          usuario={usuario}
          open={editando}
          onClose={() => setEditando(false)}
          onSalvar={(dados) => salvarDadosMut.mutate(dados)}
          salvando={salvarDadosMut.isPending}
        />
      )}
    </div>
  )
}

/* ============================================================
 * Aba: Informações — grade de dados em modo leitura.
 * ============================================================ */
function AbaInformacoes({ usuario }: { usuario: Usuario }) {
  const itens = [
    { label: 'E-mail', valor: usuario.email },
    { label: 'Telefone', valor: usuario.telefone ?? '—' },
    { label: 'Instituição', valor: usuario.instituicao?.nome ?? '—' },
    { label: 'Função', valor: usuario.funcao.nome },
    { label: 'Status', valor: usuario.status === 'ativo' ? 'Ativo' : 'Inativo' },
    { label: 'Áreas', valor: usuario.areas.map((a) => a?.nome).filter(Boolean).join(', ') || '—' },
  ]
  return (
    <div className="card p-5">
      <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Informações do pesquisador</h3>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {itens.map((i) => (
          <div key={i.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{i.label}</dt>
            <dd className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{i.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ============================================================
 * Aba: Função e Permissões — troca de função COM botão de salvar.
 * ============================================================ */
function AbaFuncao({ usuario, onSalvo }: { usuario: Usuario; onSalvo: () => void }) {
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: listarFuncoes })

  const [funcaoId, setFuncaoId] = useState(usuario.funcao.id)
  const [salvo, setSalvo] = useState(false)

  const salvarMut = useMutation({
    mutationFn: () => atualizarFuncaoUsuario(usuario.id, funcaoId),
    onSuccess: () => {
      onSalvo()
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
    },
  })

  const funcaoAtual = funcoes.find((f) => f.id === funcaoId) ?? usuario.funcao
  // Só habilita o botão quando houve mudança de verdade.
  const mudou = funcaoId !== usuario.funcao.id

  return (
    <div className="card space-y-5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Função e Permissões</h3>
          <p className="text-sm text-slate-500">
            Defina o papel do usuário e veja o que ele pode acessar.
          </p>
        </div>
        <Button
          icon={salvo ? Check : Save}
          disabled={!mudou || salvarMut.isPending}
          onClick={() => salvarMut.mutate()}
        >
          {salvo ? 'Salvo!' : salvarMut.isPending ? 'Salvando...' : 'Salvar função'}
        </Button>
      </div>

      <label className="block max-w-sm">
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Função atual
        </span>
        <Select value={funcaoId} onChange={(e) => setFuncaoId(e.target.value)}>
          {funcoes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Select>
      </label>

      {mudou && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          Alteração ainda não salva. Clique em <strong>Salvar função</strong> para aplicar.
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          Permissões desta função
        </p>
        <div className="flex flex-wrap gap-2">
          {funcaoAtual.permissoes.length === 0 ? (
            <span className="text-sm text-slate-400">Nenhuma permissão atribuída.</span>
          ) : (
            funcaoAtual.permissoes.map((p) => (
              <span
                key={p}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {rotuloPermissao(p)}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * Aba: Horários — carrega do banco e SALVA de verdade.
 * ============================================================ */
function AbaHorarios({ usuario }: { usuario: Usuario }) {
  const queryClient = useQueryClient()
  const { data: horarios, isLoading } = useQuery({
    queryKey: ['horarios', usuario.id],
    queryFn: () => listarHorarios(usuario.id),
  })

  if (isLoading) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400">Carregando horários...</div>
    )
  }

  return (
    <HorarioEditor
      horariosIniciais={horarios ?? []}
      onSalvar={async (novos) => {
        await salvarHorarios(usuario.id, novos)
        queryClient.invalidateQueries({ queryKey: ['horarios', usuario.id] })
        queryClient.invalidateQueries({ queryKey: ['horarios-todos'] })
      }}
    />
  )
}

/* ============================================================
 * Aba: Áreas de Atuação — chips + modal de seleção que grava.
 * ============================================================ */
function AbaAreas({ usuario, onSalvo }: { usuario: Usuario; onSalvo: () => void }) {
  const [modalAberto, setModalAberto] = useState(false)
  // `filter(Boolean)` protege contra vínculo órfão (área excluída).
  const areasDoUsuario = usuario.areas.filter(Boolean)

  const salvarMut = useMutation({
    mutationFn: (areaIds: string[]) => atualizarAreasUsuario(usuario.id, areaIds),
    onSuccess: () => {
      onSalvo()
      setModalAberto(false)
    },
  })

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">Áreas de Atuação</h3>
        <p className="text-sm text-slate-500">Especialidades do pesquisador.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {areasDoUsuario.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.cor }} />
            {a.nome}
          </span>
        ))}

        {areasDoUsuario.length === 0 && (
          <span className="text-sm text-slate-400">Nenhuma área definida.</span>
        )}

        <button
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-600"
        >
          <Plus className="h-4 w-4" /> Adicionar área
        </button>
      </div>

      {modalAberto && (
        <SelecionarAreasModal
          open={modalAberto}
          onClose={() => setModalAberto(false)}
          areasAtuais={areasDoUsuario.map((a) => a.id)}
          onSalvar={(ids) => salvarMut.mutate(ids)}
          salvando={salvarMut.isPending}
        />
      )}
    </div>
  )
}

/* ============================================================
 * Aba: Histórico — linha do tempo real, vinda do banco.
 * ============================================================ */
function AbaHistorico({ usuarioId }: { usuarioId: string }) {
  const { data: historico = [], isLoading } = useQuery({
    queryKey: ['historico', usuarioId],
    queryFn: () => listarHistorico(usuarioId),
  })

  // Começa mostrando os 5 mais recentes; "Ver histórico completo" abre o resto.
  const [mostrarTudo, setMostrarTudo] = useState(false)
  useEffect(() => setMostrarTudo(false), [usuarioId])

  const visiveis = mostrarTudo ? historico : historico.slice(0, 5)
  const temMais = historico.length > 5

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <History className="h-4 w-4 text-slate-400" /> Histórico de Alterações
        </h3>
        {temMais && (
          <button
            onClick={() => setMostrarTudo((v) => !v)}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            {mostrarTudo ? 'Mostrar menos' : `Ver histórico completo (${historico.length})`}
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-slate-400">Carregando...</p>
      ) : historico.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Nenhuma alteração registrada ainda. As próximas mudanças aparecerão aqui.
        </p>
      ) : (
        <ol className="space-y-4">
          {visiveis.map((h) => (
            <li key={h.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <span className="mt-1 w-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="pb-1">
                <p className="text-sm text-slate-700 dark:text-slate-200">{h.descricao}</p>
                <p className="text-xs text-slate-400">
                  {h.data}
                  {h.autor && ` · por ${h.autor}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
