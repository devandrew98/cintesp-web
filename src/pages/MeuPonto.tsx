import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, History, Loader2, QrCode } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { listarRegistrosPonto } from '@/data/ponto'
import { agruparPorDia } from '@/lib/ponto'
import { usePermissoes } from '@/hooks/usePermissoes'

/**
 * "Meu Ponto" — o pesquisador vê SÓ o próprio histórico (RLS garante isso
 * também no banco: `auth.uid() = usuario_id`). Não expõe horário de
 * colegas; quem precisa ver todo mundo é a Administração > Registro de
 * Ponto.
 */
export function MeuPontoPage() {
  const { perfil } = usePermissoes()

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['ponto-registros', { usuarioId: perfil?.id }],
    queryFn: () => listarRegistrosPonto({ usuarioId: perfil!.id }),
    enabled: Boolean(perfil?.id),
  })

  const dias = useMemo(() => agruparPorDia(registros), [registros])
  const hojeISO = new Date().toISOString().slice(0, 10)
  const hoje = dias.find((d) => d.data === hojeISO)
  const historico = dias.filter((d) => d.data !== hojeISO).slice(0, 30)

  return (
    <div>
      <PageHeader title="Meu Ponto" subtitle="Seus registros de entrada e saída, feitos pelo QR Code pessoal." />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Clock className="h-4 w-4 text-slate-400" />
              Hoje
            </h2>
            {hoje ? (
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-slate-400">Entrada</p>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {hoje.entrada ? new Date(hoje.entrada.registradoEm).toLocaleTimeString('pt-BR') : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Saída</p>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {hoje.saida ? new Date(hoje.saida.registradoEm).toLocaleTimeString('pt-BR') : '—'}
                  </p>
                </div>
                {hoje.incompleto && (
                  <span className="inline-flex h-fit items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    Aguardando {hoje.entrada ? 'saída' : 'entrada'}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <QrCode className="h-4 w-4" />
                Nenhum registro hoje ainda. Escaneie seu QR Code pessoal com a câmera do celular
                para registrar.
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <History className="h-4 w-4 text-slate-400" />
              Histórico
            </h2>
            {historico.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum registro anterior.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {historico.map((d) => (
                  <li key={`${d.usuarioId}-${d.data}-${d.entrada?.id ?? d.saida?.id}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-slate-500">
                      {new Date(`${d.data}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {d.entrada ? new Date(d.entrada.registradoEm).toLocaleTimeString('pt-BR') : '—'}
                      {' → '}
                      {d.saida ? new Date(d.saida.registradoEm).toLocaleTimeString('pt-BR') : '—'}
                    </span>
                    {d.incompleto && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        incompleto
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
