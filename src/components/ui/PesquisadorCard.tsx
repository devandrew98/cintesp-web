import { Mail, Clock } from 'lucide-react'
import { Avatar } from './Avatar'
import { DisponibilidadeBadge, disponibilidadeInfo } from './Badge'
import { textoLivre } from '@/lib/pesquisadores'
import { cn } from '@/lib/utils'
import type { Usuario } from '@/types'

/**
 * Card de pesquisador reutilizado no Quadro de Disponibilidade e no diretório
 * de Pesquisadores. Mostra avatar (com bolinha de status), nome, função,
 * áreas e — quando disponível — até que horas está livre.
 * Se `onClick` for passado, o card vira um botão clicável (abre o detalhe).
 */
export function PesquisadorCard({
  usuario,
  onClick,
}: {
  usuario: Usuario
  onClick?: () => void
}) {
  const info = disponibilidadeInfo[usuario.disponibilidade]
  const livre = textoLivre(usuario)

  const conteudo = (
    <>
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar nome={usuario.nome} fotoUrl={usuario.fotoUrl} size="md" />
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900',
              info.dotColor,
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{usuario.nome}</p>
          <p className="truncate text-xs text-slate-400">{usuario.funcao.nome}</p>
        </div>
        <DisponibilidadeBadge status={usuario.disponibilidade} />
      </div>

      {/* Áreas de atuação como chips */}
      {usuario.areas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {usuario.areas.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.cor }} />
              {a.nome}
            </span>
          ))}
        </div>
      )}

      {/* Rodapé: horário livre + e-mail */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        {livre && (
          <span className="inline-flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
            <Clock className="h-3.5 w-3.5" />
            {livre}
          </span>
        )}
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{usuario.email}</span>
        </span>
      </div>
    </>
  )

  const classe =
    'card p-4 text-left transition-shadow hover:shadow-soft'

  if (onClick) {
    return (
      <button onClick={onClick} className={cn(classe, 'w-full')}>
        {conteudo}
      </button>
    )
  }
  return <div className={classe}>{conteudo}</div>
}
