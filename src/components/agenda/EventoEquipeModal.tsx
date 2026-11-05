import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { atualizarEventoEquipe, criarEventoEquipe, removerEventoEquipe } from '@/data/agendaEquipe'
import { REPETICOES, rotuloRepeticao, type EventoEquipe, type Repeticao } from '@/lib/agendaEquipe'
import { hojeISO } from '@/lib/agendamento'
import { mensagemErro } from '@/lib/utils'

/**
 * Cria ou edita um evento da agenda da equipe (somente administradores veem este modal).
 * Campos no estilo do Google Agenda: título, período, dia inteiro, repetição, local,
 * videoconferência e descrição.
 */
export function EventoEquipeModal({
  open,
  onClose,
  evento,
  dataInicial,
}: {
  open: boolean
  onClose: () => void
  /** Presente = edição; ausente = novo evento. */
  evento?: EventoEquipe
  dataInicial?: string
}) {
  const qc = useQueryClient()
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(hojeISO())
  const [dataFim, setDataFim] = useState(hojeISO())
  const [diaInteiro, setDiaInteiro] = useState(true)
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFim, setHoraFim] = useState('10:00')
  const [repeticao, setRepeticao] = useState<Repeticao>('nunca')
  const [repeteAte, setRepeteAte] = useState('')
  const [local, setLocal] = useState('')
  const [linkVideo, setLinkVideo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmaExcluir, setConfirmaExcluir] = useState(false)

  useEffect(() => {
    if (!open) return
    const ini = evento?.data ?? dataInicial ?? hojeISO()
    setTitulo(evento?.titulo ?? '')
    setData(ini)
    setDataFim(evento?.dataFim ?? ini)
    setDiaInteiro(evento?.diaInteiro ?? true)
    setHoraInicio(evento?.horaInicio ?? '09:00')
    setHoraFim(evento?.horaFim ?? '10:00')
    setRepeticao(evento?.repeticao ?? 'nunca')
    setRepeteAte(evento?.repeteAte ?? '')
    setLocal(evento?.local ?? '')
    setLinkVideo(evento?.linkVideo ?? '')
    setDescricao(evento?.descricao ?? '')
    setErro(null)
    setConfirmaExcluir(false)
  }, [open, evento, dataInicial])

  const depois = () => {
    qc.invalidateQueries({ queryKey: ['agenda-equipe'] })
    onClose()
  }

  const salvar = useMutation({
    mutationFn: () => {
      const dados = {
        titulo,
        data,
        dataFim: dataFim && dataFim > data ? dataFim : undefined,
        diaInteiro,
        horaInicio: diaInteiro ? undefined : horaInicio,
        horaFim: diaInteiro ? undefined : horaFim,
        repeticao,
        repeteAte: repeticao === 'nunca' ? undefined : repeteAte || undefined,
        local,
        linkVideo,
        descricao,
      }
      return evento ? atualizarEventoEquipe(evento.id, dados) : criarEventoEquipe(dados)
    },
    onSuccess: depois,
    onError: (e) => setErro(mensagemErro(e)),
  })

  const excluir = useMutation({
    mutationFn: () => removerEventoEquipe(evento!.id),
    onSuccess: depois,
    onError: (e) => setErro(mensagemErro(e)),
  })

  // Ao mudar a data inicial, a final nunca fica antes dela.
  const mudarInicio = (v: string) => {
    setData(v)
    if (dataFim < v) setDataFim(v)
  }

  const ocupado = salvar.isPending || excluir.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <CalendarPlus className="h-5 w-5" />
          </span>
          {evento ? 'Editar evento' : 'Novo evento'}
        </span>
      }
      footer={
        <>
          {evento && (
            <Button
              variant={confirmaExcluir ? 'danger' : 'ghost'}
              icon={Trash2}
              className="mr-auto"
              disabled={ocupado}
              onClick={() => (confirmaExcluir ? excluir.mutate() : setConfirmaExcluir(true))}
            >
              {confirmaExcluir ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={ocupado || !titulo.trim()}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Título">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reunião geral da equipe" autoFocus />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Início">
            <Input type="date" value={data} onChange={(e) => mudarInicio(e.target.value)} />
          </Field>
          <Field label="Até">
            <Input type="date" value={dataFim} min={data} onChange={(e) => setDataFim(e.target.value)} />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Dia inteiro
        </label>
        {!diaInteiro && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Horário de início">
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </Field>
            <Field label="Horário de fim">
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Repetição">
            <Select value={repeticao} onChange={(e) => setRepeticao(e.target.value as Repeticao)}>
              {REPETICOES.map((r) => (
                <option key={r} value={r}>
                  {rotuloRepeticao(r, data)}
                </option>
              ))}
            </Select>
          </Field>
          {repeticao !== 'nunca' && (
            <Field label="Repetir até (opcional)">
              <Input type="date" value={repeteAte} min={data} onChange={(e) => setRepeteAte(e.target.value)} />
            </Field>
          )}
        </div>

        <Field label="Local (opcional)">
          <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Arena Sabiazinho" />
        </Field>
        <Field label="Link da videoconferência (opcional)" hint="Cole o link do Google Meet, Teams ou Zoom.">
          <Input type="url" value={linkVideo} onChange={(e) => setLinkVideo(e.target.value)} placeholder="https://meet.google.com/…" />
        </Field>
        <Field label="Descrição (opcional)">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="min-h-[80px]" />
        </Field>

        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
