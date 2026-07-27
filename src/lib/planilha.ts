/**
 * Leitura de planilhas (.xlsx, .xls, .csv) no NAVEGADOR.
 *
 * Todo o processamento acontece na máquina do usuário: o arquivo NÃO é enviado
 * para lugar nenhum. Só os dados já validados e confirmados vão para o banco.
 *
 * O leitor lida com planilhas do mundo real, que costumam ter:
 *   • linhas de título/logo antes do cabeçalho de verdade;
 *   • colunas vazias no meio;
 *   • datas como número de série do Excel.
 */

/** Resultado da leitura de um arquivo de planilha. */
export interface PlanilhaLida {
  /** Nomes das colunas encontradas no cabeçalho. */
  colunas: string[]
  /** Linhas de dados, já indexadas por nome de coluna. */
  linhas: Array<Record<string, string>>
  /**
   * Nº REAL de cada linha na planilha (mesma posição do array `linhas`).
   * Serve para o usuário localizar o problema no arquivo original.
   */
  numerosLinha: number[]
  /** Nome da aba usada. */
  aba: string
  /** Abas disponíveis no arquivo (para o usuário trocar, se quiser). */
  abas: string[]
  /** Em qual linha da planilha o cabeçalho foi detectado (1-based). */
  linhaCabecalho: number
}

/** Tira acentos, espaços extras e deixa minúsculo — para comparar nomes de coluna. */
export function normalizarTexto(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // remove acentos
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Converte o valor de uma célula em texto limpo. */
function celulaParaTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  // Datas viram ISO (yyyy-mm-dd) para facilitar o parse depois.
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10)
  }
  return String(valor).trim()
}

/**
 * Descobre qual linha é o cabeçalho.
 * Estratégia: percorre as primeiras linhas e escolhe a que tem MAIS células
 * preenchidas e distintas (um cabeçalho real tem vários rótulos únicos).
 * Isso resolve planilhas que começam com título/logo antes da tabela.
 */
function detectarLinhaCabecalho(matriz: unknown[][]): number {
  const limite = Math.min(matriz.length, 25) // olha só o começo do arquivo
  let melhorIndice = 0
  let melhorPontuacao = -1

  for (let i = 0; i < limite; i++) {
    const linha = matriz[i] ?? []
    const textos = linha.map(celulaParaTexto).filter((t) => t !== '')
    const distintos = new Set(textos.map(normalizarTexto))
    // Pontua: nº de rótulos únicos, penalizando linhas com valores numéricos
    // (cabeçalho costuma ser texto).
    const numericos = textos.filter((t) => /^-?[\d.,]+$/.test(t)).length
    const pontuacao = distintos.size - numericos

    if (pontuacao > melhorPontuacao) {
      melhorPontuacao = pontuacao
      melhorIndice = i
    }
  }
  return melhorIndice
}

/**
 * Lê o arquivo e devolve colunas + linhas.
 * @param file arquivo escolhido pelo usuário
 * @param nomeAba aba específica (se omitido, usa a primeira)
 */
