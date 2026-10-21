import { supabase, USE_MOCK } from '@/lib/supabase'
import { listarUsuarios } from '@/data/api'
import type { PosicaoAssinatura } from '@/lib/assinaturaPdf'
import type { DadosAssinatura } from '@/lib/assinaturaEmail'

/**
 * Camada de dados da ASSINATURA DE DOCUMENTOS (termos de empréstimo).
 * Tabelas/bucket/regras em docs/supabase-assinaturas.sql. O acesso é
 * garantido por RLS: o administrador vê tudo; o pesquisador só vê (e só
 * assina) os documentos criados PARA ele.
 *
 * Em modo mock (sem banco) tudo fica em memória — os PDFs somem ao recarregar.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type StatusDocumentoAssinatura = 'aguardando' | 'assinado'

export interface DocumentoAssinatura {
  id: string
  titulo: string
  pesquisadorId: string
  pesquisadorNome?: string
  status: StatusDocumentoAssinatura
  posicaoPesquisador: PosicaoAssinatura
  protocolo?: string
  hashFinal?: string
  criadoEm: string
  assinadoEm?: string
}

const BUCKET = 'assinaturas'

function ehTabelaAusente(error: any): boolean {
  const msg = String(error?.message ?? '')
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table/i.test(msg)
  )
}

function mapDocumento(r: any): DocumentoAssinatura {
  return {
    id: r.id,
    titulo: r.titulo,
    pesquisadorId: r.pesquisador_id,
    pesquisadorNome: r.pesquisador?.nome ?? undefined,
    status: r.status,
    posicaoPesquisador: r.posicao_pesquisador,
    protocolo: r.protocolo ?? undefined,
    hashFinal: r.hash_final ?? undefined,
    criadoEm: r.criado_em,
    assinadoEm: r.assinado_em ?? undefined,
  }
}

// ---------------- Mock (em memória) ----------------
const mockDocs: DocumentoAssinatura[] = []
const mockArquivos = new Map<string, Uint8Array>() // chave: `${id}/admin.pdf` | `${id}/final.pdf`
let mockPerfil: DadosAssinatura | null = null

// ---------------- Minha assinatura (nome, cargo, logo…) ----------------

export async function carregarMinhaAssinatura(usuarioId: string): Promise<DadosAssinatura | null> {
  if (USE_MOCK || !supabase) return mockPerfil
  const { data, error } = await supabase
    .from('assinatura_perfis')
    .select('nome, cargo, organizacao, email, logo_url')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  if (error) {
    if (ehTabelaAusente(error)) return null
    throw error
  }
  if (!data) return null
  return {
    nome: data.nome,
    cargo: data.cargo ?? '',
    organizacao: data.organizacao ?? '',
    email: data.email ?? '',
    logoUrl: data.logo_url ?? '',
  }
}

export async function salvarMinhaAssinatura(usuarioId: string, d: DadosAssinatura): Promise<void> {
  if (USE_MOCK || !supabase) {
    mockPerfil = { ...d }
    return
  }
  const { error } = await supabase.from('assinatura_perfis').upsert(
    {
      usuario_id: usuarioId,
      nome: d.nome.trim(),
      cargo: d.cargo.trim(),
      organizacao: d.organizacao.trim(),
      email: d.email.trim(),
      logo_url: d.logoUrl || null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'usuario_id' },
  )
  if (error) throw error
}

// ---------------- Documentos ----------------

export async function listarDocumentosAssinatura(): Promise<DocumentoAssinatura[]> {
  if (USE_MOCK || !supabase) return [...mockDocs]
  const { data, error } = await supabase
    .from('assinatura_documentos')
    .select('*, pesquisador:pesquisador_id (nome)')
    .order('criado_em', { ascending: false })
  if (error) {
    if (ehTabelaAusente(error)) return []
    throw error
  }
  return (data ?? []).map(mapDocumento)
}

/** Admin: cria o documento já com a assinatura do emprestante aplicada (`pdfComAdmin`). */
export async function criarDocumentoParaAssinar(dados: {
  id: string
  titulo: string
  pesquisadorId: string
  protocolo?: string
  posicaoPesquisador: PosicaoAssinatura
  pdfComAdmin: Uint8Array
  criadoPor?: string
}): Promise<void> {
  if (USE_MOCK || !supabase) {
    const usuarios = await listarUsuarios()
    mockArquivos.set(`${dados.id}/admin.pdf`, dados.pdfComAdmin)
    mockDocs.unshift({
      id: dados.id,
      titulo: dados.titulo,
      pesquisadorId: dados.pesquisadorId,
      pesquisadorNome: usuarios.find((u) => u.id === dados.pesquisadorId)?.nome,
      status: 'aguardando',
      posicaoPesquisador: dados.posicaoPesquisador,
      protocolo: dados.protocolo,
      criadoEm: new Date().toISOString(),
    })
    return
  }

  // 1º o arquivo (se falhar, não fica documento "fantasma" sem PDF); 2º a linha.
  const { error: eUp } = await supabase.storage
    .from(BUCKET)
    .upload(`${dados.id}/admin.pdf`, new Blob([dados.pdfComAdmin as BlobPart], { type: 'application/pdf' }), {
      contentType: 'application/pdf',
    })
  if (eUp) throw eUp

  const { error } = await supabase.from('assinatura_documentos').insert({
    id: dados.id,
    titulo: dados.titulo.trim(),
    pesquisador_id: dados.pesquisadorId,
    criado_por: dados.criadoPor,
    protocolo: dados.protocolo || null,
    posicao_pesquisador: dados.posicaoPesquisador,
  })
  if (error) {
    await supabase.storage.from(BUCKET).remove([`${dados.id}/admin.pdf`])
    throw error
  }
}

/** Baixa o PDF: `admin` = só com a assinatura do emprestante; `final` = com as duas. */
export async function baixarPdfDocumento(id: string, versao: 'admin' | 'final'): Promise<Uint8Array> {
  if (USE_MOCK || !supabase) {
    const bytes = mockArquivos.get(`${id}/${versao}.pdf`)
    if (!bytes) throw new Error('Arquivo não encontrado.')
    return bytes
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(`${id}/${versao}.pdf`)
  if (error) throw error
  return new Uint8Array(await data.arrayBuffer())
}

/** Pesquisador: envia o PDF com as duas assinaturas e marca o documento como assinado. */
export async function concluirAssinatura(id: string, pdfFinal: Uint8Array, hash: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    mockArquivos.set(`${id}/final.pdf`, pdfFinal)
    const d = mockDocs.find((x) => x.id === id)
    if (d) {
      d.status = 'assinado'
      d.assinadoEm = new Date().toISOString()
      d.hashFinal = hash
    }
    return
  }
  const { error: eUp } = await supabase.storage
    .from(BUCKET)
    .upload(`${id}/final.pdf`, new Blob([pdfFinal as BlobPart], { type: 'application/pdf' }), {
      contentType: 'application/pdf',
    })
  if (eUp) throw eUp
  const { error } = await supabase.rpc('assinatura_concluir', { p_id: id, p_hash: hash })
  if (error) throw error
}

export async function excluirDocumentoAssinatura(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockDocs.findIndex((x) => x.id === id)
    if (i >= 0) mockDocs.splice(i, 1)
    mockArquivos.delete(`${id}/admin.pdf`)
    mockArquivos.delete(`${id}/final.pdf`)
    return
  }
  await supabase.storage.from(BUCKET).remove([`${id}/admin.pdf`, `${id}/final.pdf`])
  const { error } = await supabase.from('assinatura_documentos').delete().eq('id', id)
  if (error) throw error
}
