import { KeyRound, Mail, Phone, MessageCircle, Fingerprint, GraduationCap, MapPin } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { UserDetail } from './UserDetail'
import { formatarCPF } from '@/lib/cpf'
import type { Participante, Usuario } from '@/types'

/**
 * Detalhe completo de uma pessoa da lista "Pesquisadores".
 *
 * - Usuário da plataforma (tem login) → reaproveita o painel rico `UserDetail`
 *   (informações, função, horários, áreas e histórico).
 * - Perfil sem login (aluno importado / cadastro manual) → mostra os dados
 *   básicos, já que ainda não há horários/permissões atrelados.
 */
export function PessoaDetailModal({
  usuario,
  participante,
  onClose,
}: {
  usuario?: Usuario | null
  participante?: Participante | null
  onClose: () => void
}) {
  const aberto = Boolean(usuario || participante)

  if (usuario) {
    return (
      <Modal open={aberto} onClose={onClose} size="xl" title={usuario.nome} subtitle={usuario.email}>
        <UserDetail usuario={usuario} />
      </Modal>
    )
  }

  if (!participante) return null

  const extras = participante.dadosExtras ?? {}
  const whatsapp = extras.whatsapp
  const papel = extras.funcaoPretendida
  const linhas = [
    participante.email && { icon: Mail, texto: participante.email },
    participante.telefone && { icon: Phone, texto: participante.telefone },
    whatsapp && { icon: MessageCircle, texto: `WhatsApp: ${whatsapp}` },
    participante.cpf && { icon: Fingerprint, texto: formatarCPF(participante.cpf) },
    participante.curso && {
      icon: GraduationCap,
      texto: participante.turma ? `${participante.curso} · ${participante.turma}` : participante.curso,
    },
    participante.endereco && {
      icon: MapPin,
      texto: participante.cep ? `${participante.endereco} — CEP ${participante.cep}` : participante.endereco,
    },
  ].filter(Boolean) as Array<{ icon: typeof Mail; texto: string }>

  return (
    <Modal open={aberto} onClose={onClose} size="lg" title={participante.nome}>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar nome={participante.nome} size="lg" />
          <div>
            <p className="text-sm font-medium text-brand-600">
              {papel ? `${papel} (sem acesso ainda)` : 'Sem acesso à plataforma'}
            </p>
            {participante.matricula && (
              <p className="text-xs text-slate-400">Matrícula {participante.matricula}</p>
            )}
          </div>
        </div>

        {/* Aviso de perfil sem login */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Esta pessoa ainda <strong>não tem login</strong>. Quando ela entrar com o e-mail acima, a
            conta é criada e os dados abaixo passam a ser dela.
          </p>
        </div>

        {linhas.length > 0 ? (
          <ul className="space-y-2">
            {linhas.map((l, i) => {
              const Icone = l.icon
              return (
                <li key={i} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <Icone className="h-4 w-4 shrink-0 text-slate-400" />
                  {l.texto}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">Sem dados de contato cadastrados.</p>
        )}

        {participante.observacoes && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Observações</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{participante.observacoes}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
