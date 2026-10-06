import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { lerPlanilha, type PlanilhaLida } from '@/lib/planilha'
import {
  baixarModeloItens,
  camposObrigatoriosItem,
  mapearColunasItem,
  montarItens,
  rotuloCampoItem,
  type CampoItem,
} from '@/lib/importarItens'
import { criarItensEmLote } from '@/data/consignados'
import { mensagemErro } from '@/lib/utils'

/**
 * Importa itens de patrimônio de uma planilha (.xlsx, .xls, .csv).
 * O arquivo é lido no navegador; antes de gravar, mostra o que será
 * importado e o que será ignorado (sem nº/nome, repetido, já cadastrado).
 */
export function ImportarItensModal({
  open,
  onClose,
  numerosExistentes,
}: {
  open: boolean
  onClose: () => void
  /** Nºs de patrimônio já cadastrados (minúsculos) — para não duplicar. */
  numerosExistentes: Set<string>
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null)
  const [mapa, setMapa] = useState<Record<CampoItem, string> | null>(null)
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)

  async function carregar(file: File, aba?: string) {
    setLendo(true)
    setErroLeitura(null)
    try {
      const lida = await lerPlanilha(file, aba)
      setArquivo(file)
      setPlanilha(lida)
      setMapa(mapearColunasItem(lida.colunas))
    } catch (e) {
      setErroLeitura(mensagemErro(e))
      setPlanilha(null)
    } finally {
      setLendo(false)
    }
  }

  const itens = useMemo(
    () => (planilha && mapa ? montarItens(planilha.linhas, planilha.numerosLinha, mapa, numerosExistentes) : []),
    [planilha, mapa, numerosExistentes],
  )
  const validos = itens.filter((i) => !i.erro)
  const ignorados = itens.filter((i) => i.erro)
  const faltaMapear = mapa ? camposObrigatoriosItem.filter((c) => !mapa[c]) : []

  const importarMut = useMutation({
    mutationFn: () => criarItensEmLote(validos.map((i) => i.dados)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patrimonio-itens'] })
      fechar()
    },
  })

  function fechar() {
    setArquivo(null)
    setPlanilha(null)
    setMapa(null)
    setErroLeitura(null)
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
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          Importar itens por planilha
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={fechar}>
            Cancelar
          </Button>
          <Button
            icon={Upload}
            onClick={() => importarMut.mutate()}
            disabled={importarMut.isPending || validos.length === 0 || faltaMapear.length > 0}
          >
            {importarMut.isPending
              ? 'Importando…'
              : `Importar ${validos.length} ite${validos.length === 1 ? 'm' : 'ns'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Escolher arquivo */}
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
          <Button variant="secondary" icon={Download} onClick={baixarModeloItens}>
            Baixar modelo
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
            Envie um arquivo .xlsx, .xls ou .csv com uma linha de cabeçalho. Obrigatório:{' '}
            <strong>nº do patrimônio</strong> e <strong>nome do item</strong>. Opcionais: categoria, situação,
            local, descrição e observações. Itens com nº já cadastrado são ignorados.
          </p>
        )}
        {erroLeitura && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {erroLeitura}
          </p>
        )}

        {planilha && mapa && (
          <>
            {/* Mapeamento de colunas */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Colunas da planilha</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(rotuloCampoItem) as CampoItem[]).map((campo) => (
                  <label key={campo} className="block text-xs text-slate-500">
                    {rotuloCampoItem[campo]}
                    {camposObrigatoriosItem.includes(campo) && <span className="text-red-500"> *</span>}
                    <Select
                      className="mt-1"
                      value={mapa[campo]}
                      onChange={(e) => setMapa({ ...mapa, [campo]: e.target.value })}
                    >
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
              {faltaMapear.length > 0 && (
                <p className="mt-2 text-sm text-amber-600">
                  Indique a coluna de: {faltaMapear.map((c) => rotuloCampoItem[c]).join(', ')}.
                </p>
              )}
            </div>

            {/* Resumo + prévia */}
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> {validos.length} para importar
              </span>
              {ignorados.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4" /> {ignorados.length} ignorado(s)
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2">Linha</th>
                    <th className="px-3 py-2">Nº</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Categoria</th>
                    <th className="px-3 py-2">Local</th>
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {itens.map((i) => (
                    <tr key={i.linha} className={i.erro ? 'bg-amber-50/50 dark:bg-amber-500/5' : undefined}>
                      <td className="px-3 py-2 text-slate-400">{i.linha}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {i.dados.numeroPatrimonio || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{i.dados.nome || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{i.dados.categoria ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{i.dados.localPadrao ?? '—'}</td>
                      <td className="px-3 py-2">
                        {i.erro ? (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{i.erro}</span>
                        ) : (
                          <span className="text-slate-500">{i.dados.status}</span>
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
