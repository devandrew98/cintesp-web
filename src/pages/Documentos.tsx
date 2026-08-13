import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FolderOpen,
  Search,
  SlidersHorizontal,
  Plus,
  Download,
  Pencil,
  Trash2,
  Building2,
  Tag,
  Calendar,
  User,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DocumentoFormModal, type DadosFormularioDocumento } from '@/components/documentos/DocumentoFormModal'
import {
  listarDocumentos,
  criarDocumento,
  atualizarDocumento,
  excluirDocumento,
  enviarArquivoDocumento,
} from '@/data/documentos'
import {
  CATEGORIAS_DOCUMENTO,
  DEPARTAMENTOS_DOCUMENTO,
  rotuloCategoria,
  rotuloDepartamento,
  iconePorArquivo,
  formatarTamanhoArquivo,
} from '@/lib/documentos'
import { usePermissoes } from '@/hooks/usePermissoes'
import { formatDateBR, mensagemErro } from '@/lib/utils'
import type { CategoriaDocumento, DepartamentoDocumento, Documento } from '@/types'

/**
 * "Documentos" — biblioteca de arquivos disponibilizados pela administração
 * (formulários, manuais, políticas etc.), na área dos pesquisadores.
 * Qualquer usuário logado vê e baixa; enviar/editar/excluir é só admin
 * (escondido aqui por conforto — o banco é quem realmente barra, via RLS).
 */
