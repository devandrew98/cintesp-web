import { supabase, USE_MOCK } from '@/lib/supabase'
import type { CategoriaDocumento, DepartamentoDocumento, Documento } from '@/types'

/**
 * Camada de dados de DOCUMENTOS (biblioteca de arquivos).
 * Leitura é liberada a qualquer usuário logado; upload/edição/exclusão é
 * garantida pelo banco (RLS: só admin) — o botão só some na tela por conforto.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DadosDocumento {
  titulo: string
  descricao?: string
  categoria: CategoriaDocumento
  departamento: DepartamentoDocumento
}

export interface NovoDocumento extends DadosDocumento {
  arquivoUrl: string
  arquivoNome: string
  arquivoTipo?: string
  arquivoTamanho?: number
}

/** Na edição, o arquivo é opcional — só manda quando a pessoa troca o anexo. */
export interface EdicaoDocumento extends DadosDocumento {
  arquivoUrl?: string
  arquivoNome?: string
  arquivoTipo?: string
  arquivoTamanho?: number
}

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table .* in the schema cache/i.test(msg)
  )
}

function mapDocumento(r: any): Documento {
  return {
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    categoria: r.categoria,
    departamento: r.departamento,
    arquivoUrl: r.arquivo_url,
    arquivoNome: r.arquivo_nome,
    arquivoTipo: r.arquivo_tipo ?? undefined,
    arquivoTamanho: r.arquivo_tamanho ?? undefined,
    autorId: r.autor_id ?? undefined,
    autorNome: r.autor?.nome ?? undefined,
    criadoEm: r.created_at,
    atualizadoEm: r.updated_at ?? undefined,
  }
}

// ---------- Mock (sem banco) ----------
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

const mockDocumentos: Documento[] = [
  {
    id: 'doc-1',
    titulo: 'Manual do Pesquisador CINTESP.Br',
    descricao: 'Normas de uso do laboratório, equipamentos e boas práticas do dia a dia.',
    categoria: 'manual',
    departamento: 'geral',
    arquivoUrl: '#',
    arquivoNome: 'manual-pesquisador-cintesp.pdf',
    arquivoTipo: 'application/pdf',
    arquivoTamanho: 2_458_000,
    autorNome: 'Administrador',
    criadoEm: diasAtras(30),
  },
  {
    id: 'doc-2',
    titulo: 'Formulário de Solicitação de Equipamento',
    descricao: 'Preencha para solicitar empréstimo de equipamento do patrimônio.',
    categoria: 'formulario',
    departamento: 'administracao',
    arquivoUrl: '#',
    arquivoNome: 'formulario-solicitacao-equipamento.docx',
    arquivoTipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    arquivoTamanho: 84_000,
    autorNome: 'Administrador',
    criadoEm: diasAtras(21),
  },
  {
    id: 'doc-3',
    titulo: 'Política de Uso de Dados de Pesquisa',
    descricao: 'Diretrizes de coleta, armazenamento e compartilhamento de dados dos projetos.',
    categoria: 'politica',
    departamento: 'pesquisa',
    arquivoUrl: '#',
    arquivoNome: 'politica-uso-dados-pesquisa.pdf',
    arquivoTipo: 'application/pdf',
    arquivoTamanho: 512_000,
    autorNome: 'Coordenação',
    criadoEm: diasAtras(18),
  },
  {
    id: 'doc-4',
    titulo: 'Modelo de Relatório Mensal',
    descricao: 'Template padrão para o relatório mensal de atividades.',
    categoria: 'modelo',
    departamento: 'pesquisa',
    arquivoUrl: '#',
    arquivoNome: 'modelo-relatorio-mensal.xlsx',
    arquivoTipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    arquivoTamanho: 63_500,
    autorNome: 'Administrador',
    criadoEm: diasAtras(12),
  },
  {
    id: 'doc-5',
    titulo: 'Ata da Reunião de Planejamento — Julho',
    descricao: 'Registro das decisões da reunião de planejamento estratégico.',
    categoria: 'ata',
    departamento: 'administracao',
    arquivoUrl: '#',
    arquivoNome: 'ata-planejamento-julho.pdf',
    arquivoTipo: 'application/pdf',
    arquivoTamanho: 210_000,
    autorNome: 'Coordenação',
    criadoEm: diasAtras(7),
  },
  {
    id: 'doc-6',
    titulo: 'Procedimento de Reembolso de Despesas',
    descricao: 'Passo a passo para solicitar reembolso ao setor financeiro.',
    categoria: 'procedimento',
    departamento: 'financeiro',
    arquivoUrl: '#',
    arquivoNome: 'procedimento-reembolso.pdf',
    arquivoTipo: 'application/pdf',
    arquivoTamanho: 340_000,
    autorNome: 'Administrador',
    criadoEm: diasAtras(3),
  },
]