export async function lerPlanilha(file: File, nomeAba?: string): Promise<PlanilhaLida> {
  // Import dinâmico: a biblioteca de planilhas (~700 kB) só é baixada quando o
  // usuário realmente vai importar um arquivo, mantendo o app leve para todos.
  const XLSX = await import('xlsx')

  const buffer = await file.arrayBuffer()
  // cellDates: converte datas do Excel em objetos Date de verdade.
  const wb = XLSX.read(buffer, { cellDates: true })

  const abas = wb.SheetNames
  if (abas.length === 0) throw new Error('A planilha não tem nenhuma aba.')

  const aba = nomeAba && abas.includes(nomeAba) ? nomeAba : abas[0]
  const ws = wb.Sheets[aba]

  // header: 1 → devolve matriz (array de arrays), preservando posição das colunas.
  // blankrows: true mantém as linhas vazias para que o número da linha informado
  // ao usuário bata EXATAMENTE com o que ele vê na planilha (linhas em branco
  // no topo são comuns). As linhas sem conteúdo são descartadas mais abaixo.
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: true,
  })

  if (matriz.length === 0) {
    return { colunas: [], linhas: [], numerosLinha: [], aba, abas, linhaCabecalho: 1 }
  }

  const indiceCabecalho = detectarLinhaCabecalho(matriz)
  const cabecalhoBruto = (matriz[indiceCabecalho] ?? []).map(celulaParaTexto)

  // Nomeia colunas sem título como "Coluna N" e garante nomes únicos.
  const usados = new Map<string, number>()
  const colunas = cabecalhoBruto.map((titulo, i) => {
    let nome = titulo || `Coluna ${i + 1}`
    const jaUsado = usados.get(nome) ?? 0
    usados.set(nome, jaUsado + 1)
    if (jaUsado > 0) nome = `${nome} (${jaUsado + 1})`
    return nome
  })

  // Converte as linhas seguintes em objetos {coluna: valor}, descartando vazias.
  const linhas: Array<Record<string, string>> = []
  const numerosLinha: number[] = []
  for (let i = indiceCabecalho + 1; i < matriz.length; i++) {
    const linha = matriz[i] ?? []
    const registro: Record<string, string> = {}
    let temAlgo = false

    colunas.forEach((coluna, c) => {
      const valor = celulaParaTexto(linha[c])
      registro[coluna] = valor
      if (valor !== '') temAlgo = true
    })

    if (temAlgo) {
      linhas.push(registro)
      numerosLinha.push(i + 1) // +1 → numeração de planilha (começa em 1)
    }
  }

  return { colunas, linhas, numerosLinha, aba, abas, linhaCabecalho: indiceCabecalho + 1 }
}

// ============================================================
// Mapeamento automático de colunas → campos do sistema
// ============================================================

/** Campos do participante que podem receber uma coluna da planilha. */
export type CampoParticipante =
  | 'nome'
  | 'cpf'
  | 'dataNascimento'
  | 'curso'
  | 'turma'
  | 'matricula'
  | 'email'
  | 'telefone'
  | 'endereco'
  | 'cep'
  | 'cidade'
  | 'estado'
  | 'observacoes'

/** Rótulo amigável de cada campo (usado na tela de mapeamento). */
export const rotuloCampo: Record<CampoParticipante, string> = {
  nome: 'Nome',
  cpf: 'CPF',
  dataNascimento: 'Data de nascimento',
  curso: 'Curso',
  turma: 'Turma',
  matricula: 'Matrícula',
  email: 'E-mail',
  telefone: 'Telefone / WhatsApp',
  endereco: 'Endereço',
  cep: 'CEP',
  cidade: 'Cidade',
  estado: 'Estado (UF)',
  observacoes: 'Observações',
}

/**
 * Apelidos aceitos para cada campo. Serve para adivinhar o mapeamento
 * automaticamente a partir do nome da coluna da planilha.
 */
const apelidos: Record<CampoParticipante, string[]> = {
  nome: ['nome', 'nome completo', 'aluno', 'participante', 'nome do aluno', 'nome do participante'],
  cpf: ['cpf', 'cpf do aluno', 'documento', 'n cpf', 'num cpf'],
  dataNascimento: [
    'data de nascimento',
    'data nascimento',
    'nascimento',
    'dt nascimento',
    'dt nasc',
    'data de nasc',
    'nasc',
    'aniversario',
  ],
  curso: ['curso', 'curso matriculado', 'nome do curso', 'graduacao', 'formacao'],
  turma: ['turma', 'classe', 'sala', 'grupo'],
  matricula: ['matricula', 'ra', 'registro academico', 'codigo', 'inscricao', 'n matricula'],
  email: ['email', 'e mail', 'e-mail', 'correio eletronico', 'endereco de e-mail'],
  telefone: [
    'telefone',
    'celular',
    'fone',
    'contato',
    'whatsapp',
    'tel',
    // nome usado no formulário do CINTESP
    'whatsapp para contato (com ddd)',
  ],
  endereco: ['endereco', 'endereco completo', 'logradouro', 'rua', 'endereço completo'],
  cep: ['cep', 'codigo postal'],
  cidade: ['cidade', 'municipio', 'localidade'],
  estado: ['estado', 'uf', 'unidade federativa'],
  observacoes: ['observacao', 'observacoes', 'obs', 'anotacoes', 'comentarios'],
}

