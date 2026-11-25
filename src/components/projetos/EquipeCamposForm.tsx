import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { Field, Select } from '@/components/ui/Field'
import { GRUPOS_PERMISSOES } from '@/lib/projetos'
import { cn } from '@/lib/utils'
import type { CampoEditavelProjeto, Usuario } from '@/types'

/**
 * Bloco reutilizável: responsável + pesquisadores vinculados + campos que os
 * demais vinculados podem editar. Usado na criação (ProjetoFormModal) e na
 * edição de equipe (ProjetoDetailModal, só admin/criador).
 */
export function EquipeCamposForm({
  pesquisadores,
  responsavelId,
  onResponsavelChange,
  membrosIds,
  onAlternarMembro,
  camposLiberados,
  onAlternarCampo,
}: {
  pesquisadores: Usuario[]
  responsavelId: string
  onResponsavelChange: (id: string) => void
  membrosIds: string[]
  onAlternarMembro: (id: string) => void
  camposLiberados: CampoEditavelProjeto[]
  onAlternarCampo: (campo: CampoEditavelProjeto) => void
}) {
  const candidatosMembro = useMemo(
    () => pesquisadores.filter((p) => p.id !== responsavelId),
    [pesquisadores, responsavelId],
  )

  return (
    <>
      <Field label="Pesquisador responsável" hint="Pode editar o projeto por completo, como o administrador.">
        <Select value={responsavelId} onChange={(e) => onResponsavelChange(e.target.value)}>
          <option value="">— Selecione o responsável —</option>
          {pesquisadores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={`Pesquisadores vinculados${membrosIds.length > 0 ? ` — ${membrosIds.length} selecionado(s)` : ''}`}
        hint="Além do responsável. Todos veem o projeto; só quem está vinculado vê o plano de trabalho."
      >
        {!responsavelId ? (
          <p className="text-xs text-slate-400">Escolha o responsável primeiro.</p>
        ) : candidatosMembro.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum outro pesquisador disponível.</p>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
            {candidatosMembro.map((p) => {
              const marcado = membrosIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAlternarMembro(p.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    marcado
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      marcado ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600',
                    )}
                  >
                    {marcado && <Check className="h-3 w-3" />}
                  </span>
                  {p.nome}
                </button>
              )
            })}
          </div>
        )}
      </Field>

      {/* Não usa <Field>: ele é um <label>, e um clique no texto acionaria o primeiro botão. */}
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">O que os colaboradores podem fazer</legend>
        {GRUPOS_PERMISSOES.map((g) => (
          <div key={g.titulo}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.titulo}</p>
            <div className="flex flex-wrap gap-2">
              {g.opcoes.map((c) => {
                const marcado = camposLiberados.includes(c.value)
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => onAlternarCampo(c.value)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      marcado
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
                    )}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <p className="text-xs text-slate-500">
          Sem nada marcado, o colaborador só consulta. O criador, o responsável e o administrador podem tudo — e só eles reordenam, concluem e conferem tarefas, mudam o título e a equipe.
        </p>
      </fieldset>
    </>
  )
}
