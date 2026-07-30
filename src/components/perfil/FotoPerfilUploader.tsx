import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, Trash2, Info } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { enviarFotoPerfil, removerFotoPerfil } from '@/data/api'
import { mensagemErro } from '@/lib/utils'

/** Orientações para uma boa foto (pedidas pelo CINTESP). */
const ORIENTACOES = [
  'Fundo claro ou neutro',
  'Boa iluminação',
  'Rosto totalmente visível',
  'Foto individual, de frente e do peito para cima',
  'Evite locais públicos, filtros, óculos escuros ou o que dificulte a identificação',
]

const TAMANHO_MAX = 5 * 1024 * 1024 // 5 MB

/**
 * Foto de perfil com upload.
 * - `podeEditar` controla se aparecem os botões de trocar/remover
 *   (o próprio usuário na tela "Meu Horário", ou um admin editando alguém).
 * - Ao enviar, atualiza o cache para a foto aparecer na hora em todo o app.
 */
export function FotoPerfilUploader({
  usuarioId,
  nome,
  fotoUrl,
  podeEditar,
  onAtualizado,
}: {
  usuarioId: string
  nome: string
  fotoUrl?: string
  podeEditar: boolean
  onAtualizado?: (url: string | null) => void
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['perfil-atual'] })
    qc.invalidateQueries({ queryKey: ['perfil'] })
    qc.invalidateQueries({ queryKey: ['usuarios'] })
  }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = '' // permite reenviar o mesmo arquivo
    if (!arquivo) return

    setErro(null)
    if (!arquivo.type.startsWith('image/')) {
      setErro('Selecione um arquivo de imagem (JPG ou PNG).')
      return
    }
    if (arquivo.size > TAMANHO_MAX) {
      setErro('A imagem deve ter no máximo 5 MB.')
      return
    }

    setEnviando(true)
    try {
      const url = await enviarFotoPerfil(usuarioId, arquivo)
      invalidar()
      onAtualizado?.(url)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  async function remover() {
    setErro(null)
    setEnviando(true)
    try {
      await removerFotoPerfil(usuarioId)
      invalidar()
      onAtualizado?.(null)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      {/* Avatar + botão de câmera sobreposto */}
      <div className="relative w-fit">
        <Avatar nome={nome} fotoUrl={fotoUrl} size="lg" />
        {podeEditar && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            title="Trocar foto"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white shadow hover:bg-brand-700 disabled:opacity-60 dark:border-slate-900"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={aoEscolher}
        />
      </div>

      {podeEditar && (
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Camera className="h-4 w-4" />
              {fotoUrl ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {fotoUrl && (
              <button
                type="button"
                onClick={remover}
                disabled={enviando}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </button>
            )}
          </div>

          {erro && (
            <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">
              {erro}
            </p>
          )}

          {/* Orientações para a foto */}
          <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-800/50">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
              <Info className="h-3.5 w-3.5" /> Como deve ser a foto
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              {ORIENTACOES.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            <p className="mt-1 text-slate-400">JPG, PNG ou WebP, até 5 MB.</p>
          </div>
        </div>
      )}
    </div>
  )
}
