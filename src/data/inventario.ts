import { supabase, USE_MOCK } from '@/lib/supabase'
import { listarProjetos } from '@/data/projetos'
import { reduzirImagem } from '@/lib/imagem'
import { tipoDaNota, extensaoDaNota, validarArquivoNota } from '@/lib/notaFiscalArquivo'
import {
  limparCnpj,
  quantidadeDe,
  validarArquivoFoto,
  validarItem,
  type DadosItemInventario,
  type FotoInventario,
  type ItemInventario,
  FOTO_ORIGINAL_MAX_MB,
  type StatusVistoria,
} from '@/lib/inventario'

/**
 * Camada de dados do INVENTÁRIO PATRIMONIAL (docs/supabase-inventario.sql).
 *
 * As fotos ficam no bucket PRIVADO `inventario` (nunca em URL pública): para
 * exibir, geramos URLs assinadas de curta duração. A validação também existe
 * no banco (constraints, CNPJ, tipos/tamanho do arquivo no bucket) — o front
 * só adianta a mensagem. Em modo mock tudo fica em memória (some ao recarregar).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKET = 'inventario'
/** Validade das URLs assinadas das fotos (segundos). */
const URL_VALIDADE_S = 60 * 60

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table/i.test(msg)
  )
}

/** Traduz erros comuns do banco/storage para algo que a pessoa entenda. */
function erroAmigavel(error: any): Error {
  const msg = String(error?.message ?? error)
  if (/inventario_itens_cnpj_check|cnpj_valido/i.test(msg)) return new Error('CNPJ inválido — confira os dígitos.')
  if (/row-level security|violates row-level/i.test(msg)) return new Error('Você não tem permissão para esta operação.')
  if (/mime type|not allowed|invalid_mime/i.test(msg)) return new Error('Tipo de arquivo não permitido. Use JPG, PNG ou WebP.')
  if (/exceeded the maximum|too large|payload/i.test(msg)) return new Error('A imagem é grande demais (máximo de 5 MB).')
  return error instanceof Error ? error : new Error(msg)
}

// ---------------- mapeadores ----------------
function mapFoto(r: any): FotoInventario {
  return { id: r.id, caminho: r.caminho, principal: Boolean(r.principal) }
}

function mapItem(r: any, nomesProjetos: Map<string, string>): ItemInventario {
  return {
    id: r.id,
    nome: r.nome,
    numeroNotaFiscal: r.numero_nota_fiscal ?? undefined,
    notaFiscalCaminho: r.nota_fiscal_caminho ?? undefined,
    notaFiscalNome: r.nota_fiscal_nome ?? undefined,
    notaFiscalLink: r.nota_fiscal_link ?? undefined,
    dataEmissaoNf: r.data_emissao_nf ?? undefined,
    dataCompra: r.data_compra ?? undefined,
    numeroSerie: r.numero_serie ?? undefined,
    quantidade: r.quantidade ?? 1,
    fornecedor: r.fornecedor ?? undefined,
    cnpj: r.cnpj ?? undefined,
    projetoId: r.projeto_id ?? undefined,
    projetoNumero: r.projeto_numero ?? undefined,
    projetoNome: r.projeto_id ? nomesProjetos.get(r.projeto_id) : undefined,
    localizacao: r.localizacao ?? undefined,
    observacoes: r.observacoes ?? undefined,
    statusVistoria: r.status_vistoria ?? 'pendente',
    fotos: (r.fotos ?? []).map(mapFoto),
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  }
}

function paraLinha(d: DadosItemInventario) {
  const txt = (v?: string) => v?.trim() || null
  return {
    nome: d.nome.trim(),
    numero_nota_fiscal: txt(d.numeroNotaFiscal),
    nota_fiscal_link: txt(d.notaFiscalLink),
    data_emissao_nf: d.dataEmissaoNf || null,
    data_compra: d.dataCompra || null,
    numero_serie: txt(d.numeroSerie),
    quantidade: quantidadeDe(d),
    fornecedor: txt(d.fornecedor),
    cnpj: limparCnpj(d.cnpj) ?? null,
    projeto_id: d.projetoId || null,
    projeto_numero: txt(d.projetoNumero),
    localizacao: txt(d.localizacao),
    observacoes: txt(d.observacoes),
    status_vistoria: d.statusVistoria,
  }
}

// ---------------- mock (em memória) ----------------
const mockItens: ItemInventario[] = []
const mockBlobs = new Map<string, string>() // caminho → object URL

// ---------------- leitura ----------------

