import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { PUBLICOS_ALVO, PUBLICO_OUTRO } from '@/lib/avisos'
import type { Aviso, StatusAviso, TipoAviso } from '@/types'

interface AvisoFormModalProps {
  open: boolean
  onClose: () => void
  /** Recebe o aviso pronto (novo ou editado). */
  onSalvar: (aviso: Aviso) => void
  /** Quando presente, o modal entra em modo EDIÇÃO deste aviso. */
  avisoEmEdicao?: Aviso | null
  salvando?: boolean
}

const hoje = new Date().toISOString().slice(0, 10)

/**
 * Formulário de aviso — serve para criar e para editar.
 *
 * O público-alvo virou uma lista de opções (Todos, Pesquisadores,
 * Administradores, Coordenação) com a alternativa "Outro" para digitar algo
 * específico, evitando que cada aviso use uma escrita diferente.
 */
export function AvisoFormModal({
  open,
  onClose,
  onSalvar,
  avisoEmEdicao,
  salvando,
}: AvisoFormModalProps) {
  const editando = Boolean(avisoEmEdicao)

  // Valores iniciais: do aviso em edição ou em branco.
  const [titulo, setTitulo] = useState(avisoEmEdicao?.titulo ?? '')
  const [descricao, setDescricao] = useState(avisoEmEdicao?.descricao ?? '')
  const [tipo, setTipo] = useState<TipoAviso>(avisoEmEdicao?.tipo ?? 'geral')
  const [data, setData] = useState(avisoEmEdicao?.data?.slice(0, 10) ?? hoje)
  const [hora, setHora] = useState(avisoEmEdicao?.hora ?? '')
  const [status, setStatus] = useState<StatusAviso>(avisoEmEdicao?.status ?? 'ativo')
  const [destaque, setDestaque] = useState(avisoEmEdicao?.destaque ?? false)

  // Público-alvo: se o valor salvo não estiver na lista, cai em "Outro".
  const publicoSalvo = avisoEmEdicao?.publicoAlvo
  const publicoConhecido =
    !publicoSalvo || (PUBLICOS_ALVO as readonly string[]).includes(publicoSalvo)
  const [publicoOpcao, setPublicoOpcao] = useState<string>(
    publicoConhecido ? (publicoSalvo ?? 'Todos') : PUBLICO_OUTRO,
  )
  const [publicoLivre, setPublicoLivre] = useState(publicoConhecido ? '' : (publicoSalvo ?? ''))

  const publicoFinal = publicoOpcao === PUBLICO_OUTRO ? publicoLivre.trim() : publicoOpcao

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const registro: Aviso = {
      id: avisoEmEdicao?.id ?? `av-${Date.now()}`,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tipo,
      status,
      destaque,
      data: new Date(`${data}T${hora || '00:00'}`).toISOString(),
      hora: hora || undefined,
      publicoAlvo: publicoFinal || 'Todos',
      autor: avisoEmEdicao?.autor,
      publicadoHa: avisoEmEdicao?.publicadoHa ?? (status === 'ativo' ? 'agora' : undefined),
      visualizacoes: avisoEmEdicao?.visualizacoes ?? 0,
    }
    onSalvar(registro)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar aviso' : 'Novo Aviso'}
      subtitle={
        editando
          ? 'As alterações aparecem para todos assim que salvas.'
          : 'Publique um comunicado para a equipe.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-aviso" disabled={salvando}>
            {salvando
              ? 'Salvando...'
              : editando
                ? 'Salvar alterações'
                : status === 'programado'
                  ? 'Programar aviso'
                  : 'Publicar aviso'}
          </Button>
        </>
      }
    >
      <form id="form-aviso" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Título">
          <Input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Reunião geral da equipe"
          />
        </Field>

        <Field label="Descrição">
          <Textarea
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhe o comunicado..."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAviso)}>
              <option value="geral">Geral</option>
              <option value="importante">Importante</option>
              <option value="reuniao">Reunião</option>
              <option value="treinamento">Treinamento</option>
            </Select>
          </Field>

          <Field label="Público-alvo">
            <Select value={publicoOpcao} onChange={(e) => setPublicoOpcao(e.target.value)}>
              {PUBLICOS_ALVO.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value={PUBLICO_OUTRO}>Outro (especificar)…</option>
            </Select>
          </Field>
        </div>

        {/* Campo livre só aparece quando escolhe "Outro" */}
        {publicoOpcao === PUBLICO_OUTRO && (
          <Field label="Qual público?">
            <Input
              required
              value={publicoLivre}
              onChange={(e) => setPublicoLivre(e.target.value)}
              placeholder="Ex.: Área de IA e Dados"
            />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Hora (opcional)">
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </Field>
        </div>

        <Field label="Publicação">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusAviso)}>
            <option value="ativo">Publicar agora</option>
            <option value="programado">Programar para depois</option>
            <option value="arquivado">Arquivar</option>
          </Select>
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <input
            type="checkbox"
            checked={destaque}
            onChange={(e) => setDestaque(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Fixar em <strong>Avisos em Destaque</strong>
          </span>
        </label>
      </form>
    </Modal>
  )
}
