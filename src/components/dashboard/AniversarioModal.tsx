import { useState } from 'react'
import { Cake, MessageCircle, Send, Share2, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import {
  normalizarNumeroWhatsApp,
  mensagemPadraoAniversario,
  mensagemPadraoGrupo,
  enviarWhatsAppPessoa,
  compartilharWhatsAppGrupo,
} from '@/lib/aniversarios'
import type { Usuario } from '@/types'

export interface AniversarianteSelecionado {
  u: Usuario
  dia: number
  mes: number
}

/**
 * Modal de "Fulano está fazendo aniversário" — mensagem editável que vai
 * direto pro WhatsApp da pessoa (link `wa.me/<numero>`, como os links
 * personalizados do WhatsApp). Pra admin, tem também um atalho pra
 * compartilhar o aniversário no grupo, com mensagem pronta.
 */
export function AniversarioModal({
  aniversariante,
  ehAdmin,
  onClose,
}: {
  aniversariante: AniversarianteSelecionado | null
  ehAdmin: boolean
  onClose: () => void
}) {
  if (!aniversariante) return null
  return (
    <AniversarioModalConteudo
      key={aniversariante.u.id}
      aniversariante={aniversariante}
      ehAdmin={ehAdmin}
      onClose={onClose}
    />
  )
}

/** Componente interno — remontado (via `key`) a cada aniversariante, pra resetar o texto digitado. */
function AniversarioModalConteudo({
  aniversariante,
  ehAdmin,
  onClose,
}: {
  aniversariante: AniversarianteSelecionado
  ehAdmin: boolean
  onClose: () => void
}) {
  const { u, dia, mes } = aniversariante
  const hoje = new Date()
  const ehHoje = dia === hoje.getDate() && mes === hoje.getMonth() + 1

  const numero = normalizarNumeroWhatsApp(u.whatsapp || u.telefone)
  const [mensagem, setMensagem] = useState(() => mensagemPadraoAniversario(u.nome))
  const [compartilhando, setCompartilhando] = useState(false)

  function enviar() {
    if (!numero || !mensagem.trim()) return
    enviarWhatsAppPessoa(numero, mensagem.trim())
  }

  async function compartilharNoGrupo() {
    setCompartilhando(true)
    try {
      await compartilharWhatsAppGrupo(mensagemPadraoGrupo(u.nome, ehHoje))
    } finally {
      setCompartilhando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <Avatar nome={u.nome} fotoUrl={u.fotoUrl} size="sm" />
          {u.nome}
        </span>
      }
      subtitle={u.funcao?.nome}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Fechar
          </Button>
          <Button icon={Send} onClick={enviar} disabled={!numero || !mensagem.trim()}>
            Enviar no WhatsApp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Cake className="h-3.5 w-3.5" />
            {String(dia).padStart(2, '0')}/{String(mes).padStart(2, '0')}
          </span>
          {ehHoje && (
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              Hoje 🎉
            </span>
          )}
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          {ehHoje
            ? `${u.nome} está fazendo aniversário hoje — que tal mandar uma mensagem? 🎉`
            : `${u.nome} faz aniversário em ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}. Pode mandar uma mensagem antecipada, se quiser.`}
        </p>

        <Field label="Mensagem">
          <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} />
        </Field>

        {!numero && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {u.nome} ainda não tem WhatsApp cadastrado — não dá pra enviar direto. Peça pra
            cadastrar em "Meu Perfil".
          </p>
        )}

        {ehAdmin && (
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <MessageCircle className="h-3.5 w-3.5" /> Só administradores veem isto
            </p>
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {mensagemPadraoGrupo(u.nome, ehHoje)}
            </div>
            <Button
              variant="secondary"
              icon={Share2}
              onClick={compartilharNoGrupo}
              disabled={compartilhando}
              className="mt-2"
            >
              {compartilhando ? 'Abrindo…' : 'Compartilhar no grupo'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
