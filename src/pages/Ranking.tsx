import { useQuery } from '@tanstack/react-query'
import { Crown, Flame, Loader2, Trophy } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { listarRankingMensal, type PosicaoRanking } from '@/data/ponto'
import { usePermissoes } from '@/hooks/usePermissoes'
import { cn } from '@/lib/utils'

/** Dias que faltam para o ranking fechar (último dia do mês conta como "hoje"). */
function diasParaEncerrar(agora = new Date()): number {
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  return Math.round((ultimo.getTime() - hoje.getTime()) / 86_400_000)
}

function textoPrazo(dias: number): string {
  if (dias === 0) return 'Último dia! Corre que hoje fecha 🏁'
  if (dias === 1) return 'Falta só 1 dia pro ranking fechar'
  return `Faltam ${dias} dias pro ranking fechar`
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/**
 * Ranking mensal de horas — competição amistosa. Mostra só posição, nome e
 * foto: nunca as horas de ninguém nem dados pessoais (a conta é feita no banco).
 */
export function RankingPage() {
  const { perfil } = usePermissoes()

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ['ranking-mensal', perfil?.id],
    queryFn: () => listarRankingMensal(perfil?.id),
    refetchInterval: 60_000, // vai se mexendo enquanto o pessoal bate o ponto
  })

  const top10 = ranking.filter((p) => p.posicao <= 10)
  const podio = top10.slice(0, 3)
  const resto = top10.slice(3)
  const euFora = ranking.find((p) => p.posicao > 10 && p.usuarioId === perfil?.id)
  const euNoTop = top10.find((p) => p.usuarioId === perfil?.id)

  const agora = new Date()
  const dias = diasParaEncerrar(agora)

  return (
    <div>
      <PageHeader
        title="Ranking do mês"
        subtitle={`A disputa de ${MESES[agora.getMonth()]} tá rolando! Quanto mais tempo no laboratório, mais você sobe.`}
      />

      {/* Prazo */}
      <div
        className={cn(
          'mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium',
          dias <= 3
            ? 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300'
            : 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300',
        )}
      >
        <Flame className={cn('h-5 w-5 shrink-0', dias <= 3 && 'animate-pulse')} />
        {textoPrazo(dias)}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : top10.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Trophy className="h-10 w-10 text-slate-300" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Ninguém pontuou ainda</h2>
          <p className="max-w-sm text-sm text-slate-500">
            Bate seu ponto no QR Code e seja o primeiro a aparecer no pódio deste mês!
          </p>
        </div>
      ) : (
        <>
          {euNoTop && (
            <p className="mb-4 text-center text-sm font-medium text-brand-700 dark:text-brand-300">
              {mensagemPosicao(euNoTop.posicao)}
            </p>
          )}

          <Podio podio={podio} euId={perfil?.id} />

          {resto.length > 0 && (
            <ol className="mx-auto mt-8 max-w-2xl space-y-2">
              {resto.map((p, i) => (
                <li
                  key={p.usuarioId}
                  style={{ animationDelay: `${1.1 + i * 0.1}s` }}
                  className={cn(
                    'card flex animate-entra-linha items-center gap-4 px-4 py-3',
                    p.usuarioId === perfil?.id && 'ring-2 ring-brand-500',
                  )}
                >
                  <span className="w-8 text-center text-lg font-bold text-slate-400">{p.posicao}º</span>
                  <Avatar nome={p.nome} fotoUrl={p.fotoUrl} size="md" />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                    {p.nome}
                    {p.usuarioId === perfil?.id && <span className="ml-2 text-xs text-brand-600">(você)</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {euFora && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-700">
              Você tá em <strong className="text-slate-800 dark:text-slate-100">{euFora.posicao}º</strong> lugar. Bora
              subir mais! 💪
            </div>
          )}
        </>
      )}
    </div>
  )
}

function mensagemPosicao(pos: number): string {
  if (pos === 1) return '👑 Você tá liderando! Segura aí!'
  if (pos <= 3) return `🔥 Você tá no pódio, em ${pos}º! Quase lá!`
  return `Você tá em ${pos}º no ranking, tá bonito!`
}

const ESTILO_PODIO = {
  1: {
    altura: 'h-40 sm:h-52',
    degrau: 'from-yellow-300 to-amber-500',
    anel: 'ring-yellow-400',
    delay: '0.5s',
    rotulo: '1º',
  },
  2: {
    altura: 'h-28 sm:h-40',
    degrau: 'from-slate-200 to-slate-400',
    anel: 'ring-slate-300',
    delay: '0.25s',
    rotulo: '2º',
  },
  3: {
    altura: 'h-20 sm:h-32',
    degrau: 'from-orange-300 to-amber-700',
    anel: 'ring-orange-400',
    delay: '0s',
    rotulo: '3º',
  },
} as const

function Podio({ podio, euId }: { podio: PosicaoRanking[]; euId?: string }) {
  // Ordem visual: 2º | 1º | 3º
  const ordem = [podio[1], podio[0], podio[2]]
  return (
    <div className="mx-auto flex max-w-2xl items-end justify-center gap-2 sm:gap-4">
      {ordem.map((p, idx) => {
        if (!p) return <div key={`vazio-${idx}`} className="flex-1" />
        const e = ESTILO_PODIO[p.posicao as 1 | 2 | 3]
        const primeiro = p.posicao === 1
        return (
          <div key={p.usuarioId} className="flex min-w-0 flex-1 flex-col items-center">
            <div
              className="flex animate-sobe-podio flex-col items-center"
              style={{ animationDelay: e.delay }}
            >
              {primeiro && <Crown className="mb-1 h-8 w-8 animate-coroa text-yellow-400 drop-shadow" />}
              <div
                className={cn(
                  'rounded-full ring-4',
                  e.anel,
                  primeiro && 'animate-brilho',
                  p.usuarioId === euId && 'ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
                )}
              >
                <Avatar
                  nome={p.nome}
                  fotoUrl={p.fotoUrl}
                  size="lg"
                  className={primeiro ? 'h-20 w-20 text-xl sm:h-24 sm:w-24' : 'h-16 w-16 sm:h-20 sm:w-20'}
                />
              </div>
              <p className="mt-2 w-full max-w-[9rem] truncate text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
                {p.nome.split(' ')[0]}
              </p>
              <p className="mb-2 hidden w-full max-w-[10rem] truncate text-center text-xs text-slate-400 sm:block">
                {p.nome}
              </p>
            </div>
            <div
              style={{ animationDelay: e.delay }}
              className={cn(
                'flex w-full animate-sobe-podio items-start justify-center rounded-t-2xl bg-gradient-to-b pt-3 text-3xl font-black text-white shadow-lg',
                e.altura,
                e.degrau,
              )}
            >
              {e.rotulo}
            </div>
          </div>
        )
      })}
    </div>
  )
}
