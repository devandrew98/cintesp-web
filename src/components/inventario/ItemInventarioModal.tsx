import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Camera, ExternalLink, FileText, ImagePlus, Paperclip, Star, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import {
  adicionarFoto,
  atualizarItemInventario,
  criarItemInventario,
  definirFotoPrincipal,
  removerFoto,
  anexarNotaFiscal,
  removerNotaFiscal,
  urlsDasFotos,
  urlsDasNotas,
} from '@/data/inventario'
import { lerDadosDaNota, validarArquivoNota, type DadosDaNota } from '@/lib/notaFiscalArquivo'
import { dataBR } from '@/lib/oficioTombamento'
import { listarProjetos } from '@/data/projetos'
import { mascararCNPJ } from '@/lib/cnpj'
import {
  detectarDuplicidades,
  pendenciasOficio,
  quantidadeDe,
  STATUS_VISTORIA,
  validarArquivoFoto,
  validarItem,
  FOTO_ORIGINAL_MAX_MB,
  type DadosItemInventario,
  type ItemInventario,
  type StatusVistoria,
} from '@/lib/inventario'
import { mensagemErro } from '@/lib/utils'

interface Staged {
  arquivo: File
  previa: string
}

function formularioVazio(): DadosItemInventario {
  return { nome: '', quantidade: 1, statusVistoria: 'pendente' }
}

function deItem(i: ItemInventario): DadosItemInventario {
  const { id: _id, fotos: _fotos, criadoEm: _c, atualizadoEm: _a, projetoNome: _p, ...dados } = i
  return dados
}

/**
 * Cadastro/edição de um item do inventário. Dá para salvar com poucos dados
 * (só o nome é obrigatório): o resto pode ser completado depois, e o formulário
 * mostra o que ainda falta para gerar o ofício. Fotos: no item NOVO ficam
 * "na fila" e sobem ao salvar; no item existente as ações são imediatas.
 */
