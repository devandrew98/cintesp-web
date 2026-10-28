import { describe, expect, it } from 'vitest'
import {
  acharChaveNoTexto,
  chaveNfeValida,
  digitoVerificadorChave,
  extrairDadosDeTexto,
  extrairDadosDeXml,
  validarArquivoNota,
} from '@/lib/notaFiscalArquivo'

// Chave de teste: UF 35, 07/2020, CNPJ 14.200.166/0001-66, modelo 55, série 001, nº 7 + DV.
const BASE = '35' + '2007' + '14200166000166' + '55' + '001' + '000000007' + '1' + '00000000'
const CHAVE = BASE + digitoVerificadorChave(BASE)
const BLOCOS = CHAVE.replace(/(\d{4})(?=\d)/g, '$1 ')

describe('chave de acesso', () => {
  it('valida dígito verificador, mês e CNPJ do emitente', () => {
    expect(chaveNfeValida(CHAVE)).toBe(true)
    expect(chaveNfeValida(CHAVE.slice(0, 43) + String((Number(CHAVE[43]) + 1) % 10))).toBe(false)
    expect(chaveNfeValida(CHAVE.slice(0, 43))).toBe(false)
  })
  it('acha a chave no texto, em blocos de 4 dígitos e só se for válida', () => {
    expect(acharChaveNoTexto(`CHAVE DE ACESSO ${BLOCOS} Consulta`)).toBe(CHAVE)
    expect(acharChaveNoTexto('1234 5678 1234 5678 1234 5678 1234 5678 1234 5678 1234')).toBeNull()
  })
})

describe('XML da NF-e', () => {
  const xml = `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${CHAVE}" versao="4.00">
    <ide><cUF>35</cUF><nNF>000123</nNF><serie>1</serie><dhEmi>2020-07-15T22:50:00-03:00</dhEmi></ide>
    <emit><CNPJ>14200166000166</CNPJ><xNome>ACME Informática &amp; Cia Ltda</xNome></emit>
    <dest><CNPJ>99887766000155</CNPJ><xNome>Fundação Exemplo</xNome></dest></infNFe></NFe></nfeProc>`

  it('lê número, emissão, emitente e CNPJ exatamente do arquivo', () => {
    expect(extrairDadosDeXml(xml)).toEqual({
      origem: 'xml',
      chave: CHAVE,
      numero: '123',
      emissao: '2020-07-15', // não vira dia 16 por fuso
      fornecedor: 'ACME Informática & Cia Ltda',
      cnpj: '14200166000166',
      destinatario: 'Fundação Exemplo',
    })
  })
  it('devolve null para XML que não é NF-e', () => {
    expect(extrairDadosDeXml('<root><a>1</a></root>')).toBeNull()
  })
})

describe('texto de um DANFE (PDF)', () => {
  const danfe = `RECEBEMOS DE  ACME INFORMATICA LTDA  OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO.
    DANFE Documento Auxiliar da Nota Fiscal Eletrônica Nº 000.000.007 SÉRIE 1
    CHAVE DE ACESSO ${BLOCOS}
    NATUREZA DA OPERAÇÃO VENDA
    DATA DE EMISSÃO 15/07/2020 DATA DE SAÍDA 16/07/2020`

  it('usa a chave (número, CNPJ) e o texto (fornecedor, data de emissão)', () => {
    expect(extrairDadosDeTexto(danfe)).toEqual({
      origem: 'pdf',
      chave: CHAVE,
      numero: '7',
      emissao: '2020-07-15', // a data DEPOIS do rótulo "DATA DE EMISSÃO", não a de saída
      fornecedor: 'ACME INFORMATICA LTDA',
      cnpj: '14200166000166',
    })
  })

  it('sem o rótulo, usa a data que bate com o mês/ano da chave', () => {
    const t = `${BLOCOS} vencimento 20/08/2020 compra 03/07/2020 pedido 01/01/2019`
    expect(extrairDadosDeTexto(t)?.emissao).toBe('2020-07-03')
  })

  it('devolve null quando não há nada reconhecível (ex.: PDF escaneado, sem texto)', () => {
    expect(extrairDadosDeTexto('')).toBeNull()
    expect(extrairDadosDeTexto('Orçamento nº 55 — notebook')).toBeNull()
  })

  it('o que não achar fica de fora, sem chutar', () => {
    const so = extrairDadosDeTexto(`CHAVE ${BLOCOS}`)!
    expect(so.fornecedor).toBeUndefined()
    expect(so.emissao).toBeUndefined()
    expect(so.numero).toBe('7')
  })
})

describe('validarArquivoNota', () => {
  it('aceita PDF, XML e imagens até 10 MB', () => {
    expect(validarArquivoNota({ name: 'nf.pdf', type: 'application/pdf', size: 1000 })).toBeNull()
    expect(validarArquivoNota({ name: 'nf.xml', type: 'text/xml', size: 1000 })).toBeNull()
    expect(validarArquivoNota({ name: 'nf.xml', type: '', size: 1000 })).toBeNull() // navegador sem tipo
    expect(validarArquivoNota({ name: 'nf.png', type: 'image/png', size: 1000 })).toBeNull()
  })
  it('recusa outros formatos e arquivos grandes', () => {
    expect(validarArquivoNota({ name: 'nf.docx', type: 'application/msword', size: 10 })).toMatch(/PDF, XML/)
    expect(validarArquivoNota({ name: 'nf.exe', type: '', size: 10 })).not.toBeNull()
    expect(validarArquivoNota({ name: 'nf.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 })).toMatch(/10 MB/)
  })
})
