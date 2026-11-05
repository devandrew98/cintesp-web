import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { criarEvento, type Solicitacao, type TipoEvento } from '@/data/agendamentos'
import { dataBR, fimDoBloco, hojeISO } from '@/lib/agendamento'
import { mensagemErro } from '@/lib/utils'

/**
 * Cria um compromisso ou um bloqueio (horário indisponível) na agenda do avaliador.
 * Os dois tiram os blocos do formulário público. Avisa — sem impedir — se o horário
 * já tem avaliação de alguém marcada.
 */
export function EventoModal({
  open,
  onClose,
  dataInicial,
  tipoInicial = 'compromisso',
  solicitacoes,
}: {
  open: boolean
  onClose: () => void
  dataInicial?: string
  tipoInicial?: TipoEvento
  solicitacoes: Solicitacao[]
}) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<TipoEvento>(tipoInicial)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(dataInicial ?? hojeISO())
  const [diaInteiro, setDiaInteiro] = useState(false)
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFim, setHoraFim] = useState('09:00')
  const [notas, setNotas] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTipo(tipoInicial)
    setTitulo('')
    setData(dataInicial ?? hojeISO())
    setDiaInteiro(false)
    setHoraInicio('08:00')
    setHoraFim('09:00')
    setNotas('')
    setErro(null)
  }, [open, dataInicial, tipoInicial])

  // Avaliações marcadas que esse evento atropelaria.
  const conflitos = useMemo(() => {
    return solicitacoes
      .filter((s) => s.status !== 'cancelado')
      .flatMap((s) => s.itens.map((i) => ({ s, i })))
      .filter(({ i }) => i.status !== 'cancelado' && i.data === data && (diaInteiro || (horaInicio < fimDoBloco(i.hora) && horaFim > i.hora)))
  }, [solicitacoes, data, diaInteiro, horaInicio, horaFim])

  const salvar = useMutation({
    mutationFn: () => criarEvento({ tipo, titulo, data, diaInteiro, horaInicio: diaInteiro ? undefined : horaInicio, horaFim: diaInteiro ? undefined : horaFim, notas }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agendamento-eventos'] })
      qc.invalidateQueries({ queryKey: ['agendamento-ocupados'] })
      onClose()
    },
    onError: (e) => setErro(mensagemErro(e)),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <CalendarPlus className="h-5 w-5" />
          </span>
          {tipo === 'bloqueio' ? 'Bloquear horário' : 'Novo compromisso'}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !titulo.trim()}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tipo" hint="Os dois tiram o horário do formulário público; o bloqueio é para ausências, feriados e indisponibilidades.">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)}>
            <option value="compromisso">Compromisso</option>
            <option value="bloqueio">Bloqueio (indisponível)</option>
          </Select>
        </Field>
        <Field label="Título">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === 'bloqueio' ? 'Ex.: Feriado, congresso, indisponível' : 'Ex.: Reunião com a coordenação'} />
        </Field>
        <Field label="Data">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Dia inteiro
        </label>
        {!diaInteiro && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </Field>
            <Field label="Fim">
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label="Notas (opcional)">
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} className="min-h-[64px]" />
        </Field>

        {conflitos.length > 0 && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <p className="font-medium">Atenção: já há avaliações marcadas nesse horário.</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {conflitos.map(({ s, i }) => (
                <li key={i.id}>
                  {s.nome} — {i.avaliacaoNome}, {dataBR(i.data)} às {i.hora}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Elas continuam marcadas. Desmarque-as na aba Solicitações se quiser liberar o horário.</p>
          </div>
        )}
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