export async function listarInventario(): Promise<ItemInventario[]> {
  if (USE_MOCK || !supabase) return mockItens.map((i) => ({ ...i, fotos: [...i.fotos] }))

  const { data, error } = await supabase
    .from('inventario_itens')
    .select('*, fotos:inventario_fotos (id, caminho, principal)')
    .order('criado_em', { ascending: false })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw error
  }
  const projetos = await listarProjetos().catch(() => [])
  const nomes = new Map(projetos.map((p) => [p.id, p.titulo]))
  return (data ?? []).map((r) => mapItem(r, nomes))
}

/** URLs assinadas (temporárias) das fotos, por caminho. */
export async function urlsDasFotos(caminhos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (caminhos.length === 0) return mapa
  if (USE_MOCK || !supabase) {
    for (const c of caminhos) {
      const u = mockBlobs.get(c)
      if (u) mapa.set(c, u)
    }
    return mapa
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(caminhos, URL_VALIDADE_S)
  if (error) throw erroAmigavel(error)
  for (const r of data ?? []) if (r.path && r.signedUrl) mapa.set(r.path, r.signedUrl)
  return mapa
}

/** Baixa os bytes de uma foto (para a exportação em Excel). */
export async function baixarFoto(caminho: string): Promise<{ bytes: ArrayBuffer; extensao: 'jpeg' | 'png' } | null> {
  try {
    if (USE_MOCK || !supabase) {
      const url = mockBlobs.get(caminho)
      if (!url) return null
      const blob = await (await fetch(url)).blob()
      return { bytes: await blob.arrayBuffer(), extensao: blob.type === 'image/png' ? 'png' : 'jpeg' }
    }
    const { data, error } = await supabase.storage.from(BUCKET).download(caminho)
    if (error || !data) return null
    return { bytes: await data.arrayBuffer(), extensao: data.type === 'image/png' ? 'png' : 'jpeg' }
  } catch {
    return null
  }
}

// ---------------- itens ----------------

/** `id` pode ser gerado antes (o formulário já precisa dele para nomear as fotos). */
export async function criarItemInventario(dados: DadosItemInventario, id: string = crypto.randomUUID()): Promise<string> {
  const erros = validarItem(dados)
  if (Object.keys(erros).length > 0) throw new Error(Object.values(erros)[0])

  if (USE_MOCK || !supabase) {
    const agora = new Date().toISOString()
    mockItens.unshift({ ...dados, cnpj: limparCnpj(dados.cnpj), id, fotos: [], criadoEm: agora, atualizadoEm: agora })
    return id
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('inventario_itens').insert({ id, ...paraLinha(dados), criado_por: auth.user?.id })
  if (error) throw erroAmigavel(error)
  return id
}

export async function atualizarItemInventario(id: string, dados: DadosItemInventario): Promise<void> {
  const erros = validarItem(dados)
  if (Object.keys(erros).length > 0) throw new Error(Object.values(erros)[0])

  if (USE_MOCK || !supabase) {
    const i = mockItens.findIndex((x) => x.id === id)
    if (i < 0) throw new Error('Item não encontrado.')
    mockItens[i] = { ...mockItens[i], ...dados, cnpj: limparCnpj(dados.cnpj), atualizadoEm: new Date().toISOString() }
    return
  }
  const { error } = await supabase.from('inventario_itens').update(paraLinha(dados)).eq('id', id)
  if (error) throw erroAmigavel(error)
}

export async function atualizarStatusVistoria(id: string, status: StatusVistoria): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockItens.find((x) => x.id === id)
    if (i) {
      i.statusVistoria = status
      i.atualizadoEm = new Date().toISOString()
    }
    return
  }
  const { error } = await supabase.from('inventario_itens').update({ status_vistoria: status }).eq('id', id)
  if (error) throw erroAmigavel(error)
}

/** Apaga o item, as fotos e a nota anexada (sem deixar arquivo órfão). Só admin (RLS). */
export async function excluirItemInventario(
  id: string,
  fotos: FotoInventario[],
  notaCaminho?: string,
): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockItens.findIndex((x) => x.id === id)
    if (i >= 0) mockItens.splice(i, 1)
    fotos.forEach((f) => mockBlobs.delete(f.caminho))
    if (notaCaminho) mockBlobs.delete(notaCaminho)
    return
  }
  // Primeiro confirma que o item pode ser apagado (RLS: só admin) ANTES de apagar arquivos.
  const { error } = await supabase.from('inventario_itens').delete().eq('id', id)
  if (error) throw erroAmigavel(error)
  const arquivos = [...fotos.map((f) => f.caminho), ...(notaCaminho ? [notaCaminho] : [])]
  if (arquivos.length > 0) {
    const { error: eArq } = await supabase.storage.from(BUCKET).remove(arquivos)
    if (eArq) console.warn('[inventario] item apagado, mas alguns arquivos de foto não foram removidos:', eArq.message)
  }
}

