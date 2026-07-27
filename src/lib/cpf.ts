/**
 * Utilitários de CPF.
 *
 * O CPF é a CHAVE de deduplicação da importação de planilhas: é por ele que
 * o sistema decide se uma linha cria um participante novo ou atualiza um
 * existente. Por isso ele é normalizado (só dígitos) e validado de verdade
 * (dígitos verificadores), evitando lixo entrar no banco.
 */

/** Remove tudo que não for dígito: "123.456.789-09" → "12345678909". */
export function normalizarCPF(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).replace(/\D/g, '')
}

/**
 * Valida um CPF pelos dígitos verificadores (algoritmo oficial).
 * Retorna false para tamanho errado ou sequências repetidas (111.111.111-11).
 */
export function cpfValido(valor: unknown): boolean {
  const cpf = normalizarCPF(valor)

  // Precisa ter 11 dígitos e não pode ser todos iguais.
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  // Calcula um dígito verificador a partir dos N primeiros dígitos.
  const calcularDigito = (base: string, pesoInicial: number): number => {
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  const digito1 = calcularDigito(cpf.slice(0, 9), 10)
  if (digito1 !== Number(cpf[9])) return false

  const digito2 = calcularDigito(cpf.slice(0, 10), 11)
  return digito2 === Number(cpf[10])
}

/**
 * Formata para exibição: "12345678909" → "123.456.789-09".
 * Se não tiver 11 dígitos, devolve o valor como veio (não inventa formato).
 */
export function formatarCPF(valor: unknown): string {
  const cpf = normalizarCPF(valor)
  if (cpf.length !== 11) return String(valor ?? '')
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

/**
 * Mascara o CPF para exibição em listas (LGPD — evita expor o número inteiro
 * em tela para quem só precisa identificar a pessoa): "123.***.**9-09".
 */
export function mascararCPF(valor: unknown): string {
  const cpf = normalizarCPF(valor)
  if (cpf.length !== 11) return String(valor ?? '')
  return `${cpf.slice(0, 3)}.***.**${cpf.slice(8, 9)}-${cpf.slice(9)}`
}
