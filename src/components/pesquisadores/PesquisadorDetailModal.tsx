import { Mail, Phone, Building2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { DisponibilidadeBadge } from '@/components/ui/Badge'
import { rotuloDia, ordemDias } from '@/lib/horarios'
import { textoLivre } from '@/lib/pesquisadores'
import { horarioPadrao } from '@/data/mock'
import type { Usuario } from '@/types'

/**
 * Modal de detalhe (somente leitura) de um pesquisador, aberto ao clicar
 * num card do diretório. Mostra contato, áreas e o horário semanal.
 * (O horário usa `horarioPadrao` do mock; na Fase 4 virá do banco por usuário.)
 */
export function PesquisadorDetailModal({
  usuario,
  onClose,
}: {
  usuario: Usuario | null
  onClose: () => void
}) {
  const livre = usuario ? textoLivre(usuario) : ''

  return (
    <Modal
      open={Boolean(usuario)}
      onClose={onClose}
      size="lg"
      title={usuario?.nome ?? ''}
      subtitle={usuario?.funcao.nome}
    >
      {usuario && (
        <div className="space-y-5">
          {/* Cabeçalho: avatar + status */}
          <div className="flex items-center gap-4">
            <Avatar nome={usuario.nome} fotoUrl={usuario.fotoUrl} size="lg" />
            <div className="space-y-1">
              <DisponibilidadeBadge status={usuario.disponibilidade} />
              {livre && <p className="text-sm text-brand-600 dark:text-brand-400">{livre}</p>}
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" /> {usuario.email}
            </span>
            {usuario.telefone && (
              <span className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" /> {usuario.telefone}
              </span>
            )}
            {usuario.instituicao && (
              <span className="inline-flex items-center gap-2 sm:col-span-2">
                <Building2 className="h-4 w-4 text-slate-400" /> {usuario.instituicao.sigla} —{' '}
                {usuario.instituicao.nome}
              </span>
            )}
          </div>

          {/* Áreas */}
          {usuario.areas.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Áreas de atuação
              </p>
              <div className="flex flex-wrap gap-2">
                {usuario.areas.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.cor }} />
                    {a.nome}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Horário semanal (leitura) */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Horário da semana
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
              {ordemDias.map((dia) => {
                const h = horarioPadrao.find((x) => x.dia === dia)
                const blocos: string[] = []
                if (h?.manha.ativo) blocos.push(`${h.manha.inicio}–${h.manha.fim}`)
                if (h?.tarde.ativo) blocos.push(`${h.tarde.inicio}–${h.tarde.fim}`)
                return (
                  <div
                    key={dia}
                    className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-0 dark:border-slate-800"
                  >
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {rotuloDia[dia]}
                    </span>
                    <span className={blocos.length ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>
                      {blocos.length ? blocos.join('  •  ') : 'Indisponível'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