export function ItemInventarioModal({
  open,
  onClose,
  item,
  todos,
  onSalvo,
}: {
  open: boolean
  onClose: () => void
  /** null = novo item. */
  item: ItemInventario | null
  /** Lista completa, para o alerta de duplicidade. */
  todos: ItemInventario[]
  onSalvo: (mensagem: string) => void
}) {
  const qc = useQueryClient()
  const camRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)
  const novoId = useRef(crypto.randomUUID())
  const [criadoId, setCriadoId] = useState<string | null>(null)
  const [form, setForm] = useState<DadosItemInventario>(formularioVazio)
  const [staged, setStaged] = useState<Staged[]>([])
  const [tentou, setTentou] = useState(false)
  const [erroFoto, setErroFoto] = useState<string | null>(null)
  const [ocupadoFoto, setOcupadoFoto] = useState(false)
  const notaRef = useRef<HTMLInputElement>(null)
  const [notaNova, setNotaNova] = useState<File | null>(null) // anexada agora, sobe ao salvar
  const [removerNota, setRemoverNota] = useState(false)
  const [lendoNota, setLendoNota] = useState(false)
  const [resultadoNota, setResultadoNota] = useState<{ tipo: 'ok' | 'aviso' | 'erro'; texto: string } | null>(null)

  const idItem = item?.id ?? criadoId ?? novoId.current
  const editando = Boolean(item) || Boolean(criadoId)

  // Ao abrir: carrega o item (ou zera, com id novo).
  useEffect(() => {
    if (!open) return
    setForm(item ? deItem(item) : formularioVazio())
    setStaged([])
    setTentou(false)
    setErroFoto(null)
    setCriadoId(null)
    setNotaNova(null)
    setRemoverNota(false)
    setResultadoNota(null)
    if (!item) novoId.current = crypto.randomUUID()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const { data: projetos = [] } = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos, enabled: open })

  const fotosAtuais = item?.fotos ?? []
  const { data: urls } = useQuery({
    queryKey: ['inventario-urls', fotosAtuais.map((f) => f.caminho).join('|')],
    queryFn: () => urlsDasFotos(fotosAtuais.map((f) => f.caminho)),
    enabled: open && fotosAtuais.length > 0,
    staleTime: 30 * 60 * 1000,
  })

  const erros = validarItem(form)
  const duplicados = useMemo(() => detectarDuplicidades(form, todos, idItem), [form, todos, idItem])
  const faltaOficio = pendenciasOficio(form)
  const qtd = quantidadeDe(form)
  // Uma foto por unidade: no item novo contam as da fila; no existente, as já enviadas.
  const totalFotos = (item ? fotosAtuais.length : 0) + staged.length
  const fotosQueFaltam = Math.max(0, qtd - totalFotos)

  const atualizar = (patch: Partial<DadosItemInventario>) => setForm((f) => ({ ...f, ...patch }))
  const invalidar = () => qc.invalidateQueries({ queryKey: ['inventario'] })

  async function receberArquivos(lista: FileList | null) {
    if (!lista || lista.length === 0) return
    setErroFoto(null)
    const arquivos = [...lista]
    for (const a of arquivos) {
      const problema = validarArquivoFoto(a, FOTO_ORIGINAL_MAX_MB)
      if (problema) {
        setErroFoto(`${a.name}: ${problema}`)
        return
      }
    }
    if (!editando) {
      setStaged((s) => [...s, ...arquivos.map((arquivo) => ({ arquivo, previa: URL.createObjectURL(arquivo) }))])
      return
    }
    setOcupadoFoto(true)
    try {
      for (const a of arquivos) await adicionarFoto(idItem, a, false)
      invalidar()
    } catch (e) {
      setErroFoto(mensagemErro(e))
    } finally {
      setOcupadoFoto(false)
    }
  }

  async function acaoFoto(fn: () => Promise<void>) {
    setErroFoto(null)
    setOcupadoFoto(true)
    try {
      await fn()
      invalidar()
    } catch (e) {
      setErroFoto(mensagemErro(e))
    } finally {
      setOcupadoFoto(false)
    }
  }

  /** Anexa a nota (PDF/XML/imagem), lê os dados dela e preenche o formulário com o que for encontrado. */
  async function receberNota(arquivo: File | undefined) {
    if (!arquivo) return
    const problema = validarArquivoNota(arquivo)
    if (problema) {
      setResultadoNota({ tipo: 'erro', texto: problema })
      return
    }
    setNotaNova(arquivo)
    setRemoverNota(false)
    setResultadoNota(null)
    setLendoNota(true)
    const dados: DadosDaNota | null = await lerDadosDaNota(arquivo)
    setLendoNota(false)
    if (!dados) {
      setResultadoNota({
        tipo: 'aviso',
        texto: 'Nota anexada, mas não consegui ler os dados dela (imagem, PDF escaneado ou arquivo que não é NF-e). Preencha os campos à mão.',
      })
      return
    }
    const preenchidos: string[] = []
    const faltaram: string[] = []
    const patch: Partial<DadosItemInventario> = {}
    const pegar = <K extends keyof DadosItemInventario>(chave: K, valor: DadosItemInventario[K] | undefined, rotulo: string) => {
      if (valor) {
        patch[chave] = valor
        preenchidos.push(rotulo)
      } else faltaram.push(rotulo)
    }
    pegar('numeroNotaFiscal', dados.numero, 'nº da nota')
    pegar('dataEmissaoNf', dados.emissao, 'emissão')
    pegar('fornecedor', dados.fornecedor, 'fornecedor')
    pegar('cnpj', dados.cnpj, 'CNPJ')
    // A nota não traz "data da compra": usa a emissão, sem sobrescrever o que já foi digitado.
    if (dados.emissao && !form.dataCompra) patch.dataCompra = dados.emissao
    setForm((f) => ({ ...f, ...patch }))
    setResultadoNota({
      tipo: faltaram.length === 0 ? 'ok' : 'aviso',
      texto:
        `Li a nota (${dados.origem === 'xml' ? 'XML' : 'PDF'})${dados.numero ? ` nº ${dados.numero}` : ''}${dados.emissao ? `, emitida em ${dataBR(dados.emissao)}` : ''}. ` +
        `Preenchi: ${preenchidos.join(', ') || 'nada'}.` +
        (faltaram.length > 0 ? ` Não encontrei: ${faltaram.join(', ')} — complete à mão.` : '') +
        (patch.dataCompra ? ' A “data da compra” recebeu a data de emissão; ajuste se for diferente.' : '') +
        (dados.destinatario ? ` Destinatário: ${dados.destinatario}.` : '') +
        ' Confira os valores antes de salvar.',
    })
  }

  async function abrirNotaAnexada() {
    const caminho = item?.notaFiscalCaminho
    if (!caminho) return
    try {
      const url = (await urlsDasNotas([caminho])).get(caminho)
      if (url) window.open(url, '_blank', 'noopener')
    } catch (e) {
      setResultadoNota({ tipo: 'erro', texto: mensagemErro(e) })
    }
  }

  const salvarMut = useMutation({
    mutationFn: async () => {
      if (editando) {
        await atualizarItemInventario(idItem, form)
      } else {
        await criarItemInventario(form, idItem)
        setCriadoId(idItem) // a partir daqui, salvar de novo ATUALIZA (nunca duplica)
      }
      let falhas = 0
      // Nota fiscal anexada: item já está salvo; falha aqui NÃO desfaz nada, só avisa.
      try {
        if (notaNova) {
          await anexarNotaFiscal(idItem, notaNova, item?.notaFiscalCaminho)
          setNotaNova(null)
        } else if (removerNota && item?.notaFiscalCaminho) {
          await removerNotaFiscal(idItem, item.notaFiscalCaminho)
          setRemoverNota(false)
        }
      } catch (e) {
        falhas++
        setResultadoNota({ tipo: 'erro', texto: `O item foi salvo, mas a nota não subiu: ${mensagemErro(e)}` })
      }
      for (let i = 0; !editando && i < staged.length; i++) {
        try {
          await adicionarFoto(idItem, staged[i].arquivo, i === 0)
        } catch (e) {
          falhas++
          setErroFoto(mensagemErro(e))
        }
      }
      return { id: idItem, falhasFoto: falhas }
    },
    onSuccess: ({ falhasFoto }) => {
      invalidar()
      staged.forEach((s) => URL.revokeObjectURL(s.previa))
      if (falhasFoto > 0) {
        setStaged([]) // as que falharam não ficam na fila; adicione de novo com o item já salvo
        return // mantém o modal aberto para mostrar o erro
      }
      onSalvo(editando ? 'Item atualizado.' : 'Item cadastrado.')
      onClose()
    },
  })

  function salvar() {
    setTentou(true)
    if (Object.keys(erros).length > 0) return
    salvarMut.mutate()
  }

  const campoErro = (k: string) => (tentou && erros[k] ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : undefined)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={editando ? 'Editar item' : 'Novo item do inventário'}
      subtitle="Só o nome é obrigatório para salvar — o restante pode ser completado depois."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvarMut.isPending}>
            {salvarMut.isPending ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar item'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ---------- Fotos ---------- */}
        <section>
          <h3 className="mb-2 flex flex-wrap items-baseline gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Fotografia{qtd > 1 ? 's' : ''}
            {qtd > 1 && (
              <span className={`text-xs font-normal ${fotosQueFaltam > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {totalFotos} de {qtd} — uma foto por unidade
                {fotosQueFaltam > 0 ? ` (faltam ${fotosQueFaltam})` : ' ✓'}
              </span>
            )}
          </h3>
          <div className="flex flex-wrap gap-3">
            {fotosAtuais.map((f) => (
              <div key={f.id} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                {urls?.get(f.caminho) && <img src={urls.get(f.caminho)} alt="" className="h-full w-full object-cover" />}
                {f.principal && (
                  <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Principal
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  {!f.principal ? (
                    <button
                      type="button"
                      title="Tornar principal"
                      disabled={ocupadoFoto}
                      onClick={() => acaoFoto(() => definirFotoPrincipal(idItem, f.id))}
                      className="rounded p-1 text-white hover:bg-white/20"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    title="Remover foto"
                    disabled={ocupadoFoto}
                    onClick={() =>
                      acaoFoto(() => removerFoto(idItem, f, fotosAtuais.filter((x) => x.id !== f.id)))
                    }
                    className="rounded p-1 text-white hover:bg-red-500/70"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {staged.map((s, i) => (
              <div key={s.previa} className="relative h-24 w-24 overflow-hidden rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                <img src={s.previa} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Principal
                  </span>
                )}
                <button
                  type="button"
                  title="Remover da fila"
                  onClick={() => {
                    URL.revokeObjectURL(s.previa)
                    setStaged((lista) => lista.filter((x) => x !== s))
                  }}
                  className="absolute bottom-1 right-1 rounded bg-black/55 p-1 text-white hover:bg-red-500/70"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-col justify-center gap-2">
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void receberArquivos(e.target.files)
                  e.target.value = ''
                }}
              />
              <input
                ref={galeriaRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  void receberArquivos(e.target.files)
                  e.target.value = ''
                }}
              />
              <Button variant="secondary" icon={Camera} onClick={() => camRef.current?.click()} disabled={ocupadoFoto}>
                Tirar foto
              </Button>
              <Button variant="secondary" icon={ImagePlus} onClick={() => galeriaRef.current?.click()} disabled={ocupadoFoto}>
                Da galeria
              </Button>
            </div>
          </div>
          {ocupadoFoto && <p className="mt-2 text-xs text-slate-400">Enviando imagem…</p>}
          {!editando && staged.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">As fotos sobem junto com o cadastro do item.</p>
          )}
          {erroFoto && <p className="mt-2 text-sm text-red-500">{erroFoto}</p>}
        </section>

        {/* ---------- Identificação ---------- */}
        <Field label="Nome / descrição do item *">
          <Input
            value={form.nome}
            onChange={(e) => atualizar({ nome: e.target.value })}
            placeholder="Ex.: Notebook Dell Latitude 5420"
            className={campoErro('nome')}
            autoFocus={!editando}
          />
          {tentou && erros.nome && <p className="mt-1 text-xs text-red-500">{erros.nome}</p>}
        </Field>

        <Field label="Quantidade de itens" hint="Se houver mais de um, o ideal é uma foto de cada unidade.">
          <Input
            type="number"
            min={1}
            max={9999}
            inputMode="numeric"
            value={form.quantidade ?? 1}
            onChange={(e) => atualizar({ quantidade: e.target.value === '' ? undefined : Number(e.target.value) })}
            className={`sm:max-w-[160px] ${campoErro('quantidade') ?? ''}`}
          />
          {erros.quantidade && <p className="mt-1 text-xs text-red-500">{erros.quantidade}</p>}
        </Field>

        {duplicados.length > 0 && (
          <div className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Possível item duplicado — confira antes de salvar:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {duplicados.slice(0, 4).map((d) => (
                  <li key={d.item.id}>
                    “{d.item.nome}” — {d.motivo}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs opacity-80">Vários itens na mesma nota fiscal são normais; este é só um aviso.</p>
            </div>
          </div>
        )}

        {/* ---------- Onde está + observação (o que se anota percorrendo o laboratório) ---------- */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Local / laboratório onde está o item" hint="Ex.: Laboratório de Robótica — sala 2, armário 3.">
            <Input value={form.localizacao ?? ''} onChange={(e) => atualizar({ localizacao: e.target.value })} placeholder="Laboratório e/ou sala" />
          </Field>
          <Field label="Status da vistoria">
            <Select value={form.statusVistoria} onChange={(e) => atualizar({ statusVistoria: e.target.value as StatusVistoria })}>
              {(Object.keys(STATUS_VISTORIA) as StatusVistoria[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_VISTORIA[s].label}
                </option>
              ))}
            </Select>
          </Field>
        </section>

        <Field label="Observação" hint="Estado do item, onde foi achado, o que falta conferir…">
          <Textarea value={form.observacoes ?? ''} onChange={(e) => atualizar({ observacoes: e.target.value })} />
        </Field>

        {/* ---------- Nota fiscal anexada ---------- */}
        <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <FileText className="h-4 w-4 text-slate-400" /> Nota fiscal
          </h3>
          <input
            ref={notaRef}
            type="file"
            accept=".pdf,.xml,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              void receberNota(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" icon={Paperclip} onClick={() => notaRef.current?.click()} disabled={lendoNota}>
              {lendoNota ? 'Lendo a nota…' : notaNova || (item?.notaFiscalNome && !removerNota) ? 'Trocar nota fiscal' : 'Anexar nota fiscal'}
            </Button>
            {notaNova ? (
              <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                {notaNova.name} <span className="text-xs text-slate-400">(sobe ao salvar)</span>
                <button type="button" title="Descartar" onClick={() => { setNotaNova(null); setResultadoNota(null) }} className="rounded p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            ) : item?.notaFiscalNome && !removerNota ? (
              <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                {item.notaFiscalNome}
                <button type="button" title="Abrir nota anexada" onClick={abrirNotaAnexada} className="rounded p-1 text-slate-400 hover:text-brand-600">
                  <ExternalLink className="h-4 w-4" />
                </button>
                <button type="button" title="Remover nota anexada" onClick={() => setRemoverNota(true)} className="rounded p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            ) : removerNota ? (
              <span className="text-sm text-amber-600">A nota será removida ao salvar.</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            PDF ou XML da NF-e: o app lê o arquivo e preenche nota, emissão, fornecedor e CNPJ. Imagem ou PDF escaneado é só anexado.
          </p>
          {resultadoNota && (
            <p
              className={`mt-2 rounded-lg px-3 py-2 text-sm ${
                resultadoNota.tipo === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : resultadoNota.tipo === 'aviso'
                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                    : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
              }`}
            >
              {resultadoNota.texto}
            </p>
          )}
          <Field label="Link da nota no Drive" hint="Cole o link do arquivo no Drive — ele vai na coluna “Nota fiscal (link)” da planilha exportada.">
            <Input
              type="url"
              value={form.notaFiscalLink ?? ''}
              onChange={(e) => atualizar({ notaFiscalLink: e.target.value })}
              placeholder="https://drive.google.com/…"
              className={campoErro('notaFiscalLink')}
            />
            {erros.notaFiscalLink && form.notaFiscalLink && <p className="mt-1 text-xs text-red-500">{erros.notaFiscalLink}</p>}
          </Field>
        </section>

        {/* ---------- Dados fiscais ---------- */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Nota fiscal nº">
            <Input value={form.numeroNotaFiscal ?? ''} onChange={(e) => atualizar({ numeroNotaFiscal: e.target.value })} />
          </Field>
          <Field label="Emissão da nota fiscal">
            <Input type="date" value={form.dataEmissaoNf ?? ''} onChange={(e) => atualizar({ dataEmissaoNf: e.target.value })} />
          </Field>
          <Field label="Data da compra" hint="Se for diferente da emissão.">
            <Input type="date" value={form.dataCompra ?? ''} onChange={(e) => atualizar({ dataCompra: e.target.value })} />
          </Field>
          <Field label="Empresa fornecedora" >
            <Input value={form.fornecedor ?? ''} onChange={(e) => atualizar({ fornecedor: e.target.value })} />
          </Field>
          <Field label="CNPJ da empresa">
            <Input
              inputMode="numeric"
              value={mascararCNPJ(form.cnpj)}
              onChange={(e) => atualizar({ cnpj: e.target.value.replace(/\D/g, '').slice(0, 14) })}
              placeholder="00.000.000/0000-00"
              className={campoErro('cnpj')}
            />
            {erros.cnpj && form.cnpj && form.cnpj.length === 14 && <p className="mt-1 text-xs text-red-500">{erros.cnpj}</p>}
            {tentou && erros.cnpj && form.cnpj && form.cnpj.length !== 14 && (
              <p className="mt-1 text-xs text-red-500">{erros.cnpj}</p>
            )}
          </Field>
          <Field label="Nº de série" hint="Opcional.">
            <Input value={form.numeroSerie ?? ''} onChange={(e) => atualizar({ numeroSerie: e.target.value })} />
          </Field>
        </section>

        {/* ---------- Projeto ---------- */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nº / identificação do projeto (CNPq)" hint="Aparece no ofício.">
            <Input value={form.projetoNumero ?? ''} onChange={(e) => atualizar({ projetoNumero: e.target.value })} />
          </Field>
          <Field label="Projeto cadastrado no sistema" hint="Opcional — só para organizar e filtrar.">
            <Select value={form.projetoId ?? ''} onChange={(e) => atualizar({ projetoId: e.target.value || undefined })}>
              <option value="">— sem vínculo —</option>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </Select>
          </Field>
        </section>

        {faltaOficio.length > 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800">
            Para gerar o ofício ainda falta: {faltaOficio.join(', ')}.
          </p>
        )}

        {salvarMut.isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {mensagemErro(salvarMut.error)}
          </p>
        )}
        {criadoId && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            O item foi salvo, mas alguma foto não subiu. Adicione-a de novo acima — não é preciso cadastrar o item outra vez.
          </p>
        )}
      </div>
    </Modal>
  )
}
