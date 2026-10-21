import { montarPdfConsignado } from '@/lib/consignadoPdf'
import { carimbarAssinatura, codigoDoDocumento, gerarImagemAssinatura } from '@/lib/assinaturaPdf'
import { criarDocumentoParaAssinar } from '@/data/assinaturas'
import type { DadosAssinatura } from '@/lib/assinaturaEmail'
import type { NovoConsignado } from '@/data/consignados'

/**
 * Atalho do "Novo empréstimo": gera o termo (PDF timbrado, com os dados do
 * empréstimo), aplica a assinatura do emprestante e manda para o pesquisador
 * assinar — tudo sem o administrador precisar subir arquivo nem posicionar nada.
 */
export async function enviarTermoParaAssinatura(dados: {
  protocolo: string
  emprestimo: NovoConsignado
  assinaturaAdmin: DadosAssinatura
  adminId: string
  adminNome: string
}): Promise<void> {
  const { emprestimo: e, protocolo } = dados
  if (!e.pesquisadorId) throw new Error('Selecione o pesquisador para enviar o termo.')

  const protocoloNo = protocolo.slice(0, 8).toUpperCase()
  const { doc, posicoes } = await montarPdfConsignado({
    protocoloNo,
    itens: e.itens.map((it) => ({ numero: it.itemNumero, nome: it.itemNome })),
    pesquisadorNome: e.pesquisadorNome,
    pesquisadorCpf: e.pesquisadorCpf,
    pesquisadorArea: e.pesquisadorArea,
    local: e.local,
    dataRetirada: e.dataRetirada,
    dataEntregaPrevista: e.dataEntregaPrevista,
    observacoes: e.observacoes,
    entreguePor: dados.adminNome,
    recebidoPor: e.pesquisadorNome ?? '',
    assinaturaDigital: true,
  })
  const pdfBase = new Uint8Array(doc.output('arraybuffer'))

  const id = crypto.randomUUID()
  const imagem = await gerarImagemAssinatura(dados.assinaturaAdmin, 'Emprestante', new Date(), codigoDoDocumento(id))
  const pdfComAdmin = await carimbarAssinatura(pdfBase, imagem, { pagina: posicoes.pagina, base: true, ...posicoes.emprestante })

  const resumoItens = e.itens.length > 1 ? `${e.itens.length} itens` : (e.itens[0]?.itemNome ?? 'item')
  await criarDocumentoParaAssinar({
    id,
    titulo: `Termo de empréstimo ${protocoloNo} — ${resumoItens}`,
    pesquisadorId: e.pesquisadorId,
    protocolo,
    posicaoPesquisador: { pagina: posicoes.pagina, base: true, ...posicoes.pesquisador },
    pdfComAdmin,
    criadoPor: dados.adminId,
  })
}
