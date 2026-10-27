import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { urlsDasFotos } from '@/data/inventario'
import { mascararCNPJ } from '@/lib/cnpj'
import { fotosFaltando, pendenciasOficio, quantidadeDe, STATUS_VISTORIA, fotoPrincipal, type ItemInventario } from '@/lib/inventario'
import { dataBR } from '@/lib/oficioTombamento'

/** Visualização somente-leitura de um item, com a galeria de fotos e atalhos. */
export function ItemInventarioDetalhe({
  item,
  onClose,
  onEditar,
  onOficio,
}: {
  item: ItemInventario | null
  onClose: () => void
  onEditar: (i: ItemInventario) => void
  onOficio: (i: ItemInventario) => void
}) {
  const [fotoId, setFotoId] = useState<string | null>(null)
  useEffect(() => setFotoId(null), [item?.id])

  const caminhos = item?.fotos.map((f) => f.caminho) ?? []
  const { data: urls } = useQuery({
    queryKey: ['inventario-urls', caminhos.join('|')],
    queryFn: () => urlsDasFotos(caminhos),
    enabled: caminhos.length > 0,
    staleTime: 30 * 60 * 1000,
  })

  if (!item) return null
  const atual = item.fotos.find((f) => f.id === fotoId) ?? fotoPrincipal(item)
  const falta = pendenciasOficio(item)
  const st = STATUS_VISTORIA[item.statusVistoria]

  const qtd = quantidadeDe(item)
  const faltamFotos = fotosFaltando(item)
  const linhas: [string, string | undefined][] = [
    ['Quantidade', qtd > 1 ? `${qtd} unidades (${item.fotos.length} foto${item.fotos.length === 1 ? '' : 's'})` : undefined],
    ['Nota fiscal nº', item.numeroNotaFiscal],
    ['Emissão da nota fiscal', item.dataEmissaoNf ? dataBR(item.dataEmissaoNf) : undefined],
    ['Data da compra', item.dataCompra ? dataBR(item.dataCompra) : undefined],
    ['Nº de série', item.numeroSerie],
    ['Empresa fornecedora', item.fornecedor],
    ['CNPJ', item.cnpj ? mascararCNPJ(item.cnpj) : undefined],
    ['Projeto (nº)', item.projetoNumero],
    ['Projeto cadastrado', item.projetoNome],
    ['Localização', item.localizacao],
    ['Observações', item.observacoes],
    ['Cadastrado em', new Date(item.criadoEm).toLocaleString('pt-BR')],
    ['Última atualização', new Date(item.atualizadoEm).toLocaleString('pt-BR')],
  ]

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={item.nome}
      subtitle={st.label}
      footer={
        <>
          <Button variant="secondary" icon={Pencil} onClick={() => onEditar(item)}>
            Editar
          </Button>
          <Button icon={FileText} onClick={() => onOficio(item)}>
            Gerar ofício
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {item.fotos.length > 0 && (
          <div>
            <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
              {atual && urls?.get(atual.caminho) && (
                <img src={urls.get(atual.caminho)} alt={item.nome} className="max-h-full max-w-full object-contain" />
              )}
            </div>
            {item.fotos.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.fotos.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFotoId(f.id)}
                    className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${
                      atual?.id === f.id ? 'border-brand-600' : 'border-transparent'
                    }`}
                  >
                    {urls?.get(f.caminho) && <img src={urls.get(f.caminho)} alt="" className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {linhas
            .filter(([, v]) => v)
            .map(([rotulo, valor]) => (
              <div key={rotulo} className={rotulo === 'Observações' ? 'sm:col-span-2' : undefined}>
                <dt className="text-xs text-slate-400">{rotulo}</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">{valor}</dd>
              </div>
            ))}
        </dl>

        {faltamFotos > 0 && qtd > 1 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Faltam {faltamFotos} foto{faltamFotos > 1 ? 's' : ''} (uma por unidade).
          </p>
        )}
        {falta.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Falta para o ofício: {falta.join(', ')}.
          </p>
        )}
      </div>
    </Modal>
  )
}
