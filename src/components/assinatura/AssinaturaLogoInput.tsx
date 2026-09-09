import { useRef, useState } from 'react'
import { Upload, RotateCcw } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { blobParaDataUri, LOGO_PADRAO_CAMINHO, urlParaDataUri } from '@/lib/assinaturaEmail'
import { mensagemErro } from '@/lib/utils'

const TAMANHO_MAX_MB = 3

/**
 * Logo da assinatura: mostra uma prévia e deixa enviar uma imagem do
 * computador (fica embutida como base64 — nunca como link externo, que é
 * o que fazia a logo não aparecer ao colar no Outlook).
 */
export function AssinaturaLogoInput({
  logoUrl,
  onChange,
}: {
  logoUrl: string
  onChange: (dataUri: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function enviarArquivo(arquivo: File) {
    setErro(null)
    if (!arquivo.type.startsWith('image/')) {
      setErro('Selecione um arquivo de imagem (PNG, JPG ou SVG).')
      return
    }
    if (arquivo.size > TAMANHO_MAX_MB * 1024 * 1024) {
      setErro(`A imagem deve ter no máximo ${TAMANHO_MAX_MB} MB.`)
      return
    }
    setCarregando(true)
    try {
      const dataUri = await blobParaDataUri(arquivo)
      onChange(dataUri)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setCarregando(false)
    }
  }

  async function usarPadrao() {
    setErro(null)
    setCarregando(true)
    try {
      const dataUri = await urlParaDataUri(LOGO_PADRAO_CAMINHO)
      onChange(dataUri)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Field label="Logo" hint="Fica embutida na assinatura (não depende de nenhum site do ar pra aparecer).">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo atual" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400">sem logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={carregando}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Upload className="h-3.5 w-3.5" /> {carregando ? 'Carregando…' : 'Enviar logo'}
          </button>
          <button
            type="button"
            onClick={usarPadrao}
            disabled={carregando}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Usar padrão CINTESP.Br
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) enviarArquivo(f)
            if (inputRef.current) inputRef.current.value = ''
          }}
        />
      </div>
      {erro && <p className="mt-1 text-xs text-red-500">{erro}</p>}
    </Field>
  )
}
