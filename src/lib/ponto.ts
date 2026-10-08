import type { RegistroPonto, TipoPonto } from '@/types'

/** Rótulo amigável de cada tipo de registro. */
export const TIPO_PONTO_LABEL: Record<TipoPonto, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  falta: 'Falta',
}

/** Cores (badge) por tipo de registro. */
export const TIPO_PONTO_COR: Record<TipoPonto, string> = {
  entrada: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  saida: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  falta: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

/** Formata um ISO completo como "dd/mm/aaaa às HH:MM:SS". */
export function formatarDataHoraPonto(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`
}

/** Só o horário, "HH:MM:SS". */
export function formatarHoraPonto(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR')
}

/** Converte um Date local para o formato aceito por `<input type="datetime-local">`. */
export function paraDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Converte um Date local para o formato de `<input type="date">` (yyyy-mm-dd). */
export function paraDateLocal(iso: string): string {
  return paraDatetimeLocal(iso).slice(0, 10)
}

/** Dia inteiro (`<input type="date">`) → ISO ao meio-dia local (evita virar o dia por fuso). */
export function deDateLocal(valor: string): string {
  return new Date(`${valor}T12:00:00`).toISOString()
}

/** Converte o valor de um `<input type="datetime-local">` de volta para ISO. */
export function deDatetimeLocal(valor: string): string {
  return new Date(valor).toISOString()
}

/** URL funcional que o QR Code do pesquisador deve conter — abre direto em /ponto/:token. */
export function urlRegistroPonto(token: string): string {
  return `${window.location.origin}/ponto/${token}`
}

// ============================================================
// Frequência — agrupa registros soltos (entrada/saída) em "dias" e resume
// por pesquisador. Usado pelo painel administrativo e pelo relatório mensal.
// ============================================================

/** yyyy-mm-dd no fuso local. */
function localDia(iso: string): string {
  return paraDateLocal(iso)
}

/** Um par entrada/saída de um dia (ou um lado órfão, quando falta o par). */
export interface DiaFrequencia {
  usuarioId: string
  usuarioNome: string
  /** Data (yyyy-mm-dd) da entrada — ou da saída, se for um registro órfão. */
  data: string
  entrada?: RegistroPonto
  saida?: RegistroPonto
  /** true quando só tem entrada OU só saída (sem o par). */
  incompleto: boolean
  /** true quando qualquer um dos dois lados foi corrigido/lançado manualmente. */
  corrigido: boolean
  /** Registro de falta (dia inteiro) lançado pelo admin — não tem entrada/saída. */
  falta?: RegistroPonto
}

/**
 * Agrupa uma lista de registros (já filtrada por período) em dias
 * trabalhados por pesquisador, casando ENTRADA com a SAÍDA seguinte.
 * Não conta simplesmente "quantidade de leituras" — segue a sequência
 * real entrada→saída→entrada→saída de cada pessoa.
 */
export function agruparPorDia(registros: RegistroPonto[]): DiaFrequencia[] {
  const porUsuario = new Map<string, RegistroPonto[]>()
  for (const r of registros) {
    const lista = porUsuario.get(r.usuarioId) ?? []
    lista.push(r)
    porUsuario.set(r.usuarioId, lista)
  }

  const dias: DiaFrequencia[] = []
  for (const [usuarioId, lista] of porUsuario) {
    const ordenados = [...lista].sort((a, b) => a.registradoEm.localeCompare(b.registradoEm))
    const nome = ordenados[0]?.usuarioNome ?? ''
    let aberto: DiaFrequencia | null = null

    for (const r of ordenados) {
      if (r.tipo === 'falta') {
        // Falta é um dia à parte: não entra no pareamento entrada→saída.
        dias.push({
          usuarioId,
          usuarioNome: nome,
          data: localDia(r.registradoEm),
          falta: r,
          incompleto: false,
          corrigido: r.editado,
        })
      } else if (r.tipo === 'entrada') {
        if (aberto) dias.push(aberto) // entrada anterior nunca teve saída — fecha como incompleta
        aberto = {
          usuarioId,
          usuarioNome: nome,
          data: r.registradoEm.slice(0, 10),
          entrada: r,
          incompleto: true,
          corrigido: r.editado,
        }
      } else if (aberto) {
        aberto.saida = r
        aberto.incompleto = false
        aberto.corrigido = aberto.corrigido || r.editado
        dias.push(aberto)
        aberto = null
      } else {
        // Saída sem entrada correspondente no período (ex.: entrada ficou fora do filtro).
        dias.push({
          usuarioId,
          usuarioNome: nome,
          data: r.registradoEm.slice(0, 10),
          saida: r,
          incompleto: true,
          corrigido: r.editado,
        })
      }
    }
    if (aberto) dias.push(aberto)
  }

  return dias.sort((a, b) => b.data.localeCompare(a.data) || a.usuarioNome.localeCompare(b.usuarioNome, 'pt-BR'))
}

/** Resumo mensal (ou de qualquer período) por pesquisador — base do relatório .xlsx. */
export interface ResumoFrequencia {
  usuarioId: string
  usuarioNome: string
  diasTrabalhados: number
  entradas: number
  saidas: number
  incompletos: number
  corrigidos: number
  faltas: number
  /** Soma das horas de dias com entrada E saída válidas. */
  horasTrabalhadas: number
}

export function resumirFrequencia(dias: DiaFrequencia[]): ResumoFrequencia[] {
  const porUsuario = new Map<string, ResumoFrequencia>()
  for (const d of dias) {
    let r = porUsuario.get(d.usuarioId)
    if (!r) {
      r = {
        usuarioId: d.usuarioId,
        usuarioNome: d.usuarioNome,
        diasTrabalhados: 0,
        entradas: 0,
        saidas: 0,
        incompletos: 0,
        corrigidos: 0,
        faltas: 0,
        horasTrabalhadas: 0,
      }
      porUsuario.set(d.usuarioId, r)
    }
    if (d.falta) {
      r.faltas++
      continue
    }
    if (d.entrada) r.entradas++
    if (d.saida) r.saidas++
    if (d.corrigido) r.corrigidos++
    if (d.incompleto) {
      r.incompletos++
    } else if (d.entrada && d.saida) {
      r.diasTrabalhados++
      const horas = (new Date(d.saida.registradoEm).getTime() - new Date(d.entrada.registradoEm).getTime()) / 3_600_000
      if (horas > 0) r.horasTrabalhadas += horas
    }
  }
  return [...porUsuario.values()].sort((a, b) => a.usuarioNome.localeCompare(b.usuarioNome, 'pt-BR'))
}

/** "7h30" a partir de horas fracionárias (7.5). */
export function formatarHoras(horas: number): string {
  const totalMin = Math.round(horas * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

/**
 * Exporta o relatório mensal de frequência em .xlsx (SheetJS — mesma
 * biblioteca já usada em src/lib/planilha.ts para importar planilhas).
 * Import dinâmico: só baixa a lib quando alguém realmente exporta.
 */
export async function exportarFrequenciaXlsx(
  resumo: ResumoFrequencia[],
  opcoes: { mes: number; ano: number; registros?: RegistroPonto[] },
): Promise<void> {
  const XLSX = await import('xlsx')

  const nomeMes = new Date(opcoes.ano, opcoes.mes - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  // Observações: motivo de todo registro corrigido ou lançado manualmente (faltas inclusas).
  const comObservacao = (opcoes.registros ?? [])
    .filter((r) => r.editado || r.origem === 'manual')
    .sort((a, b) => (a.usuarioNome ?? '').localeCompare(b.usuarioNome ?? '', 'pt-BR') || a.registradoEm.localeCompare(b.registradoEm))
  const dataCurta = (r: RegistroPonto) => new Date(r.registradoEm).toLocaleDateString('pt-BR')
  const horaDe = (r: RegistroPonto) => (r.tipo === 'falta' ? '—' : formatarHoraPonto(r.registradoEm))
  const textoObs = (r: RegistroPonto) => `${dataCurta(r)} (${TIPO_PONTO_LABEL[r.tipo].toLowerCase()}): ${r.motivoEdicao ?? 'sem motivo informado'}`
  const obsPorUsuario = new Map<string, string[]>()
  for (const r of comObservacao) {
    const lista = obsPorUsuario.get(r.usuarioId) ?? []
    lista.push(textoObs(r))
    obsPorUsuario.set(r.usuarioId, lista)
  }

  const linhas = resumo.map((r) => ({
    Pesquisador: r.usuarioNome,
    'Dias trabalhados': r.diasTrabalhados,
    Entradas: r.entradas,
    Saídas: r.saidas,
    Faltas: r.faltas,
    'Registros incompletos': r.incompletos,
    'Registros corrigidos/manuais': r.corrigidos,
    'Horas trabalhadas': formatarHoras(r.horasTrabalhadas),
    Observações: (obsPorUsuario.get(r.usuarioId) ?? []).join(' | '),
  }))

  const ws = XLSX.utils.json_to_sheet(linhas)
  ws['!cols'] = [
    { wch: 28 }, // Pesquisador
    { wch: 16 }, // Dias trabalhados
    { wch: 10 }, // Entradas
    { wch: 10 }, // Saídas
    { wch: 10 }, // Faltas
    { wch: 20 }, // Registros incompletos
    { wch: 24 }, // Registros corrigidos/manuais
    { wch: 16 }, // Horas trabalhadas
    { wch: 70 }, // Observações
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Frequência')

  // Segunda aba: um registro por linha, com o motivo e quem lançou/corrigiu.
  const linhasObs = comObservacao.map((r) => ({
    Pesquisador: r.usuarioNome ?? '',
    Data: dataCurta(r),
    Tipo: TIPO_PONTO_LABEL[r.tipo],
    Horário: horaDe(r),
    Origem: r.origem === 'manual' ? 'Lançamento manual' : 'Corrigido',
    Observação: r.motivoEdicao ?? '',
    'Lançado/corrigido por': r.criadoPorNome ?? '',
  }))
  const wsObs = XLSX.utils.json_to_sheet(
    linhasObs.length > 0
      ? linhasObs
      : [{ Pesquisador: '', Data: '', Tipo: '', Horário: '', Origem: '', Observação: 'Nenhum registro corrigido ou lançado manualmente no período.', 'Lançado/corrigido por': '' }],
  )
  wsObs['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 60 }, { wch: 26 }]
  XLSX.utils.book_append_sheet(wb, wsObs, 'Observações')
  XLSX.writeFile(wb, `frequencia-ponto-${nomeMes.replace(' ', '-')}.xlsx`)
}
