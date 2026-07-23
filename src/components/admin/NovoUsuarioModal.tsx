import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { funcoes, instituicoes } from '@/data/mock'
import type { StatusUsuario, Usuario } from '@/types'

/**
 * Modal de cadastro de novo usuário. Em modo mock, monta um objeto Usuario
 * e devolve via `onCreate`. Na Fase 4 (Supabase), aqui entra o convite/insert
 * na tabela `usuarios` (e criação no Auth).
 */
export function NovoUsuarioModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (usuario: Usuario) => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [funcaoId, setFuncaoId] = useState(funcoes[2].id) // padrão: Pesquisador
  const [instituicaoId, setInstituicaoId] = useState(instituicoes[0].id)
  const [status, setStatus] = useState<StatusUsuario>('ativo')

  function reset() {
    setNome('')
    setEmail('')
    setTelefone('')
    setFuncaoId(funcoes[2].id)
    setInstituicaoId(instituicoes[0].id)
    setStatus('ativo')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const novo: Usuario = {
      id: `u-${Date.now()}`,
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone.trim() || undefined,
      funcao: funcoes.find((f) => f.id === funcaoId)!,
      instituicao: instituicoes.find((i) => i.id === instituicaoId),
      areas: [],
      status,
      disponibilidade: 'ausente', // começa ausente até definir horários
    }
    onCreate(novo)
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo Usuário"
      subtitle="Cadastre um novo pesquisador na equipe."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-novo-usuario">
            Cadastrar
          </Button>
        </>
      }
    >
      <form id="form-novo-usuario" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome completo">
          <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João Silva" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="E-mail">
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@cintesp.org.br" />
          </Field>
          <Field label="Telefone">
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(34) 90000-0000" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Função">
            <Select value={funcaoId} onChange={(e) => setFuncaoId(e.target.value)}>
              {funcoes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Instituição">
            <Select value={instituicaoId} onChange={(e) => setInstituicaoId(e.target.value)}>
              {instituicoes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sigla} — {i.nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusUsuario)}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </Select>
        </Field>
      </form>
    </Modal>
  )
}
