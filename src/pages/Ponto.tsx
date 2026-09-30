import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LogOut, QrCode, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { listarUsuarios } from '@/data/api'
import { assinarRegistrosPontoMock, PONTO_MOCK_LS_REGISTROS } from '@/data/ponto'
import { supabase, USE_MOCK } from '@/lib/supabase'
import { TIPO_PONTO_LABEL } from '@/lib/ponto'
import { usePermissoes } from '@/hooks/usePermissoes'
import { useAuth } from '@/store/auth'
import type { RegistroPonto } from '@/types'

/** Quanto tempo o resultado de um registro fica na tela antes de voltar a ociosa. */
const TEMPO_RESULTADO_MS = 8000

/**
 * Telão do terminal de ponto (notebook do laboratório).
 *
 * O terminal NÃO lê mais QR Code — quem registra é o próprio pesquisador,
 * pela câmera do celular (ver /ponto/:token). Esta tela só REFLETE, em
 * tempo real, o último registro feito por QUALQUER pesquisador: assina o
 * Realtime do Supabase na tabela `ponto_registros` (ver
 * docs/supabase-ponto-autoatendimento.sql) e mostra "Entrada/Saída
 * registrada" por alguns segundos.
 */
export function PontoPage() {
  const { podeVerTerminalPonto, carregando } = usePermissoes()
  const { sair } = useAuth()

  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios })
  const usuariosRef = useRef(usuarios)
  usuariosRef.current = usuarios

  const [ultimo, setUltimo] = useState<RegistroPonto | null>(null)
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!ultimo) return
    const t = setTimeout(() => setUltimo(null), TEMPO_RESULTADO_MS)
    return () => clearTimeout(t)
  }, [ultimo])

  // Assina os registros ao vivo: Realtime do Supabase, ou (em mock) o
  // barramento local + evento "storage" — permite testar abrindo /ponto
  // numa aba e /ponto/:token noutra, no mesmo navegador.
  useEffect(() => {
    if (!podeVerTerminalPonto) return

    function receber(r: RegistroPonto) {
      const nome = r.usuarioNome ?? usuariosRef.current.find((u) => u.id === r.usuarioId)?.nome
      setUltimo(nome ? { ...r, usuarioNome: nome } : r)
    }

    if (USE_MOCK || !supabase) {
      const cancelar = assinarRegistrosPontoMock(receber)
      function onStorage(e: StorageEvent) {
        if (e.key !== PONTO_MOCK_LS_REGISTROS || !e.newValue) return
        try {
          const lista = JSON.parse(e.newValue) as RegistroPonto[]
          if (lista[0]) receber(lista[0])
        } catch {
          // ignora payload inesperado
        }
      }
      window.addEventListener('storage', onStorage)
      return () => {
        cancelar()
        window.removeEventListener('storage', onStorage)
      }
    }

    const client = supabase // captura já estreitada (não-nula) para o cleanup
    const canal = client
      .channel('ponto-terminal')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ponto_registros' },
        (payload) => {
          const row = payload.new as {
            id: string
            usuario_id: string
            tipo: 'entrada' | 'saida'
            registrado_em: string
            terminal_id: string
            origem: 'qrcode' | 'manual'
            editado: boolean
          }
          receber({
            id: row.id,
            usuarioId: row.usuario_id,
            tipo: row.tipo,
            registradoEm: row.registrado_em,
            terminalId: row.terminal_id,
            origem: row.origem,
            editado: row.editado,
          })
        },
      )
      .subscribe()

    return () => {
      client.removeChannel(canal)
    }
  }, [podeVerTerminalPonto])

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    )
  }

  if (!podeVerTerminalPonto) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <ShieldAlert className="h-14 w-14 text-amber-400" />
        <h1 className="text-xl font-semibold text-white">Terminal não autorizado</h1>
        <p className="max-w-md text-slate-400">
          Esta conta não tem permissão para exibir o terminal de ponto. Peça a um administrador
          para atribuir a função <strong>Terminal Ponto</strong> a esta conta em Administração
          &gt; Funções.
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
      <button
        onClick={() => sair()}
        className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-300"
        title="Sair (manutenção)"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </button>

      {ultimo ? <ResultadoAoVivo registro={ultimo} /> : <TelaOciosa agora={agora} />}
    </div>
  )
}

function TelaOciosa({ agora }: { agora: Date }) {
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
        <QrCode className="h-16 w-16 text-brand-400" />
        <p className="text-xl font-medium text-white">Registro de Ponto — CINTESP</p>
        <p className="max-w-xs text-sm text-slate-500">
          Escaneie seu QR Code pessoal com a câmera do celular para registrar entrada/saída.
        </p>
      </div>
    </>
  )
}

function ResultadoAoVivo({ registro }: { registro: RegistroPonto }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <CheckCircle2 className="h-24 w-24 text-emerald-400" />
      <p className="text-2xl font-semibold text-white">
        {registro.usuarioNome ?? 'Pesquisador'}
      </p>
      <p className="text-lg text-emerald-300">
        {TIPO_PONTO_LABEL[registro.tipo].toUpperCase()} REGISTRADA
      </p>
      <p className="text-4xl font-bold tabular-nums text-white">
        {new Date(registro.registradoEm).toLocaleTimeString('pt-BR')}
      </p>
    </div>
  )
}
