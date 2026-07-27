import { useCallback, useMemo, useRef, useState } from 'react'
import {
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  PlusCircle,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { cn } from '@/lib/utils'
import { formatarCPF } from '@/lib/cpf'
import {
  lerPlanilha,
  mapearColunasAuto,
  rotuloCampo,
  type CampoParticipante,
  type PlanilhaLida,
} from '@/lib/planilha'
import { analisarLinhas, resumir, type LinhaAnalisada } from '@/lib/importacao'
import { cpfsExistentes, importarParticipantes } from '@/data/participantes'

/**
 * Assistente de importação de planilha (4 etapas):
 *
 *   1. Arquivo     → escolher o .xlsx/.csv (o arquivo NÃO sai do navegador)
 *   2. Mapeamento  → conferir qual coluna vai para qual campo (pré-preenchido)
 *   3. Conferência → prévia com o que será criado, atualizado e o que tem erro
 *   4. Resultado   → confirmação do que foi gravado
 *
 * A gravação no banco SÓ acontece após a confirmação explícita na etapa 3.
 */

type Etapa = 1 | 2 | 3 | 4

const CAMPOS = Object.keys(rotuloCampo) as CampoParticipante[]

export function ImportWizard({
  open,
  onClose,
  onConcluido,
}: {
  open: boolean
  onClose: () => void
  onConcluido: () => void
}) {
  const [etapa, setEtapa] = useState<Etapa>(1)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null)
  const [mapa, setMapa] = useState<Record<CampoParticipante, string>>(
    {} as Record<CampoParticipante, string>,
  )
  const [analisadas, setAnalisadas] = useState<LinhaAnalisada[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState<{ criados: number; atualizados: number } | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  /** Volta tudo ao estado inicial (ao fechar ou importar outra planilha). */
  const reiniciar = useCallback(() => {
    setEtapa(1)
    setArquivo(null)
    setPlanilha(null)
    setMapa({} as Record<CampoParticipante, string>)
    setAnalisadas([])
    setErro(null)
    setProgresso(0)
    setResultado(null)
  }, [])

  function fechar() {
    reiniciar()
    onClose()
  }

  // ---------- Etapa 1 → 2: lê o arquivo ----------
  async function selecionarArquivo(file: File) {
    setErro(null)
    setCarregando(true)
    try {
      const lida = await lerPlanilha(file)
      if (lida.linhas.length === 0) {
        setErro('A planilha não tem linhas de dados abaixo do cabeçalho.')
        setCarregando(false)
        return
      }
      setArquivo(file)
      setPlanilha(lida)
      setMapa(mapearColunasAuto(lida.colunas)) // pré-preenche o mapeamento
      setEtapa(2)
    } catch (e) {
      setErro(
        `Não consegui ler o arquivo: ${
          e instanceof Error ? e.message : String(e)
        }. Formatos aceitos: .xlsx, .xls e .csv.`,
      )
    } finally {
      setCarregando(false)
    }
  }

  /** Troca a aba da planilha (arquivos com várias abas). */
  async function trocarAba(nomeAba: string) {
    if (!arquivo) return
    setCarregando(true)
    try {
      const lida = await lerPlanilha(arquivo, nomeAba)
      setPlanilha(lida)
      setMapa(mapearColunasAuto(lida.colunas))
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }

  // ---------- Etapa 2 → 3: valida as linhas ----------
  async function analisar() {
    if (!planilha) return
    setErro(null)
    setCarregando(true)
    try {
      // Descobre quais CPFs já existem para diferenciar "criar" de "atualizar".
      const colunaCpf = mapa.cpf
      const cpfsDaPlanilha = colunaCpf
        ? planilha.linhas.map((l) => (l[colunaCpf] ?? '').replace(/\D/g, '')).filter(Boolean)
        : []
      const existentes = await cpfsExistentes(cpfsDaPlanilha)

      setAnalisadas(
        analisarLinhas(
          planilha.linhas,
          mapa,
          planilha.colunas,
          existentes,
          planilha.numerosLinha,
        ),
      )
      setEtapa(3)
    } catch (e) {
      setErro(
        `Não consegui conferir os CPFs no banco: ${e instanceof Error ? e.message : String(e)}`,
      )
    } finally {
      setCarregando(false)
    }
  }

  // ---------- Etapa 3 → 4: grava de verdade ----------
  async function confirmarImportacao() {
    if (!arquivo) return
    setErro(null)
    setCarregando(true)
    setProgresso(0)
    try {
      const aImportar = analisadas.filter((l) => l.importar)
      const jaExistiam = new Set(
        analisadas
          .filter((l) => l.importar && l.situacao === 'atualizar' && l.participante.cpf)
          .map((l) => l.participante.cpf as string),
      )

      const r = await importarParticipantes(
        aImportar.map((l) => l.participante),
        arquivo.name,
        jaExistiam,
        setProgresso,
      )
      setResultado({ criados: r.criados, atualizados: r.atualizados })
      setEtapa(4)
      onConcluido() // avisa a tela para recarregar a lista
    } catch (e) {
      setErro(
        `A importação falhou: ${
          e instanceof Error ? e.message : String(e)
        }. Nenhum dado parcial foi confirmado como válido — verifique e tente de novo.`,
      )
    } finally {
      setCarregando(false)
    }
  }

  const resumo = useMemo(() => resumir(analisadas), [analisadas])
  const totalImportar = resumo.novos + resumo.atualizar

  return (
    <Modal
      open={open}
      onClose={fechar}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-brand-600" />
          Importar planilha de participantes
        </span>
      }
      subtitle={`Etapa ${etapa} de 4 — ${
        { 1: 'escolher arquivo', 2: 'conferir colunas', 3: 'conferir dados', 4: 'resultado' }[etapa]
      }`}
      footer={<Rodape />}
    >
      {/* Trilha de etapas */}
      <ol className="mb-5 flex items-center gap-2 text-xs">
        {['Arquivo', 'Colunas', 'Conferência', 'Resultado'].map((rotulo, i) => {
          const n = (i + 1) as Etapa
          return (
            <li key={rotulo} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  etapa > n
                    ? 'bg-brand-600 text-white'
                    : etapa === n
                      ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500 dark:bg-brand-500/20 dark:text-brand-300'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
                )}
              >
                {etapa > n ? '✓' : n}
              </span>
              <span
                className={cn(
                  'hidden truncate sm:block',
                  etapa === n ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-400',
                )}
              >
                {rotulo}
              </span>
              {i < 3 && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />}
            </li>
          )
        })}
      </ol>

      {/* Mensagem de erro global */}
      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* ---------------- Etapa 1: arquivo ---------------- */}
      {etapa === 1 && (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastando(false)
              const f = e.dataTransfer.files?.[0]
              if (f) selecionarArquivo(f)
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors',
              arrastando
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50',
            )}
          >
            {carregando ? (
              <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
            ) : (
              <UploadCloud className="h-10 w-10 text-slate-400" />
            )}
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                {carregando ? 'Lendo a planilha...' : 'Arraste a planilha aqui ou clique para escolher'}
              </p>
              <p className="mt-1 text-sm text-slate-400">Formatos aceitos: .xlsx, .xls e .csv</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) selecionarArquivo(f)
              }}
            />
          </div>

          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60">
            🔒 <strong>Privacidade:</strong> a planilha é lida no seu próprio navegador. O arquivo
            não é enviado para nenhum servidor — só os dados que você confirmar vão para o banco.
          </p>
        </div>
      )}

      {/* ---------------- Etapa 2: mapeamento ---------------- */}
      {etapa === 2 && planilha && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <span className="text-slate-600 dark:text-slate-300">
              <strong>{planilha.linhas.length}</strong> linhas · cabeçalho detectado na linha{' '}
              <strong>{planilha.linhaCabecalho}</strong>
            </span>
            {planilha.abas.length > 1 && (
              <label className="flex items-center gap-2">
                <span className="text-slate-500">Aba:</span>
                <Select
                  value={planilha.aba}
                  onChange={(e) => trocarAba(e.target.value)}
                  className="h-8 py-0 text-sm"
                >
                  {planilha.abas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>

          <p className="mb-3 text-sm text-slate-500">
            Confira para onde vai cada coluna. O sistema já preencheu o que reconheceu — ajuste se
            precisar. Colunas deixadas em <em>“Não importar”</em> ficam guardadas como dados extras.
          </p>

          <div className="space-y-2">
            {CAMPOS.map((campo) => (
              <div key={campo} className="grid grid-cols-[1fr_auto_1.2fr] items-center gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {rotuloCampo[campo]}
                  {(campo === 'nome' || campo === 'cpf') && (
                    <span className="ml-1 text-red-500" title="Obrigatório">
                      *
                    </span>
                  )}
                </span>
                <ArrowLeft className="h-4 w-4 text-slate-300" />
                <Select
                  value={mapa[campo] ?? ''}
                  onChange={(e) => setMapa((m) => ({ ...m, [campo]: e.target.value }))}
                  className="h-9 py-0 text-sm"
                >
                  <option value="">— Não importar —</option>
                  {planilha.colunas.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          {(!mapa.nome || !mapa.cpf) && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Nome</strong> e <strong>CPF</strong> são obrigatórios: o CPF é o que evita
                cadastrar a mesma pessoa duas vezes.
              </span>
            </p>
          )}
        </div>
      )}

      {/* ---------------- Etapa 3: conferência ---------------- */}
      {etapa === 3 && (
        <div>
          {/* Cartões de resumo */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CartaoResumo icone={PlusCircle} cor="green" valor={resumo.novos} rotulo="Novos" />
            <CartaoResumo icone={RefreshCw} cor="blue" valor={resumo.atualizar} rotulo="Atualizar" />
            <CartaoResumo icone={AlertTriangle} cor="amber" valor={resumo.avisos} rotulo="Avisos" />
            <CartaoResumo icone={XCircle} cor="red" valor={resumo.erros} rotulo="Com erro" />
          </div>

          <p className="mb-3 text-sm text-slate-500">
            {totalImportar > 0 ? (
              <>
                Vou gravar <strong>{totalImportar}</strong> registro(s):{' '}
                <strong>{resumo.novos}</strong> novo(s) e <strong>{resumo.atualizar}</strong>{' '}
                atualização(ões).
                {resumo.erros > 0 && (
                  <> As <strong>{resumo.erros}</strong> linha(s) com erro serão ignoradas.</>
                )}
              </>
            ) : (
              <>Nenhuma linha válida para importar. Reveja o mapeamento ou a planilha.</>
            )}
          </p>

          {/* Tabela de prévia */}
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Linha</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">CPF</th>
                  <th className="px-3 py-2">Curso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {analisadas.slice(0, 200).map((l) => (
                  <tr
                    key={l.numero}
                    className={cn(!l.importar && 'bg-red-50/60 dark:bg-red-500/5')}
                    title={l.motivo ?? l.aviso}
                  >
                    <td className="px-3 py-2 text-slate-400">{l.numero}</td>
                    <td className="px-3 py-2">
                      <EtiquetaSituacao linha={l} />
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-slate-700 dark:text-slate-200">
                      {l.participante.nome || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {l.participante.cpf ? formatarCPF(l.participante.cpf) : '—'}
                    </td>
                    <td className="max-w-[150px] truncate px-3 py-2 text-slate-500">
                      {l.participante.curso ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analisadas.length > 200 && (
            <p className="mt-2 text-xs text-slate-400">
              Mostrando as primeiras 200 linhas de {analisadas.length}. Todas serão processadas.
            </p>
          )}

          {/* Barra de progresso durante a gravação */}
          {carregando && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all"
                  style={{ width: `${Math.round(progresso * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-center text-xs text-slate-500">
                Gravando... {Math.round(progresso * 100)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Etapa 4: resultado ---------------- */}
      {etapa === 4 && resultado && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Importação concluída!
          </h3>
          <p className="text-sm text-slate-500">
            <strong className="text-brand-600">{resultado.criados}</strong> participante(s)
            cadastrado(s) e{' '}
            <strong className="text-sky-600">{resultado.atualizados}</strong> atualizado(s).
            {resumo.erros > 0 && (
              <>
                {' '}
                <strong className="text-red-500">{resumo.erros}</strong> linha(s) foram ignoradas
                por erro.
              </>
            )}
          </p>
          <p className="text-xs text-slate-400">
            O registro desta importação ficou salvo no histórico, com data e responsável.
          </p>
        </div>
      )}
    </Modal>
  )

  /** Rodapé com os botões de cada etapa (fica aqui para enxergar o estado). */
  function Rodape() {
    if (etapa === 1) {
      return (
        <Button variant="secondary" onClick={fechar}>
          Cancelar
        </Button>
      )
    }
    if (etapa === 2) {
      return (
        <>
          <Button variant="secondary" onClick={() => setEtapa(1)} icon={ArrowLeft}>
            Voltar
          </Button>
          <Button onClick={analisar} disabled={!mapa.nome || !mapa.cpf || carregando} icon={ArrowRight}>
            {carregando ? 'Conferindo...' : 'Conferir dados'}
          </Button>
        </>
      )
    }
    if (etapa === 3) {
      return (
        <>
          <Button variant="secondary" onClick={() => setEtapa(2)} icon={ArrowLeft} disabled={carregando}>
            Voltar
          </Button>
          <Button onClick={confirmarImportacao} disabled={totalImportar === 0 || carregando}>
            {carregando ? 'Gravando...' : `Confirmar e importar ${totalImportar}`}
          </Button>
        </>
      )
    }
    return (
      <>
        <Button variant="secondary" onClick={reiniciar}>
          Importar outra
        </Button>
        <Button onClick={fechar}>Concluir</Button>
      </>
    )
  }
}

/** Cartão pequeno de contagem usado na conferência. */
function CartaoResumo({
  icone: Icone,
  cor,
  valor,
  rotulo,
}: {
  icone: typeof PlusCircle
  cor: 'green' | 'blue' | 'amber' | 'red'
  valor: number
  rotulo: string
}) {
  const cores = {
    green: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  }
  return (
    <div className={cn('rounded-xl p-3', cores[cor])}>
      <Icone className="mb-1 h-4 w-4" />
      <p className="text-xl font-bold leading-none">{valor}</p>
      <p className="mt-1 text-xs font-medium">{rotulo}</p>
    </div>
  )
}

/** Etiqueta colorida da situação de cada linha na prévia. */
function EtiquetaSituacao({ linha }: { linha: LinhaAnalisada }) {
  if (!linha.importar) {
    return (
      <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">
        Erro
      </span>
    )
  }
  if (linha.aviso) {
    return (
      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
        Aviso
      </span>
    )
  }
  if (linha.situacao === 'atualizar') {
    return (
      <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
        Atualizar
      </span>
    )
  }
  return (
    <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
      Novo
    </span>
  )
}
