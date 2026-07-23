import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { UserList } from '@/components/admin/UserList'
import { UserDetail } from '@/components/admin/UserDetail'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { listarUsuarios } from '@/data/api'

/**
 * Tela "Administração > Usuários" (print 2), agora lendo do Supabase.
 * Layout mestre-detalhe: lista à esquerda, detalhe do usuário à direita.
 * Como cada usuário tem login próprio, novos pesquisadores entram por
 * convite (Supabase Auth) ou cadastro — o botão "Novo" explica isso.
 */
export function AdminUsuariosPage() {
  const { data: lista = [], isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [infoAberto, setInfoAberto] = useState(false)

  // Usuário exibido no detalhe (o selecionado, ou o primeiro da lista).
  const selecionado = lista.find((u) => u.id === selecionadoId) ?? lista[0] ?? null

  return (
    <AdminShell>
      {isLoading ? (
        <div className="card flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários…
        </div>
      ) : lista.length === 0 ? (
        <div className="card px-6 py-16 text-center text-sm text-slate-400">
          Nenhum usuário ainda. Convide pesquisadores para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <UserList
            usuarios={lista}
            selecionadoId={selecionado?.id ?? ''}
            onSelect={setSelecionadoId}
            onNovo={() => setInfoAberto(true)}
          />
          {selecionado && <UserDetail usuario={selecionado} />}
        </div>
      )}

      {/* Como adicionar pesquisadores (não dá para criar login pelo front). */}
      <Modal
        open={infoAberto}
        onClose={() => setInfoAberto(false)}
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <UserPlus className="h-5 w-5" />
            </span>
            Adicionar pesquisador
          </span>
        }
        footer={
          <Button onClick={() => setInfoAberto(false)}>Entendi</Button>
        }
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>Cada pesquisador tem um login próprio, então o cadastro passa pela autenticação:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Convite:</strong> no painel do Supabase, em{' '}
              <em>Authentication → Users → Invite user</em>, informe o e-mail do pesquisador.
            </li>
            <li>
              <strong>Autocadastro:</strong> a pessoa acessa a tela de login e clica em{' '}
              <em>“Criar conta”</em>.
            </li>
          </ul>
          <p className="text-slate-500">
            Ao entrar pela primeira vez, o perfil é criado automaticamente como{' '}
            <strong>Pesquisador</strong>. Depois, aqui você ajusta função, áreas e status.
          </p>
        </div>
      </Modal>
    </AdminShell>
  )
}
