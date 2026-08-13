import { useRef, useState, type FormEvent } from 'react'
import { UploadCloud, Paperclip, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Field'
import { CATEGORIAS_DOCUMENTO, DEPARTAMENTOS_DOCUMENTO, formatarTamanhoArquivo } from '@/lib/documentos'
import type { CategoriaDocumento, DepartamentoDocumento, Documento } from '@/types'

/** Limite de tamanho do arquivo (o Storage/CDN também deve aplicar o mesmo limite). */
const TAMANHO_MAX_MB = 25

export interface DadosFormularioDocumento {
  titulo: string
  descricao?: string
  categoria: CategoriaDocumento
  departamento: DepartamentoDocumento
  /** Só vem preenchido quando um arquivo novo foi escolhido (upload ou troca). */
  arquivo?: File
}

/** Modal para enviar um documento novo ou editar um já publicado (admin). */
export function DocumentoFormModal({
  open,
  onClose,
  onSalvar,
  documentoEmEdicao,
  salvando,
  erro,
}: {
  open: boolean
  onClose: () => void
  onSalvar: (dados: DadosFormularioDocumento) => void
  documentoEmEdicao?: Documento | null
  salvando?: boolean
  erro?: string | null
}) {
  const editando = Boolean(documentoEmEdicao)
  const inputRef = useRef<HTMLInputElement>(null)

  const [titulo, setTitulo] = useState(documentoEmEdicao?.titulo ?? '')
  const [descricao, setDescricao] = useState(documentoEmEdicao?.descricao ?? '')
  const [categoria, setCategoria] = useState<CategoriaDocumento>(documentoEmEdicao?.categoria ?? 'formulario')
  const [departamento, setDepartamento] = useState<DepartamentoDocumento>(
    documentoEmEdicao?.departamento ?? 'geral',
  )
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)

  function escolherArquivo(f: File | null) {
    setErroArquivo(null)
    if (f && f.size > TAMANHO_MAX_MB * 1024 * 1024) {
      setErroArquivo(`O arquivo deve ter no máximo ${TAMANHO_MAX_MB} MB.`)
      return
    }
    setArquivo(f)
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!editando && !arquivo) {
      setErroArquivo('Selecione o arquivo para enviar.')
      return
    }
    onSalvar({
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      categoria,
      departamento,
      arquivo: arquivo ?? undefined,
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
            <UploadCloud className="h-5 w-5" />
          </span>
          {editando ? 'Editar documento' : 'Novo documento'}
        </span>
      }
      subtitle={
        editando
          ? 'Atualize os dados ou substitua o arquivo. As alterações aparecem para todos assim que salvas.'
          : 'Disponibilize um arquivo para os pesquisadores acessarem e baixarem.'
      }
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-documento" disabled={salvando || !titulo.trim()}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Publicar documento'}
          </Button>
        </>
      }
    >
      <form id="form-documento" onSubmit={enviar} className="space-y-4">
        <Field label="Título">
          <Input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Manual do Pesquisador CINTESP.Br"
          />
        </Field>

        <Field label="Descrição (opcional)">
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Do que se trata este documento, quando usar, etc."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}>
              {CATEGORIAS_DOCUMENTO.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Departamento">
            <Select
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value as DepartamentoDocumento)}
            >
              {DEPARTAMENTOS_DOCUMENTO.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={editando ? 'Substituir arquivo (opcional)' : 'Arquivo'}>
          {arquivo ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
              <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{arquivo.name}</span>
              <span className="shrink-0 text-xs text-slate-400">{formatarTamanhoArquivo(arquivo.size)}</span>
              <button
                type="button"
                onClick={() => escolherArquivo(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                aria-label="Remover arquivo selecionado"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-600"
            >
              <UploadCloud className="h-4 w-4" />
              {editando ? `Manter "${documentoEmEdicao?.arquivoNome}" (clique para trocar)` : 'Selecionar arquivo'}
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              escolherArquivo(e.target.files?.[0] ?? null)
              if (inputRef.current) inputRef.current.value = ''
            }}
          />
          <p className="mt-1 text-xs text-slate-400">Tamanho máximo: {TAMANHO_MAX_MB} MB.</p>
        </Field>

        {(erroArquivo || erro) && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {erroArquivo || erro}
          </p>
        )}
      </form>
    </Modal>
  )
}
