import { useState } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { UserList } from '@/components/admin/UserList'
import { UserDetail } from '@/components/admin/UserDetail'
import { NovoUsuarioModal } from '@/components/admin/NovoUsuarioModal'
import { usuarios as usuariosMock } from '@/data/mock'
import type { Usuario } from '@/types'

/**
 * Tela "Administração > Usuários" (print 2).
 * Layout mestre-detalhe: lista de usuários à esquerda e o detalhe do
 * usuário selecionado à direita. Mantém em estado a lista (para novos
 * cadastros) e o id selecionado.
 */
export function AdminUsuariosPage() {
  const [lista, setLista] = useState<Usuario[]>(usuariosMock)
  const [selecionadoId, setSelecionadoId] = useState<string>(usuariosMock[0].id)
  const [modalAberto, setModalAberto] = useState(false)

  // Usuário atualmente exibido no painel de detalhe.
  const selecionado = lista.find((u) => u.id === selecionadoId) ?? lista[0]

  return (
    <AdminShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        {/* Painel esquerdo: lista */}
        <UserList
          usuarios={lista}
          selecionadoId={selecionado.id}
          onSelect={setSelecionadoId}
          onNovo={() => setModalAberto(true)}
        />

        {/* Painel direito: detalhe */}
        <UserDetail usuario={selecionado} />
      </div>

      {/* Modal de cadastro — prepend na lista e já seleciona o novo usuário */}
      <NovoUsuarioModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onCreate={(novo) => {
          setLista((prev) => [novo, ...prev])
          setSelecionadoId(novo.id)
        }}
      />
    </AdminShell>
  )
}