// ---------------- nota fiscal anexada ----------------

/**
 * Anexa (ou substitui) o arquivo da nota fiscal do item. O arquivo antigo, se houver, é apagado
 * DEPOIS de o novo estar gravado — nunca fica item apontando para arquivo inexistente nem arquivo órfão.
 */
export async function anexarNotaFiscal(
  itemId: string,
  arquivo: File,
  caminhoAnterior?: string,
): Promise<{ caminho: string; nome: string }> {
  const problema = validarArquivoNota(arquivo)
  if (problema) throw new Error(problema)
  const caminho = `${itemId}/${crypto.randomUUID()}.${extensaoDaNota(arquivo.name)}`
  const nome = arquivo.name

  if (USE_MOCK || !supabase) {
    const item = mockItens.find((x) => x.id === itemId)
    if (!item) throw new Error('Salve o item antes de anexar a nota.')
    mockBlobs.set(caminho, URL.createObjectURL(arquivo))
    if (caminhoAnterior) mockBlobs.delete(caminhoAnterior)
    item.notaFiscalCaminho = caminho
    item.notaFiscalNome = nome
    return { caminho, nome }
  }

  const { error: eUp } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: tipoDaNota(nome) })
  if (eUp) throw erroAmigavel(eUp)
  const { error } = await supabase
    .from('inventario_itens')
    .update({ nota_fiscal_caminho: caminho, nota_fiscal_nome: nome })
    .eq('id', itemId)
  if (error) {
    await supabase.storage.from(BUCKET).remove([caminho])
    throw erroAmigavel(error)
  }
  if (caminhoAnterior) await supabase.storage.from(BUCKET).remove([caminhoAnterior])
  return { caminho, nome }
}

export async function removerNotaFiscal(itemId: string, caminho: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const item = mockItens.find((x) => x.id === itemId)
    if (item) {
      item.notaFiscalCaminho = undefined
      item.notaFiscalNome = undefined
    }
    mockBlobs.delete(caminho)
    return
  }
  const { error } = await supabase
    .from('inventario_itens')
    .update({ nota_fiscal_caminho: null, nota_fiscal_nome: null })
    .eq('id', itemId)
  if (error) throw erroAmigavel(error)
  await supabase.storage.from(BUCKET).remove([caminho])
}

/** URLs assinadas das notas anexadas, por caminho (`validadeS`: 1 h para abrir na tela; mais longa para a planilha). */
export async function urlsDasNotas(caminhos: string[], validadeS = URL_VALIDADE_S): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (caminhos.length === 0) return mapa
  if (USE_MOCK || !supabase) {
    for (const c of caminhos) {
      const u = mockBlobs.get(c)
      if (u) mapa.set(c, u)
    }
    return mapa
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(caminhos, validadeS)
  if (error) throw erroAmigavel(error)
  for (const r of data ?? []) if (r.path && r.signedUrl) mapa.set(r.path, r.signedUrl)
  return mapa
}

// ---------------- fotos ----------------

/**
 * Envia uma foto (reduzida) e cria o registro. Vira a principal se o item ainda
 * não tem nenhuma. Devolve a foto criada.
 */
