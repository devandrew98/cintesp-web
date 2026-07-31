import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { atualizarMeuPerfil, type DadosPerfil } from '@/data/api'
import { mensagemErro } from '@/lib/utils'
import type { Usuario } from '@/types'

/**
 * Modal "Editar Perfil" — dados pessoais do usuário logado (ou de qualquer um,
 * quando aberto por um admin). O e-mail não é editável (é o login).
 */
export function EditarPerfilModal({
  usuario,
  open,
  onClose,
}: {
  usuario: Usuario
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [dados, setDados] = useState<DadosPerfil>({
    nome: usuario.nome,
    telefone: usuario.telefone ?? '',
    whatsapp: usuario.whatsapp ?? '',
    cpf: usuario.cpf ?? '',
    endereco: usuario.endereco ?? '',
    cep: usuario.cep ?? '',
    curso: usuario.curso ?? '',
  })
  const [erro, setErro] = useState<string | null>(null)

  const set = (campo: keyof DadosPerfil) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDados((d) => ({ ...d, [campo]: e.target.value }))

  const salvar = useMutation({
    mutationFn: () => atualizarMeuPerfil(usuario.id, { ...dados, nome: dados.nome.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perfil'] })
      qc.invalidateQueries({ queryKey: ['perfil-atual'] })
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      onClose()
    },
    onError: (e) => setErro(mensagemErro(e)),
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    salvar.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Editar perfil"
      subtitle="Atualize seus dados de contato e informações."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-editar-perfil" disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <form id="form-editar-perfil" onSubmit={enviar} className="space-y-4">
        <Field label="Nome completo">
          <Input required value={dados.nome} onChange={set('nome')} placeholder="Seu nome" />
        </Field>

        <Field label="E-mail" hint="O e-mail é o seu login e não pode ser alterado aqui.">
          <Input value={usuario.email} disabled className="opacity-60" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="CPF">
            <Input value={dados.cpf} onChange={set('cpf')} placeholder="000.000.000-00" />
          </Field>
          <Field label="Curso">
            <Input value={dados.curso} onChange={set('curso')} placeholder="Ex.: Medicina" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <Input value={dados.telefone} onChange={set('telefone')} placeholder="(34) 3000-0000" />
          </Field>
          <Field label="WhatsApp">
            <Input value={dados.whatsapp} onChange={set('whatsapp')} placeholder="(34) 90000-0000" />
          </Field>
        </div>

        <Field label="Endereço">
          <Input value={dados.endereco} onChange={set('endereco')} placeholder="Rua, número, bairro" />
        </Field>

        <Field label="CEP">
          <Input value={dados.cep} onChange={set('cep')} placeholder="00000-000" className="sm:max-w-xs" />
        </Field>

        {erro && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {erro}
          </p>
        )}
      </form>
    </Modal>
  )
}
