import { normalizarTexto } from '@/lib/planilha'
import { CATEGORIAS_ITEM } from '@/lib/consignados'
import type { DadosItem, StatusItem } from '@/data/consignados'

/** Campos de um item que a planilha pode preencher. */
export type CampoItem =
  | 'numeroPatrimonio'
  | 'nome'
  | 'categoria'
  | 'localPadrao'
  | 'status'
  | 'descricao'
  | 'observacoes'

export const rotuloCampoItem: Record<CampoItem, string> = {
  numeroPatrimonio: 'Nº do patrimônio',
  nome: 'Nome do item',
  categoria: 'Categoria',
  localPadrao: 'Local (estoque padrão)',
  status: 'Situação',
  descricao: 'Descrição',
  observacoes: 'Observações',
}

export const camposObrigatoriosItem: CampoItem[] = ['numeroPatrimonio', 'nome']

/** Nomes de coluna aceitos (já normalizados: sem acento, minúsculos), do mais ao menos específico. */
const SINONIMOS: Record<CampoItem, string[]> = {
  numeroPatrimonio: [
    'numero do patrimonio',
    'n do patrimonio',
    'patrimonio',
    'n patrimonio',
    'tombo',
    'tombamento',
    'plaqueta',
    'codigo',
    'numero',
    'n',
  ],
  nome: ['nome do item', 'nome', 'item', 'equipamento', 'produto', 'bem', 'material'],
  categoria: ['categoria', 'tipo', 'classe', 'grupo'],
  localPadrao: ['local', 'localizacao', 'local padrao', 'estoque', 'sala', 'armario'],
  status: ['situacao', 'status', 'estado'],
  descricao: ['descricao', 'detalhes', 'marca/modelo', 'marca', 'modelo'],
  observacoes: ['observacoes', 'observacao', 'obs', 'anotacoes'],
}

/** Sugere qual coluna da planilha alimenta cada campo (o usuário pode trocar depois). */
export function mapearColunasItem(colunas: string[]): Record<CampoItem, string> {
  const usadas = new Set<string>()
  const resultado = {} as Record<CampoItem, string>
  const norm = colunas.map((c) => ({ original: c, n: normalizarTexto(c).replace(/[º°.]/g, '') }))

  for (const campo of Object.keys(SINONIMOS) as CampoItem[]) {
    let achada = ''
    for (const sin of SINONIMOS[campo]) {
      const exata = norm.find((c) => !usadas.has(c.original) && c.n === sin)
      if (exata) {
        achada = exata.original
        break
      }
    }
    if (!achada) {
      for (const sin of SINONIMOS[campo]) {
        if (sin.length < 4) continue
        const parcial = norm.find((c) => !usadas.has(c.original) && c.n.includes(sin))
        if (parcial) {
          achada = parcial.original
          break
        }
      }
    }
    if (achada) usadas.add(achada)
    resultado[campo] = achada
  }

  // Planilha sem coluna de nome: a "descrição" costuma ser o nome do item.
  if (!resultado.nome && resultado.descricao) {
    resultado.nome = resultado.descricao
    resultado.descricao = ''
  }
  return resultado
}

function statusDeTexto(v: string): StatusItem {
  const t = normalizarTexto(v)
  if (t.startsWith('manut')) return 'manutencao'
  if (t.startsWith('baix') || t.startsWith('inserv') || t.startsWith('descart')) return 'baixado'
  return 'disponivel'
}

function categoriaDeTexto(v: string): string | undefined {
  const t = normalizarTexto(v)
  if (!t) return undefined
  return CATEGORIAS_ITEM.find((c) => normalizarTexto(c) === t) ?? 'Outro'
}

export interface LinhaItemImportacao {
  /** Nº da linha na planilha original. */
  linha: number
  dados: DadosItem
  /** Motivo de a linha NÃO ser importada (ausente = vai ser importada). */
  erro?: string
}

/** Converte as linhas lidas em itens, marcando as que não podem ser importadas. */
export function montarItens(
  linhas: Array<Record<string, string>>,
  numerosLinha: number[],
  mapa: Record<CampoItem, string>,
  numerosExistentes: Set<string>,
): LinhaItemImportacao[] {
  const vistos = new Set<string>()
  const pega = (l: Record<string, string>, campo: CampoItem) =>
    mapa[campo] ? (l[mapa[campo]] ?? '').trim() : ''

  return linhas.map((l, i) => {
    const numero = pega(l, 'numeroPatrimonio')
    const nome = pega(l, 'nome')
    const dados: DadosItem = {
      numeroPatrimonio: numero,
      nome,
      categoria: categoriaDeTexto(pega(l, 'categoria')),
      localPadrao: pega(l, 'localPadrao') || undefined,
      status: statusDeTexto(pega(l, 'status')),
      descricao: pega(l, 'descricao') || undefined,
      observacoes: pega(l, 'observacoes') || undefined,
    }

    let erro: string | undefined
    const chave = numero.toLowerCase()
    if (!numero) erro = 'Sem nº de patrimônio'
    else if (!nome) erro = 'Sem nome do item'
    else if (numerosExistentes.has(chave)) erro = 'Já cadastrado'
    else if (vistos.has(chave)) erro = 'Repetido na planilha'
    if (!erro) vistos.add(chave)

    return { linha: numerosLinha[i], dados, erro }
  })
}

/** Gera um .csv de exemplo para o usuário preencher. */
export function baixarModeloItens() {
  const csv =
    'Nº do patrimônio;Nome do item;Categoria;Situação;Local;Descrição;Observações\n' +
    '000123;Notebook Dell;Notebook;Disponível;Sala CINTESP - armário 2;Latitude 5420, S/N ABC123;Acompanha carregador\n'
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo-patrimonio.csv'
  a.click()
  URL.revokeObjectURL(url)
}
