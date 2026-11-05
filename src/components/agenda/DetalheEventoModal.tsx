import { CalendarDays, Clock3, ExternalLink, MapPin, Repeat, Video } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { rotuloQuando, rotuloRepeticao, type Ocorrencia } from '@/lib/agendaEquipe'
import { dataExtenso } from '@/lib/agendamento'

/** Detalhes de um evento (todos veem). O administrador ganha o botão Editar. */
export function DetalheEventoModal({
  ocorrencia,
  onClose,
  onEditar,
}: {
  ocorrencia: Ocorrencia | null
  onClose: () => void
  /** Só passado para administradores. */
  onEditar?: () => void
}) {
  const e = ocorrencia?.evento
  return (
    <Modal
      open={Boolean(ocorrencia)}
      onClose={onClose}
      title={e?.titulo ?? ''}
      footer={
        <>
          {onEditar && (
            <Button variant="secondary" onClick={onEditar}>
              Editar
            </Button>
          )}
          <Button onClick={onClose}>Fechar</Button>
        </>
      }
    >
      {ocorrencia && e && (
        <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <Linha icon={CalendarDays}>
            {ocorrencia.dataFim > ocorrencia.data ? `${dataExtenso(ocorrencia.data)} até ${dataExtenso(ocorrencia.dataFim)}` : dataExtenso(ocorrencia.data)}
          </Linha>
          <Linha icon={Clock3}>{rotuloQuando(ocorrencia)}</Linha>
          {e.repeticao !== 'nunca' && <Linha icon={Repeat}>{rotuloRepeticao(e.repeticao, e.data)}</Linha>}
          {e.local && <Linha icon={MapPin}>{e.local}</Linha>}
          {e.linkVideo && (
            <Linha icon={Video}>
              <a
                href={e.linkVideo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
              >
                Entrar na videoconferência <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Linha>
          )}
          {e.descricao && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{e.descricao}</p>}
        </ul>
      )}
    </Modal>
  )
}

function Linha({ icon: Icon, children }: { icon: typeof Clock3; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0">{children}</span>
    </li>
  )
}
