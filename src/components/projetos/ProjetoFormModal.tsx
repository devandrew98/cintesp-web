import { useState, type FormEvent } from 'react'
import { FolderKanban } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { STATUS_PROJETO, statusProjetoInfo } from '@/lib/projetos'
import { EquipeCamposForm } from './EquipeCamposForm'
import type { DadosProjeto } from '@/data/projetos'
import type { CampoEditavelProjeto, StatusProjeto, Usuario } from '@/types'

/** Modal (admin) para criar um projeto: dados básicos + equipe + permissões dos membros. */
export function ProjetoFormModal({
  open,
  onClose,
  onSalvar,
  salvando,
  pesquisadores,
}: {
  open: boolean
  onClose: () => void
  onSalvar: (dados: DadosProjeto) => void
  salvando?: boolean
  pesquisadores: Usuario[]
}) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState<StatusProjeto>('planejamento')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFimPrevista, setDataFimPrevista] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [membrosIds, setMembrosIds] = useState<string[]>([])
  const [camposLiberados, setCamposLiberados] = useState<CampoEditavelProjeto[]>(['trl', 'progresso'])

  function alternarMembro(id: string) {
    setMembrosIds((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))
  }
  function alternarCampo(campo: CampoEditavelProjeto) {
    setCamposLiberados((atual) => (atual.includes(campo) ? atual.filter((x) => x !== campo) : [...atual, campo]))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!responsavelId) return
    onSalvar({
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      status,
      dataInicio: dataInicio || undefined,
      dataFimPrevista: dataFimPrevista || undefined,
      responsavelId,
      pesquisadoresIds: membrosIds,
      camposEditaveisMembros: camposLiberados,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <FolderKanban className="h-5 w-5" />
          </span>
          Novo projeto
        </span>
      }
      subtitle="Defina o responsável, a equipe vinculada e o que os demais membros podem editar."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-projeto" disabled={salvando || !titulo.trim() || !responsavelId}>
            {salvando ? 'Criando…' : 'Criar projeto'}
          </Button>
        </>
      }
    >
      <form id="form-projeto" onSubmit={enviar} className="space-y-4">
        <Field label="Título do projeto">
          <Input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Cadeira de Rodas Inteligente com Sensores de Obstáculo"
          />
        </Field>

        <Field label="Descrição (opcional)">
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Objetivo do projeto, escopo, contexto..."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Status inicial">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusProjeto)}>
              {STATUS_PROJETO.map((s) => (
                <option key={s} value={s}>
                  {statusProjetoInfo[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Início">
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </Field>
          <Field label="Fim previsto">
            <Input type="date" value={dataFimPrevista} onChange={(e) => setDataFimPrevista(e.target.value)} />
          </Field>
        </div>

        <EquipeCamposForm
          pesquisadores={pesquisadores}
          responsavelId={responsavelId}
          onResponsavelChange={setResponsavelId}
          membrosIds={membrosIds}
          onAlternarMembro={alternarMembro}
          camposLiberados={camposLiberados}
          onAlternarCampo={alternarCampo}
        />
      </form>
    </Modal>
  )
}