export function DocumentosPage() {
  const qc = useQueryClient()
  const { ehAdmin } = usePermissoes()

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ['documentos'],
    queryFn: listarDocumentos,
  })

  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaDocumento | 'todas'>('todas')
  const [departamentoFiltro, setDepartamentoFiltro] = useState<DepartamentoDocumento | 'todos'>('todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const [modalAberto, setModalAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Documento | null>(null)
  const [aExcluir, setAExcluir] = useState<Documento | null>(null)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [enviandoArquivo, setEnviandoArquivo] = useState(false)

  const invalidar = () => qc.invalidateQueries({ queryKey: ['documentos'] })

  const criar = useMutation({
    mutationFn: criarDocumento,
    onSuccess: () => {
      invalidar()
      fecharModal()
    },
  })
  const editar = useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Parameters<typeof atualizarDocumento>[1] }) =>
      atualizarDocumento(id, dados),
    onSuccess: () => {
      invalidar()
      fecharModal()
    },
  })
  const remover = useMutation({
    mutationFn: excluirDocumento,
    onSuccess: () => {
      invalidar()
      setAExcluir(null)
    },
  })

  function fecharModal() {
    setModalAberto(false)
    setEmEdicao(null)
    setErroSalvar(null)
  }

  async function salvar(dados: DadosFormularioDocumento) {
    setErroSalvar(null)
    try {
      let arquivoEnviado: Awaited<ReturnType<typeof enviarArquivoDocumento>> | undefined
      if (dados.arquivo) {
        setEnviandoArquivo(true)
        arquivoEnviado = await enviarArquivoDocumento(dados.arquivo)
      }
      const base = {
        titulo: dados.titulo,
        descricao: dados.descricao,
        categoria: dados.categoria,
        departamento: dados.departamento,
      }
      if (emEdicao) {
        await editar.mutateAsync({
          id: emEdicao.id,
          dados: {
            ...base,
            ...(arquivoEnviado
              ? {
                  arquivoUrl: arquivoEnviado.url,
                  arquivoNome: arquivoEnviado.nome,
                  arquivoTipo: arquivoEnviado.tipo,
                  arquivoTamanho: arquivoEnviado.tamanho,
                }
              : {}),
          },
        })
      } else if (arquivoEnviado) {
        await criar.mutateAsync({
          ...base,
          arquivoUrl: arquivoEnviado.url,
          arquivoNome: arquivoEnviado.nome,
          arquivoTipo: arquivoEnviado.tipo,
          arquivoTamanho: arquivoEnviado.tamanho,
        })
      }
    } catch (err) {
      setErroSalvar(mensagemErro(err))
    } finally {
      setEnviandoArquivo(false)
    }
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista
      .filter((d) => categoriaFiltro === 'todas' || d.categoria === categoriaFiltro)
      .filter((d) => departamentoFiltro === 'todos' || d.departamento === departamentoFiltro)
      .filter((d) => {
        if (!q) return true
        return `${d.titulo} ${d.descricao ?? ''} ${d.arquivoNome}`.toLowerCase().includes(q)
      })
      .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm))
  }, [lista, busca, categoriaFiltro, departamentoFiltro])

  const kpis = useMemo(
    () => ({
      total: lista.length,
      categorias: new Set(lista.map((d) => d.categoria)).size,
      departamentos: new Set(lista.map((d) => d.departamento)).size,
    }),
    [lista],
  )

  const salvando = criar.isPending || editar.isPending || enviandoArquivo

  return (
    <div>
      <PageHeader
        title="Documentos"
        subtitle="Formulários, manuais e outros arquivos disponibilizados pela administração."
        actions={
          <>
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar documentos..."
                className="h-10 w-56 pl-9"
              />
            </div>
            <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setMostrarFiltros((v) => !v)}>
              Filtros
            </Button>
            {ehAdmin && (
              <Button icon={Plus} onClick={() => setModalAberto(true)}>
                Novo documento
              </Button>
            )}
          </>
        }
      />

      {/* Busca no mobile */}
      <div className="relative mb-4 sm:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar documentos..." className="pl-9" />
      </div>

      {/* Filtros por categoria + departamento */}
      {mostrarFiltros && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value as typeof categoriaFiltro)}>
            <option value="todas">Todas as categorias</option>
            {CATEGORIAS_DOCUMENTO.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            value={departamentoFiltro}
            onChange={(e) => setDepartamentoFiltro(e.target.value as typeof departamentoFiltro)}
          >
            <option value="todos">Todos os departamentos</option>
            {DEPARTAMENTOS_DOCUMENTO.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.total}</p>
          <p className="text-sm text-slate-500">Documentos disponíveis</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.categorias}</p>
          <p className="text-sm text-slate-500">Categorias em uso</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.departamentos}</p>
          <p className="text-sm text-slate-500">Departamentos em uso</p>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400">Carregando documentos…</p>
      ) : filtrados.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-16 text-center">
          <FolderOpen className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            {lista.length === 0
              ? 'Nenhum documento disponível ainda.'
              : 'Nenhum documento encontrado para os filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((doc) => (
            <DocumentoCard
              key={doc.id}
              documento={doc}
              podeGerenciar={ehAdmin}
              onEditar={() => {
                setEmEdicao(doc)
                setModalAberto(true)
              }}
              onExcluir={() => setAExcluir(doc)}
            />
          ))}
        </div>
      )}

      {/* Formulário: envia um documento novo OU edita um existente (admin) */}
      {modalAberto && (
        <DocumentoFormModal
          key={emEdicao?.id ?? 'novo'}
          open={modalAberto}
          documentoEmEdicao={emEdicao}
          salvando={salvando}
          erro={erroSalvar}
          onClose={fecharModal}
          onSalvar={salvar}
        />
      )}

      <ConfirmDialog
        open={Boolean(aExcluir)}
        onClose={() => setAExcluir(null)}
        onConfirm={() => aExcluir && remover.mutate(aExcluir.id)}
        title="Excluir documento"
        message={`Tem certeza que deseja excluir "${aExcluir?.titulo}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  )
}

function DocumentoCard({
  documento,
  podeGerenciar,
  onEditar,
  onExcluir,
}: {
  documento: Documento
  podeGerenciar: boolean
  onEditar: () => void
  onExcluir: () => void
}) {
  const Icone = iconePorArquivo(documento.arquivoNome || documento.arquivoTipo)

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Icone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900 dark:text-white">{documento.titulo}</h3>
            <p className="truncate text-xs text-slate-400">
              {documento.arquivoNome} · {formatarTamanhoArquivo(documento.arquivoTamanho)}
            </p>
          </div>
        </div>
        {podeGerenciar && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onEditar}
              title="Editar documento"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onExcluir}
              title="Excluir documento"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {documento.descricao && (
        <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{documento.descricao}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="green">
          <Tag className="h-3 w-3" /> {rotuloCategoria(documento.categoria)}
        </Badge>
        <Badge tone="slate">
          <Building2 className="h-3 w-3" /> {rotuloDepartamento(documento.departamento)}
        </Badge>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> {formatDateBR(documento.criadoEm)}
          </span>
          {documento.autorNome && (
            <span className="inline-flex items-center gap-1.5 truncate">
              <User className="h-3.5 w-3.5 shrink-0" /> {documento.autorNome}
            </span>
          )}
        </div>
        <a
          href={documento.arquivoUrl}
          download={documento.arquivoNome}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          <Download className="h-4 w-4" /> Baixar
        </a>
      </div>
    </div>
  )
}
