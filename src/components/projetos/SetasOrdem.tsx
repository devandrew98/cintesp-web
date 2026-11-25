import { ChevronDown, ChevronUp } from 'lucide-react'

/** Botões "subir / descer" para o ADM organizar grupos e tarefas (funciona no toque e no teclado). */
export function SetasOrdem({ nome, primeiro, ultimo, ocupado, onMover }: { nome: string; primeiro: boolean; ultimo: boolean; ocupado?: boolean; onMover: (passo: -1 | 1) => void }) {
  const classe = 'rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-25 dark:hover:bg-slate-800'
  return (
    <span className="inline-flex shrink-0 flex-col">
      <button type="button" className={classe} disabled={primeiro || ocupado} onClick={() => onMover(-1)} aria-label={`Subir ${nome}`} title="Subir">
        <ChevronUp className="h-4 w-4" />
      </button>
      <button type="button" className={classe} disabled={ultimo || ocupado} onClick={() => onMover(1)} aria-label={`Descer ${nome}`} title="Descer">
        <ChevronDown className="h-4 w-4" />
      </button>
    </span>
  )
}
