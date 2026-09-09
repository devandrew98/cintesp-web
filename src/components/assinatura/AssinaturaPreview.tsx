/** Pré-visualização — renderiza o HTML real da assinatura (o que você vê é o que vai ser copiado). */
export function AssinaturaPreview({ html }: { html: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
