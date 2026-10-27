import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Image as IconeImagem, Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { lerPlanilha, type PlanilhaLida } from '@/lib/planilha'
import { extrairImagensPlanilha, type ImagensDaPlanilha } from '@/lib/planilhaImagens'
import {
  mapearColunasInventario,
  montarItensImportados,
  rotuloCampoInventario,
  type CampoInventario,
} from '@/lib/inventarioPlanilha'
import { adicionarFoto, criarItensInventarioEmLote } from '@/data/inventario'
import type { ItemInventario } from '@/lib/inventario'
import { mensagemErro } from '@/lib/utils'

/**
 * Importa itens do inventário de uma planilha (.xlsx/.xls/.csv). Só "nome" é
 * obrigatório; possíveis duplicados (mesma série, ou mesma NF + descrição) e
 * linhas sem nome são ignorados — o resumo mostra o que entra e o que fica de fora.
 */
export function ImportarInventarioModal({
  open,
  onClose,
  existentes,
  onImportado,
}: {
  open: boolean
  onClose: () => void
  existentes: ItemInventario[]
  /** Texto do resultado para a página mostrar (`ok=false` se algo ficou pendente). */
  onImportado: (texto: string, ok: boolean) => void
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null)
  const [mapa, setMapa] = useState<Record<CampoInventario, string> | null>(null)
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [imagens, setImagens] = useState<ImagensDaPlanilha | null>(null)
  const [comFotos, setComFotos] = useState(true)
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null)

  async function carregar(file: File, aba?: string) {
    setLendo(true)
    setErroLeitura(null)
    try {
      const lida = await lerPlanilha(file, aba)
      setArquivo(file)
      setPlanilha(lida)
      setMapa(mapearColunasInventario(lida.colunas))
      // Fotos que estão dentro da planilha (flutuantes ou em células). Falha aqui não impede importar os textos.
      try {
        setImagens(await extrairImagensPlanilha(await file.arrayBuffer(), lida.aba))
      } catch {
        setImagens(null)
      }
    } catch (e) {
      setErroLeitura(mensagemErro(e))
      setPlanilha(null)
    } finally {
      setLendo(false)
    }
  }

  const linhas = useMemo(
    () => (planilha && mapa ? montarItensImportados(planilha.linhas, planilha.numerosLinha, mapa, existentes) : []),
    [planilha, mapa, existentes],
  )
  const validos = linhas.filter((l) => !l.erro)
  const ignorados = linhas.length - validos.length
  const semNome = mapa ? !mapa.nome : false

  const fotosDe = (linha: number) => imagens?.porLinha.get(linha) ?? []
  const totalFotos = validos.reduce((n, l) => n + fotosDe(l.linha).length, 0)

  const importarMut = useMutation({
    mutationFn: async () => {
      const ids = await criarItensInventarioEmLote(validos.map((l) => l.dados))
      // Itens já estão salvos; a partir daqui, falha em foto NÃO desfaz nada — só é contada.
      const tarefas: { itemId: string; nome: string; arquivo: File }[] = []
      if (comFotos) {
        validos.forEach((l, i) =>
          fotosDe(l.linha).forEach((img, k) => {
            const ext = img.tipo === 'image/png' ? 'png' : img.tipo === 'image/webp' ? 'webp' : 'jpg'
            tarefas.push({
              itemId: ids[i],
              nome: l.dados.nome,
              arquivo: new File([img.bytes as BlobPart], `linha-${l.linha}-foto-${k + 1}.${ext}`, { type: img.tipo }),
            })
          }),
        )
      }
      let feitas = 0
      let enviadas = 0
      const falhas: string[] = []
      setProgresso({ feitas: 0, total: tarefas.length })
      // Fotos do MESMO item vão em sequência (a 1ª vira a principal); itens diferentes, 3 por vez.
      const porItem = new Map<string, typeof tarefas>()
      for (const t of tarefas) porItem.set(t.itemId, [...(porItem.get(t.itemId) ?? []), t])
      const filas = [...porItem.values()]
      let proxima = 0
      const trabalhador = async () => {
        while (proxima < filas.length) {
          const fila = filas[proxima++]
          for (const t of fila) {
            try {
              await adicionarFoto(t.itemId, t.arquivo, false)
              enviadas++
            } catch {
              falhas.push(t.nome)
            }
            setProgresso({ feitas: ++feitas, total: tarefas.length })
          }
        }
      }
      await Promise.all([trabalhador(), trabalhador(), trabalhador()])
      return { itens: ids.length, enviadas, falhas }
    },
    onSuccess: ({ itens, enviadas, falhas }) => {
      qc.invalidateQueries({ queryKey: ['inventario'] })
      const base = `${itens} ite${itens === 1 ? 'm importado' : 'ns importados'}`
      const fotos = enviadas > 0 ? ` com ${enviadas} foto${enviadas === 1 ? '' : 's'}` : ''
      const nomes = [...new Set(falhas)]
      onImportado(
        falhas.length > 0
          ? `${base}${fotos}, mas ${falhas.length} foto(s) não subiram (${nomes.slice(0, 3).join(', ')}${nomes.length > 3 ? '…' : ''}). Adicione-as pela edição do item.`
          : `${base}${fotos}.`,
        falhas.length === 0,
      )
      fechar()
    },
  })

  function fechar() {
    setArquivo(null)
    setPlanilha(null)
    setMapa(null)
    setErroLeitura(null)
    setImagens(null)
    setProgresso(null)
    importarMut.reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={fechar}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <FileSpreadsheet className="h-5 w-5 text-brand-600" /> Importar inventário por planilha
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={fechar}>
            Cancelar
          </Button>
          <Button icon={Upload} onClick={() => importarMut.mutate()} disabled={importarMut.isPending || validos.length === 0 || semNome}>
            {importarMut.isPending
              ? progresso && progresso.total > 0
                ? `Enviando fotos ${progresso.feitas}/${progresso.total}…`
                : 'Importando…'
              : `Importar ${validos.length} ite${validos.length === 1 ? 'm' : 'ns'}${comFotos && totalFotos > 0 ? ` e ${totalFotos} foto${totalFotos === 1 ? '' : 's'}` : ''}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void carregar(f)
              e.target.value = ''
            }}
          />
          <Button variant="secondary" icon={Upload} onClick={() => inputRef.current?.click()} disabled={lendo}>
            {lendo ? 'Lendo…' : arquivo ? 'Trocar planilha' : 'Escolher planilha'}
          </Button>
          {arquivo && <span className="text-sm text-slate-500">{arquivo.name}</span>}
          {planilha && planilha.abas.length > 1 && (
            <div className="min-w-[160px]">
              <Select value={planilha.aba} onChange={(e) => arquivo && void carregar(arquivo, e.target.value)}>
                {planilha.abas.map((a) => (
                  <option key={a} value={a}>
                    Aba: {a}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {!planilha && !erroLeitura && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-800">
            Envie uma planilha com cabeçalho. Só o <strong>nome do item</strong> é obrigatório; nota fiscal, datas, série,
            fornecedor, CNPJ, projeto, localização, status e observações são aproveitados quando existirem. Itens que já
            parecem cadastrados (mesma série, ou mesma nota + descrição) são ignorados. As fotos não vêm por planilha.
          </p>
        )}
        {erroLeitura && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erroLeitura}</p>}

        {planilha && mapa && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(rotuloCampoInventario) as CampoInventario[]).map((campo) => (
                <label key={campo} className="block text-xs text-slate-500">
                  {rotuloCampoInventario[campo]}
                  {campo === 'nome' && <span className="text-red-500"> *</span>}
                  <Select className="mt-1" value={mapa[campo]} onChange={(e) => setMapa({ ...mapa, [campo]: e.target.value })}>
                    <option value="">— não importar —</option>
                    {planilha.colunas.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
            {semNome && <p className="text-sm text-amber-600">Indique a coluna com o nome do item.</p>}

            {imagens && imagens.total > 0 && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                <input type="checkbox" className="mt-0.5" checked={comFotos} onChange={(e) => setComFotos(e.target.checked)} />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <IconeImagem className="h-4 w-4 text-brand-600" />
                    Importar também as fotos da planilha
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {imagens.total} foto{imagens.total === 1 ? '' : 's'} encontrada{imagens.total === 1 ? '' : 's'} em{' '}
                    {imagens.porLinha.size} linha{imagens.porLinha.size === 1 ? '' : 's'}
                    {imagens.ignoradas > 0 ? ` (${imagens.ignoradas} em formato não suportado foi ignorada)` : ''}. Cada foto vai
                    para o item da própria linha.
                  </span>
                </span>
              </label>
            )}

            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> {validos.length} para importar
              </span>
              {ignorados > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4" /> {ignorados} ignorado(s)
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2">Linha</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">NF</th>
                    <th className="px-3 py-2">Qtd</th>
                    <th className="px-3 py-2">Fotos</th>
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {linhas.map((l) => (
                    <tr key={l.linha} className={l.erro ? 'bg-amber-50/50 dark:bg-amber-500/5' : undefined}>
                      <td className="px-3 py-2 text-slate-400">{l.linha}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{l.dados.nome || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{l.dados.numeroNotaFiscal ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{l.dados.quantidade ?? 1}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {fotosDe(l.linha).length > 0 ? (
                          <span className={fotosDe(l.linha).length < (l.dados.quantidade ?? 1) ? 'text-amber-600' : undefined}>
                            {fotosDe(l.linha).length}
                            {(l.dados.quantidade ?? 1) > 1 ? ` de ${l.dados.quantidade}` : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {l.erro ? (
                          <span className="font-medium text-amber-700 dark:text-amber-300">{l.erro}</span>
                        ) : l.avisos.length > 0 ? (
                          <span className="text-slate-500">ok · {l.avisos.join('; ')}</span>
                        ) : (
                          <span className="text-slate-500">ok</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {importarMut.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {mensagemErro(importarMut.error)}
          </p>
        )}
      </div>
    </Modal>
  )
}
