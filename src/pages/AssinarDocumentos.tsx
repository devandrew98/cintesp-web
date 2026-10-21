import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileSignature, Loader2, PenLine, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { AssinaturaPreview } from '@/components/assinatura/AssinaturaPreview'
import { AssinarDocumentoModal } from '@/components/assinaturas/AssinarDocumentoModal'
import { MinhaAssinaturaModal } from '@/components/assinaturas/MinhaAssinaturaModal'
import { useMinhaAssinatura } from '@/components/assinaturas/useMinhaAssinatura'
import { baixarPdfDocumento, listarDocumentosAssinatura, type DocumentoAssinatura } from '@/data/assinaturas'
import { gerarHtmlAssinatura } from '@/lib/assinaturaEmail'
import { baixarArquivo } from '@/lib/assinaturaPdf'
import { usePermissoes } from '@/hooks/usePermissoes'
import { mensagemErro } from '@/lib/utils'

/**
 * "Assinar documentos" — o pesquisador vê SÓ os documentos criados para ele
 * (RLS no banco), assina e baixa o PDF final. Também edita aqui a assinatura
 * que vai nos documentos.
 */
export function AssinarDocumentosPage() {
  const { perfil } = usePermissoes()
  const { data: minhaAssinatura = null, isLoading: carregandoAss } = useMinhaAssinatura(perfil?.id)
  const [editando, setEditando] = useState(false)
  const [assinando, setAssinando] = useState<DocumentoAssinatura | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['assinatura-documentos'],
    queryFn: listarDocumentosAssinatura,
  })
  // Admin enxerga todos na tabela de Consignados; aqui só os que são PARA a própria pessoa.
  const meus = documentos.filter((d) => d.pesquisadorId === perfil?.id)
  const pendentes = meus.filter((d) => d.status === 'aguardando')
  const assinados = meus.filter((d) => d.status === 'assinado')

  async function baixar(d: DocumentoAssinatura) {
    setErro(null)
    try {
      const bytes = await baixarPdfDocumento(d.id, 'final')
      baixarArquivo(bytes, `${d.titulo} (assinado).pdf`)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <div>
      <PageHeader
        title="Assinar documentos"
        subtitle="Termos de empréstimo e outros documentos que precisam da sua assinatura."
      />

      {/* Minha assinatura */}
      <div className="card mb-6 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <PenLine className="h-4 w-4 text-slate-400" /> Minha assinatura
          </h2>
          <Button variant="secondary" icon={PenLine} onClick={() => setEditando(true)} disabled={!perfil}>
            {minhaAssinatura ? 'Editar' : 'Criar assinatura'}
          </Button>
        </div>
        {carregandoAss ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        ) : minhaAssinatura ? (
          <AssinaturaPreview html={gerarHtmlAssinatura(minhaAssinatura)} />
        ) : (
          <p className="text-sm text-slate-400">
            Você ainda não criou a sua assinatura. Crie uma para poder assinar documentos.
          </p>
        )}
      </div>

      {erro && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{erro}</p>
      )}

      {/* Aguardando */}
      <div className="card mb-6 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <FileSignature className="h-4 w-4 text-amber-500" /> Aguardando minha assinatura
          {pendentes.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{pendentes.length}</span>
          )}
        </h2>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        ) : pendentes.length === 0 ? (
          <p className="text-sm text-slate-400">Nada pendente por aqui. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {pendentes.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{d.titulo}</p>
                  <p className="text-xs text-slate-400">Enviado em {new Date(d.criadoEm).toLocaleDateString('pt-BR')}</p>
                </div>
                <Button icon={PenLine} onClick={() => setAssinando(d)}>
                  Revisar e assinar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Assinados */}
      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Já assinados
        </h2>
        {assinados.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum documento assinado ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {assinados.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{d.titulo}</p>
                  <p className="text-xs text-slate-400">
                    Assinado em {d.assinadoEm ? new Date(d.assinadoEm).toLocaleString('pt-BR') : '—'}
                  </p>
                </div>
                <Button variant="secondary" icon={Download} onClick={() => baixar(d)}>
                  Baixar PDF
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {perfil && (
        <MinhaAssinaturaModal
          usuarioId={perfil.id}
          inicial={minhaAssinatura}
          nomePadrao={perfil.nome}
          emailPadrao={perfil.email}
          open={editando}
          onClose={() => setEditando(false)}
        />
      )}
      <AssinarDocumentoModal
        documento={assinando}
        minhaAssinatura={minhaAssinatura}
        onClose={() => setAssinando(null)}
        onEditarAssinatura={() => setEditando(true)}
      />
    </div>
  )
}
