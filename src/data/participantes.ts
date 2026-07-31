import { supabase, USE_MOCK } from '@/lib/supabase'
import { normalizarCPF } from '@/lib/cpf'
import type { Importacao, Participante, StatusImportacao } from '@/types'

/**
 * Camada de dados dos PARTICIPANTES (alunos importados de planilha).
 *
 * Segue o mesmo padrão de `data/api.ts`: cada função decide a fonte
 * (mock em memória ou Supabase). A importação faz "upsert" pelo CPF —
 * quem já existe é atualizado, quem é novo é criado.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------- Mapeadores banco → domínio ----------
const mapParticipante = (r: any): Participante => ({
  id: r.id,
  nome: r.nome,
  cpf: r.cpf ?? undefined,
  dataNascimento: r.data_nascimento ?? undefined,
  curso: r.curso ?? undefined,
  turma: r.turma ?? undefined,
  matricula: r.matricula ?? undefined,
  instituicaoId: r.instituicao_id ?? undefined,
  email: r.email ?? undefined,
  telefone: r.telefone ?? undefined,
  endereco: r.endereco ?? undefined,
  cep: r.cep ?? undefined,
  cidade: r.cidade ?? undefined,
  estado: r.estado ?? undefined,
  status: r.status ?? 'ativo',
  observacoes: r.observacoes ?? undefined,
  dadosExtras: r.dados_extras ?? {},
  criadoEm: r.created_at ?? undefined,
})

const mapImportacao = (r: any): Importacao => ({
  id: r.id,
  arquivo: r.arquivo,
  totalLinhas: r.total_linhas ?? 0,
  criados: r.criados ?? 0,
  atualizados: r.atualizados ?? 0,
  ignorados: r.ignorados ?? 0,
  erros: r.erros ?? 0,
  status: r.status ?? 'concluida',
  autorNome: r.autor?.nome ?? undefined,
  criadoEm: r.created_at,
})

/** Converte o participante do domínio para as colunas do banco. */
function paraLinhaDoBanco(p: Participante, importacaoId?: string) {
  return {
    nome: p.nome,
    cpf: p.cpf || null,
    data_nascimento: p.dataNascimento || null,
    curso: p.curso || null,
    turma: p.turma || null,
    matricula: p.matricula || null,
    email: p.email || null,
    telefone: p.telefone || null,
    endereco: p.endereco || null,
    cep: p.cep || null,
    cidade: p.cidade || null,
    estado: p.estado || null,
    status: p.status || 'ativo',
    observacoes: p.observacoes || null,
    dados_extras: p.dadosExtras ?? {},
    importacao_id: importacaoId ?? null,
  }
}

// ============================================================
// Armazenamento em memória para o modo MOCK (sem banco).
// Permite testar toda a tela de importação sem Supabase.
// ============================================================
const mockParticipantes: Participante[] = []
const mockImportacoes: Importacao[] = []

// ============================================================
// Leitura
// ============================================================

export async function listarParticipantes(): Promise<Participante[]> {
  if (USE_MOCK || !supabase) return [...mockParticipantes]

  const { data, error } = await supabase
    .from('participantes')
    .select('*')
    .order('nome')
  if (error) throw error
  return (data ?? []).map(mapParticipante)
}

export async function listarImportacoes(): Promise<Importacao[]> {
  if (USE_MOCK || !supabase) return [...mockImportacoes]

  const { data, error } = await supabase
    .from('importacoes')
    .select('*, autor:autor_id (nome)')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []).map(mapImportacao)
}

/**
 * Busca quais CPFs (de uma lista) JÁ existem no banco.
 * Usado na pré-visualização para mostrar quantos serão criados
 * e quantos serão atualizados ANTES de confirmar.
 */
