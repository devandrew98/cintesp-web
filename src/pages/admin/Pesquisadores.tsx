import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload,
  UserPlus,
  Search,
  Trash2,
  Pencil,
  RotateCcw,
  Users2,
  ShieldCheck,
  GraduationCap,
  Download,
  Clock,
  Mail,
  Phone,
  MessageCircle,
  History,
  AlertCircle,
} from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { StatCard } from '@/components/ui/StatCard'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ImportWizard } from '@/components/participantes/ImportWizard'
import { EditarUsuarioModal } from '@/components/admin/EditarUsuarioModal'
import { PessoaFormModal } from '@/components/admin/PessoaFormModal'
import { PessoaDetailModal } from '@/components/admin/PessoaDetailModal'
import {
  listarUsuarios,
  listarTodosHorarios,
  atualizarUsuario,
  type DadosUsuario,
} from '@/data/api'
import {
  listarParticipantes,
  listarImportacoes,
  excluirParticipante,
  criarPerfilManual,
  atualizarPerfilManual,
  type PerfilManual,
} from '@/data/participantes'
import { diasAtivos, horasSemanais, formatarHoras } from '@/lib/horarios'
import { mascararCPF } from '@/lib/cpf'
import type { HorarioDia, Participante, Usuario } from '@/types'

/** Uma pessoa da lista unificada — com login (usuário) ou sem (aluno/manual). */
interface LinhaPessoa {
  key: string
  tipo: 'usuario' | 'participante'
  nome: string
  fotoUrl?: string
  papel: string
  temAcesso: boolean
  ativo: boolean
  cpf?: string
  curso?: string
  email?: string
  telefone?: string
  whatsapp?: string
  horarios: HorarioDia[]
  usuario?: Usuario
  participante?: Participante
}

/** Converte um participante para os campos do formulário de perfil manual. */
function participanteParaPerfil(p: Participante): PerfilManual {
  const extras = p.dadosExtras ?? {}
  return {
    nome: p.nome,
    email: p.email,
    cpf: p.cpf,
    curso: p.curso,
    telefone: p.telefone,
    whatsapp: extras.whatsapp,
    endereco: p.endereco,
    cep: p.cep,
    papelPretendido: extras.funcaoPretendida ?? 'Aluno',
    responsavelId: extras.responsavelId,
    responsavelNome: extras.responsavelNome,
  }
}

/** Resumo curto do horário para a coluna da tabela. */
function resumoHorario(horarios: HorarioDia[]): string {
  const dias = diasAtivos(horarios)
  if (dias === 0) return '—'
  return `${dias} ${dias === 1 ? 'dia' : 'dias'} · ${formatarHoras(horasSemanais(horarios))}`
}

/**
 * "Administração > Pesquisadores" — visão unificada de TODAS as pessoas:
 * usuários da plataforma (admins, coordenadores, pesquisadores) e os perfis
 * sem login (alunos importados de planilha + cadastros manuais).
 *
 * Cada linha mostra papel, CPF, curso, contato e um resumo do horário; clicar
 * abre todos os detalhes; os botões editam e removem (usuário é desativado,
 * mantendo o cadastro; perfil sem login é excluído de vez).
 */
