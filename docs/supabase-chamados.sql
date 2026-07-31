-- ============================================================
-- CINTESP WEB — Chamados (suporte / TI, Pesquisa, etc.)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Regra de acesso:
--   • QUALQUER usuário logado pode ABRIR um chamado e ver os SEUS.
--   • Apenas ADMINISTRADORES (is_admin) veem TODOS, aceitam e mudam o status.
-- ============================================================

-- ---------- Enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_chamado') then
    create type status_chamado as enum
      ('aberto', 'em_andamento', 'aguardando_usuario', 'finalizado', 'cancelado');
  end if;
  if not exists (select 1 from pg_type where typname = 'prioridade_chamado') then
    create type prioridade_chamado as enum ('baixa', 'media', 'alta', 'urgente');
  end if;
end $$;

-- ---------- Tabela ----------
create table if not exists public.chamados (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  descricao      text not null,               -- resumo do problema
  setor          text not null default 'ti',  -- ti | pesquisa | administrativo | infraestrutura | outro
  categoria      text,                        -- ex.: Hardware, Rede, Software...
  prioridade     prioridade_chamado not null default 'media',
  status         status_chamado not null default 'aberto',
  solicitante_id uuid not null references public.usuarios (id) on delete cascade,
  responsavel_id uuid references public.usuarios (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  finalizado_em  timestamptz
);

create index if not exists idx_chamados_status on public.chamados (status);
create index if not exists idx_chamados_setor on public.chamados (setor);
create index if not exists idx_chamados_solicitante on public.chamados (solicitante_id);
create index if not exists idx_chamados_criado on public.chamados (created_at desc);

-- updated_at automático (reaproveita a função touch_updated_at do participantes.sql;
-- se ela não existir, cria).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_chamados_updated_at on public.chamados;
create trigger trg_chamados_updated_at
  before update on public.chamados
  for each row execute function public.touch_updated_at();

-- ---------- Segurança (RLS) ----------
alter table public.chamados enable row level security;

-- Ler: o solicitante vê os seus; o admin vê todos.
drop policy if exists "chamados: leitura" on public.chamados;
create policy "chamados: leitura" on public.chamados
  for select to authenticated
  using (solicitante_id = auth.uid() or public.is_admin());

-- Abrir: qualquer logado, sempre como solicitante = ele mesmo.
drop policy if exists "chamados: abrir" on public.chamados;
create policy "chamados: abrir" on public.chamados
  for insert to authenticated
  with check (solicitante_id = auth.uid());

-- Gerir (aceitar, mudar status, atribuir, excluir): só admin.
drop policy if exists "chamados: admin gere" on public.chamados;
create policy "chamados: admin gere" on public.chamados
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "chamados: admin exclui" on public.chamados;
create policy "chamados: admin exclui" on public.chamados
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.chamados to authenticated;

-- ---------- Realtime ----------
-- Em Database → Replication, adicione a tabela chamados à publicação
-- supabase_realtime (ou rode):
--   alter publication supabase_realtime add table public.chamados;

-- ============================================================
-- Pronto. "Abrir Chamado" fica disponível para todos; "Chamados"
-- (gestão) aparece só para administradores.
-- ============================================================
