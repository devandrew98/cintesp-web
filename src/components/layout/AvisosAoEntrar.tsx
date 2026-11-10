import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarClock, ExternalLink, MapPin, Timer, Video } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { listarRegistrosPonto } from '@/data/ponto'
import { listarEventosEquipe } from '@/data/agendaEquipe'
import { usePermissoes } from '@/hooks/usePermissoes'
import { acessoEsquecidoAberto } from '@/lib/acessoAberto'
import { euParticipo, ocorrenciasNoPeriodo, rotuloQuando } from '@/lib/agendaEquipe'
import { hojeISO } from '@/lib/agendamento'
import { paraDateLocal } from '@/lib/ponto'

/** Lembra (no aparelho) que o aviso já foi dispensado hoje. */
const chaveVisto = (...partes: string[]) => `cintesp:aviso-visto:${partes.join(':')}`
function foiVisto(chave: string): boolean {
  try {
    return localStorage.getItem(chave) === '1'
  } catch {
    return false
  }
}
function marcarVisto(chave: string) {
  try {
    localStorage.setItem(chave, '1')
  } catch {
    /* sem localStorage: o aviso só reaparece no próximo carregamento */
  }
}

/**
 * Popups ao entrar no sistema:
 *  1) "Você deixou o acesso aberto": a última marcação de ponto é uma ENTRADA de um dia
 *     anterior, sem saída — ou seja, passou da meia-noite e o ponto continua aberto.
 *  2) "Você tem reunião hoje": eventos da Programação de hoje em que a pessoa participa.
 * Cada um aparece uma vez por dia (depois de "Entendi" não volta até o dia seguinte).
 */
export function AvisosAoEntrar() {
  const { perfil } = usePermissoes()
  const uid = perfil?.id
  const hoje = hojeISO()
  const [, forcar] = useState(0)

  const { data: registros = [] } = useQuery({
    queryKey: ['ponto-aviso-aberto', uid],
    queryFn: () => listarRegistrosPonto({ usuarioId: uid!, de: new Date(Date.now() - 4 * 86_400_000).toISOString() }),
    enabled: Boolean(uid),
    staleTime: 60_000,
  })
  const { data: eventos = [] } = useQuery({ queryKey: ['agenda-equipe'], queryFn: listarEventosEquipe, enabled: Boolean(uid) })

  const aberto = useMemo(() => acessoEsquecidoAberto(registros, hoje, paraDateLocal), [registros, hoje])

  const reunioes = useMemo(() => {
    const agora = new Date()
    const hhmm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
    return ocorrenciasNoPeriodo(
      eventos.filter((e) => euParticipo(e, uid)),
      hoje,
      hoje,
    ).filter((o) => o.evento.diaInteiro || !o.evento.horaFim || o.dataFim > hoje || o.evento.horaFim >= hhmm)
  }, [eventos, uid, hoje])

  if (!uid) return null

  const chaveAberto = aberto ? chaveVisto(uid, 'acesso-aberto', aberto.id, hoje) : ''
  const mostrarAberto = Boolean(aberto) && !foiVisto(chaveAberto)

  const pendentes = reunioes.filter((o) => !foiVisto(chaveVisto(uid, 'evento', o.evento.id, o.data)))

  // Um popup por vez: primeiro o acesso aberto, depois as reuniões.
  if (mostrarAberto && aberto) {
    const dia = paraDateLocal(aberto.registradoEm).split('-').reverse().join('/')
    const hora = new Date(aberto.registradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const dispensar = () => {
      marcarVisto(chaveAberto)
      forcar((n) => n + 1)
    }
    return (
      <Modal
        open
        onClose={dispensar}
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Timer className="h-5 w-5" />
            </span>
            Você deixou o acesso aberto
          </span>
        }
        footer={
          <>
            <Link to="/meu-acesso" onClick={dispensar}>
              <Button variant="secondary">Ver Meu Acesso</Button>
            </Link>
            <Button onClick={dispensar}>Entendi</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          <p>
            Sua entrada de <strong>{dia} às {hora}</strong> não teve uma saída registrada, então o seu ponto continuou aberto
            depois da meia-noite.
          </p>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Avise a administração para lançar ou corrigir o horário de saída daquele dia.
          </p>
        </div>
      </Modal>
    )
  }

  if (pendentes.length > 0) {
    const dispensar = () => {
      pendentes.forEach((o) => marcarVisto(chaveVisto(uid, 'evento', o.evento.id, o.data)))
      forcar((n) => n + 1)
    }
    return (
      <Modal
        open
        onClose={dispensar}
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <CalendarClock className="h-5 w-5" />
            </span>
            {pendentes.length === 1 ? 'Você tem um compromisso hoje' : `Você tem ${pendentes.length} compromissos hoje`}
          </span>
        }
        footer={
          <>
            <Link to="/agenda" onClick={dispensar}>
              <Button variant="secondary">Ver agenda</Button>
            </Link>
            <Button onClick={dispensar}>Entendi</Button>
          </>
        }
      >
        <ul className="space-y-3">
          {pendentes.map((o) => (
            <li key={`${o.evento.id}|${o.data}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{o.evento.titulo}</p>
              <p className="mt-0.5 text-sm text-brand-700 dark:text-brand-300">Hoje · {rotuloQuando(o)}</p>
              {o.evento.local && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5" /> {o.evento.local}
                </p>
              )}
              {o.evento.linkVideo && (
                <a
                  href={o.evento.linkVideo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
                >
                  <Video className="h-3.5 w-3.5" /> Entrar na videoconferência <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {o.evento.descricao && <p className="mt-2 whitespace-pre-line text-xs text-slate-500">{o.evento.descricao}</p>}
            </li>
          ))}
        </ul>
      </Modal>
    )
  }

  return null
}
