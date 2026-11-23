-- ============================================================
-- CINTESP WEB — Projetos: capa do projeto + tarefas (estilo Trello/Notion)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase DEPOIS de docs/supabase-projetos.sql e
-- docs/supabase-projetos-colaborativo.sql. É idempotente.
--
-- Regras:
--   • Capa: admin e DONO do projeto (criador/responsável) trocam; todos veem.
--   • Tarefas: TODOS leem; criar/editar: admin, dono e pesquisadores vinculados;
--     excluir: admin, dono do projeto ou quem criou a tarefa.
-- ============================================================

-- ---------- Capa ----------
alter table public.projetos add column if not exists capa_url text;

-- Bucket PÚBLICO só para as capas (imagens não sensíveis, vistas por todos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('projeto-capas', 'projeto-capas', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

-- Caminho: <projeto-id>/capa.jpg  (o primeiro segmento é o id do projeto)
drop policy if exists "projeto_capas: ler" on storage.objects;
create policy "projeto_capas: ler" on storage.objects
  for select using (bucket_id = 'projeto-capas');

drop policy if exists "projeto_capas: enviar" on storage.objects;
create policy "projeto_capas: enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'projeto-capas' and (public.is_admin() or public.projeto_dono(((storage.foldername(name))[1])::uuid)));

drop policy if exists "projeto_capas: trocar" on storage.objects;
create policy "projeto_capas: trocar" on storage.objects
  for update to authenticated
  using (bucket_id = 'projeto-capas' and (public.is_admin() or public.projeto_dono(((storage.foldername(name))[1])::uuid)))
  with check (bucket_id = 'projeto-capas' and (public.is_admin() or public.projeto_dono(((storage.foldername(name))[1])::uuid)));

drop policy if exists "projeto_capas: apagar" on storage.objects;
create policy "projeto_capas: apagar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'projeto-capas' and (public.is_admin() or public.projeto_dono(((storage.foldername(name))[1])::uuid)));

-- ---------- Tarefas ----------
create table if not exists public.projeto_tarefas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos (id) on delete cascade,
  titulo         text not null check (length(btrim(titulo)) > 0),
  descricao      text,
  status         text not null default 'nao_iniciado'
                 check (status in ('nao_iniciado', 'em_andamento', 'aguardando', 'concluido')),
  prioridade     text not null default 'media'
                 check (prioridade in ('baixa', 'media', 'alta')),
  responsavel_id uuid references public.usuarios (id) on delete set null,
  data_entrega   date,
  criado_por     uuid references public.usuarios (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_projeto_tarefas_projeto     on public.projeto_tarefas (projeto_id);
create index if not exists idx_projeto_tarefas_responsavel on public.projeto_tarefas (responsavel_id, data_entrega);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_projeto_tarefas_updated_at on public.projeto_tarefas;
create trigger trg_projeto_tarefas_updated_at
  before update on public.projeto_tarefas
  for each row execute function public.touch_updated_at();

alter table public.projeto_tarefas enable row level security;

drop policy if exists "projeto_tarefas: leitura" on public.projeto_tarefas;
create policy "projeto_tarefas: leitura" on public.projeto_tarefas
  for select to authenticated using (true);

drop policy if exists "projeto_tarefas: criar" on public.projeto_tarefas;
create policy "projeto_tarefas: criar" on public.projeto_tarefas
  for insert to authenticated
  with check (
    criado_por = auth.uid()
    and (public.is_admin() or public.projeto_membro(projeto_id) or public.projeto_dono(projeto_id))
  );

drop policy if exists "projeto_tarefas: editar" on public.projeto_tarefas;
create policy "projeto_tarefas: editar" on public.projeto_tarefas
  for update to authenticated
  using (public.is_admin() or public.projeto_membro(projeto_id) or public.projeto_dono(projeto_id))
  with check (public.is_admin() or public.projeto_membro(projeto_id) or public.projeto_dono(projeto_id));

drop policy if exists "projeto_tarefas: excluir" on public.projeto_tarefas;
create policy "projeto_tarefas: excluir" on public.projeto_tarefas
  for delete to authenticated
  using (public.is_admin() or public.projeto_dono(projeto_id) or criado_por = auth.uid());

grant select, insert, update, delete on public.projeto_tarefas to authenticated;

-- Atualização em tempo real (se a publicação existir).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'projeto_tarefas') then
    alter publication supabase_realtime add table public.projeto_tarefas;
  end if;
end $$;

notify pgrst, 'reload schema';
