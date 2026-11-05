import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CalendarPlus, Check, Copy, ExternalLink, FileText, Loader2, MessageCircle, Search, Settings, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input, Select } from '@/components/ui/Field'
import { CalendarioMes, type MarcadorDia } from '@/components/agendamento/CalendarioMes'
import { SolicitacaoModal, ROTULO_STATUS, TOM_STATUS, type AbaSolicitacao } from '@/components/agendamento/SolicitacaoModal'
import { EventoModal } from '@/components/agendamento/EventoModal'
import { ConfigAgendamentoModal } from '@/components/agendamento/ConfigAgendamentoModal'
import {
  definirStatusSolicitacao,
  listarEventos,
  listarSolicitacoes,
  obterConfigPublica,
  removerEvento,
  type EventoAgenda,
  type Solicitacao,
  type StatusAgendamento,
  type TipoEvento,
} from '@/data/agendamentos'
import { usePermissoes } from '@/hooks/usePermissoes'
import {
  CONFIG_PADRAO,
  dataBR,
  dataExtenso,
  fimDoBloco,
  hojeISO,
  linkWhatsapp,
  mensagemConfirmacao,
  partesData,
} from '@/lib/agendamento'
import { cn, mensagemErro } from '@/lib/utils'

const ROTULO_FILTRO = { pendente: 'Pendentes', confirmado: 'Confirmadas', cancelado: 'Canceladas', todas: 'Todas' } as const

type Aba = 'solicitacoes' | 'calendario' | 'programacao' | 'prontuarios'

/** Uma linha da agenda: avaliação marcada, compromisso ou bloqueio. */
interface Entrada {
  chave: string
  data: string
  /** Início; vazio = dia inteiro. */
  hora?: string
  fim?: string
  titulo: string
  detalhe?: string
  tipo: 'avaliacao' | 'compromisso' | 'bloqueio'
  status?: StatusAgendamento
  solicitacao?: Solicitacao
  evento?: EventoAgenda
}

const COR: Record<string, string> = {
  pendente: 'bg-amber-500',
  confirmado: 'bg-emerald-500',
  compromisso: 'bg-sky-500',
  bloqueio: 'bg-slate-500',
}
const corDaEntrada = (e: Entrada) => (e.tipo === 'avaliacao' ? COR[e.status ?? 'pendente'] : COR[e.tipo])

function montarEntradas(solicitacoes: Solicitacao[], eventos: EventoAgenda[]): Entrada[] {
  const doItens: Entrada[] = solicitacoes
    .filter((s) => s.status !== 'cancelado')
    .flatMap((s) =>
      s.itens
        .filter((i) => i.status !== 'cancelado')
        .map((i) => ({
          chave: `i-${i.id}`,
          data: i.data,
          hora: i.hora,
          fim: fimDoBloco(i.hora),
          titulo: s.nome,
          detalhe: i.avaliacaoNome,
          tipo: 'avaliacao' as const,
          status: i.status,
          solicitacao: s,
        })),
    )
  const doEventos: Entrada[] = eventos.map((e) => ({
    chave: `e-${e.id}`,
    data: e.data,
    hora: e.diaInteiro ? undefined : e.horaInicio,
    fim: e.diaInteiro ? undefined : e.horaFim,
    titulo: e.titulo,
    detalhe: e.notas,
    tipo: e.tipo,
    evento: e,
  }))
  return [...doItens, ...doEventos].sort((a, b) => (a.data + (a.hora ?? '00:00')).localeCompare(b.data + (b.hora ?? '00:00')))
}

const horaDaEntrada = (e: Entrada) => (e.hora ? `${e.hora}${e.fim ? ` – ${e.fim}` : ''}` : 'Dia inteiro')

/**
 * Área do PESQUISADOR AVALIADOR (rota /agendamentos, com login): solicitações recebidas,
 * calendário próprio com compromissos e bloqueios, programação completa em lista e
 * prontuário/anotações por solicitante.
 */
