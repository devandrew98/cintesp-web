import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, QrCode } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { obterStatusPorToken, registrarPontoPorToken } from '@/data/ponto'
import { TIPO_PONTO_LABEL, formatarHoraPonto } from '@/lib/ponto'
import { mensagemErro } from '@/lib/utils'
import type { ResultadoPonto } from '@/types'

/** Depois de quanto tempo a tela de sucesso volta a mostrar o botão (permite registrar de novo mais tarde). */
const TEMPO_SUCESSO_MS = 5000

/**
 * Página de AUTOATENDIMENTO do ponto — aberta ao ler o QR Code pessoal com
 * a câmera do celular (o QR contém esta URL: /ponto/:token). Não exige
 * login: a autorização é só o token, imprevisível e revogável (ver
 * docs/supabase-ponto-autoatendimento.sql). É pública de propósito — o
 * pesquisador normalmente NÃO está logado no app no celular.
 */
export function RegistrarPontoPage() {
  const { token = '' } = useParams<{ token: string }>()
  const qc = useQueryClient()
  const [resultado, setResultado] = useState<ResultadoPonto | null>(null)

  const statusQuery = useQuery({
    queryKey: ['ponto-status-token', token],
    queryFn: () => obterStatusPorToken(token),
    staleTime: 0,
    retry: false,
  })

  const registrarMut = useMutation({
    mutationFn: () => registrarPontoPorToken(token, 'AUTOATENDIMENTO-CELULAR'),
    onSuccess: (r) => setResultado(r),
  })

  // Volta a mostrar o botão (com o status atualizado) depois de um tempo.
  useEffect(() => {
    if (!resultado) return
    const t = setTimeout(() => {
      setResultado(null)
      qc.invalidateQueries({ queryKey: ['ponto-status-token', token] })
    }, TEMPO_SUCESSO_MS)
    return () => clearTimeout(t)
  }, [resultado, qc, token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo className="h-14 w-auto" />
        </div>

        <div className="card p-6">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Registro de Ponto
          </p>

          {statusQuery.isLoading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
              <p className="text-sm text-slate-500">Verificando seu QR Code…</p>
            </div>
          )}

          {statusQuery.isError && (
            <div className="flex flex-col items-center gap-3 py-6">
              <XCircle className="h-14 w-14 text-red-500" />
              <p className="text-base font-medium text-red-600 dark:text-red-400">
                {mensagemErro(statusQuery.error)}
              </p>
              <p className="text-sm text-slate-500">
                Peça a um administrador para gerar um novo QR Code para você.
              </p>
            </div>
          )}

          {statusQuery.isSuccess && !resultado && (
            <div className="space-y-6">
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  Olá, {statusQuery.data.nome.split(' ')[0]}
                </h1>
                <p className="mt-3 text-sm text-slate-500">Último registro</p>
                {statusQuery.data.ultimoRegistradoEm ? (
                  <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                    {TIPO_PONTO_LABEL[statusQuery.data.ultimoTipo!]} —{' '}
                    {formatarHoraPonto(statusQuery.data.ultimoRegistradoEm)}
                  </p>
                ) : (
                  <p className="text-base text-slate-400">Nenhum registro ainda</p>
                )}
              </div>

              <button
                onClick={() => registrarMut.mutate()}
                disabled={registrarMut.isPending}
                className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 text-lg font-semibold text-white shadow-soft transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {registrarMut.isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <QrCode className="h-5 w-5" />
                    Registrar meu ponto
                  </>
                )}
              </button>

              {registrarMut.isError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
                  {mensagemErro(registrarMut.error)}
                </p>
              )}
            </div>
          )}

          {resultado && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {TIPO_PONTO_LABEL[resultado.tipo]} registrada
              </p>
              <p className="text-sm text-slate-500">
                {new Date(resultado.registradoEm).toLocaleDateString('pt-BR')} às{' '}
                {formatarHoraPonto(resultado.registradoEm)}
              </p>
              <p className="mt-2 text-sm text-slate-400">Registro realizado com sucesso.</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-400">CINTESP.Br — Registro de Ponto</p>
      </div>
    </div>
  )
}
