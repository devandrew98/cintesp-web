import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { AssinaturaForm } from '@/components/assinatura/AssinaturaForm'
import { AssinaturaPreview } from '@/components/assinatura/AssinaturaPreview'
import { AssinaturaCodigo } from '@/components/assinatura/AssinaturaCodigo'
import { usePermissoes } from '@/hooks/usePermissoes'
import {
  gerarHtmlAssinatura,
  gerarTextoAssinatura,
  valoresPadraoAssinatura,
  validarAssinatura,
  type CampoAssinatura,
  type DadosAssinatura,
} from '@/lib/assinaturaEmail'

/**
 * "Assinatura de E-mail" — gera a assinatura padrão do CINTESP.Br a partir
 * de um formulário. Tudo roda no navegador (sem backend/banco): o HTML é
 * montado na hora com tabelas + estilo inline, pronto pra colar no Gmail ou
 * Outlook, com ou sem formatação.
 */
export function AssinaturaEmailPage() {
  const { perfil } = usePermissoes()

  const [dados, setDados] = useState<DadosAssinatura>(valoresPadraoAssinatura)

  // Só de brinde: pré-preenche com o nome/e-mail de quem está logado assim
  // que o perfil carrega (a consulta é assíncrona, não dá pra pegar no
  // useState inicial). Só uma vez, e só se a pessoa ainda não digitou nada.
  const jaPreencheu = useRef(false)
  useEffect(() => {
    if (jaPreencheu.current || !perfil) return
    jaPreencheu.current = true
    setDados((d) => ({ ...d, nome: d.nome || perfil.nome || '', email: d.email || perfil.email || '' }))
  }, [perfil])
  const [camposFaltando, setCamposFaltando] = useState<CampoAssinatura[]>([])
  const [gerada, setGerada] = useState(false)
  const [copiando, setCopiando] = useState<'visual' | 'html' | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const html = useMemo(() => gerarHtmlAssinatura(dados), [dados])
  const texto = useMemo(() => gerarTextoAssinatura(dados), [dados])

  function atualizar(patch: Partial<DadosAssinatura>) {
    setDados((d) => ({ ...d, ...patch }))
    setGerada(false)
    setMensagem(null)
    setErro(null)
  }

  function gerar() {
    const faltando = validarAssinatura(dados)
    setCamposFaltando(faltando)
    setGerada(faltando.length === 0)
    setMensagem(null)
    setErro(null)
  }

  function limpar() {
    const base = valoresPadraoAssinatura()
    setDados(base)
    setCamposFaltando([])
    setGerada(false)
    setMensagem(null)
    setErro(null)
  }

  async function copiarVisual() {
    setCopiando('visual')
    setMensagem(null)
    setErro(null)
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        throw new Error('SEM_SUPORTE')
      }
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([texto], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([item])
      setMensagem('Assinatura copiada! Cole com Ctrl+V direto no Gmail ou Outlook.')
    } catch (err) {
      setErro(
        err instanceof Error && err.message === 'SEM_SUPORTE'
          ? 'Seu navegador não suporta copiar com formatação. Use "Copiar código HTML" e cole no editor de assinatura do seu cliente de e-mail.'
          : 'Não foi possível copiar. Tente "Copiar código HTML".',
      )
    } finally {
      setCopiando(null)
    }
  }

  async function copiarHtml() {
    setCopiando('html')
    setMensagem(null)
    setErro(null)
    try {
      await navigator.clipboard.writeText(html)
      setMensagem('Código HTML copiado!')
    } catch {
      setErro('Não foi possível copiar o código. Selecione o texto manualmente.')
    } finally {
      setCopiando(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Assinatura de E-mail"
        subtitle="Gere sua assinatura padrão do CINTESP.Br — pronta para colar no Gmail ou Outlook."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand-600" /> Seus dados
            </span>
          }
          bodyClassName="p-5"
        >
          <AssinaturaForm
            dados={dados}
            onChange={atualizar}
            camposFaltando={camposFaltando}
            gerada={gerada}
            onGerar={gerar}
            onCopiarVisual={copiarVisual}
            onCopiarHtml={copiarHtml}
            onLimpar={limpar}
            copiando={copiando}
          />

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

        <div className="space-y-6">
          <SectionCard title="Pré-visualização" bodyClassName="p-5">
            <AssinaturaPreview html={html} />
          </SectionCard>

          <SectionCard title="Código HTML" bodyClassName="p-5">
            <AssinaturaCodigo html={html} />
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
