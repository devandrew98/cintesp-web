-- ============================================================
-- CINTESP WEB — Leituras de avisos (KPIs reais: "lidos hoje" e "visualizações")
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Antes, "Lidos hoje" era um número fixo (18) e "Visualizações" era a soma de
-- um campo estático. Com esta tabela, o app registra CADA leitura (quem abriu
-- o aviso e quando) e os KPIs passam a ser calculados de verdade, ao vivo.
-- ============================================================

create table if not exists public.aviso_leituras (
  aviso_id   uuid not null references public.avisos (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  lido_em    timestamptz not null default now(),
  primary key (aviso_id, usuario_id)   -- uma leitura por pessoa/aviso (atualiza a data)
);

create index if not exists idx_aviso_leituras_lido_em on public.aviso_leituras (lido_em);

-- ---------- Segurança (RLS) ----------
alter table public.aviso_leituras enable row level security;

-- Todo mundo logado pode LER (para os KPIs contarem).
drop policy if exists "leituras: leitura autenticada" on public.aviso_leituras;
create policy "leituras: leitura autenticada" on public.aviso_leituras
  for select to authenticated using (true);

-- Cada um registra apenas a PRÓPRIA leitura.
drop policy if exists "leituras: registra a propria" on public.aviso_leituras;
create policy "leituras: registra a propria" on public.aviso_leituras
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists "leituras: atualiza a propria" on public.aviso_leituras;
create policy "leituras: atualiza a propria" on public.aviso_leituras
  for update to authenticated using (usuario_id = auth.uid());

grant select, insert, update on public.aviso_leituras to authenticated;

-- ---------- Realtime (para os KPIs atualizarem sozinhos) ----------
-- Em Database → Replication, adicione também a tabela aviso_leituras à
-- publicação supabase_realtime (ou rode a linha abaixo):
--   alter publication supabase_realtime add table public.aviso_leituras;
