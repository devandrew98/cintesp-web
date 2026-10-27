import { beforeAll, describe, expect, it, vi } from 'vitest'

// Persistência de imagens, em modo mock (sem banco): o que se grava continua disponível nas leituras seguintes.
vi.mock('@/lib/supabase', () => ({ supabase: null, USE_MOCK: true }))
vi.mock('@/lib/imagem', () => ({ reduzirImagem: async (f: File) => f })) // sem canvas no Node

const arquivo = (nome = 'foto.jpg', tipo = 'image/jpeg', tamanho = 1000) =>
  new File([new Uint8Array(tamanho)], nome, { type: tipo })

type Dados = typeof import('@/data/inventario')
let d: Dados

beforeAll(async () => {
  d = await import('@/data/inventario')
})

describe('inventário — dados e fotos (mock)', () => {
  it('cadastra parcialmente, atualiza sem duplicar e mantém os dados nas leituras seguintes', async () => {
    const id = await d.criarItemInventario({ nome: 'Osciloscópio', statusVistoria: 'pendente' })
    await d.atualizarItemInventario(id, {
      nome: 'Osciloscópio',
      statusVistoria: 'localizado',
      numeroNotaFiscal: '777',
      cnpj: '11.222.333/0001-81',
    })
    const lista = (await d.listarInventario()).filter((i) => i.nome === 'Osciloscópio')
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ numeroNotaFiscal: '777', cnpj: '11222333000181', statusVistoria: 'localizado' })
  })

  it('recusa nome vazio e CNPJ inválido', async () => {
    await expect(d.criarItemInventario({ nome: '  ', statusVistoria: 'pendente' })).rejects.toThrow(/nome/i)
    await expect(d.criarItemInventario({ nome: 'X', cnpj: '11222333000180', statusVistoria: 'pendente' })).rejects.toThrow(/CNPJ/)
  })

  it('foto: a primeira vira principal, dá para trocar a principal e remover sem deixar órfã', async () => {
    const id = await d.criarItemInventario({ nome: 'Fonte de bancada', statusVistoria: 'pendente' })
    const f1 = await d.adicionarFoto(id, arquivo('a.jpg'), false)
    const f2 = await d.adicionarFoto(id, arquivo('b.png', 'image/png'), false)
    expect([f1.principal, f2.principal]).toEqual([true, false])

    // As fotos continuam disponíveis em leituras novas (persistem além do formulário)…
    let item = (await d.listarInventario()).find((i) => i.id === id)!
    expect(item.fotos).toHaveLength(2)
    const urls = await d.urlsDasFotos(item.fotos.map((f) => f.caminho))
    expect(urls.size).toBe(2)
    expect(f1.caminho).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}\\.jpg$`))

    await d.definirFotoPrincipal(id, f2.id)
    item = (await d.listarInventario()).find((i) => i.id === id)!
    expect(item.fotos.filter((f) => f.principal).map((f) => f.id)).toEqual([f2.id])

    // Remover a principal promove a outra; o arquivo some junto (sem órfã).
    await d.removerFoto(id, { ...f2, principal: true }, item.fotos.filter((f) => f.id !== f2.id))
    item = (await d.listarInventario()).find((i) => i.id === id)!
    expect(item.fotos.map((f) => [f.id, f.principal])).toEqual([[f1.id, true]])
    expect((await d.urlsDasFotos([f2.caminho])).size).toBe(0)
  })

  it('substituir a foto troca a principal e apaga a antiga', async () => {
    const id = await d.criarItemInventario({ nome: 'Multímetro', statusVistoria: 'pendente' })
    const antiga = await d.adicionarFoto(id, arquivo('velha.jpg'), false)
    const item = (await d.listarInventario()).find((i) => i.id === id)!
    await d.substituirFotoPrincipal(item, arquivo('nova.jpg'))
    const depois = (await d.listarInventario()).find((i) => i.id === id)!
    expect(depois.fotos).toHaveLength(1)
    expect(depois.fotos[0].id).not.toBe(antiga.id)
    expect(depois.fotos[0].principal).toBe(true)
    expect((await d.urlsDasFotos([antiga.caminho])).size).toBe(0)
  })

  it('recusa arquivo que não é imagem permitida e imagem enorme', async () => {
    const id = await d.criarItemInventario({ nome: 'Impressora 3D', statusVistoria: 'pendente' })
    await expect(d.adicionarFoto(id, arquivo('x.pdf', 'application/pdf'), false)).rejects.toThrow(/JPG, PNG ou WebP/)
    await expect(d.adicionarFoto(id, arquivo('x.jpg', 'image/jpeg', 31 * 1024 * 1024), false)).rejects.toThrow(/30 MB/)
  })

  it('excluir o item remove também as fotos', async () => {
    const id = await d.criarItemInventario({ nome: 'Roteador', statusVistoria: 'pendente' })
    const f = await d.adicionarFoto(id, arquivo(), false)
    await d.excluirItemInventario(id, [f])
    expect((await d.listarInventario()).some((i) => i.id === id)).toBe(false)
    expect((await d.urlsDasFotos([f.caminho])).size).toBe(0)
  })
})
