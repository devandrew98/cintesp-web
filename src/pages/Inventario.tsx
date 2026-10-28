import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ItemInventarioModal } from '@/components/inventario/ItemInventarioModal'
import { ItemInventarioDetalhe } from '@/components/inventario/ItemInventarioDetalhe'
import { ImportarInventarioModal } from '@/components/inventario/ImportarInventarioModal'
import {
  atualizarStatusVistoria,
  baixarFoto,
  excluirItemInventario,
  listarInventario,
  substituirFotoPrincipal,
  urlsDasFotos,
  urlsDasNotas,
} from '@/data/inventario'
import {
  fotoPrincipal,
  fotosFaltando,
  quantidadeDe,
  resumoVistoria,
  STATUS_VISTORIA,
  type ItemInventario,
  type StatusVistoria,
} from '@/lib/inventario'
import { DadosOficioIncompletosError, gerarOficioTombamento } from '@/lib/oficioTombamento'
import { exportarInventarioXlsx } from '@/lib/inventarioPlanilha'
import { baixarArquivo } from '@/lib/assinaturaPdf'
import { cn, mensagemErro } from '@/lib/utils'

const POR_PAGINA = 20
type FiltroStatus = 'todos' | StatusVistoria

const BORDA_STATUS: Record<StatusVistoria, string> = {
  pendente: 'border-l-amber-400',
  localizado: 'border-l-emerald-500',
  nao_localizado: 'border-l-red-500',
}

/**
 * Inventário Patrimonial — levantamento dos bens dos laboratórios (fotos, dados
 * fiscais, status da vistoria) e geração do ofício de tombamento item a item.
 */