/**
 * Tenta casar cada campo do sistema com uma coluna da planilha.
 * Retorna um objeto { campo: nomeDaColuna | '' }.
 *
 * Casa primeiro por igualdade exata (normalizada) e depois por "contém",
 * garantindo que uma mesma coluna não seja usada em dois campos.
 */
export function mapearColunasAuto(
  colunas: string[],
): Record<CampoParticipante, string> {
  const mapa = {} as Record<CampoParticipante, string>
  const campos = Object.keys(apelidos) as CampoParticipante[]
  const jaUsadas = new Set<string>()

  const colunasNorm = colunas.map((c) => ({ original: c, norm: normalizarTexto(c) }))

  // 1ª passada: correspondência exata.
  for (const campo of campos) {
    const alvo = colunasNorm.find(
      (c) => !jaUsadas.has(c.original) && apelidos[campo].includes(c.norm),
    )
    mapa[campo] = alvo?.original ?? ''
    if (alvo) jaUsadas.add(alvo.original)
  }

  // 2ª passada: correspondência parcial, mas por PALAVRA INTEIRA.
  //
  // Cuidado importante: comparar por "contém" solto gera falsos positivos —
  // o apelido "ra" (de matrícula) casava dentro de "Situação Financei-RA".
  // A exigência de PALAVRA COMPLETA resolve isso, e o mínimo de 3 letras é uma
  // proteção extra (mantém "cpf"/"cep", que são essenciais, e barra "ra"/"uf",
  // que já são cobertos pela comparação exata da 1ª passada).
  const contemPalavra = (texto: string, alvo: string) =>
    new RegExp(`(^| )${alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(texto)

  for (const campo of campos) {
    if (mapa[campo]) continue
    const alvo = colunasNorm.find(
      (c) =>
        !jaUsadas.has(c.original) &&
        apelidos[campo].some((a) => a.length >= 3 && contemPalavra(c.norm, a)),
    )
    if (alvo) {
      mapa[campo] = alvo.original
      jaUsadas.add(alvo.original)
    }
  }

  return mapa
}

/**
 * Converte uma data escrita de vários jeitos para ISO (yyyy-mm-dd).
 * Aceita: "2000-05-20", "20/05/2000", "20-05-2000" e número de série do Excel.
 * Retorna '' se não conseguir entender (a linha será marcada com aviso).
 */
export function parseData(valor: string): string {
  const v = (valor ?? '').trim()
  if (!v) return ''

  // Já está em ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v

  // dd/mm/aaaa ou dd-mm-aaaa (formato brasileiro).
  const br = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (br) {
    const dia = br[1].padStart(2, '0')
    const mes = br[2].padStart(2, '0')
    let ano = br[3]
    if (ano.length === 2) ano = Number(ano) > 30 ? `19${ano}` : `20${ano}`
    const iso = `${ano}-${mes}-${dia}`
    return dataEhValida(iso) ? iso : ''
  }

  // Número de série do Excel (dias desde 30/12/1899).
  if (/^\d+(\.\d+)?$/.test(v)) {
    const serie = Number(v)
    if (serie > 0 && serie < 200000) {
      const base = Date.UTC(1899, 11, 30)
      const d = new Date(base + serie * 86400000)
      return d.toISOString().slice(0, 10)
    }
  }

  return ''
}

/** Confere se uma data ISO existe de fato (evita 31/02, por exemplo). */
function dataEhValida(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`)
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}