export async function adicionarFoto(itemId: string, arquivo: File, comoPrincipal: boolean): Promise<FotoInventario> {
  const problema = validarArquivoFoto(arquivo, FOTO_ORIGINAL_MAX_MB)
  if (problema) throw new Error(problema)

  const blob = await reduzirImagem(arquivo)
  // O que vai para o storage precisa caber no limite do bucket.
  const problemaFinal = validarArquivoFoto(blob)
  if (problemaFinal) throw new Error(problemaFinal)
  const tipoFinal = blob.type === 'image/png' || blob.type === 'image/webp' ? blob.type : 'image/jpeg'
  const ext = tipoFinal === 'image/png' ? 'png' : tipoFinal === 'image/webp' ? 'webp' : 'jpg'
  const fotoId = crypto.randomUUID()
  const caminho = `${itemId}/${fotoId}.${ext}`

  if (USE_MOCK || !supabase) {
    const item = mockItens.find((x) => x.id === itemId)
    if (!item) throw new Error('Salve o item antes de adicionar fotos.')
    const principal = comoPrincipal || item.fotos.length === 0
    if (principal) item.fotos.forEach((f) => (f.principal = false))
    const foto = { id: fotoId, caminho, principal }
    item.fotos.push(foto)
    mockBlobs.set(caminho, URL.createObjectURL(blob))
    return foto
  }

  const { error: eUp } = await supabase.storage.from(BUCKET).upload(caminho, blob, { contentType: tipoFinal })
  if (eUp) throw erroAmigavel(eUp)

  // Já existe principal? (consulta fresca — evita depender do estado da tela)
  const { data: existentes, error: eSel } = await supabase
    .from('inventario_fotos')
    .select('id, principal')
    .eq('item_id', itemId)
  if (eSel) {
    await supabase.storage.from(BUCKET).remove([caminho])
    throw erroAmigavel(eSel)
  }
  const temPrincipal = (existentes ?? []).some((f) => f.principal)
  const principal = comoPrincipal || !temPrincipal

  if (principal && temPrincipal) {
    const { error } = await supabase.from('inventario_fotos').update({ principal: false }).eq('item_id', itemId)
    if (error) {
      await supabase.storage.from(BUCKET).remove([caminho])
      throw erroAmigavel(error)
    }
  }
  const { error } = await supabase.from('inventario_fotos').insert({ id: fotoId, item_id: itemId, caminho, principal })
  if (error) {
    await supabase.storage.from(BUCKET).remove([caminho]) // não deixa arquivo órfão
    throw erroAmigavel(error)
  }
  return { id: fotoId, caminho, principal }
}

export async function definirFotoPrincipal(itemId: string, fotoId: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const item = mockItens.find((x) => x.id === itemId)
    item?.fotos.forEach((f) => (f.principal = f.id === fotoId))
    return
  }
  const { error: e1 } = await supabase.from('inventario_fotos').update({ principal: false }).eq('item_id', itemId)
  if (e1) throw erroAmigavel(e1)
  const { error: e2 } = await supabase.from('inventario_fotos').update({ principal: true }).eq('id', fotoId)
  if (e2) throw erroAmigavel(e2)
}

/** Remove a foto (registro + arquivo). Se era a principal, promove outra do mesmo item. */
export async function removerFoto(itemId: string, foto: FotoInventario, restantes: FotoInventario[]): Promise<void> {
  if (USE_MOCK || !supabase) {
    const item = mockItens.find((x) => x.id === itemId)
    if (item) {
      item.fotos = item.fotos.filter((f) => f.id !== foto.id)
      if (foto.principal && item.fotos[0]) item.fotos[0].principal = true
    }
    mockBlobs.delete(foto.caminho)
    return
  }
  const { error } = await supabase.from('inventario_fotos').delete().eq('id', foto.id)
  if (error) throw erroAmigavel(error)
  const { error: eArq } = await supabase.storage.from(BUCKET).remove([foto.caminho])
  if (eArq) console.warn('[inventario] registro removido, mas o arquivo ficou no storage:', eArq.message)
  if (foto.principal && restantes[0]) await definirFotoPrincipal(itemId, restantes[0].id)
}

/**
 * "Registrar ou substituir a fotografia": envia a nova como principal e remove a principal anterior.
 */
export async function substituirFotoPrincipal(item: ItemInventario, arquivo: File): Promise<void> {
  const antiga = item.fotos.find((f) => f.principal) ?? item.fotos[0]
  const nova = await adicionarFoto(item.id, arquivo, true)
  if (antiga) {
    const restantes = item.fotos.filter((f) => f.id !== antiga.id).concat({ ...nova, principal: true })
    await removerFoto(item.id, { ...antiga, principal: false }, restantes)
  }
}

// ---------------- importação em lote ----------------

/** Cadastra vários itens (importação), em blocos de 200. Devolve os ids, na mesma ordem. */
export async function criarItensInventarioEmLote(itens: DadosItemInventario[]): Promise<string[]> {
  if (itens.length === 0) return []
  const ids = itens.map(() => crypto.randomUUID())
  if (USE_MOCK || !supabase) {
    for (let i = 0; i < itens.length; i++) await criarItemInventario(itens[i], ids[i])
    return ids
  }
  const { data: auth } = await supabase.auth.getUser()
  const linhas = itens.map((d, i) => {
    const erros = validarItem(d)
    if (Object.keys(erros).length > 0) throw new Error(`"${d.nome}": ${Object.values(erros)[0]}`)
    return { id: ids[i], ...paraLinha(d), criado_por: auth.user?.id }
  })
  for (let i = 0; i < linhas.length; i += 200) {
    const { error } = await supabase.from('inventario_itens').insert(linhas.slice(i, i + 200))
    if (error) throw erroAmigavel(error)
  }
  return ids
}
