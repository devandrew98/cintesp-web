import { Calendar, Users, Pencil, Trash2, MessageCircle, Eye, Pin } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { tipoAvisoInfo, statusAvisoInfo, linkWhatsApp } from '@/lib/avisos'
import { cn, formatDateBR } from '@/lib/utils'
import type { Aviso } from '@/types'

/**
 * Modal de leitura de um aviso.
 *
 * Abre ao clicar no aviso na lista. Mostra o conteúdo completo e oferece
 * compartilhar no WhatsApp; para administradores, também editar e excluir.
 */
export function AvisoDetailModal({
  aviso,
  open,
  onClose,
  onEditar,
  onExcluir,
  podeGerenciar,
}: {
  aviso: Aviso
  open: boolean
  onClose: () => void
  onEditar?: () => void
  onExcluir?: () => void
  podeGerenciar?: boolean
}) {
  const info = tipoAvisoInfo[aviso.tipo]
  const status = statusAvisoInfo[aviso.status]
  const Icone = info.icon

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', info.iconBox)}>
            <Icone className="h-4 w-4" />
          </span>
          {aviso.titulo}
        </span>
      }
      footer={
        <>
          {podeGerenciar && onExcluir && (
            <Button variant="secondary" icon={Trash2} onClick={onExcluir} className="mr-auto">
              Excluir
            </Button>
          )}
          {/* Compartilhar abre o WhatsApp numa aba nova, com o texto pronto */}
          <a
            href={linkWhatsApp(aviso)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <MessageCircle className="h-4 w-4 text-brand-600" />
            Compartilhar
          </a>
          {podeGerenciar && onEditar && (
            <Button icon={Pencil} onClick={onEditar}>
              Editar
            </Button>
          )}
          {!podeGerenciar && <Button onClick={onClose}>Fechar</Button>}
        </>
      }
    >
      {/* Etiquetas */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
            info.pill,
          )}
        >
          {info.label}
        </span>
        <Badge tone={status.tone as 'green' | 'amber' | 'slate'}>{status.label}</Badge>
        {aviso.destaque && (
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            <Pin className="h-3 w-3 -rotate-45 fill-current" />
            Em destaque
          </span>
        )}
      </div>

      {/* Texto do aviso (respeita as quebras de linha digitadas) */}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {aviso.descricao}
      </p>

      {/* Metadados */}
      <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-sm dark:border-slate-800 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-slate-500">
          <Calendar className="h-4 w-4 text-slate-400" />
          {formatDateBR(aviso.data)}
          {aviso.hora && ` às ${aviso.hora}`}
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <Users className="h-4 w-4 text-slate-400" />
          {aviso.publicoAlvo}
        </div>
        {aviso.autor && (
          <div className="text-slate-500">
            <span className="text-slate-400">Publicado por:</span> {aviso.autor}
          </div>
        )}
        {typeof aviso.visualizacoes === 'number' && (
          <div className="flex items-center gap-2 text-slate-500">
            <Eye className="h-4 w-4 text-slate-400" />
            {aviso.visualizacoes} visualização(ões)
          </div>
        )}
      </dl>
    </Modal>
  )
}
