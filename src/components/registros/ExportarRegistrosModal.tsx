import { useState } from 'react'
import { FileDown, FileText, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { obterFotoParaRelatorio } from '@/data/registros'
import { carregarPapelTimbrado } from '@/lib/consignadoPdf'
import { baixarArquivo } from '@/lib/assinaturaPdf'
import { gerarDocxRegistros, gerarPdfRegistros } from '@/lib/relatorioRegistros'
import { nomeArquivoRelatorio, type Registro } from '@/lib/registros'
import { cn, mensagemErro } from '@/lib/utils'

type Escopo = 'todos' | 'filtrados' | 'selecionados'
type Formato = 'docx' | 'pdf'

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Exporta o relatório em Word ou PDF, no papel timbrado do CINTESP: todos os registros,
 * só o resultado do filtro atual ou só os selecionados na lista.
 */
export function ExportarRegistrosModal({
  open,
  onClose,
  todos,
  filtrados,
  selecionados,
  descricaoFiltro,
  filtroAtivo,
}: {
  open: boolean
  onClose: () => void
  todos: Registro[]
  filtrados: Registro[]
  selecionados: Registro[]
  descricaoFiltro: string
  filtroAtivo: boolean
}) {
  const [escopo, setEscopo] = useState<Escopo>('filtrados')
  const [formato, setFormato] = useState<Formato>('pdf')
  const [incluirFotos, setIncluirFotos] = useState(true)
  const [incluirAta, setIncluirAta] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Ao abrir, sugere o escopo mais provável.
  const [abertoAntes, setAbertoAntes] = useState(false)
  if (open && !abertoAntes) {
    setAbertoAntes(true)
    setEscopo(selecionados.length > 0 ? 'selecionados' : 'filtrados')
    setErro(null)
    setAviso(null)
  }
  if (!open && abertoAntes) setAbertoAntes(false)

  const escolhidos = escopo === 'todos' ? todos : escopo === 'selecionados' ? selecionados : filtrados
  const semFotos = escolhidos.every((r) => r.anexos.every((a) => a.categoria !== 'foto'))

  async function exportar() {
    if (escolhidos.length === 0) return
    setGerando(true)
    setErro(null)
    setAviso(null)
    try {
      let papel: string | null = null
      try {
        papel = await carregarPapelTimbrado()
      } catch {
        setAviso('O papel timbrado não pôde ser carregado: o relatório saiu sem o fundo.')
      }
      // Cronológico (do mais antigo ao mais novo) é a leitura natural de um relatório.
      const ordenados = [...escolhidos].sort((a, b) => a.data.localeCompare(b.data) || (a.horaInicio ?? '').localeCompare(b.horaInicio ?? ''))
      const opcoes = {
        descricaoFiltro: escopo === 'filtrados' ? descricaoFiltro : escopo === 'selecionados' ? 'Registros selecionados' : '',
        incluirFotos,
        incluirAta,
        obterFoto: obterFotoParaRelatorio,
        papelTimbrado: papel,
      }
      const bytes = formato === 'pdf' ? await gerarPdfRegistros(ordenados, opcoes) : await gerarDocxRegistros(ordenados, opcoes)
      baixarArquivo(bytes, nomeArquivoRelatorio(formato), formato === 'pdf' ? 'application/pdf' : MIME_DOCX)
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setGerando(false)
    }
  }

  const opcaoEscopo = (valor: Escopo, titulo: string, qtd: number, dica?: string, desabilitada = false) => (
    <button
      type="button"
      disabled={desabilitada}
      onClick={() => setEscopo(valor)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        escopo === valor ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
      )}
    >
      <span className="min-w-0">
        <span className="block font-medium text-slate-800 dark:text-slate-100">{titulo}</span>
        {dica && <span className="block text-xs text-slate-400">{dica}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{qtd}</span>
    </button>
  )

  const opcaoFormato = (valor: Formato, titulo: string, dica: string) => (
    <button
      type="button"
      onClick={() => setFormato(valor)}
      className={cn(
        'flex flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
        formato === valor ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
      )}
    >
      <FileText className={cn('h-5 w-5 shrink-0', formato === valor ? 'text-brand-600' : 'text-slate-400')} />
      <span>
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{titulo}</span>
        <span className="block text-xs text-slate-400">{dica}</span>
      </span>
    </button>
  )

  return (
    <Modal
      open={open}
      onClose={gerando ? () => undefined : onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <FileDown className="h-5 w-5" />
          </span>
          Exportar relatório
        </span>
      }
      subtitle="Sai no papel timbrado do CINTESP."
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button variant="secondary" onClick={onClose} disabled={gerando} className="w-full sm:w-auto">
            Fechar
          </Button>
          <Button icon={gerando ? Loader2 : FileDown} onClick={exportar} disabled={gerando || escolhidos.length === 0} className="w-full sm:w-auto">
            {gerando ? 'Gerando…' : `Exportar ${escolhidos.length} registro${escolhidos.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">O que exportar</p>
          <div className="space-y-2">
            {opcaoEscopo('filtrados', filtroAtivo ? 'Resultado do filtro atual' : 'Todos os registros listados', filtrados.length, filtroAtivo ? descricaoFiltro : undefined)}
            {opcaoEscopo('selecionados', 'Somente os selecionados', selecionados.length, selecionados.length === 0 ? 'Marque os registros na lista para exportar só alguns.' : undefined, selecionados.length === 0)}
            {filtroAtivo && opcaoEscopo('todos', 'Todos os registros (ignorar filtros)', todos.length)}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Formato</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {opcaoFormato('pdf', 'PDF', 'Pronto para enviar e imprimir')}
            {opcaoFormato('docx', 'Word (.docx)', 'Editável')}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={incluirFotos} onChange={(e) => setIncluirFotos(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Incluir fotos (até 9 por registro){semFotos ? ' — nenhum dos escolhidos tem fotos' : ''}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={incluirAta} onChange={(e) => setIncluirAta(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Incluir o texto da ata / resumo
          </label>
          <p className="text-xs text-slate-400">Os documentos e atas anexados aparecem listados pelo nome; os arquivos continuam disponíveis em cada registro.</p>
        </div>

        {aviso && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{aviso}</p>}
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>}
      </div>
    </Modal>
  )
}
