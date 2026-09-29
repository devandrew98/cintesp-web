import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { LogOut, QrCode, CheckCircle2, XCircle, ShieldAlert, Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { registrarPontoPorToken } from '@/data/ponto'
import { TIPO_PONTO_LABEL } from '@/lib/ponto'
import { mensagemErro } from '@/lib/utils'
import { envVar } from '@/lib/env'
import { usePermissoes } from '@/hooks/usePermissoes'
import { useAuth } from '@/store/auth'
import type { ResultadoPonto } from '@/types'

/** Identifica este terminal físico. Único notebook hoje — fixo por enquanto. */
const TERMINAL_ID = envVar('VITE_PONTO_TERMINAL_ID')?.trim() || 'CINTESP-PONTO-001'

/** Quanto tempo a tela de resultado (sucesso/erro) fica visível antes de voltar a ler. */
const TEMPO_RESULTADO_MS = 4000

/**
 * Tela EXCLUSIVA do terminal de ponto (kiosk).
 *
 * Fica sozinha, sem o menu/sidebar do resto do app — é a única coisa que o
 * notebook da recepção mostra, o dia inteiro, logado como a conta
 * "PONTO"/"Terminal Ponto". Um leitor de QR Code USB funciona como teclado:
 * ele "digita" o token e manda Enter — por isso a tela mantém um campo de
 * texto invisível sempre focado, em vez de usar a câmera.
 *
 * O front NUNCA decide se é entrada ou saída, nem manda horário: só envia o
 * token lido; quem responde tudo isso é o banco (ver docs/supabase-ponto.sql).
 */
export function PontoPage() {
  const { podeRegistrarPonto, carregando } = usePermissoes()
  const { sair } = useAuth()

  const [resultado, setResultado] = useState<ResultadoPonto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [buffer, setBuffer] = useState('')
  const [agora, setAgora] = useState(() => new Date())
  const inputRef = useRef<HTMLInputElement>(null)

  const registrarMut = useMutation({
    mutationFn: (token: string) => registrarPontoPorToken(token, TERMINAL_ID),
    onSuccess: (r) => {
      setResultado(r)
      setErro(null)
    },
    onError: (e) => {
      setErro(mensagemErro(e))
      setResultado(null)
    },
  })

  // Relógio da tela ociosa.
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Some com o resultado (sucesso ou erro) depois de um tempo e volta a ler.
  useEffect(() => {
    if (!resultado && !erro) return
    const t = setTimeout(() => {
      setResultado(null)
      setErro(null)
    }, TEMPO_RESULTADO_MS)
    return () => clearTimeout(t)
  }, [resultado, erro])

  // Mantém o campo de leitura sempre focado (o leitor USB "digita" nele).
  useEffect(() => {
    if (!podeRegistrarPonto) return
    const focar = () => inputRef.current?.focus()
    focar()
    const t = setInterval(focar, 1500)
    window.addEventListener('click', focar)
    return () => {
      clearInterval(t)
      window.removeEventListener('click', focar)
    }
  }, [podeRegistrarPonto, resultado, erro])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const token = buffer.trim()
    setBuffer('')
    if (!token || registrarMut.isPending) return
    registrarMut.mutate(token)
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    )
  }

  if (!podeRegistrarPonto) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <ShieldAlert className="h-14 w-14 text-amber-400" />
        <h1 className="text-xl font-semibold text-white">Terminal não autorizado</h1>
        <p className="max-w-md text-slate-400">
          Esta conta não tem permissão para registrar ponto. Peça a um administrador para atribuir a
          função <strong>Terminal Ponto</strong> a esta conta em Administração &gt; Funções.
        </p>
        <button
          onClick={() => sair()}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
        >
          <LogOut className="h-4 w-4" />
          Trocar de conta
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-center">
      {/* Campo invisível: recebe o que o leitor USB "digita". */}
      <input
        ref={inputRef}
        value={buffer}
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        aria-hidden
        tabIndex={-1}
      />

      <button
        onClick={() => sair()}
        className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-300"
        title="Sair (manutenção)"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </button>

      {resultado ? (
        <ResultadoSucesso resultado={resultado} />
      ) : erro ? (
        <ResultadoErro mensagem={erro} />
      ) : (
        <TelaOciosa pendente={registrarMut.isPending} agora={agora} />
      )}
    </div>
  )
}

function TelaOciosa({ pendente, agora }: { pendente: boolean; agora: Date }) {
  return (
    <>
      <BrandLogo className="mb-8 h-16 w-auto brightness-0 invert" />
      <div className="mb-2 text-7xl font-bold tabular-nums text-white">
        {agora.toLocaleTimeString('pt-BR')}
      </div>
      <div className="mb-10 text-lg capitalize text-slate-400">
        {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
      </div>
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-800 bg-slate-900/60 px-12 py-10">
        {pendente ? (
          <Loader2 className="h-16 w-16 animate-spin text-brand-400" />
        ) : (
          <QrCode className="h-16 w-16 text-brand-400" />
        )}
        <p className="text-xl font-medium text-white">
          {pendente ? 'Registrando…' : 'Aproxime seu QR Code do leitor'}
        </p>
        <p className="text-sm text-slate-500">Registro de Ponto — CINTESP</p>
      </div>
    </>
  )
}

function ResultadoSucesso({ resultado }: { resultado: ResultadoPonto }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <CheckCircle2 className="h-24 w-24 text-emerald-400" />
      <p className="text-2xl font-semibold text-white">Olá, {resultado.nome}!</p>
      <p className="text-lg text-emerald-300">
        {TIPO_PONTO_LABEL[resultado.tipo]} registrada às{' '}
        {new Date(resultado.registradoEm).toLocaleTimeString('pt-BR')}
      </p>
    </div>
  )
}

function ResultadoErro({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <XCircle className="h-24 w-24 text-red-400" />
      <p className="max-w-md text-lg font-medium text-red-300">{mensagem}</p>
    </div>
  )
}
