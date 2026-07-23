import { useState } from 'react'
import { Mail, Phone, Building2, Pencil, Plus, Clock, History } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { HorarioEditor } from './HorarioEditor'
import { cn } from '@/lib/utils'
import { funcoes, historico, horarioPadrao } from '@/data/mock'
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
 */
export function UserDetail({ usuario }: { usuario: Usuario }) {
  const [aba, setAba] = useState<SubAba>('informacoes')

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
          <Button variant="secondary" icon={Pencil}>
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
      {aba === 'funcao' && <AbaFuncao usuario={usuario} />}
      {/* key={usuario.id} recria o editor com os horários do usuário atual */}
      {aba === 'horarios' && <HorarioEditor key={usuario.id} horariosIniciais={horarioPadrao} />}
      {aba === 'areas' && <AbaAreas usuario={usuario} />}
      {aba === 'historico' && <AbaHistorico />}
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
    { label: 'Áreas', valor: usuario.areas.map((a) => a.nome).join(', ') || '—' },
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
 * Aba: Função e Permissões — troca de função + chips de permissões.
 * ============================================================ */
function AbaFuncao({ usuario }: { usuario: Usuario }) {
  const [funcaoId, setFuncaoId] = useState(usuario.funcao.id)
  const funcaoAtual = funcoes.find((f) => f.id === funcaoId) ?? usuario.funcao

  return (
    <div className="card space-y-5 p-5">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">Função e Permissões</h3>
        <p className="text-sm text-slate-500">Defina o papel do usuário e veja o que ele pode acessar.</p>
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

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Permissões</p>
        <div className="flex flex-wrap gap-2">
          {funcaoAtual.permissoes.map((p) => (
            <span
              key={p}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {/* transforma "editar_horarios" em "editar horarios" para exibir */}
              {p.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * Aba: Áreas de Atuação — chips coloridas + adicionar.
 * ============================================================ */
function AbaAreas({ usuario }: { usuario: Usuario }) {
  return (
    <div className="card space-y-4 p-5">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">Áreas de Atuação</h3>
        <p className="text-sm text-slate-500">Especialidades do pesquisador.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {usuario.areas.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.cor }} />
            {a.nome}
          </span>
        ))}
        <button className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-600">
          <Plus className="h-4 w-4" /> Adicionar área
        </button>
      </div>
    </div>
  )
}

/* ============================================================
 * Aba: Histórico — linha do tempo de alterações.
 * ============================================================ */
function AbaHistorico() {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <History className="h-4 w-4 text-slate-400" /> Histórico de Alterações
        </h3>
        <button className="text-sm font-medium text-brand-600 hover:underline">
          Ver histórico completo
        </button>
      </div>
      <ol className="space-y-4">
        {historico.map((h) => (
          <li key={h.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                <Clock className="h-3.5 w-3.5" />
              </span>
              <span className="mt-1 w-px flex-1 bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="pb-1">
              <p className="text-sm text-slate-700 dark:text-slate-200">{h.descricao}</p>
              <p className="text-xs text-slate-400">{h.data}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
