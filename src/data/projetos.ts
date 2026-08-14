import { supabase, USE_MOCK } from '@/lib/supabase'
import { perfilAtual, listarUsuarios } from '@/data/api'
import type {
  CampoEditavelProjeto,
  MensagemProjeto,
  PesquisadorVinculado,
  Projeto,
  StatusProjeto,
} from '@/types'

/**
 * Camada de dados de PROJETOS (equipe, TRL/progresso, chat privado).
 * Leitura: admin vê todos; pesquisador só vê os projetos em que está
 * vinculado. Escrita de conteúdo respeita os campos liberados por projeto.
 * Tudo é garantido pelo banco (RLS) — aqui é só conforto visual/mock.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DadosProjeto {
  titulo: string
  descricao?: string
  status: StatusProjeto
  dataInicio?: string
  dataFimPrevista?: string
  responsavelId: string
  /** Ids dos pesquisadores vinculados, SEM o responsável (ele é incluído automaticamente). */
  pesquisadoresIds: string[]
  camposEditaveisMembros: CampoEditavelProjeto[]
}

/** Campos de conteúdo que podem ser atualizados (parcialmente) depois de criado. */
export interface ConteudoProjeto {
  titulo?: string
  descricao?: string
  status?: StatusProjeto
  dataInicio?: string
  dataFimPrevista?: string
  trl?: number
  progresso?: number
  dadosTecnicos?: string
  observacoes?: string
}

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table .* in the schema cache/i.test(msg)
  )
}

function mapProjeto(r: any): Projeto {
  const pesquisadores: PesquisadorVinculado[] = (r.pesquisadores ?? []).map((p: any) => ({
    usuarioId: p.usuario_id,
    nome: p.usuario?.nome ?? undefined,
    fotoUrl: p.usuario?.foto_url ?? undefined,
    papel: p.papel,
  }))
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    status: r.status,
    trl: r.trl ?? undefined,
    progresso: r.progresso ?? 0,
    dadosTecnicos: r.dados_tecnicos ?? undefined,
    observacoes: r.observacoes ?? undefined,
    dataInicio: r.data_inicio ?? undefined,
    dataFimPrevista: r.data_fim_prevista ?? undefined,
    responsavelId: r.responsavel_id,
    responsavelNome: r.responsavel?.nome ?? undefined,
    responsavelFotoUrl: r.responsavel?.foto_url ?? undefined,
    pesquisadores,
    camposEditaveisMembros: r.campos_editaveis_membros ?? [],
    criadoPorNome: r.criado_por?.nome ?? undefined,
    criadoEm: r.created_at,
    atualizadoEm: r.updated_at ?? undefined,
  }
}

// ---------- Mock (sem banco) ----------
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const diasNaFrente = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

const P = (
  usuarioId: string,
  nome: string,
  papel: PesquisadorVinculado['papel'] = 'membro',
): PesquisadorVinculado => ({ usuarioId, nome, papel })

const mockProjetos: Projeto[] = [
  {
    id: 'proj-1',
    titulo: 'Cadeira de Rodas Inteligente com Sensores de Obstáculo',
    descricao: 'Protótipo de cadeira de rodas motorizada com desvio automático de obstáculos.',
    status: 'em_andamento',
    trl: 5,
    progresso: 55,
    dadosTecnicos: 'Microcontrolador ESP32, sensores ultrassônicos HC-SR04 (x4), motor DC 24V.',
    observacoes: 'Aguardando peças para o próximo teste de campo.',
    dataInicio: diasNaFrente(-120),
    dataFimPrevista: diasNaFrente(150),
    responsavelId: 'u1',
    responsavelNome: 'João Silva',
    pesquisadores: [P('u1', 'João Silva', 'responsavel'), P('u2', 'Mariana Souza'), P('u4', 'Larissa Martins')],
    camposEditaveisMembros: ['trl', 'progresso', 'dadosTecnicos'],
    criadoPorNome: 'Administrador',
    criadoEm: diasAtras(120),
    atualizadoEm: diasAtras(2),
  },
  {
    id: 'proj-2',
    titulo: 'Aplicativo de Comunicação Alternativa (CAA) por Voz',
    descricao: 'App mobile de comunicação aumentativa/alternativa para pessoas não-verbais.',
    status: 'planejamento',
    trl: 2,
    progresso: 10,
    dadosTecnicos: '',
    dataInicio: diasNaFrente(10),
    responsavelId: 'u3',
    responsavelNome: 'Carlos Almeida',
    pesquisadores: [P('u3', 'Carlos Almeida', 'responsavel'), P('u6', 'Ana Rodrigues')],
    camposEditaveisMembros: ['progresso', 'descricao'],
    criadoPorNome: 'Administrador',
    criadoEm: diasAtras(15),
  },
  {
    id: 'proj-3',
    titulo: 'Órtese de Mão Impressa em 3D de Baixo Custo',
    descricao: 'Órtese funcional para reabilitação, com arquivos de impressão 3D abertos.',
    status: 'concluido',
    trl: 8,
    progresso: 100,
    dadosTecnicos: 'PETG, impressão FDM, tempo de impressão médio 6h por unidade.',
    observacoes: 'Publicado artigo no congresso regional de tecnologia assistiva.',
    dataInicio: diasNaFrente(-400),
    dataFimPrevista: diasNaFrente(-30),
    responsavelId: 'u5',
    responsavelNome: 'Rafael Costa',
    pesquisadores: [P('u5', 'Rafael Costa', 'responsavel'), P('u1', 'João Silva'), P('u7', 'Lucas Almeida')],
    camposEditaveisMembros: ['trl', 'progresso', 'dadosTecnicos', 'observacoes'],
    criadoPorNome: 'Coordenação',
    criadoEm: diasAtras(400),
    atualizadoEm: diasAtras(30),
  },
]