export function AgendamentosAvaliadorPage() {
  const qc = useQueryClient()
  const { perfil } = usePermissoes()
  const [aba, setAba] = useState<Aba>('solicitacoes')
  const [filtro, setFiltro] = useState<StatusAgendamento | 'todas'>('pendente')
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<{ id: string; aba: AbaSolicitacao } | null>(null)
  const [evento, setEvento] = useState<{ aberto: boolean; data?: string; tipo: TipoEvento }>({ aberto: false, tipo: 'compromisso' })
  const [configAberta, setConfigAberta] = useState(false)
  const [removendo, setRemovendo] = useState<EventoAgenda | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const hoje = hojeISO()
  const { a: anoHoje, m: mesHoje } = partesData(hoje)
  const [mesVisto, setMesVisto] = useState({ ano: anoHoje, mes: mesHoje })
  const [diaSel, setDiaSel] = useState<string>(hoje)
  const [mostrarPassados, setMostrarPassados] = useState(false)
  const [tipoLista, setTipoLista] = useState<'todos' | 'avaliacao' | 'compromisso' | 'bloqueio'>('todos')

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['agendamento-solicitacoes'],
    queryFn: listarSolicitacoes,
    refetchInterval: 30_000,
  })
  const { data: eventos = [] } = useQuery({ queryKey: ['agendamento-eventos'], queryFn: listarEventos })
  const { data: config = CONFIG_PADRAO } = useQuery({ queryKey: ['agendamento-config'], queryFn: obterConfigPublica })

  const entradas = useMemo(() => montarEntradas(solicitacoes, eventos), [solicitacoes, eventos])
  const pendentes = solicitacoes.filter((s) => s.status === 'pendente').length

  const confirmarMut = useMutation({
    mutationFn: (id: string) => definirStatusSolicitacao(id, 'confirmado'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agendamento-solicitacoes'] }),
    onError: (e) => setErro(mensagemErro(e)),
  })
  const removerMut = useMutation({
    mutationFn: (id: string) => removerEvento(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agendamento-eventos'] })
      qc.invalidateQueries({ queryKey: ['agendamento-ocupados'] })
    },
    onError: (e) => setErro(mensagemErro(e)),
  })

  const linkPublico = `${window.location.origin}/agendamento`
  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkPublico)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copie o link do formulário:', linkPublico)
    }
  }

  const solicitacaoAberta = solicitacoes.find((s) => s.id === aberta?.id) ?? null

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return solicitacoes.filter(
      (s) =>
        (filtro === 'todas' || s.status === filtro) &&
        (!q || [s.nome, s.protocolo, s.cpf, s.telefone, s.email].join(' ').toLowerCase().includes(q)),
    )
  }, [solicitacoes, filtro, busca])

  const abas: [Aba, string][] = [
    ['solicitacoes', 'Solicitações'],
    ['calendario', 'Calendário'],
    ['programacao', 'Programação'],
    ['prontuarios', 'Prontuários'],
  ]

  return (
    <div>
      <PageHeader
        title="Agendamentos"
        subtitle="Solicitações de avaliação, sua agenda e os prontuários."
        actions={
          <>
            <Button variant="secondary" icon={copiado ? Check : Copy} onClick={copiarLink}>
              {copiado ? 'Link copiado' : 'Link do formulário'}
            </Button>
            <Button variant="secondary" icon={Settings} onClick={() => setConfigAberta(true)}>
              Configurações
            </Button>
            <Button icon={CalendarPlus} onClick={() => setEvento({ aberto: true, tipo: 'compromisso', data: aba === 'calendario' ? diaSel : undefined })}>
              Compromisso
            </Button>
          </>
        }
      />

      {!config.whatsapp && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          O WhatsApp do pesquisador ainda não está configurado: quem enviar o formulário não verá o botão de aviso por WhatsApp.{' '}
          <button className="font-semibold underline" onClick={() => setConfigAberta(true)}>
            Configurar agora
          </button>
        </p>
      )}
      {erro && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>
      )}

      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {abas.map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              aba === id ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            {rotulo}
            {id === 'solicitacoes' && pendentes > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{pendentes}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      )}

      {/* ------------------------------------------------ SOLICITAÇÕES */}
      {!isLoading && aba === 'solicitacoes' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
              {(['pendente', 'confirmado', 'cancelado', 'todas'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    filtro === f ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
                  )}
                >
                  {ROTULO_FILTRO[f]}
                </button>
              ))}
            </div>
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF, protocolo…" className="pl-9" />
            </div>
          </div>

          {filtradas.length === 0 ? (
            <div className="card px-6 py-14 text-center text-sm text-slate-500">
              {solicitacoes.length === 0 ? 'Nenhuma solicitação recebida ainda. Compartilhe o link do formulário.' : 'Nenhuma solicitação nesse filtro.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtradas.map((s) => {
                const ativos = s.itens.filter((i) => i.status !== 'cancelado')
                const primeiro = ativos[0]
                const ultimo = ativos[ativos.length - 1]
                const wa = linkWhatsapp(s.telefone, mensagemConfirmacao({ nome: s.nome, local: config.local, itens: ativos }))
                return (
                  <li key={s.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
                    <button onClick={() => setAberta({ id: s.id, aba: 'resumo' })} className="min-w-0 flex-1 text-left">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                        <span className="truncate">{s.nome}</span>
                        <Badge tone={TOM_STATUS[s.status]} dot>
                          {ROTULO_STATUS[s.status]}
                        </Badge>
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {s.protocolo} · {s.perfil}
                        {primeiro && ` · ${dataBR(primeiro.data)} a ${dataBR(ultimo.data)}`}
                      </p>
                    </button>
                    <div className="flex items-center gap-1">
                      {s.status === 'pendente' && (
                        <Button size="sm" icon={Check} onClick={() => confirmarMut.mutate(s.id)} disabled={confirmarMut.isPending}>
                          Confirmar
                        </Button>
                      )}
                      {s.status !== 'cancelado' && wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Confirmar pelo WhatsApp"
                          className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        >
                          <MessageCircle className="h-5 w-5" />
                        </a>
                      )}
                      <button
                        onClick={() => setAberta({ id: s.id, aba: 'resumo' })}
                        title="Abrir"
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------------------------ CALENDÁRIO */}
      {!isLoading && aba === 'calendario' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="card p-4">
            <CalendarioMes
              ano={mesVisto.ano}
              mes={mesVisto.mes}
              onMes={(ano, mes) => setMesVisto({ ano, mes })}
              selecionado={diaSel}
              onSelecionar={setDiaSel}
              marcadores={(iso): MarcadorDia[] => entradas.filter((e) => e.data === iso).map((e) => ({ cor: corDaEntrada(e), titulo: `${horaDaEntrada(e)} — ${e.titulo}` }))}
            />
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <Legenda cor="bg-amber-500" rotulo="Avaliação pendente" />
              <Legenda cor="bg-emerald-500" rotulo="Avaliação confirmada" />
              <Legenda cor="bg-sky-500" rotulo="Compromisso" />
              <Legenda cor="bg-slate-500" rotulo="Bloqueio" />
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{dataExtenso(diaSel)}</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => setEvento({ aberto: true, tipo: 'compromisso', data: diaSel })}>
                  Compromisso
                </Button>
                <Button size="sm" variant="secondary" icon={Ban} onClick={() => setEvento({ aberto: true, tipo: 'bloqueio', data: diaSel })}>
                  Bloquear
                </Button>
              </div>
            </div>
            <ListaEntradas
              entradas={entradas.filter((e) => e.data === diaSel)}
              vazio="Nada marcado neste dia."
              onAbrir={(s) => setAberta({ id: s.id, aba: 'resumo' })}
              onRemover={setRemovendo}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------ PROGRAMAÇÃO */}
      {!isLoading && aba === 'programacao' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={tipoLista} onChange={(e) => setTipoLista(e.target.value as typeof tipoLista)} className="w-auto">
              <option value="todos">Tudo</option>
              <option value="avaliacao">Avaliações</option>
              <option value="compromisso">Compromissos</option>
              <option value="bloqueio">Bloqueios</option>
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={mostrarPassados} onChange={(e) => setMostrarPassados(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Mostrar dias que já passaram
            </label>
          </div>
          <Programacao
            entradas={entradas.filter((e) => (mostrarPassados || e.data >= hoje) && (tipoLista === 'todos' || e.tipo === tipoLista))}
            onAbrir={(s) => setAberta({ id: s.id, aba: 'resumo' })}
            onRemover={setRemovendo}
          />
        </div>
      )}

      {/* ------------------------------------------------ PRONTUÁRIOS */}
      {!isLoading && aba === 'prontuarios' && (
        <div>
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar solicitante por nome, CPF…" className="pl-9" />
          </div>
          {solicitacoes.length === 0 ? (
            <div className="card px-6 py-14 text-center text-sm text-slate-500">Os prontuários aparecem aqui conforme as solicitações chegam.</div>
          ) : (
            <ul className="space-y-2">
              {solicitacoes
                .filter((s) => !busca.trim() || [s.nome, s.cpf, s.protocolo].join(' ').toLowerCase().includes(busca.trim().toLowerCase()))
                .map((s) => (
                  <li key={s.id} className="card flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">{s.nome}</p>
                      <p className="truncate text-xs text-slate-400">
                        {s.protocolo} · {s.deficiencia}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" icon={FileText} onClick={() => setAberta({ id: s.id, aba: 'prontuario' })}>
                      Abrir prontuário
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <SolicitacaoModal
        solicitacao={solicitacaoAberta}
        local={config.local}
        autorNome={perfil?.nome}
        abaInicial={aberta?.aba}
        onClose={() => setAberta(null)}
      />
      <EventoModal
        open={evento.aberto}
        onClose={() => setEvento((e) => ({ ...e, aberto: false }))}
        dataInicial={evento.data}
        tipoInicial={evento.tipo}
        solicitacoes={solicitacoes}
      />
      <ConfigAgendamentoModal open={configAberta} onClose={() => setConfigAberta(false)} config={config} />
      <ConfirmDialog
        open={Boolean(removendo)}
        onClose={() => setRemovendo(null)}
        onConfirm={() => removendo && removerMut.mutate(removendo.id)}
        title={removendo?.tipo === 'bloqueio' ? 'Remover bloqueio' : 'Desmarcar compromisso'}
        message={removendo ? `Remover "${removendo.titulo}" de ${dataBR(removendo.data)}? O horário volta a ficar disponível no formulário.` : ''}
        confirmLabel="Remover"
      />
    </div>
  )
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', cor)} /> {rotulo}
    </span>
  )
}

function LinhaEntrada({ e, onAbrir, onRemover }: { e: Entrada; onAbrir: (s: Solicitacao) => void; onRemover: (ev: EventoAgenda) => void }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
      <span className={cn('h-8 w-1.5 shrink-0 rounded-full', corDaEntrada(e))} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400">{horaDaEntrada(e)}</p>
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{e.titulo}</p>
        {e.detalhe && <p className="truncate text-xs text-slate-500">{e.detalhe}</p>}
      </div>
      {e.tipo === 'avaliacao' && e.status && <Badge tone={TOM_STATUS[e.status]}>{ROTULO_STATUS[e.status]}</Badge>}
      {e.tipo === 'compromisso' && <Badge tone="blue">Compromisso</Badge>}
      {e.tipo === 'bloqueio' && <Badge tone="slate">Bloqueio</Badge>}
      {e.solicitacao && (
        <button onClick={() => onAbrir(e.solicitacao!)} title="Abrir solicitação" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ExternalLink className="h-4 w-4" />
        </button>
      )}
      {e.evento && (
        <button onClick={() => onRemover(e.evento!)} title="Desmarcar" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}

function ListaEntradas({ entradas, vazio, onAbrir, onRemover }: { entradas: Entrada[]; vazio: string; onAbrir: (s: Solicitacao) => void; onRemover: (ev: EventoAgenda) => void }) {
  if (entradas.length === 0) return <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400 dark:border-slate-700">{vazio}</p>
  return (
    <ul className="space-y-2">
      {entradas.map((e) => (
        <LinhaEntrada key={e.chave} e={e} onAbrir={onAbrir} onRemover={onRemover} />
      ))}
    </ul>
  )
}

/** Lista completa, agrupada por dia, em ordem cronológica. */
function Programacao({ entradas, onAbrir, onRemover }: { entradas: Entrada[]; onAbrir: (s: Solicitacao) => void; onRemover: (ev: EventoAgenda) => void }) {
  const grupos = useMemo(() => {
    const m = new Map<string, Entrada[]>()
    for (const e of entradas) m.set(e.data, [...(m.get(e.data) ?? []), e])
    return [...m.entries()]
  }, [entradas])

  if (grupos.length === 0) return <div className="card px-6 py-14 text-center text-sm text-slate-500">Nada na programação.</div>
  return (
    <div className="space-y-5">
      {grupos.map(([data, lista]) => (
        <section key={data}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {dataExtenso(data)}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {lista.length} item{lista.length > 1 ? 's' : ''}
            </span>
          </h3>
          <ListaEntradas entradas={lista} vazio="" onAbrir={onAbrir} onRemover={onRemover} />
        </section>
      ))}
    </div>
  )
}

