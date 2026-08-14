import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { Field, Select } from '@/components/ui/Field'
import { CAMPOS_EDITAVEIS_PROJETO } from '@/lib/projetos'
import { cn } from '@/lib/utils'
import type { CampoEditavelProjeto, Usuario } from '@/types'

/**
 * Bloco reutilizável: responsável + pesquisadores vinculados + campos que os
 * demais vinculados podem editar. Usado na criação (ProjetoFormModal) e na
 * edição de equipe (ProjetoDetailModal, só admin).
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
        hint="Além do responsável. Só quem está vinculado vê o projeto e participa do chat."
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

      <Field
        label="Campos que os demais vinculados podem editar"
        hint="O responsável e o admin sempre podem editar tudo. Título, status e datas ficam sempre restritos a eles."
      >
        <div className="flex flex-wrap gap-2">
          {CAMPOS_EDITAVEIS_PROJETO.map((c) => {
            const marcado = camposLiberados.includes(c.value)
            return (
              <button
                key={c.value}
                type="button"
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
      </Field>
    </>
  )
}
