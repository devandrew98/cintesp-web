import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, Download, FileText, Handshake, ImagePlus, Loader2, MapPin, Pencil, Trash2, Upload, User, Users } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { adicionarAnexo, removerAnexo, urlDeDownload, urlsDosAnexos } from '@/data/registros'
import { usePermissoes } from '@/hooks/usePermissoes'
import {
  ACCEPT_DOCUMENTO,
  ACCEPT_FOTO,
  ROTULO_CATEGORIA,
  dataBR,
  documentosDe,
  formatarTamanho,
  fotosDe,
  pillTipo,
  podeEditarRegistro,
  podeRemoverAnexo,
  rotuloHorario,
  rotuloTipo,
  type AnexoRegistro,
  type CategoriaAnexo,
  type Registro,
} from '@/lib/registros'
import { cn, mensagemErro } from '@/lib/utils'

/** Detalhe do registro: dados, ata, galeria de fotos e documentos. Todos podem anexar fotos/documentos. */
export function RegistroDetalheModal({
  registro,
  onClose,
  onEditar,
  onExcluir,
}: {
  registro: Registro | null
  onClose: () => void
  onEditar: () => void
  onExcluir: () => void
}) {
  const qc = useQueryClient()
  const { perfil, ehAdmin } = usePermissoes()
  const inputFotos = useRef<HTMLInputElement>(null)
  const inputDocs = useRef<HTMLInputElement>(null)
  const [categoriaDoc, setCategoriaDoc] = useState<CategoriaAnexo>('ata')
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const fotos = registro ? fotosDe(registro) : []
  const docs = registro ? documentosDe(registro) : []
  const caminhosFotos = fotos.map((f) => f.caminho)
  const { data: urls = new Map<string, string>() } = useQuery({
    queryKey: ['registros-urls', caminhosFotos.join('|')],
    queryFn: () => urlsDosAnexos(caminhosFotos),
    enabled: caminhosFotos.length > 0,
    staleTime: 30 * 60_000,
  })

  if (!registro) return null
  const dono = podeEditarRegistro(registro, perfil?.id, ehAdmin)

  async function enviar(arquivos: File[], categoria: CategoriaAnexo) {
    if (arquivos.length === 0 || !registro) return
    setErro(null)
    const falhas: string[] = []
    for (const [i, f] of arquivos.entries()) {
      setEnviando(`Enviando ${i + 1} de ${arquivos.length}…`)
      try {
        await adicionarAnexo(registro.id, f, categoria)
        await qc.invalidateQueries({ queryKey: ['registros'] })
      } catch (e) {
        falhas.push(mensagemErro(e))
      }
    }
    setEnviando(null)
    if (falhas.length > 0) setErro(falhas.join(' '))
  }

  async function remover(a: AnexoRegistro) {
    if (!window.confirm(`Remover "${a.nome}"? Esta ação não pode ser desfeita.`)) return
    setErro(null)
    try {
      await removerAnexo(a)
      await qc.invalidateQueries({ queryKey: ['registros'] })
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  async function baixar(a: AnexoRegistro) {
    try {
      const url = await urlDeDownload(a)
      const link = document.createElement('a')
      link.href = url
      link.download = a.nome
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  const info: { icon: typeof Calendar; texto?: string }[] = [
    { icon: Calendar, texto: dataBR(registro.data) },
    { icon: Clock, texto: rotuloHorario(registro) },
    { icon: MapPin, texto: registro.local },
    { icon: Users, texto: [registro.instituicao, registro.participantes !== undefined ? `${registro.participantes} participante(s)` : ''].filter(Boolean).join(' · ') },
    { icon: User, texto: registro.responsavel ? `Responsável: ${registro.responsavel}` : '' },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Handshake className="h-5 w-5" />
          </span>
          <span className="min-w-0">{registro.titulo}</span>
        </span>
      }
      subtitle={registro.criadoPorNome ? `Registrado por ${registro.criadoPorNome}` : undefined}
      footer={
        dono ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button variant="ghost" icon={Trash2} onClick={onExcluir} className="w-full text-red-600 sm:mr-2 sm:w-auto">
              Excluir
            </Button>
            <Button variant="secondary" icon={Pencil} onClick={onEditar} className="w-full sm:w-auto">
              Editar
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', pillTipo(registro.tipo))}>{rotuloTipo(registro.tipo)}</span>
        </div>

        <ul className="grid grid-cols-1 gap-2 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
          {info
            .filter((i) => i.texto)
            .map((i) => (
              <li key={i.icon.displayName ?? i.texto} className="flex items-start gap-2.5">
                <i.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 break-words">{i.texto}</span>
              </li>
            ))}
        </ul>

        {registro.descricao && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Descrição</h3>
            <p className="whitespace-pre-line break-words text-sm text-slate-700 dark:text-slate-200">{registro.descricao}</p>
          </section>
        )}
        {registro.ata && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Ata / resumo</h3>
            <p className="whitespace-pre-line break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">{registro.ata}</p>
          </section>
        )}

        {/* Fotos */}
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fotos ({fotos.length})</h3>
            <input
              ref={inputFotos}
              type="file"
              accept={ACCEPT_FOTO}
              multiple
              className="hidden"
              onChange={(e) => {
                enviar(Array.from(e.target.files ?? []), 'foto')
                if (inputFotos.current) inputFotos.current.value = ''
              }}
            />
            <Button size="sm" variant="secondary" icon={ImagePlus} disabled={Boolean(enviando)} onClick={() => inputFotos.current?.click()}>
              Adicionar fotos
            </Button>
          </div>
          {fotos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-700">Nenhuma foto ainda. Qualquer pesquisador pode adicionar.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {fotos.map((f) => {
                const url = urls.get(f.caminho)
                return (
                  <li key={f.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" title={f.nome}>
                        <img src={url} alt={f.nome} loading="lazy" className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <span className="flex h-full items-center justify-center text-slate-300">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </span>
                    )}
                    {podeRemoverAnexo(f, registro, perfil?.id, ehAdmin) && (
                      <button
                        type="button"
                        aria-label={`Remover foto ${f.nome}`}
                        onClick={() => remover(f)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1.5 text-white sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {f.enviadoPorNome && <span className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-4 text-[10px] text-white">{f.enviadoPorNome}</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Documentos e atas */}
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Documentos e atas ({docs.length})</h3>
            <div className="flex items-center gap-2">
              <Select value={categoriaDoc} onChange={(e) => setCategoriaDoc(e.target.value as CategoriaAnexo)} className="h-9 w-auto py-1" aria-label="Tipo do arquivo">
                <option value="ata">Ata</option>
                <option value="documento">Documento</option>
              </Select>
              <input
                ref={inputDocs}
                type="file"
                accept={ACCEPT_DOCUMENTO}
                multiple
                className="hidden"
                onChange={(e) => {
                  enviar(Array.from(e.target.files ?? []), categoriaDoc)
                  if (inputDocs.current) inputDocs.current.value = ''
                }}
              />
              <Button size="sm" variant="secondary" icon={Upload} disabled={Boolean(enviando)} onClick={() => inputDocs.current?.click()}>
                Importar
              </Button>
            </div>
          </div>
          {docs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400 dark:border-slate-700">Nenhum documento ou ata importado.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {docs.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{a.nome}</p>
                    <p className="text-xs text-slate-400">
                      {ROTULO_CATEGORIA[a.categoria]} · {formatarTamanho(a.tamanho)}
                      {a.enviadoPorNome ? ` · ${a.enviadoPorNome}` : ''}
                    </p>
                  </div>
                  <button type="button" aria-label={`Baixar ${a.nome}`} onClick={() => baixar(a)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <Download className="h-4 w-4" />
                  </button>
                  {podeRemoverAnexo(a, registro, perfil?.id, ehAdmin) && (
                    <button type="button" aria-label={`Remover ${a.nome}`} onClick={() => remover(a)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {enviando && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {enviando}
          </p>
        )}
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
