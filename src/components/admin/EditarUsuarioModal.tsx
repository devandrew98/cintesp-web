import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { listarInstituicoes, type DadosUsuario } from '@/data/api'
import type { StatusUsuario, Usuario } from '@/types'

/**
 * Modal "Editar Dados" do usuário (Administração > Usuários).
 * Permite alterar nome, telefone, instituição e situação (ativo/inativo).
 *
 * O e-mail NÃO é editável: ele é a identidade do login (Supabase Auth) e
 * trocá-lo aqui deixaria o perfil fora de sincronia com a conta de acesso.
 */
export function EditarUsuarioModal({
  usuario,
  open,
  onClose,
  onSalvar,
  salvando,
}: {
  usuario: Usuario
  open: boolean
  onClose: () => void
  onSalvar: (dados: DadosUsuario) => void
  salvando?: boolean
}) {
  const { data: instituicoes = [] } = useQuery({
    queryKey: ['instituicoes'],
    queryFn: listarInstituicoes,
  })

  const [nome, setNome] = useState(usuario.nome)
  const [telefone, setTelefone] = useState(usuario.telefone ?? '')
  const [instituicaoId, setInstituicaoId] = useState(usuario.instituicao?.id ?? '')
  const [status, setStatus] = useState<StatusUsuario>(usuario.status)

  function enviar(e: FormEvent) {
    e.preventDefault()
    onSalvar({
      nome: nome.trim(),
      telefone: telefone.trim() || undefined,
      instituicaoId: instituicaoId || undefined,
      status,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar dados do pesquisador"
      subtitle={usuario.email}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-editar-usuario" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </>
      }
    >
      <form id="form-editar-usuario" onSubmit={enviar} className="space-y-4">
        <Field label="Nome completo">
          <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>

        <Field label="E-mail" hint="O e-mail é a identidade de acesso e não pode ser alterado aqui.">
          <Input value={usuario.email} disabled className="opacity-60" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(34) 90000-0000"
            />
          </Field>
          <Field label="Situação">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusUsuario)}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Select>
          </Field>
        </div>

        <Field label="Instituição">
          <Select value={instituicaoId} onChange={(e) => setInstituicaoId(e.target.value)}>
            <option value="">— Sem instituição —</option>
            {instituicoes.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sigla} — {i.nome}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  )
}
