import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Handshake, ImagePlus, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { adicionarAnexo, atualizarRegistro, criarRegistro } from '@/data/registros'
import { ACCEPT_FOTO, TIPOS_REGISTRO, validarRegistro, type DadosRegistro, type Registro, type TipoRegistro } from '@/lib/registros'
import { hojeISO } from '@/lib/agendamento'
import { mensagemErro } from '@/lib/utils'

/**
 * Cria ou edita um registro (visita, evento, oficina…). Ao criar, já dá para escolher as fotos
 * (do celular ou do computador): elas sobem logo depois que o registro é salvo.
 */
export function RegistroFormModal({
  open,
  onClose,
  registro,
  onSalvo,
}: {
  open: boolean
  onClose: () => void
  /** Presente = edição. */
  registro?: Registro
  /** Chamado com o id quando salvou tudo (para abrir o detalhe). */
  onSalvo?: (id: string) => void
}) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<TipoRegistro>('visita')
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(hojeISO())
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [local, setLocal] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [participantes, setParticipantes] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ata, setAta] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const inputFotos = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTipo(registro?.tipo ?? 'visita')
    setTitulo(registro?.titulo ?? '')
    setData(registro?.data ?? hojeISO())
    setHoraInicio(registro?.horaInicio ?? '')
    setHoraFim(registro?.horaFim ?? '')
    setLocal(registro?.local ?? '')
    setInstituicao(registro?.instituicao ?? '')
    setResponsavel(registro?.responsavel ?? '')
    setParticipantes(registro?.participantes !== undefined ? String(registro.participantes) : '')
    setDescricao(registro?.descricao ?? '')
    setAta(registro?.ata ?? '')
    setFotos([])
    setErro(null)
    setProgresso(null)
    setAviso(null)
  }, [open, registro])

  const ocupado = progresso !== null

  async function salvar() {
    const dados: DadosRegistro = {
      tipo,
      titulo,
      data,
      horaInicio: horaInicio || undefined,
      horaFim: horaFim || undefined,
      local,
      instituicao,
      responsavel,
      participantes: participantes.trim() === '' ? undefined : Number(participantes),
      descricao,
      ata,
    }
    const invalido = validarRegistro(dados)
    if (invalido) return setErro(invalido)
    setErro(null)
    setProgresso('Salvando…')
    try {
      let id = registro?.id
      if (registro) await atualizarRegistro(registro.id, dados)
      else id = await criarRegistro(dados)
      qc.invalidateQueries({ queryKey: ['registros'] })

      // Fotos escolhidas na criação: sobem uma a uma; falhas não desfazem o registro.
      const falhas: string[] = []
      for (const [i, f] of fotos.entries()) {
        setProgresso(`Enviando foto ${i + 1} de ${fotos.length}…`)
        try {
          await adicionarAnexo(id!, f, 'foto')
        } catch (e) {
          falhas.push(mensagemErro(e))
        }
      }
      qc.invalidateQueries({ queryKey: ['registros'] })
      setProgresso(null)
      if (falhas.length > 0) {
        setAviso(`Registro salvo, mas ${falhas.length} foto(s) não subiram: ${falhas.join(' ')} Você pode tentar de novo pelo detalhe do registro.`)
        return
      }
      onSalvo?.(id!)
      onClose()
    } catch (e) {
      setProgresso(null)
      setErro(mensagemErro(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={ocupado ? () => undefined : onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Handshake className="h-5 w-5" />
          </span>
          {registro ? 'Editar registro' : 'Novo registro'}
        </span>
      }
      footer={
        aviso ? (
          <Button onClick={onClose}>Fechar</Button>
        ) : (
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button variant="secondary" onClick={onClose} disabled={ocupado} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={ocupado || !titulo.trim()} className="w-full sm:w-auto">
              {progresso ?? 'Salvar'}
            </Button>
          </div>
        )
      }
    >
      {aviso ? (
        <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{aviso}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Tipo">
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoRegistro)}>
                {TIPOS_REGISTRO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Título">
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Visita da Escola Estadual Prof. Maria" autoFocus />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Data">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
            <Field label="Início (opcional)">
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </Field>
            <Field label="Fim (opcional)">
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Local">
              <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Arena Sabiazinho" />
            </Field>
            <Field label="Instituição / público" hint="Escola, empresa ou grupo que participou.">
              <Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
            </Field>
            <Field label="Responsável no CINTESP">
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </Field>
            <Field label="Nº de participantes">
              <Input type="number" min={0} inputMode="numeric" value={participantes} onChange={(e) => setParticipantes(e.target.value)} />
            </Field>
          </div>

          <Field label="Descrição">
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que foi feito, quem participou, destaques…" />
          </Field>
          <Field label="Ata / resumo" hint="Entra no relatório exportado. Você também pode anexar o arquivo da ata depois, no detalhe do registro.">
            <Textarea value={ata} onChange={(e) => setAta(e.target.value)} className="min-h-[110px]" />
          </Field>

          {!registro && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Fotos (opcional)</span>
              <input
                ref={inputFotos}
                type="file"
                accept={ACCEPT_FOTO}
                multiple
                className="hidden"
                onChange={(e) => {
                  setFotos((a) => [...a, ...Array.from(e.target.files ?? [])])
                  if (inputFotos.current) inputFotos.current.value = ''
                }}
              />
              <Button type="button" variant="secondary" icon={ImagePlus} onClick={() => inputFotos.current?.click()} className="w-full sm:w-auto">
                Escolher fotos
              </Button>
              {fotos.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {fotos.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <span className="truncate">{f.name}</span>
                      <button type="button" aria-label={`Remover ${f.name}`} onClick={() => setFotos((a) => a.filter((_, k) => k !== i))} className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
        </div>
      )}
    </Modal>
  )
}
