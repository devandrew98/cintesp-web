import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, FileDown, FileText, Handshake, ImageIcon, MapPin, Plus, Search, Users, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SeletorMes } from '@/components/ui/SeletorMes'
import { RegistroFormModal } from '@/components/registros/RegistroFormModal'
import { RegistroDetalheModal } from '@/components/registros/RegistroDetalheModal'
import { ExportarRegistrosModal } from '@/components/registros/ExportarRegistrosModal'
import { excluirRegistro, listarRegistros, urlsDosAnexos } from '@/data/registros'
import {
  TIPOS_REGISTRO,
  dataBR,
  descreverFiltro,
  documentosDe,
  filtrarRegistros,
  filtroAtivo as haFiltro,
  filtroVazio,
  fotosDe,
  pillTipo,
  rotuloHorario,
  rotuloTipo,
  type FiltroRegistros,
  type Registro,
} from '@/lib/registros'
import { cn, mensagemErro } from '@/lib/utils'

/**
 * "Visitas e Eventos": registro institucional de visitas, eventos, oficinas, reuniões e palestras
 * realizados no CINTESP. Aberto a todos (ver, registrar, subir fotos, documentos e atas); o relatório
 * sai em Word ou PDF no papel timbrado.
 */
export function RegistrosPage() {
  const qc = useQueryClient()
  const { data: lista = [], isLoading, error } = useQuery({ queryKey: ['registros'], queryFn: listarRegistros })

  const [filtro, setFiltro] = useState<FiltroRegistros>(() => filtroVazio())
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [novo, setNovo] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [aExcluir, setAExcluir] = useState<Registro | null>(null)
  const [exportando, setExportando] = useState(false)

  const filtrados = useMemo(() => filtrarRegistros(lista, filtro), [lista, filtro])
  const selecionadosLista = useMemo(() => lista.filter((r) => selecionados.has(r.id)), [lista, selecionados])
  const detalhe = lista.find((r) => r.id === detalheId) ?? null
  const editando = lista.find((r) => r.id === editandoId)

  // Capas: a primeira foto de cada registro visível (uma única chamada para as URLs).
  const capas = useMemo(() => filtrados.map((r) => fotosDe(r)[0]?.caminho).filter((c): c is string => Boolean(c)).slice(0, 60), [filtrados])
  const { data: urlsCapas = new Map<string, string>() } = useQuery({
    queryKey: ['registros-urls', 'capas', capas.join('|')],
    queryFn: () => urlsDosAnexos(capas),
    enabled: capas.length > 0,
    staleTime: 30 * 60_000,
  })

  const remover = useMutation({
    mutationFn: excluirRegistro,
    onSuccess: (_d, r) => {
      qc.invalidateQueries({ queryKey: ['registros'] })
      setSelecionados((s) => {
        const n = new Set(s)
        n.delete(r.id)
        return n
      })
      setAExcluir(null)
      setDetalheId(null)
    },
  })

  const set = <K extends keyof FiltroRegistros>(k: K, v: FiltroRegistros[K]) => setFiltro((f) => ({ ...f, [k]: v }))
  const alternar = (id: string) =>
    setSelecionados((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const todosFiltradosMarcados = filtrados.length > 0 && filtrados.every((r) => selecionados.has(r.id))
  const marcarFiltrados = () =>
    setSelecionados((s) => {
      const n = new Set(s)
      if (todosFiltradosMarcados) filtrados.forEach((r) => n.delete(r.id))
      else filtrados.forEach((r) => n.add(r.id))
      return n
    })

  const ativo = haFiltro(filtro)

  return (
    <div>
      <PageHeader
        title="Visitas e Eventos"
        subtitle="Registro de visitas institucionais, eventos, oficinas e reuniões realizados no CINTESP."
        actions={
          <>
            <Button variant="secondary" icon={FileDown} onClick={() => setExportando(true)} disabled={lista.length === 0}>
              Exportar relatório
            </Button>
            <Button icon={Plus} onClick={() => setNovo(true)}>
              Novo registro
            </Button>
          </>
        }
      />

      {/* Filtros */}
      <div className="card mb-5 space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={filtro.busca} onChange={(e) => set('busca', e.target.value)} placeholder="Buscar por título, local, instituição, ata…" className="pl-9" aria-label="Buscar registros" />
          </div>
          <Select value={filtro.tipo} onChange={(e) => set('tipo', e.target.value as FiltroRegistros['tipo'])} aria-label="Tipo">
            <option value="todos">Todos os tipos</option>
            {TIPOS_REGISTRO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label="Período">
            {(
              [
                ['tudo', 'Tudo'],
                ['mes', 'Mês'],
                ['intervalo', 'Entre datas'],
              ] as const
            ).map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => set('periodo', v)}
                className={cn('rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors', filtro.periodo === v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}
              >
                {t}
              </button>
            ))}
          </div>
          {filtro.periodo === 'mes' && <SeletorMes valor={filtro.mes} onChange={(m) => set('mes', m)} />}
          {filtro.periodo === 'intervalo' && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Input type="date" value={filtro.de} max={filtro.ate || undefined} onChange={(e) => set('de', e.target.value)} className="w-40" aria-label="De" />
              <span>até</span>
              <Input type="date" value={filtro.ate} min={filtro.de || undefined} onChange={(e) => set('ate', e.target.value)} className="w-40" aria-label="Até" />
            </div>
          )}
          {ativo && (
            <button type="button" onClick={() => setFiltro(filtroVazio())} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Barra de seleção */}
      {filtrados.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={todosFiltradosMarcados} onChange={marcarFiltrados} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            {todosFiltradosMarcados ? 'Desmarcar' : 'Selecionar'} os {filtrados.length} {ativo ? 'filtrados' : 'registros'}
          </label>
          <span className="flex items-center gap-3">
            {selecionados.size > 0 && (
              <>
                <span className="font-medium text-slate-700 dark:text-slate-200">{selecionados.size} selecionado(s)</span>
                <button type="button" onClick={() => setSelecionados(new Set())} className="text-brand-600 hover:underline">
                  Limpar seleção
                </button>
                <Button size="sm" icon={FileDown} onClick={() => setExportando(true)}>
                  Exportar selecionados
                </Button>
              </>
            )}
          </span>
        </div>
      )}

      {error ? (
        <p className="card px-4 py-10 text-center text-sm text-red-500">{mensagemErro(error)}</p>
      ) : isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400">Carregando registros…</p>
      ) : filtrados.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-16 text-center">
          <Handshake className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">{lista.length === 0 ? 'Nenhum registro ainda. Registre a primeira visita ou evento!' : 'Nenhum registro encontrado para os filtros selecionados.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((r) => (
            <CartaoRegistro key={r.id} registro={r} capa={urlsCapas.get(fotosDe(r)[0]?.caminho ?? '')} marcado={selecionados.has(r.id)} onMarcar={() => alternar(r.id)} onAbrir={() => setDetalheId(r.id)} />
          ))}
        </div>
      )}

      <RegistroFormModal open={novo} onClose={() => setNovo(false)} onSalvo={(id) => setDetalheId(id)} />
      <RegistroFormModal open={Boolean(editando)} registro={editando} onClose={() => setEditandoId(null)} />

      {detalhe && (
        <RegistroDetalheModal
          registro={detalhe}
          onClose={() => setDetalheId(null)}
          onEditar={() => {
            setEditandoId(detalhe.id)
          }}
          onExcluir={() => setAExcluir(detalhe)}
        />
      )}

      <ConfirmDialog
        open={Boolean(aExcluir)}
        onClose={() => setAExcluir(null)}
        onConfirm={() => aExcluir && remover.mutate(aExcluir)}
        title="Excluir registro"
        message={`Excluir "${aExcluir?.titulo}" com todas as fotos, documentos e atas? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
      {remover.isError && <p className="mt-3 text-sm text-red-500">{mensagemErro(remover.error)}</p>}

      <ExportarRegistrosModal
        open={exportando}
        onClose={() => setExportando(false)}
        todos={lista}
        filtrados={filtrados}
        selecionados={selecionadosLista}
        descricaoFiltro={descreverFiltro(filtro)}
        filtroAtivo={ativo}
      />
    </div>
  )
}

function CartaoRegistro({
  registro: r,
  capa,
  marcado,
  onMarcar,
  onAbrir,
}: {
  registro: Registro
  capa?: string
  marcado: boolean
  onMarcar: () => void
  onAbrir: () => void
}) {
  const nFotos = fotosDe(r).length
  const nDocs = documentosDe(r).length
  return (
    <div className={cn('card relative flex flex-col overflow-hidden transition-colors', marcado && 'ring-2 ring-brand-500')}>
      <button type="button" onClick={onAbrir} className="flex flex-1 flex-col text-left">
        <div className="relative aspect-[16/9] w-full bg-slate-100 dark:bg-slate-800">
          {capa ? (
            <img src={capa} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-slate-300 dark:text-slate-600">
              <Handshake className="h-10 w-10" />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <span className={cn('w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold', pillTipo(r.tipo))}>{rotuloTipo(r.tipo)}</span>
          <h3 className="line-clamp-2 break-words font-semibold text-slate-900 dark:text-white">{r.titulo}</h3>
          <div className="space-y-1 text-xs text-slate-500">
            <p className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" /> {dataBR(r.data)}
              {rotuloHorario(r) ? ` · ${rotuloHorario(r)}` : ''}
            </p>
            {r.local && (
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{r.local}</span>
              </p>
            )}
            {r.participantes !== undefined && (
              <p className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 shrink-0" /> {r.participantes} participante(s)
              </p>
            )}
          </div>
          <div className="mt-auto flex items-center gap-3 border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-slate-800">
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" /> {nFotos}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> {nDocs}
            </span>
          </div>
        </div>
      </button>
      <label className="absolute left-2.5 top-2.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/90 shadow-card dark:bg-slate-900/90" title="Selecionar para exportar">
        <input type="checkbox" checked={marcado} onChange={onMarcar} className="h-4 w-4 rounded border-slate-300 text-brand-600" aria-label={`Selecionar ${r.titulo}`} />
      </label>
    </div>
  )
}