export async function cpfsExistentes(cpfs: string[]): Promise<Set<string>> {
  const limpos = cpfs.filter(Boolean)
  if (limpos.length === 0) return new Set()

  if (USE_MOCK || !supabase) {
    return new Set(
      mockParticipantes.map((p) => p.cpf).filter((c): c is string => Boolean(c)),
    )
  }

  // Consulta em blocos para não estourar o tamanho da URL.
  const encontrados = new Set<string>()
  const TAMANHO = 300
  for (let i = 0; i < limpos.length; i += TAMANHO) {
    const bloco = limpos.slice(i, i + TAMANHO)
    const { data, error } = await supabase
      .from('participantes')
      .select('cpf')
      .in('cpf', bloco)
    if (error) throw error
    for (const linha of data ?? []) {
      if (linha.cpf) encontrados.add(linha.cpf)
    }
  }
  return encontrados
}

// ============================================================
// Importação
// ============================================================

/** Resultado consolidado de uma importação. */
export interface ResultadoImportacao {
  criados: number
  atualizados: number
  erros: number
  importacaoId?: string
  mensagemErro?: string
}

/**
 * Grava os participantes no banco.
 *
 * - Deduplicação: upsert com `onConflict: 'cpf'` — quem já tem aquele CPF é
 *   ATUALIZADO; quem não tem é criado.
 * - Envio em lotes de 200 para não estourar limites da API.
 * - Registra a operação na tabela `importacoes` (auditoria).
 *
 * @param participantes linhas já validadas e confirmadas pelo usuário
 * @param arquivo nome do arquivo de origem (para o histórico)
 * @param jaExistiam CPFs que já estavam no banco (para contar criados x atualizados)
 * @param onProgresso callback (0..1) para a barra de progresso
 */
export async function importarParticipantes(
  participantes: Participante[],
  arquivo: string,
  jaExistiam: Set<string>,
  onProgresso?: (fracao: number) => void,
): Promise<ResultadoImportacao> {
  // Conta antecipadamente, com base no que foi verificado na pré-visualização.
  const atualizados = participantes.filter((p) => p.cpf && jaExistiam.has(p.cpf)).length
  const criados = participantes.length - atualizados

  // ----- Modo mock: guarda em memória -----
  if (USE_MOCK || !supabase) {
    for (const p of participantes) {
      const i = mockParticipantes.findIndex((x) => x.cpf && x.cpf === p.cpf)
      if (i >= 0) {
        // Mantém o id original: `p` vem da planilha com id vazio e, sem isso,
        // apagaria o identificador do registro (gerando chaves duplicadas na tela).
        mockParticipantes[i] = { ...mockParticipantes[i], ...p, id: mockParticipantes[i].id }
      } else {
        mockParticipantes.push({ ...p, id: p.id || `pt-${Date.now()}-${Math.random()}` })
      }
    }
    onProgresso?.(1)
    const registro: Importacao = {
      id: `imp-${Date.now()}`,
      arquivo,
      totalLinhas: participantes.length,
      criados,
      atualizados,
      ignorados: 0,
      erros: 0,
      status: 'concluida',
      criadoEm: new Date().toISOString(),
    }
    mockImportacoes.unshift(registro)
    return { criados, atualizados, erros: 0, importacaoId: registro.id }
  }

  // ----- Modo real: Supabase -----
  // 1) Cria o registro da importação (para vincular as linhas e auditar).
  const { data: usuarioAuth } = await supabase.auth.getUser()
  const { data: impCriada, error: erroImp } = await supabase
    .from('importacoes')
    .insert({
      arquivo,
      total_linhas: participantes.length,
      criados,
      atualizados,
      ignorados: 0,
      erros: 0,
      status: 'concluida' as StatusImportacao,
      autor_id: usuarioAuth?.user?.id ?? null,
    })
    .select('id')
    .single()
  if (erroImp) throw erroImp
  const importacaoId = impCriada?.id as string

  // 2) Envia os participantes em lotes.
  const LOTE = 200
  let enviados = 0
  try {
    for (let i = 0; i < participantes.length; i += LOTE) {
      const bloco = participantes
        .slice(i, i + LOTE)
        .map((p) => paraLinhaDoBanco(p, importacaoId))

      const { error } = await supabase
        .from('participantes')
        .upsert(bloco, { onConflict: 'cpf' })
      if (error) throw error

      enviados += bloco.length
      onProgresso?.(enviados / participantes.length)
    }
  } catch (e: any) {
    // Marca a importação como falha/parcial para o histórico ficar honesto.
    await supabase
      .from('importacoes')
      .update({
        status: (enviados > 0 ? 'parcial' : 'falhou') as StatusImportacao,
        criados: 0,
        atualizados: 0,
        erros: participantes.length - enviados,
        detalhes: { mensagem: String(e?.message ?? e) },
      })
      .eq('id', importacaoId)
    throw e
  }

  return { criados, atualizados, erros: 0, importacaoId }
}