// ============================================================
// Leitura
// ============================================================

export async function listarDocumentos(): Promise<Documento[]> {
  if (USE_MOCK || !supabase) return [...mockDocumentos]
  const { data, error } = await supabase
    .from('documentos')
    .select('*, autor:autor_id (nome)')
    .order('created_at', { ascending: false })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw error
  }
  return (data ?? []).map(mapDocumento)
}

// ============================================================
// Upload do arquivo (Storage)
// ============================================================

export interface ArquivoEnviado {
  url: string
  nome: string
  tipo: string
  tamanho: number
}

/** Envia o arquivo pro Storage (bucket `documentos`) e devolve a URL pública. */
export async function enviarArquivoDocumento(arquivo: File): Promise<ArquivoEnviado> {
  if (USE_MOCK || !supabase) {
    return { url: URL.createObjectURL(arquivo), nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size }
  }
  const { data: auth } = await supabase.auth.getUser()
  const nomeSeguro = arquivo.name.replace(/[^\w.\-]+/g, '_')
  const caminho = `${auth.user?.id ?? 'anon'}/${Date.now()}-${nomeSeguro}`
  const { error } = await supabase.storage
    .from('documentos')
    .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type || undefined })
  if (error) throw error
  const { data: pub } = supabase.storage.from('documentos').getPublicUrl(caminho)
  return { url: pub.publicUrl, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size }
}

// ============================================================
// Escrita (admin — garantido pelo RLS)
// ============================================================

export async function criarDocumento(input: NovoDocumento): Promise<Documento> {
  if (USE_MOCK || !supabase) {
    const doc: Documento = {
      id: `doc-${Date.now()}`,
      titulo: input.titulo,
      descricao: input.descricao,
      categoria: input.categoria,
      departamento: input.departamento,
      arquivoUrl: input.arquivoUrl,
      arquivoNome: input.arquivoNome,
      arquivoTipo: input.arquivoTipo,
      arquivoTamanho: input.arquivoTamanho,
      autorNome: 'Você',
      criadoEm: new Date().toISOString(),
    }
    mockDocumentos.unshift(doc)
    return doc
  }
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('documentos')
    .insert({
      titulo: input.titulo.trim(),
      descricao: input.descricao?.trim() || null,
      categoria: input.categoria,
      departamento: input.departamento,
      arquivo_url: input.arquivoUrl,
      arquivo_nome: input.arquivoNome,
      arquivo_tipo: input.arquivoTipo || null,
      arquivo_tamanho: input.arquivoTamanho || null,
      autor_id: auth.user?.id ?? null,
    })
    .select('*, autor:autor_id (nome)')
    .single()
  if (error) throw error
  return mapDocumento(data)
}

export async function atualizarDocumento(id: string, input: EdicaoDocumento): Promise<Documento> {
  if (USE_MOCK || !supabase) {
    const idx = mockDocumentos.findIndex((d) => d.id === id)
    if (idx === -1) throw new Error('Documento não encontrado.')
    mockDocumentos[idx] = {
      ...mockDocumentos[idx],
      titulo: input.titulo,
      descricao: input.descricao,
      categoria: input.categoria,
      departamento: input.departamento,
      ...(input.arquivoUrl
        ? {
            arquivoUrl: input.arquivoUrl,
            arquivoNome: input.arquivoNome!,
            arquivoTipo: input.arquivoTipo,
            arquivoTamanho: input.arquivoTamanho,
          }
        : {}),
      atualizadoEm: new Date().toISOString(),
    }
    return mockDocumentos[idx]
  }
  const patch: Record<string, unknown> = {
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() || null,
    categoria: input.categoria,
    departamento: input.departamento,
  }
  if (input.arquivoUrl) {
    patch.arquivo_url = input.arquivoUrl
    patch.arquivo_nome = input.arquivoNome
    patch.arquivo_tipo = input.arquivoTipo || null
    patch.arquivo_tamanho = input.arquivoTamanho || null
  }
  const { data, error } = await supabase
    .from('documentos')
    .update(patch)
    .eq('id', id)
    .select('*, autor:autor_id (nome)')
    .single()
  if (error) throw error
  return mapDocumento(data)
}

export async function excluirDocumento(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const idx = mockDocumentos.findIndex((d) => d.id === id)
    if (idx !== -1) mockDocumentos.splice(idx, 1)
    return
  }
  const { error } = await supabase.from('documentos').delete().eq('id', id)
  if (error) throw error
}
