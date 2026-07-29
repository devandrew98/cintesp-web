import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Users2, CalendarClock, Clock3, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { envVar } from "@/lib/env";
import { PersonRow } from "@/components/ui/PersonRow";
import { Badge } from "@/components/ui/Badge";
import { listarUsuarios, listarMudancas } from "@/data/api";

const dataHojeRaw = new Date().toLocaleDateString("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});
// "quinta-feira, 23 de julho de 2026" → "Quinta-feira, 23 de julho de 2026"
const dataHoje = dataHojeRaw.charAt(0).toUpperCase() + dataHojeRaw.slice(1);

/**
 * Tela "Agenda do Dia" (Fase 5).
 * Linha do tempo das mudanças de turno do dia + um retrato da disponibilidade
 * atual (quem está livre e até quando, e quem está em atendimento).
 */
export function AgendaPage() {
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listarUsuarios,
  });
  const { data: mudancas = [] } = useQuery({
    queryKey: ["mudancas"],
    queryFn: listarMudancas,
  });

  const ativos = useMemo(
    () => usuarios.filter((u) => u.status === "ativo"),
    [usuarios],
  );

  // Disponíveis ordenados por quem sai mais cedo (livreAte); "dia todo" por último.
  const disponiveis = useMemo(
    () =>
      ativos
        .filter((u) => u.disponibilidade === "disponivel")
        .sort((a, b) =>
          (a.livreAte ?? "99:99").localeCompare(b.livreAte ?? "99:99"),
        ),
    [ativos],
  );
  const emAtendimento = useMemo(
    () => ativos.filter((u) => u.disponibilidade === "parcial" || u.disponibilidade === "home_office"),
    [ativos],
  );

  return (
    <div>
      <PageHeader title="Agenda do Dia" subtitle={dataHoje} />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={CheckCircle2}
          value={disponiveis.length}
          label="Disponíveis agora"
          accent="green"
        />
        <StatCard
          icon={Users2}
          value={emAtendimento.length}
          label="Em atendimento"
          accent="blue"
        />
        <StatCard
          icon={CalendarClock}
          value={mudancas.length}
          label="Mudanças hoje"
          accent="violet"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Linha do tempo das mudanças */}
        <SectionCard
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-500" />
              Linha do tempo do dia
            </span>
          }
          bodyClassName="p-5"
        >
          {mudancas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhuma mudança de turno hoje.
            </p>
          ) : (
            <ol className="space-y-1">
              {mudancas.map((m, i) => (
                <li key={m.id} className="flex gap-4">
                  {/* Rail com bolinha */}
                  <div className="flex flex-col items-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      <Clock3 className="h-4 w-4" />
                    </span>
                    {i < mudancas.length - 1 && (
                      <span className="my-1 w-px flex-1 bg-slate-100 dark:bg-slate-800" />
                    )}
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {m.descricao}
                      </p>
                      <Badge tone="slate">{m.tag}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{m.quando}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* ---------- Agenda do Google ---------- */}
          {/* Mostra o calendário da equipe embutido, logo abaixo da linha do
              tempo. O endereço fica em VITE_GOOGLE_CALENDAR_URL para cada
              instalação apontar para a sua própria agenda. */}
          <AgendaGoogle />
        </SectionCard>

        {/* Disponibilidade agora */}
        <div className="space-y-6">
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                Disponíveis agora
              </span>
            }
            action={
              <span className="text-sm font-medium text-brand-600">
                {disponiveis.length}
              </span>
            }
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {disponiveis.slice(0, 6).map((u) => (
                <PersonRow key={u.id} usuario={u} showLivreAte />
              ))}
              {disponiveis.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-slate-400">
                  Ninguém disponível.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Home-Office
              </span>
            }
            action={
              <span className="text-sm font-medium text-amber-600">
                {emAtendimento.length}
              </span>
            }
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {emAtendimento.slice(0, 5).map((u) => (
                <PersonRow key={u.id} usuario={u} compactStatus />
              ))}
              {emAtendimento.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-slate-400">
                  Ninguém em atendimento.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/**
 * Calendário do Google embutido.
 *
 * O endereço vem da variável `VITE_GOOGLE_CALENDAR_URL`. Se ela não estiver
 * configurada, explicamos como preencher em vez de mostrar um quadro vazio.
 */
function AgendaGoogle() {
  const url = envVar('VITE_GOOGLE_CALENDAR_URL')?.trim()

  return (
    <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <CalendarDays className="h-4 w-4 text-slate-400" />
        Agenda do Google
      </h3>

      {url ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <iframe
            src={url}
            title="Agenda do Google da equipe"
            className="h-[600px] w-full"
            style={{ border: 0 }}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-700">
          <p className="font-medium text-slate-700 dark:text-slate-200">
            Calendário ainda não configurado
          </p>
          <p className="mt-1">
            Defina a variável <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">VITE_GOOGLE_CALENDAR_URL</code>{' '}
            com o endereço de incorporação da agenda. No Google Agenda:{' '}
            <em>Configurações → sua agenda → Integrar agenda → Incorporar código</em>, e copie
            apenas o valor do <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">src</code>.
          </p>
        </div>
      )}
    </div>
  )
}
