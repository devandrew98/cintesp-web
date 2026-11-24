import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Cake, CalendarClock, ExternalLink, MapPin, Timer, Video } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { listarRegistrosPonto } from '@/data/ponto'
import { listarEventosEquipe } from '@/data/agendaEquipe'
import { listarAvisos, listarUsuarios } from '@/data/api'
import { usePermissoes } from '@/hooks/usePermissoes'
import { acessoEsquecidoAberto } from '@/lib/acessoAberto'
import { euParticipo, ocorrenciasNoPeriodo, rotuloQuando } from '@/lib/agendaEquipe'
import { hojeISO } from '@/lib/agendamento'
import { tipoAvisoInfo } from '@/lib/avisos'
import { paraDateLocal } from '@/lib/ponto'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

/** Avisos publicados nos últimos dias contam como "novos" (mesma regra do sino). */
const DIAS_AVISO_NOVO = 7

/** "Não me avise novamente": guardado no aparelho, por pessoa e por aviso específico. */
const chaveOculto = (uid: string, chave: string) => `cintesp:aviso-oculto:${uid}:${chave}`
function estaOculto(uid: string, chave: string): boolean {
  try {
    return localStorage.getItem(chaveOculto(uid, chave)) === '1'
  } catch {
    return false
  }
}
function ocultar(uid: string, chave: string) {
  try {
    localStorage.setItem(chaveOculto(uid, chave), '1')
  } catch {
    /* sem localStorage: vale só até recarregar */
  }
}

/** Rodapé dos popups: botões empilhados e largos no celular, em linha no desktop. */
function Rodape({ onEntendi, onNunca, extra }: { onEntendi: () => void; onNunca: () => void; extra?: ReactNode }) {
  return (
    <div className="flex w-full flex-col-reverse gap-1 sm:flex-row sm:items-center sm:gap-2">
      <button
        type="button"
        onClick={onNunca}
        className="rounded-lg px-2 py-2.5 text-sm text-slate-500 underline-offset-2 hover:underline sm:mr-auto sm:py-1.5 sm:text-xs"
      >
        Não me avise novamente
      </button>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {extra}
        <Button onClick={onEntendi} className="w-full sm:w-auto">
          Entendi
        </Button>
      </div>
    </div>
  )
}

const Icone = ({ tom, children }: { tom: string; children: ReactNode }) => (
  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tom)}>{children}</span>
)

/**
 * Popups ao entrar no sistema, sempre que a página é aberta ou atualizada:
 *  1) "Você deixou o acesso aberto": última marcação é uma ENTRADA de dia anterior, sem saída.
 *  2) Aniversário: só no dia — parabéns para quem faz aniversário e aviso aos colegas.
 *  3) "Você tem evento hoje": eventos da Programação de hoje em que a pessoa participa.
 *  4) Avisos novos publicados (últimos 7 dias).
 * "Entendi" fecha só por agora (volta ao atualizar a página). "Não me avise novamente" some
 * para sempre com AQUELE aviso — os próximos continuam aparecendo.
 */