let seqMensagem = 0
const mockMensagens: MensagemProjeto[] = [
  {
    id: 'pm-1',
    projetoId: 'proj-1',
    autorId: 'u19',
    autorNome: 'Administrador',
    corpo: 'Time, lembrando do prazo de entrega do protótipo v2 no fim do mês.',
    criadoEm: diasAtras(3),
  },
  {
    id: 'pm-2',
    projetoId: 'proj-1',
    autorId: 'u1',
    autorNome: 'João Silva',
    corpo: 'Combinado. Os sensores novos chegam essa semana, já atualizei o progresso.',
    criadoEm: diasAtras(2),
  },
]

/** true se o usuário (id) está vinculado ao projeto, em qualquer papel. */
function vinculado(p: Projeto, usuarioId?: string): boolean {
  return Boolean(usuarioId) && p.pesquisadores.some((v) => v.usuarioId === usuarioId)
}

// ============================================================
// Leitura
// ============================================================

/** Lista projetos: admin vê todos; pesquisador só os que está vinculado. */
export async function listarProjetos(): Promise<Projeto[]> {
  if (USE_MOCK || !supabase) {
    const perfil = await perfilAtual()
    const ehAdmin = perfil?.funcao?.permissoes?.includes('gerenciar_tudo')
    if (ehAdmin) return [...mockProjetos]
    return mockProjetos.filter((p) => vinculado(p, perfil?.id))
  }
  // RLS no banco já filtra para "todos" (admin) ou "só os meus" (pesquisador) —
  // o front sempre pede tudo e recebe só o que a política liberar.
  const { data, error } = await supabase
    .from('projetos')
    .select(
      `*, responsavel:responsavel_id (nome, foto_url), criado_por:criado_por (nome),
       pesquisadores:projeto_pesquisadores (usuario_id, papel, usuario:usuario_id (nome, foto_url))`,
    )
    .order('created_at', { ascending: false })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw error
  }
  return (data ?? []).map(mapProjeto)
}

// ============================================================
// Escrita — estrutura (admin only)
// ============================================================

