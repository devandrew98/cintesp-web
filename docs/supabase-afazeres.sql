-- ============================================================
-- CINTESP WEB — Meus Afazeres (agenda pessoal, tarefas e anotações)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase DEPOIS de docs/supabase-agenda-equipe.sql
-- e docs/supabase-projetos-tarefas.sql. É idempotente.
--
-- Regras:
--   • Compromissos pessoais ficam na tabela de eventos da agenda (`agenda_eventos`)
--     com `dono_id`. PRIVADOS por padrão: só o dono vê. Marcados como 'publica',
--     todos veem (aparecem na Programação geral com o nome do dono).
--   • Eventos oficiais (dono_id nulo): todos leem, só o admin grava (como antes).
--   • Tarefas particulares e anotações: SOMENTE o dono lê e grava
--     (nem o administrador enxerga).
-- ============================================================

-- ---------- Compromissos pessoais ----------
alter table public.agenda_eventos
  add column if not exists dono_id uuid references public.usuarios (id) on delete cascade;
alter table public.agenda_eventos
  add column if not exists visibilidade text not null default 'publica';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agenda_eventos_visibilidade_check') then
    alter table public.agenda_eventos
      add constraint agenda_eventos_visibilidade_check check (visibilidade in ('privada', 'publica'));
  end if;
end $$;

create index if not exists idx_agenda_eventos_dono on public.agenda_eventos (dono_id);

-- Troca as políticas antigas (leitura livre / só admin grava) pelas novas.
drop policy if exists "agenda_eventos: leitura"     on public.agenda_eventos;
drop policy if exists "agenda_eventos: admin gere"  on public.agenda_eventos;
drop policy if exists "agenda_eventos: ler"         on public.agenda_eventos;
drop policy if exists "agenda_eventos: criar"       on public.agenda_eventos;
drop policy if exists "agenda_eventos: editar"      on public.agenda_eventos;
drop policy if exists "agenda_eventos: excluir"     on public.agenda_eventos;

-- Ler: oficiais, os meus e os públicos de outras pessoas. Privados alheios: nunca.
create policy "agenda_eventos: ler" on public.agenda_eventos
  for select to authenticated
  using (dono_id is null or dono_id = auth.uid() or visibilidade = 'publica');

-- Criar: oficial (só admin) ou pessoal (só em meu nome).
create policy "agenda_eventos: criar" on public.agenda_eventos
  for insert to authenticated
  with check ((dono_id is null and public.is_admin()) or dono_id = auth.uid());

create policy "agenda_eventos: editar" on public.agenda_eventos
  for update to authenticated
  using ((dono_id is null and public.is_admin()) or dono_id = auth.uid())
  with check ((dono_id is null and public.is_admin()) or dono_id = auth.uid());

create policy "agenda_eventos: excluir" on public.agenda_eventos
  for delete to authenticated
  using ((dono_id is null and public.is_admin()) or dono_id = auth.uid());

-- ---------- Tarefas particulares ----------
create table if not exists public.afazeres_tarefas (
  id           uuid primary key default gen_random_uuid(),
  dono_id      uuid not null references public.usuarios (id) on delete cascade,
  titulo       text not null check (length(btrim(titulo)) > 0),
  descricao    text,
  status       text not null default 'nao_iniciado'
               check (status in ('nao_iniciado', 'em_andamento', 'aguardando', 'concluido')),
  prioridade   text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  data_entrega date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_afazeres_tarefas_dono on public.afazeres_tarefas (dono_id, data_entrega);

-- ---------- Anotações ----------
create table if not exists public.afazeres_notas (
  id          uuid primary key default gen_random_uuid(),
  dono_id     uuid not null references public.usuarios (id) on delete cascade,
  titulo      text not null default '',
  texto       text not null default '',
  fixada      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint afazeres_notas_conteudo check (length(btrim(titulo)) > 0 or length(btrim(texto)) > 0)
);

create index if not exists idx_afazeres_notas_dono on public.afazeres_notas (dono_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_afazeres_tarefas_updated_at on public.afazeres_tarefas;
create trigger trg_afazeres_tarefas_updated_at
  before update on public.afazeres_tarefas
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_afazeres_notas_updated_at on public.afazeres_notas;
create trigger trg_afazeres_notas_updated_at
  before update on public.afazeres_notas
  for each row execute function public.touch_updated_at();

alter table public.afazeres_tarefas enable row level security;
alter table public.afazeres_notas   enable row level security;

drop policy if exists "afazeres_tarefas: dono" on public.afazeres_tarefas;
create policy "afazeres_tarefas: dono" on public.afazeres_tarefas
  for all to authenticated
  using (dono_id = auth.uid())
  with check (dono_id = auth.uid());

drop policy if exists "afazeres_notas: dono" on public.afazeres_notas;
create policy "afazeres_notas: dono" on public.afazeres_notas
  for all to authenticated
  using (dono_id = auth.uid())
  with check (dono_id = auth.uid());

grant select, insert, update, delete on public.afazeres_tarefas to authenticated;
grant select, insert, update, delete on public.afazeres_notas   to authenticated;

notify pgrst, 'reload schema';
