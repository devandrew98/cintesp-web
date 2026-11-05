import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Users2, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { PersonRow } from "@/components/ui/PersonRow";
import { ProgramacaoCard, useEventosHoje } from "@/components/agenda/Programacao";
import { listarUsuarios } from "@/data/api";

const dataHojeRaw = new Date().toLocaleDateString("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});
// "quinta-feira, 23 de julho de 2026" → "Quinta-feira, 23 de julho de 2026"
const dataHoje = dataHojeRaw.charAt(0).toUpperCase() + dataHojeRaw.slice(1);

/**
 * Tela "Agenda do Dia".
 * Programação da equipe (agenda própria, cadastrada pelo administrador) + um
 * retrato da disponibilidade atual (quem está livre e quem está em home-office).
 */
export function AgendaPage() {
  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: listarUsuarios,
  });
  const eventosHoje = useEventosHoje();

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
  // Quem está em turno de home-office agora (definido no horário do pesquisador).
  const homeOffice = useMemo(
    () => ativos.filter((u) => u.disponibilidade === "home_office"),
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
          value={eventosHoje}
          label="Eventos hoje"
          accent="violet"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Programação da equipe (agenda própria; só o admin cadastra) */}
        <ProgramacaoCard className="lg:col-span-2" />

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
                {homeOffice.length}
              </span>
            }
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {homeOffice.slice(0, 5).map((u) => (
                <PersonRow key={u.id} usuario={u} showLivreAte />
              ))}
              {homeOffice.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-slate-400">
                  Ninguém em home-office agora.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
