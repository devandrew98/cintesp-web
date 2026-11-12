import { supabase, USE_MOCK } from '@/lib/supabase'
import { perfilAtual } from '@/data/api'
import { miniaturaJpeg, reduzirImagem, type ImagemRelatorio } from '@/lib/imagem'
import {
  extensaoDe,
  mimeDoArquivo,
  validarArquivoAnexo,
  validarRegistro,
  type AnexoRegistro,
  type CategoriaAnexo,
  type DadosRegistro,
  type Registro,
} from '@/lib/registros'

/**
 * Camada de dados dos REGISTROS INSTITUCIONAIS (docs/supabase-registros.sql).
 * Todo usuário logado vê tudo, cria registros e anexa fotos/documentos/atas; editar/excluir o
 * registro é do criador e do administrador (RLS). Arquivos ficam no bucket PRIVADO `registros`
 * (URLs assinadas). Em modo mock tudo fica em memória.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKET = 'registros'
const URL_VALIDADE_S = 60 * 60

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return error?.code === '42P01' || error?.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(msg)
}

function erroAmigavel(error: any): Error {
  const msg = String(error?.message ?? error)
  if (ehTabelaAusente(error)) return new Error('Os registros ainda não foram ativados no banco (falta rodar docs/supabase-registros.sql).')
  if (/row-level security|violates row-level/i.test(msg)) return new Error('Você não tem permissão para esta operação.')
  if (/mime type|not allowed|invalid_mime/i.test(msg)) return new Error('Tipo de arquivo não permitido.')
  if (/exceeded the maximum|too large|payload/i.test(msg)) return new Error('O arquivo é grande demais (máximo de 25 MB).')
  return error instanceof Error ? error : new Error(msg)
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : undefined)

function mapAnexo(r: any): AnexoRegistro {
  return {
    id: r.id,
    registroId: r.registro_id,
    categoria: r.categoria,
    caminho: r.caminho,
    nome: r.nome,
    mime: r.mime ?? '',
    tamanho: Number(r.tamanho ?? 0),
    enviadoPorId: r.enviado_por ?? undefined,
    enviadoPorNome: r.enviador?.nome ?? undefined,
    criadoEm: r.created_at,
  }
}

function mapRegistro(r: any): Registro {
  return {
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    data: r.data,
    horaInicio: hhmm(r.hora_inicio),
    horaFim: hhmm(r.hora_fim),
    local: r.local ?? undefined,
    instituicao: r.instituicao ?? undefined,
    responsavel: r.responsavel ?? undefined,
    participantes: r.participantes ?? undefined,
    descricao: r.descricao ?? undefined,
    ata: r.ata ?? undefined,
    criadoPorId: r.criado_por ?? undefined,
    criadoPorNome: r.criador?.nome ?? undefined,
    criadoEm: r.created_at,
    anexos: (r.anexos ?? []).map(mapAnexo).sort((a: AnexoRegistro, b: AnexoRegistro) => a.criadoEm.localeCompare(b.criadoEm)),
  }
}

const paraLinha = (d: DadosRegistro) => ({
  tipo: d.tipo,
  titulo: d.titulo.trim(),
  data: d.data,
  hora_inicio: d.horaInicio || null,
  hora_fim: d.horaFim || null,
  local: d.local?.trim() || null,
  instituicao: d.instituicao?.trim() || null,
  responsavel: d.responsavel?.trim() || null,
  participantes: d.participantes ?? null,
  descricao: d.descricao?.trim() || null,
  ata: d.ata?.trim() || null,
})

// ---------------- mock ----------------
const mockBlobs = new Map<string, string>() // caminho → object URL
const mockRegistros: Registro[] = [
  {
    id: crypto.randomUUID(),
    tipo: 'visita',
    titulo: 'Visita da Escola Estadual Prof. Maria',
    data: '2026-11-05',
    horaInicio: '09:00',
    horaFim: '11:00',
    local: 'Arena Sabiazinho',
    instituicao: 'Escola Estadual Prof. Maria',
    responsavel: 'Ana Rodrigues',
    participantes: 32,
    descricao: 'Apresentação dos projetos de tecnologia assistiva e demonstração dos equipamentos para alunos do 9º ano.',
    ata: 'Foi acordada nova visita em março, com oficina prática de impressão 3D.',
    criadoPorNome: 'Administrador',
    criadoEm: '2026-11-05T12:00:00Z',
    anexos: [],
  },
  {
    id: crypto.randomUUID(),
    tipo: 'oficina',
    titulo: 'Oficina de impressão 3D de órteses',
    data: '2026-10-20',
    horaInicio: '14:00',
    horaFim: '17:00',
    local: 'Laboratório de Prototipagem',
    responsavel: 'Rafael Costa',
    participantes: 18,
    descricao: 'Oficina prática com estudantes de graduação.',
    criadoPorNome: 'Administrador',
    criadoEm: '2026-10-20T20:00:00Z',
    anexos: [],
  },
  {
    id: crypto.randomUUID(),
    tipo: 'evento',
    titulo: 'Semana de Tecnologia e Inclusão',
    data: '2026-09-15',
    local: 'Campus Santa Mônica',
    participantes: 120,
    descricao: 'Estande do CINTESP com apresentação dos projetos de pesquisa.',
    criadoPorNome: 'Administrador',
    criadoEm: '2026-09-15T20:00:00Z',
    anexos: [],
  },
]

// ---------------- leitura ----------------

export async function listarRegistros(): Promise<Registro[]> {
  if (USE_MOCK || !supabase) return mockRegistros.map((r) => ({ ...r, anexos: [...r.anexos] }))
  const { data, error } = await supabase
    .from('registros_institucionais')
    .select('*, criador:criado_por (nome), anexos:registro_anexos (*, enviador:enviado_por (nome))')
    .order('data', { ascending: false })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw erroAmigavel(error)
  }
  return (data ?? []).map(mapRegistro)
}

/** URLs assinadas (temporárias) por caminho — fotos e documentos. */
export async function urlsDosAnexos(caminhos: string[], validadeS = URL_VALIDADE_S): Promise<Map<string, string>> {
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

/** Link que força o download do arquivo com o nome original. */
export async function urlDeDownload(a: AnexoRegistro): Promise<string> {
  if (USE_MOCK || !supabase) {
    const u = mockBlobs.get(a.caminho)
    if (!u) throw new Error('Arquivo indisponível.')
    return u
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.caminho, 120, { download: a.nome })
  if (error || !data) throw erroAmigavel(error)
  return data.signedUrl
}

/** Foto reduzida para o relatório (null se não for possível baixar/ler). */
export async function obterFotoParaRelatorio(a: AnexoRegistro): Promise<ImagemRelatorio | null> {
  try {
    let blob: Blob | null = null
    if (USE_MOCK || !supabase) {
      const u = mockBlobs.get(a.caminho)
      blob = u ? await (await fetch(u)).blob() : null
    } else {
      const { data, error } = await supabase.storage.from(BUCKET).download(a.caminho)
      blob = error ? null : data
    }
    return blob ? await miniaturaJpeg(blob) : null
  } catch {
    return null
  }
}

// ---------------- registros ----------------

/** `id` pode ser gerado antes (para já nomear os arquivos). Devolve o id criado. */
export async function criarRegistro(dados: DadosRegistro, id: string = crypto.randomUUID()): Promise<string> {
  const erro = validarRegistro(dados)
  if (erro) throw new Error(erro)
  if (USE_MOCK || !supabase) {
    const perfil = await perfilAtual()
    mockRegistros.unshift({ ...dados, titulo: dados.titulo.trim(), id, criadoPorId: perfil?.id, criadoPorNome: perfil?.nome, criadoEm: new Date().toISOString(), anexos: [] })
    return id
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('registros_institucionais').insert({ id, ...paraLinha(dados), criado_por: auth.user?.id ?? null })
  if (error) throw erroAmigavel(error)
  return id
}

export async function atualizarRegistro(id: string, dados: DadosRegistro): Promise<void> {
  const erro = validarRegistro(dados)
  if (erro) throw new Error(erro)
  if (USE_MOCK || !supabase) {
    const r = mockRegistros.find((x) => x.id === id)
    if (!r) throw new Error('Registro não encontrado.')
    Object.assign(r, { ...dados, titulo: dados.titulo.trim() })
    return
  }
  const { error } = await supabase.from('registros_institucionais').update(paraLinha(dados)).eq('id', id)
  if (error) throw erroAmigavel(error)
}

/** Exclui o registro e todos os arquivos dele. */
export async function excluirRegistro(registro: Registro): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockRegistros.findIndex((x) => x.id === registro.id)
    if (i >= 0) mockRegistros.splice(i, 1)
    registro.anexos.forEach((a) => mockBlobs.delete(a.caminho))
    return
  }
  const { error } = await supabase.from('registros_institucionais').delete().eq('id', registro.id)
  if (error) throw erroAmigavel(error)
  if (registro.anexos.length > 0) {
    const { error: eArq } = await supabase.storage.from(BUCKET).remove(registro.anexos.map((a) => a.caminho))
    if (eArq) console.warn('[registros] registro removido, mas arquivos ficaram no storage:', eArq.message)
  }
}

