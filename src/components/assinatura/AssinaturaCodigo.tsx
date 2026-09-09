/** Mostra o código-fonte HTML gerado (somente leitura). */
export function AssinaturaCodigo({ html }: { html: string }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-200">
      <code>{html}</code>
    </pre>
  )
}
