-- ============================================================
-- CINTESP WEB — Pesquisador escolhe as PRÓPRIAS áreas de atuação
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Hoje só o admin edita os vínculos de área (usuario_areas). Esta política
-- permite que cada pesquisador gerencie as ÁREAS DELE MESMO (em Meu Perfil),
-- sem poder mexer nas de outra pessoa. O admin continua podendo tudo.
-- ============================================================

alter table public.usuario_areas enable row level security;

-- Cada um gerencia (ver/adicionar/remover) apenas os seus próprios vínculos.
drop policy if exists "usuario_areas: minhas" on public.usuario_areas;
create policy "usuario_areas: minhas" on public.usuario_areas
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

grant select, insert, update, delete on public.usuario_areas to authenticated;

-- ============================================================
-- Pronto. As áreas que o admin cria em "Áreas de Atuação" já aparecem
-- para todos escolherem em Meu Perfil.
-- ============================================================
