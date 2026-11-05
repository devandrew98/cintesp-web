-- ============================================================
-- CINTESP WEB — Agenda da equipe + Home-Office por turno
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente (pode rodar de novo).
--
-- 1) Agenda da equipe (substitui o Google Agenda embutido)
--      • QUALQUER usuário logado LÊ os eventos.
--      • Apenas ADMINISTRADORES (is_admin) criam, editam e excluem.
--
-- 2) Home-Office por turno (aba Horários do pesquisador)
--      • Cada turno (manhã/tarde) de cada dia passa a ter um local:
--        'arena' (padrão) ou 'home_office'.
-- ============================================================

-- ---------- 1) Eventos da agenda ----------
create table if not exists public.agenda_eventos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (length(btrim(titulo)) > 0),
  descricao    text,
  local        text,
  link_video   text,
  data         date not null,                        -- primeiro dia
  data_fim     date,                                  -- último dia (eventos de vários dias)
  dia_inteiro  boolean not null default true,
  hora_inicio  time,
  hora_fim     time,
  repeticao    text not null default 'nunca'
               check (repeticao in ('nunca','diaria','semanal','mensal','anual','dias_uteis')),
  repete_ate   date,                                  -- fim da repetição (null = para sempre)
  criado_por   uuid references public.usuarios (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint agenda_eventos_datas_ok check (data_fim is null or data_fim >= data),
  constraint agenda_eventos_horas_ok check (dia_inteiro or (hora_inicio is not null and hora_fim is not null))
);

create index if not exists idx_agenda_eventos_data on public.agenda_eventos (data);

-- updated_at automático (reaproveita touch_updated_at; cria se faltar).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_agenda_eventos_updated_at on public.agenda_eventos;
create trigger trg_agenda_eventos_updated_at
  before update on public.agenda_eventos
  for each row execute function public.touch_updated_at();

alter table public.agenda_eventos enable row level security;

drop policy if exists "agenda_eventos: leitura" on public.agenda_eventos;
create policy "agenda_eventos: leitura" on public.agenda_eventos
  for select to authenticated using (true);

drop policy if exists "agenda_eventos: admin gere" on public.agenda_eventos;
create policy "agenda_eventos: admin gere" on public.agenda_eventos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.agenda_eventos to authenticated;

-- ---------- 2) Home-Office por turno ----------
alter table public.horarios add column if not exists manha_local text not null default 'arena';
alter table public.horarios add column if not exists tarde_local text not null default 'arena';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'horarios_manha_local_check') then
    alter table public.horarios add constraint horarios_manha_local_check check (manha_local in ('arena','home_office'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'horarios_tarde_local_check') then
    alter table public.horarios add constraint horarios_tarde_local_check check (tarde_local in ('arena','home_office'));
  end if;
end $$;

-- Atualização em tempo real da agenda (se a publicação existir).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'agenda_eventos') then
    alter publication supabase_realtime add table public.agenda_eventos;
  end if;
end $$;

-- Força o PostgREST a enxergar as colunas/tabela novas.
notify pgrst, 'reload schema';