export function AvisosAoEntrar() {
  const { perfil } = usePermissoes()
  const uid = perfil?.id
  const hoje = hojeISO()
  // Dispensados "por agora" (memória; zera ao atualizar) e contador para reler o localStorage.
  const [adiados, setAdiados] = useState<string[]>([])
  const [, forcar] = useState(0)

  const { data: registros = [] } = useQuery({
    queryKey: ['ponto-aviso-aberto', uid],
    queryFn: () => listarRegistrosPonto({ usuarioId: uid!, de: new Date(Date.now() - 4 * 86_400_000).toISOString() }),
    enabled: Boolean(uid),
    staleTime: 60_000,
  })
  const { data: eventos = [] } = useQuery({ queryKey: ['agenda-equipe'], queryFn: listarEventosEquipe, enabled: Boolean(uid) })
  const { data: avisos = [] } = useQuery({ queryKey: ['avisos'], queryFn: listarAvisos, enabled: Boolean(uid) })
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios, enabled: Boolean(uid) })

  // Quem faz aniversário HOJE (mês-dia da data de nascimento = hoje).
  const aniversariantesHoje = useMemo(() => usuarios.filter((u) => u.status === 'ativo' && u.dataNascimento && u.dataNascimento.slice(5, 10) === hoje.slice(5, 10)), [usuarios, hoje])

  const aberto = useMemo(() => acessoEsquecidoAberto(registros, hoje, paraDateLocal), [registros, hoje])

  const reunioes = useMemo(() => {
    const agora = new Date()
    const hhmm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
    return ocorrenciasNoPeriodo(
      eventos.filter((e) => !e.donoId && euParticipo(e, uid)),
      hoje,
      hoje,
    ).filter((o) => o.evento.diaInteiro || !o.evento.horaFim || o.dataFim > hoje || o.evento.horaFim >= hhmm)
  }, [eventos, uid, hoje])

  const novos = useMemo(() => {
    const limite = Date.now() - DIAS_AVISO_NOVO * 86_400_000
    return avisos.filter((a) => a.status === 'ativo' && new Date(a.data).getTime() >= limite).sort((a, b) => +new Date(b.data) - +new Date(a.data))
  }, [avisos])

  if (!uid) return null

  const visivel = (chave: string) => !adiados.includes(chave) && !estaOculto(uid, chave)
  const adiar = (chaves: string[]) => setAdiados((a) => [...a, ...chaves])
  const nunca = (chaves: string[]) => {
    chaves.forEach((c) => ocultar(uid, c))
    forcar((n) => n + 1)
  }

  // ---- 1) acesso esquecido aberto ----
  const kAberto = aberto ? `acesso:${aberto.id}` : ''
  if (aberto && visivel(kAberto)) {
    const dia = paraDateLocal(aberto.registradoEm).split('-').reverse().join('/')
    const hora = new Date(aberto.registradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return (
      <Modal
        open
        onClose={() => adiar([kAberto])}
        title={
          <span className="flex items-center gap-2.5">
            <Icone tom="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Timer className="h-5 w-5" />
            </Icone>
            Você deixou o acesso aberto
          </span>
        }
        footer={
          <Rodape
            onEntendi={() => adiar([kAberto])}
            onNunca={() => nunca([kAberto])}
            extra={
              <Link to="/meu-acesso" onClick={() => adiar([kAberto])} className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full">
                  Ver Meu Acesso
                </Button>
              </Link>
            }
          />
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

  // ---- 2) aniversário (só no dia) ----
  const kAniv = `aniv:${hoje}`
  if (aniversariantesHoje.length > 0 && visivel(kAniv)) {
    const eu = aniversariantesHoje.find((u) => u.id === uid)
    const outros = aniversariantesHoje.filter((u) => u.id !== uid)
    return (
      <Modal
        open
        onClose={() => adiar([kAniv])}
        title={
          <span className="flex items-center gap-2.5">
            <Icone tom="bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <Cake className="h-5 w-5" />
            </Icone>
            {eu ? 'Feliz aniversário! 🎉' : aniversariantesHoje.length === 1 ? 'Aniversário hoje 🎂' : 'Aniversários hoje 🎂'}
          </span>
        }
        footer={
          <Rodape
            onEntendi={() => adiar([kAniv])}
            onNunca={() => nunca([kAniv])}
            extra={
              <Link to="/pesquisadores" onClick={() => adiar([kAniv])} className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full">
                  Ver pesquisadores
                </Button>
              </Link>
            }
          />
        }
      >
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
          {eu && (
            <p className="rounded-xl bg-brand-50 px-3 py-3 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
              Parabéns, <strong>{eu.nome.split(' ')[0]}</strong>! A equipe do CINTESP deseja um dia muito especial para você. 🎂
            </p>
          )}
          {outros.length > 0 && (
            <>
              <p>{eu ? 'Também fazem aniversário hoje:' : 'Hoje é aniversário de:'}</p>
              <ul className="space-y-2">
                {outros.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
                    <Avatar nome={u.nome} fotoUrl={u.fotoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.nome}</span>
                      {u.funcao?.nome && <span className="block truncate text-xs text-slate-400">{u.funcao.nome}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400">Que tal mandar os parabéns?</p>
            </>
          )}
        </div>
      </Modal>
    )
  }

  // ---- 3) eventos de hoje ----
  const pendentes = reunioes.filter((o) => visivel(`evento:${o.evento.id}:${o.data}`))
  if (pendentes.length > 0) {
    const chaves = pendentes.map((o) => `evento:${o.evento.id}:${o.data}`)
    return (
      <Modal
        open
        onClose={() => adiar(chaves)}
        title={
          <span className="flex items-center gap-2.5">
            <Icone tom="bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <CalendarClock className="h-5 w-5" />
            </Icone>
            {pendentes.length === 1 ? 'Você tem um evento hoje' : `Você tem ${pendentes.length} eventos hoje`}
          </span>
        }
        footer={
          <Rodape
            onEntendi={() => adiar(chaves)}
            onNunca={() => nunca(chaves)}
            extra={
              <Link to="/agenda" onClick={() => adiar(chaves)} className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full">
                  Ver agenda
                </Button>
              </Link>
            }
          />
        }
      >
        <ul className="space-y-3">
          {pendentes.map((o) => (
            <li key={`${o.evento.id}|${o.data}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">{o.evento.titulo}</p>
              <p className="mt-0.5 text-sm text-brand-700 dark:text-brand-300">Hoje · {rotuloQuando(o)}</p>
              {o.evento.local && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {o.evento.local}
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
              {o.evento.descricao && <p className="mt-2 whitespace-pre-line break-words text-xs text-slate-500">{o.evento.descricao}</p>}
            </li>
          ))}
        </ul>
      </Modal>
    )
  }

  // ---- 4) aviso novo (um por vez, do mais recente) ----
  const aviso = novos.find((a) => visivel(`aviso:${a.id}`))
  if (aviso) {
    const info = tipoAvisoInfo[aviso.tipo]
    const k = `aviso:${aviso.id}`
    const TipoIcone = info.icon
    return (
      <Modal
        open
        onClose={() => adiar([k])}
        title={
          <span className="flex items-center gap-2.5">
            <Icone tom={info.iconBox}>
              <TipoIcone className="h-5 w-5" />
            </Icone>
            Novo aviso
          </span>
        }
        footer={
          <Rodape
            onEntendi={() => adiar([k])}
            onNunca={() => nunca([k])}
            extra={
              <Link to="/avisos" onClick={() => adiar([k])} className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full">
                  Ver avisos
                </Button>
              </Link>
            }
          />
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn('rounded-full px-2.5 py-0.5 font-semibold', info.pill)}>{info.label}</span>
            {aviso.publicadoHa && <span className="text-slate-400">{aviso.publicadoHa}</span>}
            {aviso.hora && <span className="text-slate-400">· {aviso.hora}</span>}
          </div>
          <h3 className="break-words text-base font-semibold text-slate-900 dark:text-white">{aviso.titulo}</h3>
          <p className="whitespace-pre-line break-words text-sm text-slate-600 dark:text-slate-300">{aviso.descricao}</p>
          {aviso.publicoAlvo && <p className="text-xs text-slate-400">Para: {aviso.publicoAlvo}</p>}
        </div>
      </Modal>
    )
  }

  return null
}