// ============================================================
// Cadastro manual (perfil sem login — dados básicos)
// ============================================================

/**
 * Dados de um perfil manual criado direto na tela (sem planilha).
 *
 * O WhatsApp e o "papel pretendido" (Pesquisador/Coordenador/Administrador)
 * não têm coluna própria na tabela de participantes, então ficam guardados em
 * `dados_extras`. Na Parte 2 (perfil-sem-login) esse papel será aplicado à
 * conta quando a pessoa fizer login com o mesmo e-mail.
 */
export interface PerfilManual {
  nome: string
  email?: string
  cpf?: string
  curso?: string
  telefone?: string
  whatsapp?: string
  endereco?: string
  cep?: string
  papelPretendido?: string
  observacoes?: string
}

/** Monta o objeto de `dados_extras` preservando o que já existir. */
function extrasComPerfil(p: PerfilManual, base: Record<string, string> = {}) {
  const extras: Record<string, string> = { ...base }
  if (p.whatsapp) extras.whatsapp = p.whatsapp
  else delete extras.whatsapp
  if (p.papelPretendido) extras.funcaoPretendida = p.papelPretendido
  else delete extras.funcaoPretendida
  return extras
}

/** Colunas do banco a partir de um perfil manual. */
function linhaManual(p: PerfilManual, base: Record<string, string> = {}) {
  return {
    nome: p.nome.trim(),
    cpf: p.cpf ? normalizarCPF(p.cpf) : null,
    curso: p.curso?.trim() || null,
    email: p.email?.trim() || null,
    telefone: p.telefone?.trim() || null,
    endereco: p.endereco?.trim() || null,
    cep: p.cep?.trim() || null,
    observacoes: p.observacoes?.trim() || null,
    dados_extras: extrasComPerfil(p, base),
  }
}

/** Cria um participante manualmente (perfil sem login). */
export async function criarPerfilManual(p: PerfilManual): Promise<void> {
  if (USE_MOCK || !supabase) {
    mockParticipantes.unshift({
      id: `pt-${Date.now()}`,
      nome: p.nome.trim(),
      cpf: p.cpf ? normalizarCPF(p.cpf) : undefined,
      curso: p.curso || undefined,
      email: p.email || undefined,
      telefone: p.telefone || undefined,
      endereco: p.endereco || undefined,
      cep: p.cep || undefined,
      status: 'ativo',
      dadosExtras: extrasComPerfil(p),
    })
    return
  }
  const { error } = await supabase.from('participantes').insert(linhaManual(p))
  if (error) throw error
}

/** Atualiza os dados básicos de um participante (perfil sem login). */
export async function atualizarPerfilManual(
  id: string,
  p: PerfilManual,
  extrasAtuais: Record<string, string> = {},
): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockParticipantes.findIndex((x) => x.id === id)
    if (i >= 0) {
      mockParticipantes[i] = {
        ...mockParticipantes[i],
        nome: p.nome.trim(),
        cpf: p.cpf ? normalizarCPF(p.cpf) : undefined,
        curso: p.curso || undefined,
        email: p.email || undefined,
        telefone: p.telefone || undefined,
        endereco: p.endereco || undefined,
        cep: p.cep || undefined,
        dadosExtras: extrasComPerfil(p, extrasAtuais),
      }
    }
    return
  }
  const { error } = await supabase
    .from('participantes')
    .update(linhaManual(p, extrasAtuais))
    .eq('id', id)
  if (error) throw error
}

/** Exclui um participante (usado na tela de listagem). */
export async function excluirParticipante(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    const i = mockParticipantes.findIndex((p) => p.id === id)
    if (i >= 0) mockParticipantes.splice(i, 1)
    return
  }
  const { error } = await supabase.from('participantes').delete().eq('id', id)
  if (error) throw error
}
