import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cake } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Avatar } from "@/components/ui/Avatar";
import { AniversarioModal, type AniversarianteSelecionado } from "@/components/dashboard/AniversarioModal";
import { usePermissoes } from "@/hooks/usePermissoes";
import type { Usuario } from "@/types";

/** Aniversariantes do mês (data de nascimento do perfil). Clicar abre o modal de parabéns pelo WhatsApp. */
export function AniversariantesCard({ ativos, className }: { ativos: Usuario[]; className?: string }) {
  const [aniversAberto, setAniversAberto] = useState(false);
  const [aniversSelecionado, setAniversSelecionado] = useState<AniversarianteSelecionado | null>(null);
  const { ehAdmin } = usePermissoes();

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const diaAtual = hoje.getDate();
  const mesNome = hoje.toLocaleDateString("pt-BR", { month: "long" });
  const aniversariantes = useMemo(
    () =>
      ativos
        .filter((u) => u.dataNascimento)
        .map((u) => ({ u, mes: Number(u.dataNascimento!.slice(5, 7)), dia: Number(u.dataNascimento!.slice(8, 10)) }))
        .filter((x) => x.mes === mesAtual)
        .sort((a, b) => a.dia - b.dia),
    [ativos, mesAtual],
  );

  return (
    <>
    <SectionCard
      className={className}
      title={
        <span className="flex items-center gap-2">
          <Cake className="h-4 w-4 text-brand-600" />
          Aniversariantes do mês
        </span>
      }
      action={
        aniversariantes.length > 0 ? (
          <button
            onClick={() => setAniversAberto((v) => !v)}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            {aniversAberto ? "Ver bolinhas" : "Ver lista"}
          </button>
        ) : undefined
      }
    >
      {aniversariantes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
          <Cake className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 first-letter:uppercase">
            Ninguém faz aniversário em {mesNome}.
          </p>
          <p className="text-xs text-slate-400">
            Cadastre sua data em{" "}
            <Link to="/meu-horario" className="font-medium text-brand-600 hover:underline">
              Meu Perfil
            </Link>
            .
          </p>
        </div>
      ) : aniversAberto ? (
        // ----- Lista aberta -----
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {aniversariantes.map(({ u, dia, mes }) => {
            const ehHoje = dia === diaAtual;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setAniversSelecionado({ u, dia, mes })}
                className="flex w-full items-center gap-3 rounded-xl py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <Avatar nome={u.nome} fotoUrl={u.fotoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {u.nome}
                  </p>
                  <p className="truncate text-xs text-slate-400">{u.funcao?.nome}</p>
                </div>
                {ehHoje ? (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    Hoje 🎉
                  </span>
                ) : (
                  <span className="shrink-0 text-sm font-medium text-slate-500">
                    {String(dia).padStart(2, "0")}/{String(mesAtual).padStart(2, "0")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        // ----- Bolinhas flutuando (clique abre a lista) -----
        <button
          type="button"
          onClick={() => setAniversAberto(true)}
          className="group flex w-full flex-col items-center gap-4 px-2 py-6"
          aria-label="Ver lista de aniversariantes"
        >
          <div className="flex min-h-[64px] flex-wrap items-center justify-center gap-3">
            {aniversariantes.slice(0, 6).map(({ u, dia, mes }, i) => (
              <span
                key={u.id}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setAniversSelecionado({ u, dia, mes });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    setAniversSelecionado({ u, dia, mes });
                  }
                }}
                className="animate-flutua cursor-pointer"
                style={{ animationDelay: `${i * 0.22}s` }}
                title={`${u.nome} — ${String(dia).padStart(2, "0")}/${String(mesAtual).padStart(2, "0")}`}
              >
                <Avatar
                  nome={u.nome}
                  fotoUrl={u.fotoUrl}
                  size="md"
                  className={`shadow-soft ring-2 ${
                    dia === diaAtual
                      ? "ring-brand-400 dark:ring-brand-500"
                      : "ring-white dark:ring-slate-800"
                  }`}
                />
              </span>
            ))}
            {aniversariantes.length > 6 && (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                +{aniversariantes.length - 6}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            🎂 {aniversariantes.length}{" "}
            {aniversariantes.length === 1 ? "aniversariante" : "aniversariantes"}
            {aniversariantes.some((a) => a.dia === diaAtual) && (
              <span className="ml-1 text-brand-600">· alguém faz hoje!</span>
            )}
          </p>
          <span className="text-xs text-slate-400 group-hover:text-brand-600">
            Clique para ver a lista
          </span>
        </button>
      )}
    </SectionCard>
      <AniversarioModal aniversariante={aniversSelecionado} ehAdmin={ehAdmin} onClose={() => setAniversSelecionado(null)} />
    </>
  );
}
