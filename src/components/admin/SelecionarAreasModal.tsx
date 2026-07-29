import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { listarAreas } from '@/data/api'
import { cn } from '@/lib/utils'

/**
 * Modal para escolher as áreas de atuação de um pesquisador.
 * Lista todas as áreas cadastradas; clicar marca/desmarca.
 */
export function SelecionarAreasModal({
  open,
  onClose,
  areasAtuais,
  onSalvar,
  salvando,
}: {
  open: boolean
  onClose: () => void
  /** ids das áreas que o usuário já tem */
  areasAtuais: string[]
  onSalvar: (areaIds: string[]) => void
  salvando?: boolean
}) {
  const { data: areas = [] } = useQuery({ queryKey: ['areas'], queryFn: listarAreas })
  const [selecionadas, setSelecionadas] = useState<string[]>(areasAtuais)
  const [busca, setBusca] = useState('')

  function alternar(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    )
  }

  const filtradas = areas.filter((a) =>
    a.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Áreas de atuação"
      subtitle="Marque as especialidades deste pesquisador."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSalvar(selecionadas)} disabled={salvando}>
            {salvando ? 'Salvando...' : `Salvar (${selecionadas.length})`}
          </Button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar área..."
          className="pl-9"
        />
      </div>

      {areas.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Nenhuma área cadastrada. Crie em <strong>Administração &gt; Áreas de Atuação</strong>.
        </p>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {filtradas.map((a) => {
            const marcada = selecionadas.includes(a.id)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => alternar(a.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  marcada
                    ? 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    marcada
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 dark:border-slate-600',
                  )}
                >
                  {marcada && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.cor }} />
                <span className="text-sm text-slate-700 dark:text-slate-200">{a.nome}</span>
              </button>
            )
          })}
          {filtradas.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">Nenhuma área encontrada.</p>
          )}
        </div>
      )}
    </Modal>
  )
}
