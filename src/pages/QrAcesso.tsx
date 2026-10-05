import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QrCode, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { QrPontoModal } from '@/components/admin/QrPontoModal'
import { listarUsuarios } from '@/data/api'
import { listarStatusQr } from '@/data/ponto'
import type { Usuario } from '@/types'

/**
 * "QR de Acesso" — busca o pesquisador pelo nome e abre o modal que gera,
 * mostra ou revoga o QR Code usado para registrar a chegada. Visível só para
 * administradores e para o perfil de registro de ponto (permissão
 * `registrar_ponto`).
 */
export function QrAcessoPage() {
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<Usuario | null>(null)

  const { data: usuarios = [], isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })
  const { data: statusLista = [] } = useQuery({ queryKey: ['ponto-qr-status'], queryFn: listarStatusQr })

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return usuarios
      .filter((u) => !q || u.nome.toLowerCase().includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [usuarios, busca])

  return (
    <div>
      <PageHeader
        title="QR de Acesso"
        subtitle="Pesquise o pesquisador pelo nome para gerar ou consultar o QR Code de registro de chegada."
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pesquisador pelo nome…"
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        {isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Carregando…</p>
        ) : filtrados.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Nenhum pesquisador encontrado.</p>
        ) : (
          filtrados.map((u) => {
            const ativo = statusLista.find((s) => s.usuarioId === u.id)?.ativo
            return (
              <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar nome={u.nome} fotoUrl={u.fotoUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">{u.nome}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {ativo && (
                    <span className="hidden rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 sm:inline dark:bg-emerald-500/15 dark:text-emerald-300">
                      QR ativo
                    </span>
                  )}
                  <button
                    onClick={() => setSelecionado(u)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                  >
                    <QrCode className="h-4 w-4" />
                    QR Code
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <QrPontoModal usuario={selecionado} open={Boolean(selecionado)} onClose={() => setSelecionado(null)} />
    </div>
  )
}