// ---------------- anexos ----------------

/** Envia uma foto (reduzida), um documento ou uma ata e cria o registro do anexo. */
export async function adicionarAnexo(registroId: string, arquivo: File, categoria: CategoriaAnexo): Promise<AnexoRegistro> {
  const problema = validarArquivoAnexo(arquivo.name, arquivo.size, arquivo.type, categoria)
  if (problema) throw new Error(problema)

  let conteudo: Blob = arquivo
  let mime = mimeDoArquivo(arquivo.name, arquivo.type)
  let nome = arquivo.name
  let ext = extensaoDe(arquivo.name)
  if (categoria === 'foto') {
    conteudo = await reduzirImagem(arquivo)
    mime = conteudo.type === 'image/png' || conteudo.type === 'image/webp' ? conteudo.type : 'image/jpeg'
    ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
    nome = arquivo.name.replace(/\.[^.]+$/, '') + '.' + ext
  }
  const id = crypto.randomUUID()
  const caminho = `${registroId}/${id}.${ext}`

  if (USE_MOCK || !supabase) {
    const r = mockRegistros.find((x) => x.id === registroId)
    if (!r) throw new Error('Registro não encontrado.')
    const perfil = await perfilAtual()
    const anexo: AnexoRegistro = { id, registroId, categoria, caminho, nome, mime, tamanho: conteudo.size, enviadoPorId: perfil?.id, enviadoPorNome: perfil?.nome, criadoEm: new Date().toISOString() }
    r.anexos.push(anexo)
    mockBlobs.set(caminho, URL.createObjectURL(conteudo))
    return anexo
  }

  const { error: eUp } = await supabase.storage.from(BUCKET).upload(caminho, conteudo, { contentType: mime })
  if (eUp) throw erroAmigavel(eUp)
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('registro_anexos')
    .insert({ id, registro_id: registroId, categoria, caminho, nome, mime, tamanho: conteudo.size, enviado_por: auth.user?.id ?? null })
  if (error) {
    await supabase.storage.from(BUCKET).remove([caminho]) // não deixa arquivo órfão
    throw erroAmigavel(error)
  }
  return { id, registroId, categoria, caminho, nome, mime, tamanho: conteudo.size, enviadoPorId: auth.user?.id, criadoEm: new Date().toISOString() }
}

export async function removerAnexo(anexo: AnexoRegistro): Promise<void> {
  if (USE_MOCK || !supabase) {
    const r = mockRegistros.find((x) => x.id === anexo.registroId)
    if (r) r.anexos = r.anexos.filter((a) => a.id !== anexo.id)
    mockBlobs.delete(anexo.caminho)
    return
  }
  const { error } = await supabase.from('registro_anexos').delete().eq('id', anexo.id)
  if (error) throw erroAmigavel(error)
  const { error: eArq } = await supabase.storage.from(BUCKET).remove([anexo.caminho])
  if (eArq) console.warn('[registros] anexo removido, mas o arquivo ficou no storage:', eArq.message)
}
