/** Link da busca de imagens do Google para reconhecer o produto pelo nome (sem API, só abre a pesquisa). */
export function linkBuscaProduto(nome: string): string {
  const q = nome.replace(/\s+/g, ' ').trim()
  return `https://www.google.com/search?udm=2&q=${encodeURIComponent(q)}`
}
