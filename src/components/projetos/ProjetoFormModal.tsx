import { useState, type FormEvent } from 'react'
import { FolderKanban } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { STATUS_PROJETO, statusProjetoInfo } from '@/lib/projetos'
import { EquipeCamposForm } from './EquipeCamposForm'
import type { DadosProjeto } from '@/data/projetos'
import type { CampoEditavelProjeto, StatusProjeto, Usuario } from '@/types'

/** Modal para criar um projeto (qualquer pesquisador): dados básicos + equipe + permissões dos membros. */
export function ProjetoFormModal({
  open,
  onClose,
  onSalvar,
  salvando,
  pesquisadores,
  responsavelPadraoId = '',
}: {
  open: boolean
  onClose: () => void
  onSalvar: (dados: DadosProjeto) => void
  salvando?: boolean
  pesquisadores: Usuario[]
  /** Quem já vem marcado como responsável (normalmente quem está criando). */
  responsavelPadraoId?: string
}) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState<StatusProjeto>('planejamento')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFimPrevista, setDataFimPrevista] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [grupoUrl, setGrupoUrl] = useState('')
  const [responsavelId, setResponsavelId] = useState(responsavelPadraoId)
  const [membrosIds, setMembrosIds] = useState<string[]>([])
  const [camposLiberados, setCamposLiberados] = useState<CampoEditavelProjeto[]>(['trl'])

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
      driveUrl: driveUrl.trim() || undefined,
      grupoUrl: grupoUrl.trim() || undefined,
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
      subtitle="Você será o dono do projeto: só você, o responsável e o administrador poderão editá-lo."
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Link do grupo de WhatsApp (opcional)" hint="Vira o botão “Entrar no grupo do projeto”. Só a equipe vê.">
            <Input value={grupoUrl} onChange={(e) => setGrupoUrl(e.target.value)} placeholder="https://chat.whatsapp.com/…" inputMode="url" />
          </Field>
          <Field label="Link do Google Drive (opcional)" hint="Só a equipe do projeto vê.">
            <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" />
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
