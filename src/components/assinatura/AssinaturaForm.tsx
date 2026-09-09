import type { FormEvent } from 'react'
import { Wand2, ClipboardCopy, Code2, Eraser, CheckCircle2, ImageDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { AssinaturaLogoInput } from './AssinaturaLogoInput'
import type { CampoAssinatura, DadosAssinatura } from '@/lib/assinaturaEmail'

/** Formulário de dados da assinatura + botões de ação (gerar, copiar, baixar, limpar). */
export function AssinaturaForm({
  dados,
  onChange,
  camposFaltando,
  gerada,
  onGerar,
  onCopiarVisual,
  onCopiarHtml,
  onBaixarPng,
  onLimpar,
  copiando,
  baixandoPng,
}: {
  dados: DadosAssinatura
  onChange: (patch: Partial<DadosAssinatura>) => void
  camposFaltando: CampoAssinatura[]
  gerada: boolean
  onGerar: () => void
  onCopiarVisual: () => void
  onCopiarHtml: () => void
  onBaixarPng: () => void
  onLimpar: () => void
  copiando: 'visual' | 'html' | null
  baixandoPng: boolean
}) {
  function faltando(campo: CampoAssinatura) {
    return camposFaltando.includes(campo)
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    onGerar()
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <AssinaturaLogoInput logoUrl={dados.logoUrl} onChange={(logoUrl) => onChange({ logoUrl })} />

      <Field label="Nome completo">
        <Input
          value={dados.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          placeholder="Ex.: Cleudmar A. Araújo"
          className={faltando('nome') ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : undefined}
        />
        {faltando('nome') && <p className="mt-1 text-xs text-red-500">Preencha o nome.</p>}
      </Field>

      <Field label="Cargo / Função">
        <Input
          value={dados.cargo}
          onChange={(e) => onChange({ cargo: e.target.value })}
          placeholder="Ex.: Coordenador"
          className={faltando('cargo') ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : undefined}
        />
        {faltando('cargo') && <p className="mt-1 text-xs text-red-500">Preencha o cargo.</p>}
      </Field>

      <Field label="Organização">
        <Input
          value={dados.organizacao}
          onChange={(e) => onChange({ organizacao: e.target.value })}
          className={faltando('organizacao') ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : undefined}
        />
        {faltando('organizacao') && <p className="mt-1 text-xs text-red-500">Preencha a organização.</p>}
      </Field>

      <Field label="E-mail">
        <Input
          type="email"
          value={dados.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="voce@cintesp.org.br"
          className={faltando('email') ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : undefined}
        />
        {faltando('email') && <p className="mt-1 text-xs text-red-500">Preencha o e-mail.</p>}
      </Field>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button type="submit" icon={Wand2}>
          Gerar assinatura
        </Button>
        <Button type="button" variant="secondary" icon={ClipboardCopy} onClick={onCopiarVisual} disabled={copiando === 'visual'}>
          {copiando === 'visual' ? 'Copiando…' : 'Copiar assinatura visual'}
        </Button>
        <Button type="button" variant="secondary" icon={Code2} onClick={onCopiarHtml} disabled={copiando === 'html'}>
          {copiando === 'html' ? 'Copiando…' : 'Copiar código HTML'}
        </Button>
        <Button type="button" variant="secondary" icon={ImageDown} onClick={onBaixarPng} disabled={baixandoPng}>
          {baixandoPng ? 'Gerando PNG…' : 'Baixar PNG'}
        </Button>
        <Button type="button" variant="ghost" icon={Eraser} onClick={onLimpar}>
          Limpar
        </Button>
      </div>

      {gerada && camposFaltando.length === 0 && (
        <p className="flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400">
          <CheckCircle2 className="h-4 w-4" /> Assinatura pronta — confira a pré-visualização ao lado.
        </p>
      )}
    </form>
  )
}
