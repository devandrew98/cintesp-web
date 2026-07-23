import { useState } from 'react'
import { Check, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { opcoesHorario, ordemDias, rotuloDia } from '@/lib/horarios'
import { cn } from '@/lib/utils'
import type { BlocoHorario, HorarioDia } from '@/types'

/**
 * Editor de "Horários de Disponibilidade" (aba Horários do detalhe do usuário).
 * Espelha o print 2: uma linha por dia, com blocos de Manhã e Tarde
 * (cada um com um checkbox de ativo + horário início/fim) e uma observação.
 *
 * O componente é AUTOSSUFICIENTE: guarda seu próprio estado. Para resetar ao
 * trocar de usuário, o pai deve passar `key={usuario.id}` — assim o React
 * recria o componente com os horários do novo usuário.
 */
export function HorarioEditor({
  horariosIniciais,
  onSalvar,
}: {
  horariosIniciais: HorarioDia[]
  /** Persiste os horários (ex.: Supabase). Se ausente, só confirma visualmente. */
  onSalvar?: (horarios: HorarioDia[]) => Promise<void>
}) {
  // Estado editável dos horários (cópia dos dados iniciais).
  const [horarios, setHorarios] = useState<HorarioDia[]>(() =>
    // Garante que todos os dias da semana existam, na ordem certa.
    ordemDias.map(
      (dia) =>
        horariosIniciais.find((h) => h.dia === dia) ?? {
          dia,
          manha: { ativo: false, inicio: '09:00', fim: '12:00' },
          tarde: { ativo: false, inicio: '13:00', fim: '18:00' },
          observacao: '',
        },
    ),
  )
  // Modo edição: quando false, os campos ficam desabilitados (só leitura).
  const [editando, setEditando] = useState(false)
  // Feedback visual após salvar ("Alterações salvas").
  const [salvo, setSalvo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  /** Atualiza um campo de um bloco (manhã/tarde) de um dia específico. */
  function atualizarBloco(
    dia: HorarioDia['dia'],
    turno: 'manha' | 'tarde',
    patch: Partial<BlocoHorario>,
  ) {
    setHorarios((prev) =>
      prev.map((h) => (h.dia === dia ? { ...h, [turno]: { ...h[turno], ...patch } } : h)),
    )
    setSalvo(false)
  }

  /** Atualiza a observação de um dia. */
  function atualizarObs(dia: HorarioDia['dia'], valor: string) {
    setHorarios((prev) => prev.map((h) => (h.dia === dia ? { ...h, observacao: valor } : h)))
    setSalvo(false)
  }

  /**
   * Salva as alterações. Em modo mock apenas confirma visualmente; na Fase 4
   * (Supabase) aqui entra o UPDATE na tabela `horarios`.
   */
  async function salvar() {
    if (onSalvar) {
      setSalvando(true)
      try {
        await onSalvar(horarios)
      } finally {
        setSalvando(false)
      }
    }
    setEditando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  return (
    <div className="card p-5">
      {/* Cabeçalho do card: título + toggle de edição + botão salvar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Horários de Disponibilidade
          </h3>
          <p className="text-sm text-slate-500">
            Ajuste os horários em que o pesquisador está disponível.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle "Editar horários" */}
          <button
            onClick={() => setEditando((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            Editar horários
            <span
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                editando ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  editando ? 'translate-x-[22px]' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>

          <Button icon={salvo ? Check : Save} disabled={!editando || salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : salvo ? 'Salvo!' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>

      {/* Cabeçalho das colunas (só no desktop) */}
      <div className="mt-5 hidden grid-cols-[150px_1fr_1fr_1.3fr] gap-4 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 lg:grid">
        <span>Dia da Semana</span>
        <span>Manhã</span>
        <span>Tarde</span>
        <span>Observação</span>
      </div>

      {/* Uma linha por dia */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {horarios.map((h) => (
          <div
            key={h.dia}
            className="grid grid-cols-1 gap-4 py-4 lg:grid-cols-[150px_1fr_1fr_1.3fr] lg:items-center"
          >
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {rotuloDia[h.dia]}
            </span>

            <BlocoTurno
              turno="manha"
              bloco={h.manha}
              editando={editando}
              onToggle={(ativo) => atualizarBloco(h.dia, 'manha', { ativo })}
              onInicio={(inicio) => atualizarBloco(h.dia, 'manha', { inicio })}
              onFim={(fim) => atualizarBloco(h.dia, 'manha', { fim })}
            />

            <BlocoTurno
              turno="tarde"
              bloco={h.tarde}
              editando={editando}
              onToggle={(ativo) => atualizarBloco(h.dia, 'tarde', { ativo })}
              onInicio={(inicio) => atualizarBloco(h.dia, 'tarde', { inicio })}
              onFim={(fim) => atualizarBloco(h.dia, 'tarde', { fim })}
            />

            <input
              type="text"
              value={h.observacao ?? ''}
              disabled={!editando}
              placeholder="—"
              onChange={(e) => atualizarObs(h.dia, e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-900"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Bloco de um turno (Manhã ou Tarde): checkbox de ativo + selects de início e fim.
 * Fica esmaecido/desabilitado quando o turno está inativo ou fora do modo edição.
 */
function BlocoTurno({
  turno,
  bloco,
  editando,
  onToggle,
  onInicio,
  onFim,
}: {
  turno: 'manha' | 'tarde'
  bloco: BlocoHorario
  editando: boolean
  onToggle: (ativo: boolean) => void
  onInicio: (v: string) => void
  onFim: (v: string) => void
}) {
  const desabilitado = !editando || !bloco.ativo
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={bloco.ativo}
        disabled={!editando}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`Ativar ${turno}`}
        className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
      />
      <select
        value={bloco.inicio}
        disabled={desabilitado}
        onChange={(e) => onInicio(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {opcoesHorario.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="text-xs text-slate-400">às</span>
      <select
        value={bloco.fim}
        disabled={desabilitado}
        onChange={(e) => onFim(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {opcoesHorario.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}
