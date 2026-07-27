import { cpfValido, normalizarCPF } from './cpf'
import { parseData, type CampoParticipante } from './planilha'
import type { Participante } from '@/types'

/**
 * Validação das linhas da planilha ANTES de gravar no banco.
 *
 * Cada linha vira um "registro analisado" com:
 *   • os dados já convertidos para o formato do sistema;
 *   • a situação (ok / atenção / erro) e o motivo.
 *
 * Nada é enviado ao banco aqui — isso é só a análise que alimenta a tela de
 * conferência. A gravação só acontece depois que o usuário confirma.
 */

/**
 * Situação da linha:
 *   novo      → será criado
 *   atualizar → CPF já existe no banco, será atualizado
 *   erro      → não será importada (motivo explica)
 */
export type SituacaoLinha = 'novo' | 'atualizar' | 'duplicado' | 'erro'

export interface LinhaAnalisada {
  /** Nº da linha na planilha (para o usuário achar o problema no arquivo). */
  numero: number
  participante: Participante
  situacao: SituacaoLinha
  /** Explicação do erro (quando a linha for bloqueada). */
  motivo?: string
  /**
   * Alerta que NÃO impede a importação (ex.: data ilegível).
   * Fica separado da `situacao` para não mascarar "novo"/"atualizar".
   */
  aviso?: string
  /** Se a linha será enviada ao banco. */
  importar: boolean
}

/** Contagens para os cartões de resumo da conferência. */
export interface ResumoAnalise {
  total: number
  novos: number
  atualizar: number
  /** Linhas repetidas na planilha (venceu a mais recente). */
  duplicados: number
  avisos: number
  erros: number
}

/**
 * Analisa as linhas lidas da planilha aplicando o mapeamento escolhido.
 *
 * @param linhas linhas cruas (indexadas por nome de coluna)
 * @param mapa   de campo do sistema → nome da coluna na planilha
 * @param colunas todas as colunas do arquivo (para guardar as não mapeadas)
 * @param cpfsNoBanco CPFs que já existem (define "novo" x "atualizar")
 */
export function analisarLinhas(
  linhas: Array<Record<string, string>>,
  mapa: Record<CampoParticipante, string>,
  colunas: string[],
  cpfsNoBanco: Set<string>,
  /** Nº real de cada linha na planilha (para o usuário localizar no arquivo). */
  numerosLinha: number[] = [],
): LinhaAnalisada[] {
  // Colunas que o usuário NÃO mapeou: viram "dados extras" (nada se perde).
  const mapeadas = new Set(Object.values(mapa).filter(Boolean))
  const extras = colunas.filter((c) => !mapeadas.has(c))

  // ---------- CPFs repetidos DENTRO do próprio arquivo ----------
  // Em respostas de formulário é comum a pessoa responder duas vezes. Nesse
  // caso vale a resposta MAIS RECENTE (a última linha), e as anteriores são
  // marcadas como "duplicado" — não são erro, só foram substituídas.
  const ultimaLinhaDoCpf = new Map<string, number>()
  linhas.forEach((linha, i) => {
    const coluna = mapa.cpf
    const cpf = coluna ? normalizarCPF(linha[coluna]) : ''
    if (cpf) ultimaLinhaDoCpf.set(cpf, i)
  })

  return linhas.map((linha, indice) => {
    /** Lê o valor de um campo conforme o mapeamento. */
    const valor = (campo: CampoParticipante): string => {
      const coluna = mapa[campo]
      return coluna ? (linha[coluna] ?? '').trim() : ''
    }

    const nome = valor('nome')
    const cpfBruto = valor('cpf')
    const cpf = normalizarCPF(cpfBruto)
    const nascimentoBruto = valor('dataNascimento')
    const nascimento = parseData(nascimentoBruto)

    // Monta os "dados extras" com as colunas não mapeadas que têm conteúdo.
    const dadosExtras: Record<string, string> = {}
    for (const c of extras) {
      const v = (linha[c] ?? '').trim()
      if (v) dadosExtras[c] = v
    }

    const participante: Participante = {
      id: '',
      nome,
      cpf: cpf || undefined,
      dataNascimento: nascimento || undefined,
      curso: valor('curso') || undefined,
      turma: valor('turma') || undefined,
      matricula: valor('matricula') || undefined,
      email: valor('email') || undefined,
      telefone: valor('telefone') || undefined,
      endereco: valor('endereco') || undefined,
      cep: valor('cep') || undefined,
      cidade: valor('cidade') || undefined,
      estado: valor('estado').toUpperCase().slice(0, 2) || undefined,
      status: 'ativo',
      observacoes: valor('observacoes') || undefined,
      dadosExtras,
    }

    // ---------- Regras de validação (da mais grave para a mais leve) ----------
    let situacao: SituacaoLinha = 'novo'
    let motivo: string | undefined
    let importar = true

    if (!nome) {
      situacao = 'erro'
      motivo = 'Sem nome — o nome é obrigatório.'
      importar = false
    } else if (!cpfBruto) {
      situacao = 'erro'
      motivo = 'Sem CPF — não dá para identificar nem evitar duplicata.'
      importar = false
    } else if (!cpfValido(cpf)) {
      situacao = 'erro'
      motivo = `CPF inválido ("${cpfBruto}").`
      importar = false
    } else if (ultimaLinhaDoCpf.get(cpf) !== indice) {
      // Existe uma linha MAIS ABAIXO com o mesmo CPF: aquela é a que vale.
      const linhaQueVale = numerosLinha[ultimaLinhaDoCpf.get(cpf) as number]
      situacao = 'duplicado'
      motivo = `CPF repetido na planilha — vale a resposta mais recente${
        linhaQueVale ? ` (linha ${linhaQueVale})` : ''
      }.`
      importar = false
    } else if (cpfsNoBanco.has(cpf)) {
      // Já existe no banco → será atualizado.
      situacao = 'atualizar'
      motivo = 'Já cadastrado — os dados serão atualizados.'
    }

    // Aviso: a linha ENTRA normalmente, mas com alguma informação perdida.
    // Fica separado de `situacao` para não apagar "novo"/"atualizar".
    let aviso: string | undefined
    if (importar && nascimentoBruto && !nascimento) {
      aviso = `Data de nascimento não reconhecida ("${nascimentoBruto}") — ficará em branco.`
    }

    return {
      numero: numerosLinha[indice] ?? indice + 1,
      participante,
      situacao,
      motivo,
      aviso,
      importar,
    }
  })
}

/** Consolida as contagens para os cartões de resumo. */
export function resumir(analisadas: LinhaAnalisada[]): ResumoAnalise {
  return {
    total: analisadas.length,
    novos: analisadas.filter((l) => l.importar && l.situacao === 'novo').length,
    atualizar: analisadas.filter((l) => l.importar && l.situacao === 'atualizar').length,
    duplicados: analisadas.filter((l) => l.situacao === 'duplicado').length,
    avisos: analisadas.filter((l) => Boolean(l.aviso)).length,
    // "erro" = bloqueada por problema no dado (duplicado NÃO conta como erro).
    erros: analisadas.filter((l) => l.situacao === 'erro').length,
  }
}