export function InventarioPage() {
  const qc = useQueryClient()
  const camRef = useRef<HTMLInputElement>(null)
  const [fotoDe, setFotoDe] = useState<ItemInventario | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [filtroProjeto, setFiltroProjeto] = useState('')
  const [pagina, setPagina] = useState(1)

  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [vendoId, setVendoId] = useState<string | null>(null)
  const [excluir, setExcluir] = useState<ItemInventario | null>(null)
  const [importando, setImportando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null) // id do item com operação em curso

  const { data: itens = [], isLoading, error } = useQuery({ queryKey: ['inventario'], queryFn: listarInventario })

  const editando = itens.find((i) => i.id === editandoId) ?? null
  const vendo = itens.find((i) => i.id === vendoId) ?? null

  // Projetos presentes nos itens (para o filtro).
  const projetos = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const i of itens) {
      const chave = i.projetoNumero?.trim() || i.projetoNome
      if (chave) mapa.set(chave, i.projetoNome ? `${i.projetoNumero ? i.projetoNumero + ' — ' : ''}${i.projetoNome}` : chave)
    }
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [itens])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens.filter((i) => {
      if (filtroStatus !== 'todos' && i.statusVistoria !== filtroStatus) return false
      if (filtroProjeto && (i.projetoNumero?.trim() || i.projetoNome) !== filtroProjeto) return false
      if (!q) return true
      return [i.nome, i.numeroNotaFiscal, i.numeroSerie, i.fornecedor, i.projetoNumero, i.projetoNome, i.localizacao]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [itens, busca, filtroStatus, filtroProjeto])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)
  const resumo = resumoVistoria(itens)

  // Miniaturas só das fotos principais da página atual.
  const caminhosMiniaturas = visiveis.map((i) => fotoPrincipal(i)?.caminho).filter((c): c is string => Boolean(c))
  const { data: urls } = useQuery({
    queryKey: ['inventario-urls', caminhosMiniaturas.join('|')],
    queryFn: () => urlsDasFotos(caminhosMiniaturas),
    enabled: caminhosMiniaturas.length > 0,
    staleTime: 30 * 60 * 1000,
  })

  const invalidar = () => qc.invalidateQueries({ queryKey: ['inventario'] })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusVistoria }) => atualizarStatusVistoria(id, status),
    onSuccess: invalidar,
    onError: (e) => setAviso({ tipo: 'erro', texto: mensagemErro(e) }),
  })

  const excluirMut = useMutation({
    mutationFn: (i: ItemInventario) => excluirItemInventario(i.id, i.fotos, i.notaFiscalCaminho),
    onSuccess: () => {
      invalidar()
      setExcluir(null)
      setAviso({ tipo: 'ok', texto: 'Item excluído.' })
    },
    onError: (e) => setAviso({ tipo: 'erro', texto: mensagemErro(e) }),
  })

  async function enviarFoto(item: ItemInventario, arquivo: File) {
    setOcupado(item.id)
    setAviso(null)
    try {
      await substituirFotoPrincipal(item, arquivo)
      invalidar()
      setAviso({ tipo: 'ok', texto: `Foto de “${item.nome}” salva.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemErro(e) })
    } finally {
      setOcupado(null)
    }
  }

  async function gerarOficio(item: ItemInventario) {
    setAviso(null)
    setOcupado(item.id)
    try {
      const r = await gerarOficioTombamento(item)
      baixarArquivo(r.bytes, r.nomeArquivo)
      setAviso(
        r.semPapelTimbrado
          ? { tipo: 'erro', texto: 'Ofício gerado SEM o papel timbrado (arquivo public/papel-timbrado.png não encontrado).' }
          : { tipo: 'ok', texto: `Ofício de “${item.nome}” gerado.` },
      )
    } catch (e) {
      if (e instanceof DadosOficioIncompletosError) {
        setAviso({ tipo: 'erro', texto: `Não foi possível gerar o ofício de “${item.nome}”. Falta preencher: ${e.campos.join(', ')}.` })
      } else {
        setAviso({ tipo: 'erro', texto: mensagemErro(e) })
      }
    } finally {
      setOcupado(null)
    }
  }

  async function exportar() {
    setAviso(null)
    setOcupado('exportar')
    try {
      // Link da nota na planilha: o do Drive (permanente) ou, na falta dele, um link temporário (7 dias) do arquivo anexado.
      const semDrive = filtrados.filter((i) => !i.notaFiscalLink && i.notaFiscalCaminho).map((i) => i.notaFiscalCaminho!)
      const linksNotas = await urlsDasNotas(semDrive, 7 * 24 * 3600).catch(() => new Map<string, string>())
      const { bytes, fotosEmbutidas } = await exportarInventarioXlsx(filtrados, baixarFoto, linksNotas)
      baixarArquivo(bytes, `Inventario_Patrimonial_${new Date().toISOString().slice(0, 10)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      setAviso({ tipo: 'ok', texto: `Planilha exportada: ${filtrados.length} itens, ${fotosEmbutidas} foto(s) incorporada(s).` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemErro(e) })
    } finally {
      setOcupado(null)
    }
  }

  function abrirNovo() {
    setEditandoId(null)
    setFormAberto(true)
  }
  function abrirEdicao(i: ItemInventario) {
    setVendoId(null)
    setEditandoId(i.id)
    setFormAberto(true)
  }

  return (
    <AdminShell
      actions={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setImportando(true)}>
              Importar
            </Button>
            <Button variant="secondary" icon={ocupado === 'exportar' ? Loader2 : Download} onClick={exportar} disabled={ocupado === 'exportar' || filtrados.length === 0}>
              {ocupado === 'exportar' ? 'Exportando…' : 'Exportar .xlsx'}
            </Button>
            <Button icon={Plus} onClick={abrirNovo}>
              Novo item
            </Button>
          </>
        }
    >
      {/* Resumo da vistoria (texto discreto, não cartões) */}
      <p className="mb-4 text-sm text-slate-500">
        <strong className="text-slate-700 dark:text-slate-200">{resumo.total}</strong> itens ·{' '}
        <span className="text-emerald-600">{resumo.localizados} localizados</span> ·{' '}
        <span className="text-amber-600">{resumo.pendentes} pendentes</span> ·{' '}
        <span className="text-red-600">{resumo.naoLocalizados} não localizados</span>
      </p>

      {aviso && (
        <div
          className={cn(
            'mb-4 flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm',
            aviso.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
          )}
        >
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="text-xs font-medium underline">
            Fechar
          </button>
        </div>
      )}

      {/* Busca + filtros */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_240px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPagina(1)
            }}
            placeholder="Buscar por item, nota fiscal, série, fornecedor ou projeto…"
            className="pl-9"
          />
        </div>
        <Select
          value={filtroStatus}
          onChange={(e) => {
            setFiltroStatus(e.target.value as FiltroStatus)
            setPagina(1)
          }}
        >
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendentes (procurar)</option>
          <option value="localizado">Localizados</option>
          <option value="nao_localizado">Não localizados</option>
        </Select>
        <Select
          value={filtroProjeto}
          onChange={(e) => {
            setFiltroProjeto(e.target.value)
            setPagina(1)
          }}
        >
          <option value="">Todos os projetos</option>
          {projetos.map(([chave, rotulo]) => (
            <option key={chave} value={chave}>
              {rotulo}
            </option>
          ))}
        </Select>
      </div>

      {/* Foto direta de um item (câmera do celular, quando houver) */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && fotoDe) void enviarFoto(fotoDe, f)
          e.target.value = ''
        }}
      />

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{mensagemErro(error)}</p>
      ) : filtrados.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <PackageSearch className="h-8 w-8 text-slate-300" />
          <p className="font-medium text-slate-700 dark:text-slate-200">
            {itens.length === 0 ? 'Nenhum item no inventário ainda.' : 'Nenhum item encontrado com esses filtros.'}
          </p>
          {itens.length === 0 && (
            <p className="text-sm text-slate-400">Cadastre o primeiro bem, ou importe uma planilha.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((i) => {
            const st = STATUS_VISTORIA[i.statusVistoria]
            const principal = fotoPrincipal(i)
            const miniatura = principal ? urls?.get(principal.caminho) : undefined
            const trabalhando = ocupado === i.id
            return (
              <li
                key={i.id}
                className={cn(
                  'card flex flex-wrap items-center gap-3 border-l-4 px-3 py-3 sm:flex-nowrap',
                  BORDA_STATUS[i.statusVistoria],
                  i.statusVistoria === 'localizado' && 'opacity-90',
                )}
              >
                <button
                  onClick={() => setVendoId(i.id)}
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                  aria-label={`Ver ${i.nome}`}
                >
                  {miniatura ? (
                    <img src={miniatura} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="mx-auto h-5 w-5 text-slate-300" />
                  )}
                </button>

                <button onClick={() => setVendoId(i.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium text-slate-800 dark:text-slate-100">{i.nome}</p>
                  <p className="truncate text-xs text-slate-400">
                    {[quantidadeDe(i) > 1 && `${quantidadeDe(i)} unidades`, i.numeroNotaFiscal && `NF ${i.numeroNotaFiscal}`, i.numeroSerie && `Série ${i.numeroSerie}`, i.fornecedor, i.localizacao]
                      .filter(Boolean)
                      .join(' · ') || 'Sem dados fiscais ainda'}
                  </p>
                  {quantidadeDe(i) > 1 && fotosFaltando(i) > 0 && (
                    <p className="text-xs text-amber-600">
                      Fotos: {i.fotos.length} de {quantidadeDe(i)} — faltam {fotosFaltando(i)}
                    </p>
                  )}
                </button>

                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                  <label className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', st.ponto)} aria-hidden />
                    <select
                      value={i.statusVistoria}
                      onChange={(e) => statusMut.mutate({ id: i.id, status: e.target.value as StatusVistoria })}
                      aria-label="Status da vistoria"
                      className={cn('cursor-pointer rounded-md bg-transparent py-1 text-xs font-medium focus:outline-none', st.texto)}
                    >
                      {(Object.keys(STATUS_VISTORIA) as StatusVistoria[]).map((s) => (
                        <option key={s} value={s} className="text-slate-800">
                          {STATUS_VISTORIA[s].label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-center">
                    {trabalhando && <Loader2 className="mr-1 h-4 w-4 animate-spin text-brand-600" />}
                    <BotaoIcone titulo="Ver dados" icone={Eye} onClick={() => setVendoId(i.id)} />
                    <BotaoIcone titulo="Editar" icone={Pencil} onClick={() => abrirEdicao(i)} />
                    <BotaoIcone
                      titulo={principal ? 'Substituir foto' : 'Registrar foto'}
                      icone={Camera}
                      disabled={trabalhando}
                      onClick={() => {
                        setFotoDe(i)
                        camRef.current?.click()
                      }}
                    />
                    <BotaoIcone titulo="Gerar ofício" icone={FileText} disabled={trabalhando} onClick={() => gerarOficio(i)} />
                    <BotaoIcone titulo="Excluir" icone={Trash2} perigo onClick={() => setExcluir(i)} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {filtrados.length > POR_PAGINA && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-slate-500">
          <Button variant="secondary" icon={ChevronLeft} onClick={() => setPagina(paginaAtual - 1)} disabled={paginaAtual <= 1}>
            Anterior
          </Button>
          <span>
            Página {paginaAtual} de {totalPaginas} · {filtrados.length} itens
          </span>
          <Button variant="secondary" onClick={() => setPagina(paginaAtual + 1)} disabled={paginaAtual >= totalPaginas}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ItemInventarioModal
        open={formAberto}
        onClose={() => setFormAberto(false)}
        item={editando}
        todos={itens}
        onSalvo={(texto) => setAviso({ tipo: 'ok', texto })}
      />
      <ItemInventarioDetalhe item={vendo} onClose={() => setVendoId(null)} onEditar={abrirEdicao} onOficio={gerarOficio} />
      <ImportarInventarioModal
        open={importando}
        onClose={() => setImportando(false)}
        existentes={itens}
        onImportado={(texto, ok) => setAviso({ tipo: ok ? 'ok' : 'erro', texto })}
      />
      <ConfirmDialog
        open={Boolean(excluir)}
        onClose={() => setExcluir(null)}
        onConfirm={() => excluir && excluirMut.mutate(excluir)}
        title="Excluir item"
        message={
          <>
            Excluir <strong>{excluir?.nome}</strong> e todas as fotos dele? Esta ação não pode ser desfeita.
          </>
        }
      />
    </AdminShell>
  )
}

function BotaoIcone({
  titulo,
  icone: Icone,
  onClick,
  disabled,
  perigo,
}: {
  titulo: string
  icone: typeof Eye
  onClick: () => void
  disabled?: boolean
  perigo?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      aria-label={titulo}
      className={cn(
        'rounded-lg p-2 text-slate-400 transition-colors disabled:opacity-40',
        perigo
          ? 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10'
          : 'hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10',
      )}
    >
      <Icone className="h-4 w-4" />
    </button>
  )
}
