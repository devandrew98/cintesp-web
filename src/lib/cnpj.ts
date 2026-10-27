/**
 * Utilitários de CNPJ (mesma ideia de `cpf.ts`). A mesma regra de validação
 * existe no banco (`public.cnpj_valido`) — o front só adianta o aviso.
 */

/** Só os dígitos: "12.345.678/0001-95" → "12345678000195". */
export function normalizarCNPJ(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).replace(/\D/g, '')
}

/** Valida pelos dígitos verificadores. Rejeita tamanho errado e sequências repetidas. */
export function cnpjValido(valor: unknown): boolean {
  const cnpj = normalizarCNPJ(valor)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false

  const digito = (base: string, pesos: number[]): number => {
    const soma = base.split('').reduce((acc, n, i) => acc + Number(n) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const d1 = digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (d1 !== Number(cnpj[12])) return false
  const d2 = digito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d2 === Number(cnpj[13])
}

/**
 * Máscara progressiva para digitar: "12345678000195" → "12.345.678/0001-95".
 * Aceita parcial ("12.34") para não atrapalhar quem está digitando.
 */
export function mascararCNPJ(valor: unknown): string {
  const d = normalizarCNPJ(valor).slice(0, 14)
  let s = d.slice(0, 2)
  if (d.length > 2) s += '.' + d.slice(2, 5)
  if (d.length > 5) s += '.' + d.slice(5, 8)
  if (d.length > 8) s += '/' + d.slice(8, 12)
  if (d.length > 12) s += '-' + d.slice(12, 14)
  return s
}
