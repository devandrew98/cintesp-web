import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Users2, CheckCircle2, Building2, Shield } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { SectionCard } from '@/components/ui/SectionCard'
import { DonutChart } from '@/components/ui/DonutChart'
import { Button } from '@/components/ui/Button'
import { listarUsuarios, listarAreas, listarFuncoes, listarInstituicoes } from '@/data/api'
import type { Usuario } from '@/types'

/**
 * Tela "Relatórios" (Fase 6).
 * Indicadores agregados da equipe (status, áreas, funções, instituições) com
 * gráficos em SVG (sem libs) e exportação da lista de pesquisadores em CSV.
 */
export function RelatoriosPage() {
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: listarAreas })
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: listarFuncoes })
  const { data: instituicoes = [] } = useQuery({
    queryKey: ['instituicoes'],
    queryFn: listarInstituicoes,
  })

  const ativos = useMemo(() => usuarios.filter((u) => u.status === 'ativo'), [usuarios])

  // Distribuição por status de disponibilidade (donut).
  const porStatus = useMemo(
    () => [
      {
        label: 'Disponíveis',
        value: ativos.filter((u) => u.disponibilidade === 'disponivel').length,
        color: '#22c55e',
      },
      {
        label: 'Em atendimento',
        value: ativos.filter((u) => u.disponibilidade === 'em_atendimento').length,
        color: '#f59e0b',
      },
      {
        label: 'Ausentes',
        value: ativos.filter((u) => u.disponibilidade === 'ausente').length,
        color: '#ef4444',
      },
    ],
    [ativos],
  )

  // Pesquisadores por área (barras).
  const porArea = useMemo(
    () =>
      areas
        .map((a) => ({
          label: a.nome,
          value: usuarios.filter((u) => u.areas.some((x) => x.id === a.id)).length,
          color: a.cor,
        }))
        .sort((x, y) => y.value - x.value),
    [usuarios, areas],
  )

  // Pesquisadores por função (barras).
  const porFuncao = useMemo(
    () =>
      funcoes
        .map((f) => ({
          label: f.nome,
          value: usuarios.filter((u) => u.funcao.id === f.id).length,
          color: '#16a34a',
        }))
        .sort((x, y) => y.value - x.value),
    [usuarios, funcoes],
  )

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Indicadores da equipe e exportação de dados."
        actions={
          <Button icon={Download} onClick={() => exportarCSV(usuarios)} disabled={usuarios.length === 0}>
            Exportar CSV
          </Button>
        }
      />

      {/* KPIs gerais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users2} value={usuarios.length} label="Total de cadastros" accent="green" />
        <StatCard icon={CheckCircle2} value={ativos.length} label="Pesquisadores ativos" accent="blue" />
        <StatCard icon={Shield} value={funcoes.length} label="Funções" accent="violet" />
        <StatCard icon={Building2} value={instituicoes.length} label="Instituições" accent="amber" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Donut por status */}
        <SectionCard title="Disponibilidade da equipe">
          <div className="flex flex-col items-center gap-5 p-2">
            <DonutChart segments={porStatus} total={ativos.length} centerLabel="Ativos" />
            <div className="w-full space-y-2.5">
              {porStatus.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {s.value}{' '}
                    <span className="text-slate-400">
                      ({ativos.length ? Math.round((s.value / ativos.length) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Barras por área */}
        <SectionCard className="lg:col-span-2" title="Pesquisadores por área">
          <BarList data={porArea} />
        </SectionCard>
      </div>

      {/* Barras por função */}
      <div className="mt-6">
        <SectionCard title="Pesquisadores por função">
          <BarList data={porFuncao} />
        </SectionCard>
      </div>
    </div>
  )
}

/** Lista de barras horizontais (label + barra proporcional + valor). */
function BarList({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="space-y-3 p-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-slate-600 dark:text-slate-300" title={d.label}>
            {d.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium text-slate-700 dark:text-slate-200">
            {d.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Gera um CSV da lista de pesquisadores e dispara o download no navegador.
 * (Funcionalidade do app — roda 100% no cliente, sem servidor.)
 */
function exportarCSV(lista: Usuario[]) {
  const cabecalho = ['Nome', 'E-mail', 'Telefone', 'Função', 'Instituição', 'Áreas', 'Status', 'Disponibilidade']
  const linhas = lista.map((u) =>
    [
      u.nome,
      u.email,
      u.telefone ?? '',
      u.funcao.nome,
      u.instituicao?.sigla ?? '',
      u.areas.map((a) => a.nome).join('; '),
      u.status,
      u.disponibilidade,
    ]
      // Escapa aspas e envolve cada campo entre aspas.
      .map((campo) => `"${String(campo).replace(/"/g, '""')}"`)
      .join(','),
  )
  const csv = [cabecalho.join(','), ...linhas].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pesquisadores-cintesp-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
