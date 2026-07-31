import { useState, type FormEvent } from 'react'
import { UserPlus, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import type { PerfilManual } from '@/data/participantes'

/** Papéis que o admin pode indicar para um perfil manual. */
export const PAPEIS_PRETENDIDOS = [
  'Aluno',
  'IC',
  'Pesquisador',
  'Vice-coordenador',
  'Coordenador',
  'Administrador',
]

/** Papéis de estudante — para estes o admin escolhe um responsável. */
export const PAPEIS_COM_RESPONSAVEL = ['Aluno', 'IC']

/**
 * Modal de cadastro/edição MANUAL de uma pessoa (perfil sem login).
 *
 * Guarda só os dados básicos — a própria pessoa completa o resto quando fizer
 * login com o mesmo e-mail (Parte 2). O "papel pretendido" é uma intenção: será
 * aplicado como função da conta no primeiro acesso.
 */
export function PessoaFormModal({
  open,
  onClose,
  onSalvar,
  salvando,
  inicial,
  responsaveis = [],
  titulo = 'Adicionar pessoa',
}: {
  open: boolean
  onClose: () => void
  onSalvar: (dados: PerfilManual) => void
  salvando?: boolean
  inicial?: PerfilManual
  /** Pessoas que podem ser responsáveis por um aluno/IC (pesquisadores etc.). */
  responsaveis?: Array<{ id: string; nome: string }>
  titulo?: string
}) {
  const editando = Boolean(inicial)
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [email, setEmail] = useState(inicial?.email ?? '')
  const [cpf, setCpf] = useState(inicial?.cpf ?? '')
  const [curso, setCurso] = useState(inicial?.curso ?? '')
  const [telefone, setTelefone] = useState(inicial?.telefone ?? '')
  const [whatsapp, setWhatsapp] = useState(inicial?.whatsapp ?? '')
  const [endereco, setEndereco] = useState(inicial?.endereco ?? '')
  const [cep, setCep] = useState(inicial?.cep ?? '')
  const [papel, setPapel] = useState(inicial?.papelPretendido ?? 'Aluno')
  const [responsavelId, setResponsavelId] = useState(inicial?.responsavelId ?? '')

  const exigeResponsavel = PAPEIS_COM_RESPONSAVEL.includes(papel)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const resp = exigeResponsavel ? responsaveis.find((r) => r.id === responsavelId) : undefined
    onSalvar({
      nome: nome.trim(),
      email: email.trim() || undefined,
      cpf: cpf.trim() || undefined,
      curso: curso.trim() || undefined,
      telefone: telefone.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      endereco: endereco.trim() || undefined,
      cep: cep.trim() || undefined,
      papelPretendido: papel,
      responsavelId: resp?.id,
      responsavelNome: resp?.nome,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            {editando ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          </span>
          {titulo}
        </span>
      }
      subtitle="Só os dados básicos — a pessoa completa o restante ao entrar com este e-mail."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-pessoa" disabled={salvando || !nome.trim()}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </>
      }
    >
      <form id="form-pessoa" onSubmit={enviar} className="space-y-4">
        <Field label="Nome completo">
          <Input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Maria Oliveira"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="E-mail" hint="Usado para vincular ao login depois.">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@exemplo.com"
            />
          </Field>
          <Field label="Papel pretendido" hint="Aplicado como função no 1º acesso.">
            <Select value={papel} onChange={(e) => setPapel(e.target.value)}>
              {PAPEIS_PRETENDIDOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Responsável — só para aluno/IC */}
        {exigeResponsavel && (
          <Field
            label="Pesquisador responsável"
            hint="Coordenador, professor, vice-coordenador ou pesquisador que acompanha este aluno/IC."
          >
            <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              <option value="">— Selecione —</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="CPF">
            <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
          </Field>
          <Field label="Curso / Área">
            <Input value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Ex.: Enfermagem" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(34) 90000-0000"
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(34) 90000-0000"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Endereço">
            <Input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro"
            />
          </Field>
          <Field label="CEP">
            <Input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" />
          </Field>
        </div>
      </form>
    </Modal>
  )
}
