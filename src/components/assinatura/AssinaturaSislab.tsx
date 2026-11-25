import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ClipboardCopy, Code2, Eraser, ImageDown, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { SectionCard } from '@/components/ui/SectionCard'
import { AssinaturaPreview } from './AssinaturaPreview'
import { AssinaturaCodigo } from './AssinaturaCodigo'
import { usePermissoes } from '@/hooks/usePermissoes'
import { mensagemErro } from '@/lib/utils'
import {
  gerarHtmlSislab,
  gerarImagemSislab,
  gerarTextoSislab,
  validarSislab,
  valoresPadraoSislab,
  type CampoSislab,
  type DadosSislab,
} from '@/lib/assinaturaSislab'

const CAMPOS: { id: keyof DadosSislab; label: string; placeholder: string; tipo?: string }[] = [
  { id: 'nome', label: 'Nome', placeholder: 'Ex.: Maria S. Oliveira' },
  { id: 'cargo', label: 'Cargo / Função', placeholder: 'Ex.: Designer | Gestora de Projetos' },
  { id: 'vinculo', label: 'Vínculo (opcional)', placeholder: 'Ex.: Pesquisadora Finep - SisAssistiva/MCTI' },
  { id: 'laboratorio', label: 'Laboratório', placeholder: '' },
  { id: 'email', label: 'E-mail', placeholder: 'voce@ufu.br', tipo: 'email' },
]

/** Modelo SisLAB: formulário, pré-visualização e ações. A assinatura é uma imagem gerada no navegador. */
export function AssinaturaSislab() {
  const { perfil } = usePermissoes()
  const [dados, setDados] = useState<DadosSislab>(valoresPadraoSislab)
  const [imagem, setImagem] = useState<{ de: DadosSislab; url: string } | null>(null)
  const [tentou, setTentou] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const jaPreencheu = useRef(false)
  useEffect(() => {
    if (jaPreencheu.current || !perfil) return
    jaPreencheu.current = true
    setDados((d) => ({ ...d, nome: d.nome || perfil.nome || '', email: d.email || perfil.email || '' }))
  }, [perfil])

  // A imagem é redesenhada a cada mudança; só vale a do último texto digitado.
  useEffect(() => {
    let vivo = true
    gerarImagemSislab(dados)
      .then((url) => vivo && setImagem({ de: dados, url }))
      .catch((e) => vivo && setErro(mensagemErro(e)))
    return () => {
      vivo = false
    }
  }, [dados])

  const faltando = validarSislab(dados)
  const mostrarFalta = (c: keyof DadosSislab) => tentou && faltando.includes(c as CampoSislab)
  const pronta = imagem?.de === dados
  const html = imagem ? gerarHtmlSislab(imagem.de, imagem.url) : ''

  function atualizar(patch: Partial<DadosSislab>) {
    setDados((d) => ({ ...d, ...patch }))
    setMensagem(null)
    setErro(null)
  }

  /** Só copia/baixa com os campos obrigatórios preenchidos. */
  async function executar(acao: () => Promise<string> | string, falha: string) {
    setTentou(true)
    setMensagem(null)
    setErro(null)
    if (faltando.length > 0) return setErro('Preencha os campos obrigatórios.')
    try {
      setMensagem(await acao())
    } catch {
      setErro(falha)
    }
  }

  const copiarVisual = () =>
    executar(async () => {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([gerarTextoSislab(dados)], { type: 'text/plain' }),
        }),
      ])
      return 'Assinatura copiada! Cole com Ctrl+V direto no Gmail ou Outlook.'
    }, 'Não foi possível copiar. Use "Baixar PNG" e insira a imagem na assinatura do seu e-mail.')

  const copiarHtml = () =>
    executar(async () => {
      await navigator.clipboard.writeText(html)
      return 'Código HTML copiado!'
    }, 'Não foi possível copiar o código. Selecione o texto manualmente.')

  const baixarPng = () =>
    executar(() => {
      const link = document.createElement('a')
      link.href = imagem!.url
      link.download = 'assinatura-sislab.png'
      document.body.appendChild(link)
      link.click()
      link.remove()
      return 'PNG baixado (800×200, para ficar nítido exibido em 400×100).'
    }, 'Não foi possível baixar o PNG.')

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-brand-600" /> Seus dados
          </span>
        }
        bodyClassName="p-5"
      >
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {CAMPOS.map((c) => (
            <Field key={c.id} label={c.label}>
              <Input
                type={c.tipo}
                value={dados[c.id]}
                placeholder={c.placeholder}
                onChange={(e) => atualizar({ [c.id]: e.target.value })}
                className={mostrarFalta(c.id) ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : undefined}
              />
              {mostrarFalta(c.id) && <p className="mt-1 text-xs text-red-500">Campo obrigatório.</p>}
            </Field>
          ))}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" icon={ClipboardCopy} onClick={copiarVisual} disabled={!pronta}>
              Copiar assinatura visual
            </Button>
            <Button type="button" variant="secondary" icon={ImageDown} onClick={baixarPng} disabled={!pronta}>
              Baixar PNG
            </Button>
            <Button type="button" variant="secondary" icon={Code2} onClick={copiarHtml} disabled={!pronta}>
              Copiar código HTML
            </Button>
            <Button
              type="button"
              variant="ghost"
              icon={Eraser}
              onClick={() => {
                setTentou(false)
                atualizar(valoresPadraoSislab())
              }}
            >
              Limpar
            </Button>
          </div>
        </form>

        {mensagem && (
          <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {mensagem}
          </p>
        )}
        {erro && (
          <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
          </p>
        )}
      </SectionCard>

      <div className="min-w-0 space-y-6">
        <SectionCard title="Pré-visualização" bodyClassName="p-5">
          <AssinaturaPreview html={html} />
        </SectionCard>
        <SectionCard title="Código HTML" bodyClassName="p-5">
          <AssinaturaCodigo html={html} />
        </SectionCard>
      </div>
    </div>
  )
}