export async function criarProjeto(input: DadosProjeto): Promise<Projeto> {
  if (USE_MOCK || !supabase) {
    const [perfil, usuarios] = await Promise.all([perfilAtual(), listarUsuarios()])
    const nomeDe = (id: string) => usuarios.find((u) => u.id === id)?.nome
    const responsavel: PesquisadorVinculado = {
      usuarioId: input.responsavelId,
      nome: nomeDe(input.responsavelId),
      papel: 'responsavel',
    }
    const membros: PesquisadorVinculado[] = input.pesquisadoresIds
      .filter((id) => id !== input.responsavelId)
      .map((id) => ({ usuarioId: id, nome: nomeDe(id), papel: 'membro' as const }))
    const projeto: Projeto = {
      id: `proj-${Date.now()}`,
      titulo: input.titulo,
      descricao: input.descricao,
      status: input.status,
      progresso: 0,
      dataInicio: input.dataInicio,
      dataFimPrevista: input.dataFimPrevista,
      responsavelId: input.responsavelId,
      responsavelNome: responsavel.nome,
      pesquisadores: [responsavel, ...membros],
      camposEditaveisMembros: input.camposEditaveisMembros,
      criadoPorNome: perfil?.nome,
      criadoEm: new Date().toISOString(),
    }
    mockProjetos.unshift(projeto)
    return projeto
  }
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('projetos')
    .insert({
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      status: input.status,
      data_inicio: input.dataInicio || null,
      data_fim_prevista: input.dataFimPrevista || null,
      responsavel_id: input.responsavelId,
      campos_editaveis_membros: input.camposEditaveisMembros,
      criado_por: auth.user?.id ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  const vinculos = Array.from(new Set([input.responsavelId, ...input.pesquisadoresIds])).map((usuarioId) => ({
    projeto_id: data.id,
    usuario_id: usuarioId,
    papel: usuarioId === input.responsavelId ? 'responsavel' : 'membro',
  }))
  const { error: errVinculo } = await supabase.from('projeto_pesquisadores').insert(vinculos)
  if (errVinculo) throw errVinculo
  const lista = await listarProjetos()
  return lista.find((p) => p.id === data.id)!
}

/** Atualiza estrutura (responsável, vínculos, campos liberados) — admin only, garantido pelo RLS. */
export async function atualizarEstruturaProjeto(
  id: string,
  input: Pick<DadosProjeto, 'responsavelId' | 'pesquisadoresIds' | 'camposEditaveisMembros'>,
): Promise<void> {
  if (USE_MOCK || !supabase) {
    const p = mockProjetos.find((x) => x.id === id)
    if (!p) throw new Error('Projeto não encontrado.')
    const usuarios = await listarUsuarios()
    const nomeDe = (uid: string) => usuarios.find((u) => u.id === uid)?.nome
    p.responsavelId = input.responsavelId
    p.responsavelNome = nomeDe(input.responsavelId)
    const membros = input.pesquisadoresIds.filter((uid) => uid !== input.responsavelId)
    p.pesquisadores = [
      { usuarioId: input.responsavelId, nome: nomeDe(input.responsavelId), papel: 'responsavel' },
      ...membros.map((uid) => ({ usuarioId: uid, nome: nomeDe(uid), papel: 'membro' as const })),
    ]
    p.camposEditaveisMembros = input.camposEditaveisMembros
    p.atualizadoEm = new Date().toISOString()
    return
  }
  const { error } = await supabase
    .from('projetos')
    .update({
      responsavel_id: input.responsavelId,
      campos_editaveis_membros: input.camposEditaveisMembros,
    })
    .eq('id', id)
  if (error) throw error
  await supabase.from('projeto_pesquisadores').delete().eq('projeto_id', id)
  const vinculos = Array.from(new Set([input.responsavelId, ...input.pesquisadoresIds])).map((usuarioId) => ({
    projeto_id: id,
    usuario_id: usuarioId,
    papel: usuarioId === input.responsavelId ? 'responsavel' : 'membro',
  }))
  const { error: errVinculo } = await supabase.from('projeto_pesquisadores').insert(vinculos)
  if (errVinculo) throw errVinculo
}

export async function excluirProjeto(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const idx = mockProjetos.findIndex((p) => p.id === id)
    if (idx !== -1) mockProjetos.splice(idx, 1)
    return
  }
  const { error } = await supabase.from('projetos').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// Escrita — conteúdo (admin, responsável, ou membro nos campos liberados)
// ============================================================

/**
 * Atualiza campos de CONTEÚDO. Só manda o que a tela deixou editável — a
 * validação de "quem pode mudar o quê" é feita no banco (ver
 * docs/supabase-projetos.sql), então mesmo que o front mande algo indevido
 * a escrita é rejeitada.
 */
export async function atualizarConteudoProjeto(id: string, patch: ConteudoProjeto): Promise<void> {
  if (USE_MOCK || !supabase) {
    const p = mockProjetos.find((x) => x.id === id)
    if (!p) throw new Error('Projeto não encontrado.')
    Object.assign(p, patch)
    p.atualizadoEm = new Date().toISOString()
    return
  }
  const payload: Record<string, unknown> = {}
  if (patch.titulo !== undefined) payload.titulo = patch.titulo.trim()
  if (patch.descricao !== undefined) payload.descricao = patch.descricao.trim() || null
  if (patch.status !== undefined) payload.status = patch.status
  if (patch.dataInicio !== undefined) payload.data_inicio = patch.dataInicio || null
  if (patch.dataFimPrevista !== undefined) payload.data_fim_prevista = patch.dataFimPrevista || null
  if (patch.trl !== undefined) payload.trl = patch.trl
  if (patch.progresso !== undefined) payload.progresso = patch.progresso
  if (patch.dadosTecnicos !== undefined) payload.dados_tecnicos = patch.dadosTecnicos.trim() || null
  if (patch.observacoes !== undefined) payload.observacoes = patch.observacoes.trim() || null
  const { error } = await supabase.from('projetos').update(payload).eq('id', id)
  if (error) throw error
}

// ============================================================
// Chat do projeto (mensagens + anexos)
// ============================================================

export async function listarMensagensProjeto(projetoId: string): Promise<MensagemProjeto[]> {
  if (USE_MOCK || !supabase) return mockMensagens.filter((m) => m.projetoId === projetoId)
  const { data, error } = await supabase
    .from('projeto_mensagens')
    .select('id, projeto_id, autor_id, corpo, anexo_url, anexo_nome, anexo_tipo, anexo_tamanho, created_at, autor:autor_id (nome, foto_url)')
    .eq('projeto_id', projetoId)
    .order('created_at', { ascending: true })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw error
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    projetoId: r.projeto_id,
    autorId: r.autor_id ?? undefined,
    autorNome: r.autor?.nome ?? undefined,
    autorFotoUrl: r.autor?.foto_url ?? undefined,
    corpo: r.corpo ?? undefined,
    anexoUrl: r.anexo_url ?? undefined,
    anexoNome: r.anexo_nome ?? undefined,
    anexoTipo: r.anexo_tipo ?? undefined,
    anexoTamanho: r.anexo_tamanho ?? undefined,
    criadoEm: r.created_at,
  }))
}