export function AdminPesquisadoresPage() {
  const qc = useQueryClient()

  const { data: usuarios = [], isLoading: carregandoU } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
  })
  const {
    data: participantes = [],
    isLoading: carregandoP,
    error: erroP,
  } = useQuery({ queryKey: ['participantes'], queryFn: listarParticipantes })
  const { data: horariosPorUsuario = {} } = useQuery({
    queryKey: ['horarios-todos'],
    queryFn: listarTodosHorarios,
  })
  const { data: importacoes = [] } = useQuery({
    queryKey: ['importacoes'],
    queryFn: listarImportacoes,
  })

  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'usuario' | 'participante'>('todos')
  const [cursoFiltro, setCursoFiltro] = useState('todos')

  const [detalhe, setDetalhe] = useState<LinhaPessoa | null>(null)
  const [editUsuario, setEditUsuario] = useState<Usuario | null>(null)
  const [editParticipante, setEditParticipante] = useState<Participante | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [aConfirmar, setAConfirmar] = useState<{
    p: LinhaPessoa
    acao: 'desativar' | 'excluir'
  } | null>(null)
  const [wizardAberto, setWizardAberto] = useState(false)

  const carregando = carregandoU || carregandoP

  // ---------- Mutations ----------
  const invalidarU = () => qc.invalidateQueries({ queryKey: ['usuarios'] })
  const invalidarP = () => qc.invalidateQueries({ queryKey: ['participantes'] })

  const salvarUsuarioMut = useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: DadosUsuario }) => atualizarUsuario(id, dados),
    onSuccess: () => {
      invalidarU()
      setEditUsuario(null)
    },
  })
  const criarManualMut = useMutation({
    mutationFn: criarPerfilManual,
    onSuccess: () => {
      invalidarP()
      setNovoAberto(false)
    },
  })
  const salvarManualMut = useMutation({
    mutationFn: ({ id, dados, extras }: { id: string; dados: PerfilManual; extras: Record<string, string> }) =>
      atualizarPerfilManual(id, dados, extras),
    onSuccess: () => {
      invalidarP()
      setEditParticipante(null)
    },
  })
  const excluirParticipanteMut = useMutation({
    mutationFn: excluirParticipante,
    onSuccess: invalidarP,
  })

  /**
   * Ativa/desativa um USUÁRIO da plataforma (com login). Nunca apaga o cadastro
   * nem o login — só muda o status, para poder reativar depois.
   */
  function definirAtivoUsuario(u: Usuario, ativar: boolean) {
    salvarUsuarioMut.mutate({
      id: u.id,
      dados: {
        nome: u.nome,
        telefone: u.telefone,
        instituicaoId: u.instituicao?.id,
        status: ativar ? 'ativo' : 'inativo',
      },
    })
  }

  // ---------- Lista unificada ----------
  const pessoas = useMemo<LinhaPessoa[]>(() => {
    const deUsuarios: LinhaPessoa[] = usuarios.map((u) => ({
      key: `u-${u.id}`,
      tipo: 'usuario',
      nome: u.nome,
      fotoUrl: u.fotoUrl,
      papel: u.funcao?.nome || 'Pesquisador',
      temAcesso: true,
      ativo: u.status === 'ativo',
      cpf: u.cpf,
      curso: u.curso,
      email: u.email,
      telefone: u.telefone,
      whatsapp: u.whatsapp,
      horarios: horariosPorUsuario[u.id] ?? [],
      usuario: u,
    }))
    const deParticipantes: LinhaPessoa[] = participantes.map((p) => {
      const extras = p.dadosExtras ?? {}
      return {
        key: `p-${p.id}`,
        tipo: 'participante',
        nome: p.nome,
        papel: extras.funcaoPretendida ?? 'Aluno',
        temAcesso: false,
        ativo: (p.status ?? 'ativo') === 'ativo',
        cpf: p.cpf,
        curso: p.curso,
        email: p.email,
        telefone: p.telefone,
        whatsapp: extras.whatsapp,
        horarios: [],
        participante: p,
      }
    })
    return [...deUsuarios, ...deParticipantes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [usuarios, participantes, horariosPorUsuario])

  const cursos = useMemo(() => {
    const s = new Set<string>()
    for (const p of pessoas) if (p.curso) s.add(p.curso)
    return [...s].sort()
  }, [pessoas])

  // Quem pode ser responsável por um aluno/IC: os usuários da plataforma.
  const responsaveis = useMemo(
    () => usuarios.map((u) => ({ id: u.id, nome: u.nome })),
    [usuarios],
  )

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const qDigitos = q.replace(/\D/g, '')
    return pessoas.filter((p) => {
      if (tipoFiltro !== 'todos' && p.tipo !== tipoFiltro) return false
      if (cursoFiltro !== 'todos' && p.curso !== cursoFiltro) return false
      if (!q) return true
      return (
        p.nome.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.papel ?? '').toLowerCase().includes(q) ||
        (qDigitos.length >= 3 && (p.cpf ?? '').includes(qDigitos))
      )
    })
  }, [pessoas, busca, tipoFiltro, cursoFiltro])

  const kpis = useMemo(
    () => ({
      total: pessoas.length,
      comAcesso: usuarios.length,
      semAcesso: participantes.length,
      cursos: cursos.length,
    }),
    [pessoas, usuarios, participantes, cursos],
  )

  function exportarCSV() {
    const cabecalho = ['Nome', 'Papel', 'Tem acesso', 'CPF', 'Curso', 'E-mail', 'Telefone']
    const linhas = filtrados.map((p) => [
      p.nome,
      p.papel,
      p.temAcesso ? 'Sim' : 'Não',
      p.cpf ?? '',
      p.curso ?? '',
      p.email ?? '',
      p.telefone ?? '',
    ])
    const csv = [cabecalho, ...linhas]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pesquisadores-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell
      actions={
        <>
          {pessoas.length > 0 && (
            <Button variant="secondary" icon={Download} onClick={exportarCSV}>
              Exportar CSV
            </Button>
          )}
          <Button variant="secondary" icon={Upload} onClick={() => setWizardAberto(true)}>
            Importar planilha
          </Button>
          <Button icon={UserPlus} onClick={() => setNovoAberto(true)}>
            Adicionar
          </Button>
        </>
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Users2} value={kpis.total} label="Pessoas" hint="No total" accent="green" />
        <StatCard icon={ShieldCheck} value={kpis.comAcesso} label="Com acesso" hint="Têm login" accent="blue" />
        <StatCard icon={GraduationCap} value={kpis.semAcesso} label="Sem acesso" hint="Alunos / manuais" accent="amber" />
        <StatCard icon={GraduationCap} value={kpis.cursos} label="Cursos" hint="Distintos" accent="violet" />
      </div>

      {/* Erro ao ler participantes (tabela ausente etc.) */}
      {erroP && (
        <div className="card mb-4 flex items-start gap-3 border-red-200 p-4 dark:border-red-500/30">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="text-sm">
            <p className="font-semibold text-red-700 dark:text-red-400">
              Não foi possível carregar os perfis sem login
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{(erroP as Error).message}</p>
            <p className="mt-2 text-xs text-slate-500">
              Rode o
              <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
                docs/supabase-participantes.sql
              </code>
              no SQL Editor do Supabase.
            </p>
          </div>
        </div>
      )}

      {/* Busca + filtros */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, papel, CPF ou e-mail…"
            className="pl-9"
          />
        </div>
        <Select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as typeof tipoFiltro)}>
          <option value="todos">Todos</option>
          <option value="usuario">Com acesso</option>
          <option value="participante">Sem acesso</option>
        </Select>
        <Select value={cursoFiltro} onChange={(e) => setCursoFiltro(e.target.value)}>
          <option value="todos">Todos os cursos</option>
          {cursos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Pessoa</th>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Curso</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Horários</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {carregando ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Carregando…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Nenhuma pessoa encontrada.
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => (
                  <tr
                    key={p.key}
                    onClick={() => setDetalhe(p)}
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      p.ativo ? '' : 'opacity-60'
                    }`}
                  >
                    {/* Pessoa */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nome={p.nome} fotoUrl={p.fotoUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                            {p.nome}
                          </p>
                          <p className="truncate text-xs text-slate-400">{p.email ?? 'sem e-mail'}</p>
                        </div>
                      </div>
                    </td>
                    {/* Papel */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={
                            p.temAcesso
                              ? 'inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                              : 'inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }
                        >
                          {p.papel}
                          {!p.temAcesso && ' · sem acesso'}
                        </span>
                        {!p.ativo && (
                          <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
                            Inativo
                          </span>
                        )}
                      </div>
                    </td>
                    {/* CPF */}
                    <td className="px-4 py-3 text-slate-500">{p.cpf ? mascararCPF(p.cpf) : '—'}</td>
                    {/* Curso */}
                    <td className="px-4 py-3 text-slate-500">{p.curso ?? '—'}</td>
                    {/* Contato */}
                    <td className="px-4 py-3 text-slate-500">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {p.telefone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {p.telefone}
                          </span>
                        )}
                        {p.whatsapp && (
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" /> {p.whatsapp}
                          </span>
                        )}
                        {!p.telefone && !p.whatsapp && p.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {p.email}
                          </span>
                        )}
                        {!p.telefone && !p.whatsapp && !p.email && '—'}
                      </div>
                    </td>
                    {/* Horários */}
                    <td className="px-4 py-3 text-slate-500">
                      {p.temAcesso ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {resumoHorario(p.horarios)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            p.tipo === 'usuario'
                              ? setEditUsuario(p.usuario!)
                              : setEditParticipante(p.participante!)
                          }
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                          aria-label={`Editar ${p.nome}`}
                          title="Editar dados"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {p.tipo === 'participante' ? (
                          // Sem login (aluno da planilha / manual) → pode EXCLUIR do banco.
                          <button
                            onClick={() => setAConfirmar({ p, acao: 'excluir' })}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                            aria-label={`Excluir ${p.nome}`}
                            title="Excluir do banco"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : p.ativo ? (
                          // Com login → só DESATIVAR (nunca apaga).
                          <button
                            onClick={() => setAConfirmar({ p, acao: 'desativar' })}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                            aria-label={`Desativar ${p.nome}`}
                            title="Desativar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => p.usuario && definirAtivoUsuario(p.usuario, true)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                            aria-label={`Reativar ${p.nome}`}
                            title="Reativar"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Mostrando {filtrados.length} de {pessoas.length} pessoas. O CPF aparece parcialmente oculto
        por proteção de dados. Clique numa linha para ver todos os detalhes.
      </p>

      {/* Histórico de importações */}
      {importacoes.length > 0 && (
        <div className="card mt-6 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <History className="h-4 w-4 text-slate-400" />
            Histórico de importações
          </h3>
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {importacoes.map((imp) => (
              <li key={imp.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">{imp.arquivo}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(imp.criadoEm).toLocaleString('pt-BR')}
                    {imp.autorNome && ` · por ${imp.autorNome}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-brand-50 px-2 py-1 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    {imp.criados} novos
                  </span>
                  <span className="rounded-md bg-sky-50 px-2 py-1 font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                    {imp.atualizados} atualizados
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Modais ---------- */}

      {/* Detalhe (clique na linha) */}
      <PessoaDetailModal
        usuario={detalhe?.usuario}
        participante={detalhe?.participante}
        onClose={() => setDetalhe(null)}
      />

      {/* Editar usuário da plataforma */}
      {editUsuario && (
        <EditarUsuarioModal
          usuario={editUsuario}
          open={Boolean(editUsuario)}
          onClose={() => setEditUsuario(null)}
          onSalvar={(dados) => salvarUsuarioMut.mutate({ id: editUsuario.id, dados })}
          salvando={salvarUsuarioMut.isPending}
        />
      )}

      {/* Editar perfil sem login */}
      {editParticipante && (
        <PessoaFormModal
          open={Boolean(editParticipante)}
          onClose={() => setEditParticipante(null)}
          titulo="Editar dados"
          inicial={participanteParaPerfil(editParticipante)}
          responsaveis={responsaveis}
          salvando={salvarManualMut.isPending}
          onSalvar={(dados) =>
            salvarManualMut.mutate({
              id: editParticipante.id,
              dados,
              extras: editParticipante.dadosExtras ?? {},
            })
          }
        />
      )}

      {/* Adicionar manualmente */}
      {novoAberto && (
        <PessoaFormModal
          open={novoAberto}
          onClose={() => setNovoAberto(false)}
          responsaveis={responsaveis}
          salvando={criarManualMut.isPending}
          onSalvar={(dados) => criarManualMut.mutate(dados)}
        />
      )}

      {/* Importar planilha */}
      <ImportWizard
        open={wizardAberto}
        onClose={() => setWizardAberto(false)}
        onConcluido={() => {
          invalidarP()
          qc.invalidateQueries({ queryKey: ['importacoes'] })
        }}
      />

      {/* Confirmação: desativar (com login) ou excluir (sem login) */}
      <ConfirmDialog
        open={Boolean(aConfirmar)}
        onClose={() => setAConfirmar(null)}
        onConfirm={() => {
          if (aConfirmar?.acao === 'excluir' && aConfirmar.p.participante) {
            excluirParticipanteMut.mutate(aConfirmar.p.participante.id)
          } else if (aConfirmar?.acao === 'desativar' && aConfirmar.p.usuario) {
            definirAtivoUsuario(aConfirmar.p.usuario, false)
          }
          setAConfirmar(null)
        }}
        title={aConfirmar?.acao === 'excluir' ? 'Excluir pessoa' : 'Desativar pessoa'}
        message={
          aConfirmar?.acao === 'excluir'
            ? `Excluir "${aConfirmar?.p.nome}" de vez? Este perfil sem login (importado da planilha ou cadastro manual) será removido do banco. Não dá para desfazer.`
            : `Desativar "${aConfirmar?.p.nome}"? A pessoa perde o acesso à plataforma, mas o cadastro e o histórico são mantidos — nada é apagado do banco e dá para reativar depois.`
        }
        confirmLabel={aConfirmar?.acao === 'excluir' ? 'Excluir' : 'Desativar'}
        variant="danger"
      />
    </AdminShell>
  )
}
