import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { CartaoGrafico, SemDados } from './CartaoGrafico'
import { obterCausaEfeito, salvarCausaEfeito } from '@/data/causaEfeito'
import { CATEGORIAS_CAUSA, MAX_CAUSAS, linhasParaCausas, quebrarTexto, type CategoriaCausa, type CausaEfeito } from '@/lib/graficos'
import { mensagemErro } from '@/lib/utils'

export function GraficoCausaEfeito({ projetoId, podeEditar }: { projetoId: string; podeEditar: boolean }) {
  const qc = useQueryClient()
  const chave = ['causa-efeito', projetoId]
  const { data } = useQuery({ queryKey: chave, queryFn: () => obterCausaEfeito(projetoId) })
  // Rascunho em edição: o efeito e um texto por categoria (uma causa por linha).
  const [rascunho, setRascunho] = useState<{ efeito: string; textos: Partial<Record<CategoriaCausa, string>> } | null>(null)

  const salvar = useMutation({
    mutationFn: (d: CausaEfeito) => salvarCausaEfeito(projetoId, d),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chave })
      setRascunho(null)
    },
  })

  const editar = () =>
    setRascunho({
      efeito: data?.efeito ?? '',
      textos: Object.fromEntries(CATEGORIAS_CAUSA.map((c) => [c.id, (data?.causas[c.id] ?? []).join('\n')])),
    })
  const enviar = () =>
    rascunho &&
    salvar.mutate({
      efeito: rascunho.efeito.trim(),
      causas: Object.fromEntries(CATEGORIAS_CAUSA.map((c) => [c.id, linhasParaCausas(rascunho.textos[c.id] ?? '')])),
    })

  const vazio = !data?.efeito && !CATEGORIAS_CAUSA.some((c) => data?.causas[c.id]?.length)

  return (
    <CartaoGrafico
      titulo="Gráfico de causa e efeito (Ishikawa)"
      comoLer="comece pela “cabeça” do peixe, à direita: é o problema analisado. Cada “espinha” é um tipo de causa (método, mão de obra, material, medida, meio ambiente, máquina) e os traços nela são causas concretas. Para achar a causa raiz, pergunte “por que isso acontece?” sobre cada uma; as que se repetem merecem atenção primeiro."
      acao={
        podeEditar && !rascunho ? (
          <Button variant="secondary" size="sm" icon={Pencil} onClick={editar}>
            {vazio ? 'Montar' : 'Editar'}
          </Button>
        ) : undefined
      }
    >
      {rascunho ? (
        <div className="space-y-4">
          <Field label="Efeito (o problema analisado)">
            <Input value={rascunho.efeito} onChange={(e) => setRascunho({ ...rascunho, efeito: e.target.value })} placeholder="Ex.: Atraso nos testes do protótipo" autoFocus />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIAS_CAUSA.map((c) => (
              <Field key={c.id} label={c.label} hint={`Uma causa por linha (até ${MAX_CAUSAS}).`}>
                <Textarea value={rascunho.textos[c.id] ?? ''} onChange={(e) => setRascunho({ ...rascunho, textos: { ...rascunho.textos, [c.id]: e.target.value } })} />
              </Field>
            ))}
          </div>
          {salvar.error != null && <p className="text-sm text-red-500">{mensagemErro(salvar.error)}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRascunho(null)}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={salvar.isPending || !rascunho.efeito.trim()}>
              {salvar.isPending ? 'Salvando…' : 'Salvar gráfico'}
            </Button>
          </div>
        </div>
      ) : vazio || !data ? (
        <SemDados>Nenhuma análise registrada ainda.{podeEditar ? ' Use “Montar” para informar o problema e as causas.' : ''}</SemDados>
      ) : (
        <div className="overflow-x-auto">
          <Espinha dados={data} />
        </div>
      )}
    </CartaoGrafico>
  )
}

/** Desenho da espinha de peixe: 3 categorias em cima, 3 embaixo, e o efeito na cabeça. */
function Espinha({ dados }: { dados: CausaEfeito }) {
  const efeito = quebrarTexto(dados.efeito || 'Efeito', 16, 5)
  const resumo = `Causa e efeito: ${dados.efeito}. ${CATEGORIAS_CAUSA.map((c) => `${c.label}: ${(dados.causas[c.id] ?? []).join('; ') || 'sem causas'}`).join('. ')}`
  return (
    <svg viewBox="0 0 960 480" className="h-auto w-full min-w-[760px]" role="img" aria-label={resumo}>
      <path d="M20 190 L80 240 L20 290 L40 240 Z" className="fill-brand-600" />
      <line x1="55" y1="240" x2="760" y2="240" className="stroke-brand-600" strokeWidth="6" />
      <path d="M750 150 L900 150 Q950 240 900 330 L750 330 Z" className="fill-brand-600" />
      {efeito.map((linha, i) => (
        <text key={i} x="835" y={240 + (i - (efeito.length - 1) / 2) * 20 + 5} textAnchor="middle" className="fill-white text-[15px] font-semibold">
          {linha}
        </text>
      ))}
      {CATEGORIAS_CAUSA.map((c, i) => {
        const emCima = i < 3
        const x = 230 + (i % 3) * 230
        const yRotulo = emCima ? 24 : 456
        const yFim = emCima ? 44 : 436
        const causas = dados.causas[c.id] ?? []
        return (
          <g key={c.id}>
            <line x1={x - 60} y1={yFim} x2={x + 20} y2="240" className="stroke-slate-400" strokeWidth="2" />
            <rect x={x - 130} y={yRotulo - 18} width="140" height="36" rx="8" className="fill-brand-600" />
            <text x={x - 60} y={yRotulo + 5} textAnchor="middle" className="fill-white text-[14px] font-semibold">
              {c.label}
            </text>
            {causas.map((causa, j) => {
              // Distribui as causas ao longo da espinha, longe do rótulo e da linha central.
              const t = (j + 1) / (MAX_CAUSAS + 1)
              const y = yFim + (240 - yFim) * t
              const px = x - 60 + 80 * t
              return (
                <g key={j}>
                  <title>{causa}</title>
                  <line x1={px - 14} y1={y} x2={px} y2={y} className="stroke-slate-400" strokeWidth="2" />
                  {quebrarTexto(causa, 24, 2).map((linha, k, todas) => (
                    <text key={k} x={px - 18} y={y + 4 + (k - (todas.length - 1) / 2) * 13} textAnchor="end" className="fill-slate-700 text-[12px] dark:fill-slate-200">
                      {linha}
                    </text>
                  ))}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