export interface NovaMensagemProjeto {
  corpo?: string
  anexoUrl?: string
  anexoNome?: string
  anexoTipo?: string
  anexoTamanho?: number
}

export async function enviarMensagemProjeto(projetoId: string, msg: NovaMensagemProjeto): Promise<void> {
  if (USE_MOCK || !supabase) {
    const perfil = await perfilAtual()
    mockMensagens.push({
      id: `pm-mock-${seqMensagem++}`,
      projetoId,
      autorId: perfil?.id,
      autorNome: perfil?.nome ?? 'Você',
      corpo: msg.corpo,
      anexoUrl: msg.anexoUrl,
      anexoNome: msg.anexoNome,
      anexoTipo: msg.anexoTipo,
      anexoTamanho: msg.anexoTamanho,
      criadoEm: new Date().toISOString(),
    })
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('projeto_mensagens').insert({
    projeto_id: projetoId,
    autor_id: auth.user?.id,
    corpo: msg.corpo || null,
    anexo_url: msg.anexoUrl || null,
    anexo_nome: msg.anexoNome || null,
    anexo_tipo: msg.anexoTipo || null,
    anexo_tamanho: msg.anexoTamanho || null,
  })
  if (error) throw error
}

export interface AnexoEnviado {
  url: string
  nome: string
  tipo: string
  tamanho: number
}

/** Envia o anexo do chat pro Storage (bucket privado `projeto-anexos`) e devolve a URL. */
export async function enviarAnexoProjeto(projetoId: string, arquivo: File): Promise<AnexoEnviado> {
  if (USE_MOCK || !supabase) {
    return { url: URL.createObjectURL(arquivo), nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size }
  }
  const { data: auth } = await supabase.auth.getUser()
  const nomeSeguro = arquivo.name.replace(/[^\w.\-]+/g, '_')
  const caminho = `${projetoId}/${auth.user?.id ?? 'anon'}-${Date.now()}-${nomeSeguro}`
  const { error } = await supabase.storage
    .from('projeto-anexos')
    .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type || undefined })
  if (error) throw error
  // Bucket é PRIVADO (só admin + vinculados, via RLS) — usa URL assinada, não pública.
  const { data: assinada, error: errAssinada } = await supabase.storage
    .from('projeto-anexos')
    .createSignedUrl(caminho, 60 * 60 * 24 * 7) // 7 dias
  if (errAssinada) throw errAssinada
  return { url: assinada.signedUrl, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size }
}
