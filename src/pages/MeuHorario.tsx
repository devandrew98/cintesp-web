import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Mail,
  Phone,
  MessageCircle,
  Building2,
  MapPin,
  GraduationCap,
  Fingerprint,
  Pencil,
  MapPinned,
  Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { FotoPerfilUploader } from '@/components/perfil/FotoPerfilUploader'
import { EditarPerfilModal } from '@/components/perfil/EditarPerfilModal'
import { SelecionarAreasModal } from '@/components/admin/SelecionarAreasModal'
import { DisponibilidadeBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { HorarioEditor } from '@/components/admin/HorarioEditor'
import { usePermissoes } from '@/hooks/usePermissoes'
import { perfilAtual, listarHorarios, salvarHorarios, atualizarAreasUsuario } from '@/data/api'

/**
 * Tela "Meu Perfil".
 * Dados pessoais do usuário logado (com foto e botão "Editar Perfil") e o
 * editor do próprio horário semanal. A situação (Disponível/Ausente…) é
 * calculada automaticamente pelo horário, então não há controle manual aqui.
 */
export function MeuHorarioPage() {
  const queryClient = useQueryClient()
  const { data: eu, isLoading } = useQuery({ queryKey: ['perfil'], queryFn: perfilAtual })
  const { data: horarios = [], isLoading: carregandoHorarios } = useQuery({
    queryKey: ['horarios', eu?.id],
    queryFn: () => listarHorarios(eu!.id),
    enabled: !!eu,
  })

  // Só a administração edita horários (regra do CINTESP).
  const { ehAdmin } = usePermissoes()
  const [editando, setEditando] = useState(false)
  const [editandoAreas, setEditandoAreas] = useState(false)

  async function salvarMeuHorario(h: typeof horarios) {
    if (!eu) return
    await salvarHorarios(eu.id, h)
    queryClient.invalidateQueries({ queryKey: ['horarios', eu.id] })
  }

  // Cada pesquisador escolhe as PRÓPRIAS áreas de atuação.
  const salvarAreasMut = useMutation({
    mutationFn: (ids: string[]) => atualizarAreasUsuario(eu!.id, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfil'] })
      queryClient.invalidateQueries({ queryKey: ['perfil-atual'] })
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setEditandoAreas(false)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando seu perfil…
      </div>
    )
  }

  if (!eu) {
    return (
      <div className="card px-6 py-16 text-center text-sm text-slate-400">
        Não foi possível carregar seu perfil.
      </div>
    )
  }

  const contatos = [
    { icon: Mail, valor: eu.email },
    eu.telefone ? { icon: Phone, valor: eu.telefone } : null,
    eu.whatsapp ? { icon: MessageCircle, valor: `WhatsApp: ${eu.whatsapp}` } : null,
    eu.cpf ? { icon: Fingerprint, valor: `CPF: ${eu.cpf}` } : null,
    eu.curso ? { icon: GraduationCap, valor: eu.curso } : null,
    eu.endereco ? { icon: MapPin, valor: eu.cep ? `${eu.endereco} — ${eu.cep}` : eu.endereco } : null,
    eu.instituicao ? { icon: Building2, valor: `${eu.instituicao.sigla} — ${eu.instituicao.nome}` } : null,
  ].filter(Boolean) as { icon: typeof Mail; valor: string }[]

  return (
    <div>
      <PageHeader
        title="Meu Perfil"
        subtitle="Seus dados e o seu horário da semana."
        actions={
          <Button variant="secondary" icon={Pencil} onClick={() => setEditando(true)}>
            Editar Perfil
          </Button>
        }
      />

      {/* Perfil */}
      <div className="card mb-6 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <FotoPerfilUploader usuarioId={eu.id} nome={eu.nome} fotoUrl={eu.fotoUrl} podeEditar />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{eu.nome}</h2>
              <DisponibilidadeBadge status={eu.disponibilidade} />
            </div>
            <p className="text-sm font-medium text-brand-600">{eu.funcao.nome}</p>

            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm text-slate-500 sm:grid-cols-2">
              {contatos.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  <c.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{c.valor}</span>
                </span>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Áreas de atuação — o próprio pesquisador escolhe (uma ou mais) */}
      <div className="card mb-6 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <MapPinned className="h-4 w-4 text-brand-600" /> Áreas de Atuação
            </h3>
            <p className="text-sm text-slate-500">
              Em quais áreas você atua? Pode escolher uma ou mais — as opções são as que a
              administração cadastrou.
            </p>
          </div>
          <Button
            variant="secondary"
            icon={Pencil}
            onClick={() => setEditandoAreas(true)}
            className="shrink-0"
          >
            {eu.areas.length ? 'Editar áreas' : 'Escolher áreas'}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {eu.areas.length === 0 ? (
            <span className="text-sm text-slate-400">
              Você ainda não informou suas áreas de atuação.
            </span>
          ) : (
            eu.areas.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.cor }} />
                {a.nome}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Editor de horários (persiste no banco) */}
      {carregandoHorarios ? (
        <div className="card flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando horários…
        </div>
      ) : (
        <HorarioEditor
          key={eu.id}
          horariosIniciais={horarios}
          onSalvar={ehAdmin ? salvarMeuHorario : undefined}
          somenteLeitura={!ehAdmin}
        />
      )}

      <EditarPerfilModal usuario={eu} open={editando} onClose={() => setEditando(false)} />

      {editandoAreas && (
        <SelecionarAreasModal
          open={editandoAreas}
          onClose={() => setEditandoAreas(false)}
          areasAtuais={eu.areas.map((a) => a.id)}
          onSalvar={(ids) => salvarAreasMut.mutate(ids)}
          salvando={salvarAreasMut.isPending}
        />
      )}
    </div>
  )
}
