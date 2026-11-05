import { Textarea } from '@/components/ui/Field'
import type { QuestaoDef, RespostaTriagem, SimNao } from '@/lib/agendamento'
import { cn } from '@/lib/utils'

/** Botões de opção estilizados (radio de verdade por baixo, acessível por teclado). */
export function Opcoes<T extends string>({
  nome,
  valor,
  opcoes,
  onChange,
}: {
  nome: string
  valor: T | ''
  opcoes: { valor: T; rotulo: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {opcoes.map((o) => {
        const ativo = valor === o.valor
        return (
          <label
            key={o.valor}
            className={cn(
              'cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors',
              ativo
                ? 'border-brand-600 bg-brand-50 font-medium text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={ativo}
              onChange={() => onChange(o.valor)}
              className="sr-only"
            />
            {o.rotulo}
          </label>
        )
      })}
    </div>
  )
}

/**
 * Pergunta Sim/Não da triagem. Quando a questão pede detalhe, o campo só aparece (e só aceita
 * escrita) se a resposta for "Sim"; ao voltar para "Não" ele some e o texto é descartado.
 */
export function QuestaoSimNao({
  questao,
  valor,
  erro,
  onChange,
}: {
  questao: QuestaoDef
  valor: RespostaTriagem
  erro?: string
  onChange: (r: RespostaTriagem) => void
}) {
  const id = `q-${questao.chave}`
  return (
    <div id={id} className={cn('rounded-xl border bg-white p-3 dark:bg-slate-900', erro ? 'border-red-300 dark:border-red-500/40' : 'border-slate-200 dark:border-slate-700')}>
      <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">
        {questao.numero}. {questao.texto} <span className="text-red-500">*</span>
      </p>
      <Opcoes<SimNao>
        nome={id}
        valor={valor.resposta}
        opcoes={[
          { valor: 'Sim', rotulo: 'Sim' },
          { valor: 'Não', rotulo: 'Não' },
        ]}
        onChange={(resposta) => onChange({ resposta, detalhe: resposta === 'Sim' ? valor.detalhe : '' })}
      />
      {valor.resposta === 'Sim' && questao.detalhe && (
        <div className="mt-3">
          <label htmlFor={`${id}-detalhe`} className="mb-1 block text-xs font-medium text-slate-500">
            {questao.detalhe} <span className="text-red-500">*</span>
          </label>
          <Textarea
            id={`${id}-detalhe`}
            value={valor.detalhe}
            onChange={(e) => onChange({ resposta: 'Sim', detalhe: e.target.value })}
            placeholder="Escreva aqui…"
            className="min-h-[64px]"
          />
        </div>
      )}
      {erro && <p className="mt-2 text-xs text-red-500">{erro}</p>}
    </div>
  )
}
