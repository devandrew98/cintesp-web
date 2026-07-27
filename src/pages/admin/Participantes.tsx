import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload,
  Search,
  Trash2,
  GraduationCap,
  Users2,
  History,
  Download,
  FileSpreadsheet,
} from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { StatCard } from '@/components/ui/StatCard'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ImportWizard } from '@/components/participantes/ImportWizard'
import { listarParticipantes, listarImportacoes, excluirParticipante } from '@/data/participantes'
import { mascararCPF } from '@/lib/cpf'
import { formatDateBR } from '@/lib/utils'
import type { Participante } from '@/types'

/**
 * Tela "Administração > Participantes".
 *
 * Lista os alunos/participantes importados de planilha, com busca e filtro
 * por curso, e dá acesso ao assistente de importação. Também mostra o
 * histórico das últimas importações (auditoria).
 */
export function AdminParticipantesPage() {
  const queryClient = useQueryClient()

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['participantes'],
    queryFn: listarParticipantes,
  })
  const { data: importacoes = [] } = useQuery({
    queryKey: ['importacoes'],
    queryFn: listarImportacoes,
  })

  const excluirMut = useMutation({
    mutationFn: excluirParticipante,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['participantes'] }),
  })

  const [busca, setBusca] = useState('')
  const [cursoFiltro, setCursoFiltro] = useState('todos')
  const [wizardAberto, setWizardAberto] = useState(false)
  const [aExcluir, setAExcluir] = useState<Participante | null>(null)

  // Lista de cursos distintos, para o filtro.
  const cursos = useMemo(() => {
    const s = new Set<string>()
    for (const p of lista) if (p.curso) s.add(p.curso)
    return [...s].sort()
  }, [lista])

  // Aplica busca (nome, CPF, matrícula, e-mail) + filtro de curso.
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const qDigitos = q.replace(/\D/g, '')
    return lista.filter((p) => {
      const bateCurso = cursoFiltro === 'todos' || p.curso === cursoFiltro
      if (!bateCurso) return false
      if (!q) return true
      return (
        p.nome.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.matricula ?? '').toLowerCase().includes(q) ||
        (qDigitos.length >= 3 && (p.cpf ?? '').includes(qDigitos))
      )
    })
  }, [lista, busca, cursoFiltro])

  /** Exporta a lista filtrada para CSV (mesmo padrão da tela de Relatórios). */
  function exportarCSV() {
    const cabecalho = ['Nome', 'CPF', 'Data de nascimento', 'Curso', 'Turma', 'Matrícula', 'E-mail', 'Telefone']
    const linhas = filtrados.map((p) => [
      p.nome,
      p.cpf ?? '',
      p.dataNascimento ?? '',
      p.curso ?? '',
      p.turma ?? '',
      p.matricula ?? '',
      p.email ?? '',
      p.telefone ?? '',
    ])
    // Escapa aspas e envolve cada campo, evitando quebrar o CSV.
    const csv = [cabecalho, ...linhas]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `participantes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell
      actions={
        <>
          {lista.length > 0 && (
            <Button variant="secondary" icon={Download} onClick={exportarCSV}>
              Exportar CSV
            </Button>
          )}
          <Button icon={Upload} onClick={() => setWizardAberto(true)}>
            Importar planilha
          </Button>
        </>
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users2} value={lista.length} label="Participantes" hint="Total cadastrado" accent="green" />
        <StatCard icon={GraduationCap} value={cursos.length} label="Cursos" hint="Distintos" accent="blue" />
        <StatCard
          icon={History}
          value={importacoes.length}
          label="Importações"
          hint="Últimas registradas"
          accent="violet"
        />
      </div>

      {/* Estado vazio: convida a importar */}
      {!isLoading && lista.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Nenhum participante cadastrado ainda
          </h3>
          <p className="max-w-md text-sm text-slate-500">
            Importe sua planilha (.xlsx ou .csv) para trazer os dados de uma vez. Você confere o
            mapeamento das colunas e o que será gravado antes de confirmar.
          </p>
          <Button icon={Upload} onClick={() => setWizardAberto(true)}>
            Importar planilha
          </Button>
        </div>
      ) : (
        <>
          {/* Busca + filtro */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, CPF, matrícula ou e-mail..."
                className="pl-9"
              />
            </div>
            <Select
              value={cursoFiltro}
              onChange={(e) => setCursoFiltro(e.target.value)}
              className="sm:w-64"
            >
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
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">CPF</th>
                    <th className="px-4 py-3">Nascimento</th>
                    <th className="px-4 py-3">Curso</th>
                    <th className="px-4 py-3">Contato</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        Carregando...
                      </td>
                    </tr>
                  ) : filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        Nenhum participante encontrado para esta busca.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                          {p.nome}
                          {p.matricula && (
                            <span className="ml-2 text-xs text-slate-400">#{p.matricula}</span>
                          )}
                        </td>
                        {/* CPF mascarado na listagem (LGPD) */}
                        <td className="px-4 py-3 text-slate-500">
                          {p.cpf ? mascararCPF(p.cpf) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {p.dataNascimento ? formatDateBR(p.dataNascimento) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {p.curso ?? '—'}
                          {p.turma && <span className="ml-1 text-xs text-slate-400">({p.turma})</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <div className="flex flex-col">
                            {p.email && <span className="truncate">{p.email}</span>}
                            {p.telefone && <span className="text-xs text-slate-400">{p.telefone}</span>}
                            {!p.email && !p.telefone && '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setAExcluir(p)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                            aria-label={`Excluir ${p.nome}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Mostrando {filtrados.length} de {lista.length} participantes. O CPF aparece parcialmente
            oculto por proteção de dados.
          </p>
        </>
      )}

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
                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {imp.arquivo}
                  </p>
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
                  {imp.erros > 0 && (
                    <span className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-600 dark:bg-red-500/15 dark:text-red-300">
                      {imp.erros} erros
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assistente de importação */}
      <ImportWizard
        open={wizardAberto}
        onClose={() => setWizardAberto(false)}
        onConcluido={() => {
          queryClient.invalidateQueries({ queryKey: ['participantes'] })
          queryClient.invalidateQueries({ queryKey: ['importacoes'] })
        }}
      />

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={Boolean(aExcluir)}
        onClose={() => setAExcluir(null)}
        onConfirm={() => {
          if (aExcluir) excluirMut.mutate(aExcluir.id)
          setAExcluir(null)
        }}
        title="Excluir participante"
        message={`Tem certeza que deseja excluir "${aExcluir?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </AdminShell>
  )
}
