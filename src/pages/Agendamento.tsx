import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarCheck, CheckCircle2, ChevronDown, Loader2, Lock, MessageCircle, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Opcoes, QuestaoSimNao } from '@/components/agendamento/QuestaoSimNao'
import { SeletorDataHora } from '@/components/agendamento/SeletorDataHora'
import { obterConfigPublica, listarOcupados, solicitarAgendamento } from '@/data/agendamentos'
import {
  AVALIACOES,
  FASES,
  LOCOMOCAO_OPCOES,
  QUESTOES,
  chaveSlot,
  dataBR,
  linkWhatsapp,
  mascararCpf,
  mascararTelefone,
  mensagemParaPesquisador,
  nomeDiaSemana,
  normalizarTriagem,
  periodoDaFase,
  pessoaVazia,
  rotuloHorario,
  sinaisDeAlerta,
  triagemVazia,
  validarPessoa,
  validarSelecoes,
  validarTriagem,
  type DadosPessoais,
  type FaseAvaliacao,
  type Selecao,
  type SimNao,
} from '@/lib/agendamento'
import { cn, mensagemErro } from '@/lib/utils'

type Escolhas = Record<string, { data: string; hora: string } | undefined>

function irPara(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/**
 * Formulário PÚBLICO de agendamento e anamnese (rota /agendamento, sem login).
 * O próprio formulário identifica o solicitante. O servidor revalida tudo (horários livres,
 * regras das fases, CPF…) — o que se vê aqui é só para guiar a pessoa.
 */
export function AgendamentoPage() {
  const qc = useQueryClient()
  const [pessoa, setPessoa] = useState<DadosPessoais>(pessoaVazia())
  const [triagem, setTriagem] = useState(triagemVazia())
  const [errosPessoa, setErrosPessoa] = useState<Partial<Record<keyof DadosPessoais, string>>>({})
  const [errosTriagem, setErrosTriagem] = useState<Record<string, string>>({})
  const [liberado, setLiberado] = useState(false)
  const [escolhas, setEscolhas] = useState<Escolhas>({})
  const [ativa, setAtiva] = useState<string | null>(AVALIACOES[0].id)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [enviado, setEnviado] = useState<{ protocolo: string; nome: string; itens: { avaliacaoNome: string; data: string; hora: string }[] } | null>(null)

  const { data: config, isLoading: carregandoConfig, error: erroConfig } = useQuery({
    queryKey: ['agendamento-config'],
    queryFn: obterConfigPublica,
    retry: false,
  })

  const intervalo = useMemo(
    () => (config ? { de: config.fase1Inicio, ate: config.fase2Fim } : null),
    [config],
  )
  const { data: ocupados = new Set<string>() } = useQuery({
    queryKey: ['agendamento-ocupados', intervalo?.de, intervalo?.ate],
    queryFn: () => listarOcupados(intervalo!.de, intervalo!.ate),
    enabled: Boolean(intervalo),
    refetchInterval: 30_000, // outra pessoa pode pegar o horário enquanto você preenche
  })

  const alertas = sinaisDeAlerta(triagem)

  function atualizarPessoa<K extends keyof DadosPessoais>(k: K, v: DadosPessoais[K]) {
    setPessoa((p) => ({ ...p, [k]: v }))
    if (errosPessoa[k]) setErrosPessoa((e) => ({ ...e, [k]: undefined }))
  }

  function concluirTriagem(): boolean {
    const ep = validarPessoa(pessoa)
    const et = validarTriagem(triagem)
    setErrosPessoa(ep)
    setErrosTriagem(et)
    const primeiroPessoa = (Object.keys(ep) as (keyof DadosPessoais)[])[0]
    if (primeiroPessoa) {
      irPara(`p-${primeiroPessoa}`)
      setLiberado(false)
      return false
    }
    const primeiraTriagem = Object.keys(et)[0]
    if (primeiraTriagem) {
      irPara(`q-${primeiraTriagem}`)
      setLiberado(false)
      return false
    }
    setLiberado(true)
    return true
  }

  function escolher(avaliacaoId: string, data: string, hora: string) {
    setEscolhas((e) => ({ ...e, [avaliacaoId]: { data, hora } }))
    setErroEnvio(null)
    // Segue para a próxima avaliação sem data/horário.
    const proxima = AVALIACOES.find((a) => a.id !== avaliacaoId && !escolhas[a.id])
    setAtiva(proxima ? proxima.id : null)
  }

  async function enviar() {
    setErroEnvio(null)
    if (!config) return
    if (!concluirTriagem()) {
      setErroEnvio('Revise os dados pessoais e a triagem antes de enviar.')
      return
    }
    const selecoes: Selecao[] = AVALIACOES.map((a) => ({
      avaliacaoId: a.id,
      data: escolhas[a.id]?.data ?? '',
      hora: escolhas[a.id]?.hora ?? '',
    }))
    const problema = validarSelecoes(selecoes, config, ocupados)
    if (problema) {
      setErroEnvio(problema)
      return
    }
    setEnviando(true)
    try {
      const r = await solicitarAgendamento(pessoa, normalizarTriagem(triagem), selecoes)
      setEnviado({
        protocolo: r.protocolo,
        nome: pessoa.nome.trim(),
        itens: AVALIACOES.map((a) => ({ avaliacaoNome: a.nome, data: escolhas[a.id]!.data, hora: escolhas[a.id]!.hora })),
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErroEnvio(mensagemErro(e))
      qc.invalidateQueries({ queryKey: ['agendamento-ocupados'] }) // mostra o que acabou de ser ocupado
    } finally {
      setEnviando(false)
    }
  }

  // ---------------------------------------------------------------- telas
  const moldura = (conteudo: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo className="h-12 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agendamento e Anamnese</h1>
          <p className="mt-1 text-sm font-medium text-brand-700 dark:text-brand-300">
            Programa Integrado de Avaliação Física, Treinamento Adaptado e Inclusão Esportiva
          </p>
          <p className="mt-1 text-xs text-slate-400">CINTESP.Br / Universidade Federal de Uberlândia - UFU</p>
        </header>
        {conteudo}
        <p className="mt-8 text-center text-xs text-slate-400">
          Seus dados de saúde são confidenciais e vistos somente pelo pesquisador responsável pelas avaliações.
        </p>
      </div>
    </div>
  )

  if (carregandoConfig) {
    return moldura(
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>,
    )
  }

  if (erroConfig || !config) {
    return moldura(
      <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Formulário indisponível</h2>
        <p className="max-w-md text-sm text-slate-500">
          Não foi possível abrir o agendamento agora. Tente de novo em alguns minutos ou fale com a organização.
        </p>
      </div>,
    )
  }

  if (!config.ativo && !enviado) {
    return moldura(
      <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Lock className="h-8 w-8 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Agendamentos encerrados</h2>
        <p className="max-w-md text-sm text-slate-500">No momento não estamos recebendo novas solicitações.</p>
      </div>,
    )
  }

  if (enviado) {
    const msg = mensagemParaPesquisador({ nome: enviado.nome, protocolo: enviado.protocolo, local: config.local, itens: enviado.itens })
    const wa = linkWhatsapp(config.whatsapp, msg)
    return moldura(
      <div className="card p-6">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">Solicitação enviada!</h2>
          <p className="mt-1 text-sm text-slate-500">
            O pesquisador avaliador recebeu o seu agendamento e vai confirmar com você.
          </p>
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-sm dark:bg-slate-800">
            Protocolo: <strong className="font-mono">{enviado.protocolo}</strong>
          </p>
        </div>

        <ul className="mt-6 space-y-2">
          {[...enviado.itens]
            .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
            .map((i) => (
              <li key={i.avaliacaoNome} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700">
                <span className="font-medium text-slate-800 dark:text-slate-100">{i.avaliacaoNome}</span>
                <span className="text-slate-500">
                  {nomeDiaSemana(i.data)}, {dataBR(i.data)} · {rotuloHorario(i.hora)}
                </span>
              </li>
            ))}
        </ul>
        <p className="mt-3 text-center text-xs text-slate-400">Local: {config.local}. Guarde o protocolo.</p>

        <div className="mt-6 flex flex-col items-center gap-2">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" /> Avisar o pesquisador no WhatsApp
            </a>
          ) : (
            <p className="text-center text-sm text-slate-500">Fique atento ao telefone e ao e-mail informados: o pesquisador vai entrar em contato.</p>
          )}
          {wa && <p className="text-xs text-slate-400">Abre o WhatsApp com a mensagem pronta; é só enviar.</p>}
        </div>
      </div>,
    )
  }

  const prazoTriagem = config.triagemLimite ? ` — até ${dataBR(config.triagemLimite)}` : ''
  const escolhidas = AVALIACOES.filter((a) => escolhas[a.id]).length
  const sec = 'mb-3 border-b border-slate-200 pb-1.5 text-base font-bold text-brand-800 dark:border-slate-700 dark:text-brand-300'

  return moldura(
    <div className="space-y-6">
      {/* ------------------------------------------------ dados pessoais */}
      <section className="card p-5">
        <h2 className={sec}>Dados pessoais</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="p-nome" label="Nome completo" erro={errosPessoa.nome}>
            <Input id="p-nome" autoComplete="name" value={pessoa.nome} onChange={(e) => atualizarPessoa('nome', e.target.value)} placeholder="Nome completo" />
          </Campo>
          <Campo id="p-cpf" label="CPF" erro={errosPessoa.cpf}>
            <Input id="p-cpf" inputMode="numeric" value={pessoa.cpf} onChange={(e) => atualizarPessoa('cpf', mascararCpf(e.target.value))} placeholder="000.000.000-00" />
          </Campo>
          <Campo id="p-endereco" label="Endereço" erro={errosPessoa.endereco}>
            <Input id="p-endereco" autoComplete="street-address" value={pessoa.endereco} onChange={(e) => atualizarPessoa('endereco', e.target.value)} placeholder="Rua, número, bairro, cidade" />
          </Campo>
          <Campo id="p-telefone" label="Telefone / WhatsApp" erro={errosPessoa.telefone}>
            <Input id="p-telefone" type="tel" autoComplete="tel" value={pessoa.telefone} onChange={(e) => atualizarPessoa('telefone', mascararTelefone(e.target.value))} placeholder="(34) 99999-9999" />
          </Campo>
          <Campo id="p-email" label="E-mail" erro={errosPessoa.email}>
            <Input id="p-email" type="email" autoComplete="email" value={pessoa.email} onChange={(e) => atualizarPessoa('email', e.target.value)} placeholder="seuemail@exemplo.com" />
          </Campo>
          <div id="p-perfil">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Perfil <span className="text-red-500">*</span>
            </span>
            <Opcoes<'Atleta' | 'Não atleta'>
              nome="perfil"
              valor={pessoa.perfil}
              opcoes={[
                { valor: 'Atleta', rotulo: 'Atleta' },
                { valor: 'Não atleta', rotulo: 'Não atleta' },
              ]}
              onChange={(v) => atualizarPessoa('perfil', v)}
            />
            {errosPessoa.perfil && <p className="mt-1 text-xs text-red-500">{errosPessoa.perfil}</p>}
          </div>
          <div className="sm:col-span-2">
            <Campo id="p-deficiencia" label="Tipo de deficiência / Patologia" erro={errosPessoa.deficiencia}>
              <Input
                id="p-deficiencia"
                value={pessoa.deficiencia}
                onChange={(e) => atualizarPessoa('deficiencia', e.target.value)}
                placeholder="Ex.: lesão medular, paralisia cerebral, amputação, deficiência visual…"
              />
            </Campo>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ triagem */}
      <section className="card p-5">
        <h2 className={sec}>Triagem e cadastramento</h2>
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Etapa obrigatória{prazoTriagem}. Sem a triagem concluída, o agendamento não é liberado.
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Responda às questões de saúde abaixo. As informações são confidenciais e servem para adequar a avaliação às suas necessidades.
        </p>

        <div className="space-y-3">
          {QUESTOES.filter((q) => q.numero < 8).map((q) => (
            <QuestaoSimNao
              key={q.chave}
              questao={q}
              valor={triagem[q.chave]}
              erro={errosTriagem[q.chave]}
              onChange={(r) => {
                setTriagem((t) => ({ ...t, [q.chave]: r }))
                if (errosTriagem[q.chave]) setErrosTriagem((e) => ({ ...e, [q.chave]: '' }))
              }}
            />
          ))}

          {/* 8 — locomoção (com "Outro: qual?") */}
          <div id="q-locomocao" className={cn('rounded-xl border bg-white p-3 dark:bg-slate-900', errosTriagem.locomocao ? 'border-red-300 dark:border-red-500/40' : 'border-slate-200 dark:border-slate-700')}>
            <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">
              8. Como você se locomove na maior parte do tempo? <span className="text-red-500">*</span>
            </p>
            <Opcoes<string>
              nome="locomocao"
              valor={triagem.locomocao}
              opcoes={LOCOMOCAO_OPCOES.map((o) => ({ valor: o, rotulo: o }))}
              onChange={(v) => {
                setTriagem((t) => ({ ...t, locomocao: v, locomocaoOutro: v === 'Outro' ? t.locomocaoOutro : '' }))
                setErrosTriagem((e) => ({ ...e, locomocao: '' }))
              }}
            />
            {triagem.locomocao === 'Outro' && (
              <div className="mt-3">
                <label htmlFor="locomocao-outro" className="mb-1 block text-xs font-medium text-slate-500">
                  Qual? <span className="text-red-500">*</span>
                </label>
                <Input
                  id="locomocao-outro"
                  value={triagem.locomocaoOutro}
                  onChange={(e) => setTriagem((t) => ({ ...t, locomocaoOutro: e.target.value }))}
                  placeholder="Descreva como você se locomove"
                />
              </div>
            )}
            {errosTriagem.locomocao && <p className="mt-2 text-xs text-red-500">{errosTriagem.locomocao}</p>}
          </div>

          {QUESTOES.filter((q) => q.numero > 8).map((q) => (
            <QuestaoSimNao
              key={q.chave}
              questao={q}
              valor={triagem[q.chave]}
              erro={errosTriagem[q.chave]}
              onChange={(r) => {
                setTriagem((t) => ({ ...t, [q.chave]: r }))
                if (errosTriagem[q.chave]) setErrosTriagem((e) => ({ ...e, [q.chave]: '' }))
              }}
            />
          ))}

          {/* 10 — autorização */}
          <div id="q-autorizacao" className={cn('rounded-xl border bg-white p-3 dark:bg-slate-900', errosTriagem.autorizacao ? 'border-red-300 dark:border-red-500/40' : 'border-slate-200 dark:border-slate-700')}>
            <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">
              10. Você autoriza a realização dos testes e declara que as informações são verdadeiras? <span className="text-red-500">*</span>
            </p>
            <Opcoes<SimNao>
              nome="autorizacao"
              valor={triagem.autorizacao}
              opcoes={[
                { valor: 'Sim', rotulo: 'Sim, autorizo e confirmo as informações' },
                { valor: 'Não', rotulo: 'Não autorizo' },
              ]}
              onChange={(v) => {
                setTriagem((t) => ({ ...t, autorizacao: v }))
                setErrosTriagem((e) => ({ ...e, autorizacao: '' }))
              }}
            />
            {errosTriagem.autorizacao && <p className="mt-2 text-xs text-red-500">{errosTriagem.autorizacao}</p>}
          </div>
        </div>

        {alertas.length > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            O pesquisador vai olhar com atenção as suas respostas antes de confirmar as avaliações.
          </p>
        )}

        <div className="mt-5">
          <Button
            onClick={() => {
              if (concluirTriagem()) setTimeout(() => irPara('agendamento'), 50)
            }}
            icon={liberado ? CheckCircle2 : ShieldCheck}
            variant={liberado ? 'secondary' : 'primary'}
          >
            {liberado ? 'Triagem concluída' : 'Concluir triagem e liberar agendamento'}
          </Button>
          {!liberado && <p className="mt-2 text-xs text-slate-400">Depois de concluir, o agendamento é desbloqueado.</p>}
        </div>
      </section>

      {/* ------------------------------------------------ agendamento */}
      <section id="agendamento" className="card relative p-5">
        <h2 className={sec}>Agendamento</h2>

        {!liberado && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/75 p-6 text-center backdrop-blur-[2px] dark:bg-slate-900/75">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <Lock className="h-4 w-4" /> Conclua os dados pessoais e a triagem para liberar o agendamento.
            </p>
          </div>
        )}

        <div className={cn(!liberado && 'pointer-events-none select-none opacity-40')} aria-hidden={!liberado}>
          <ul className="mb-5 list-disc space-y-1 pl-5 text-xs text-slate-500">
            <li>Agende <strong>todas as avaliações de uma só vez</strong>.</li>
            <li>Cada avaliação, dentro da mesma fase, em um <strong>dia diferente</strong>.</li>
            <li>Não é possível dois agendamentos no mesmo dia e horário. Horários <strong>riscados</strong> já estão ocupados.</li>
            <li>Blocos de 1h: <strong>08h–12h</strong> e <strong>13h–17h</strong>, apenas dias úteis.</li>
            <li>Primeiro a <strong>Fase 1</strong>, depois a <strong>Fase 2</strong>.</li>
          </ul>

          {([1, 2] as FaseAvaliacao[]).map((fase) => {
            const { inicio, fim } = periodoDaFase(fase, config)
            return (
              <div key={fase} className="mb-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {FASES[fase].titulo} — {FASES[fase].subtitulo}
                </h3>
                <p className="mb-3 text-xs text-slate-400">
                  Período liberado: {dataBR(inicio)} a {dataBR(fim)} · dias úteis · 8h–12h e 13h–17h
                </p>
                <div className="space-y-2">
                  {AVALIACOES.filter((a) => a.fase === fase).map((a) => {
                    const e = escolhas[a.id]
                    const aberta = ativa === a.id
                    const outras = AVALIACOES.filter((o) => o.id !== a.id && escolhas[o.id])
                    return (
                      <div key={a.id}>
                        <button
                          type="button"
                          onClick={() => setAtiva(aberta ? null : a.id)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                            e ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-800 dark:text-slate-100">{a.nome}</span>
                            <span className={cn('block text-xs', e ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400')}>
                              {e ? `${nomeDiaSemana(e.data)}, ${dataBR(e.data)} · ${rotuloHorario(e.hora)}` : 'Escolher data e horário'}
                            </span>
                          </span>
                          {e ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', aberta && 'rotate-180')} />}
                        </button>
                        {aberta && (
                          <div className="mt-2">
                            <SeletorDataHora
                              fase={fase}
                              config={config}
                              ocupados={ocupados}
                              diasUsadosNaFase={new Set(outras.filter((o) => o.fase === fase).map((o) => escolhas[o.id]!.data))}
                              slotsUsados={new Set(outras.map((o) => chaveSlot(escolhas[o.id]!.data, escolhas[o.id]!.hora)))}
                              valor={e}
                              onEscolher={(d, h) => escolher(a.id, d, h)}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {erroEnvio && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erroEnvio}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={enviar} disabled={enviando || escolhidas < AVALIACOES.length} icon={CalendarCheck}>
              {enviando ? 'Enviando…' : 'Enviar solicitação ao pesquisador'}
            </Button>
            <span className="text-xs text-slate-400">
              {escolhidas} de {AVALIACOES.length} avaliações com data e horário
            </span>
          </div>
        </div>
      </section>
    </div>,
  )
}

function Campo({ id, label, erro, children }: { id: string; label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} <span className="text-red-500">*</span>
      </label>
      {children}
      {erro && <p className="mt-1 text-xs text-red-500">{erro}</p>}
    </div>
  )
}

