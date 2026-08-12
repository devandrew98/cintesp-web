-- ============================================================
-- CINTESP WEB — Documentos (biblioteca de arquivos para pesquisadores)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Regra de acesso:
--   • QUALQUER usuário logado LÊ (vê e baixa) todos os documentos.
--   • Apenas ADMINISTRADORES (is_admin) enviam, editam e excluem.
-- ============================================================

-- ---------- Tabela ----------
create table if not exists public.documentos (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descricao       text,
  categoria       text not null default 'outro',        -- formulario | manual | politica | modelo | relatorio | ata | procedimento | outro
  departamento    text not null default 'geral',         -- geral | administracao | pesquisa | rh | financeiro | ti | juridico | comunicacao
  arquivo_url     text not null,
  arquivo_nome    text not null,
  arquivo_tipo    text,                                  -- mime type, ex.: application/pdf
  arquivo_tamanho bigint,                                 -- bytes
  autor_id        uuid references public.usuarios (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_documentos_categoria    on public.documentos (categoria);
create index if not exists idx_documentos_departamento on public.documentos (departamento);
create index if not exists idx_documentos_criado       on public.documentos (created_at desc);

-- updated_at automático (reaproveita a função touch_updated_at; cria se faltar).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_documentos_updated_at on public.documentos;
create trigger trg_documentos_updated_at
  before update on public.documentos
  for each row execute function public.touch_updated_at();

-- ---------- Segurança (RLS) ----------
alter table public.documentos enable row level security;

-- Ler: qualquer usuário logado.
drop policy if exists "documentos: leitura" on public.documentos;
create policy "documentos: leitura" on public.documentos
  for select to authenticated using (true);

-- Enviar/editar/excluir: só admin.
drop policy if exists "documentos: admin gere" on public.documentos;
create policy "documentos: admin gere" on public.documentos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.documentos to authenticated;

-- ---------- Arquivos (Storage) ----------
-- Bucket público para os documentos (leitura pública facilita o link de
-- download; quem pode ver a LISTA já é controlado pela RLS da tabela acima).
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', true, 26214400) -- 25 MB (bata com TAMANHO_MAX_MB do front)
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists "documentos_leitura" on storage.objects;
create policy "documentos_leitura" on storage.objects
  for select using (bucket_id = 'documentos');

drop policy if exists "documentos_admin_escreve" on storage.objects;
create policy "documentos_admin_escreve" on storage.objects
  for all to authenticated
  using (bucket_id = 'documentos' and public.is_admin())
  with check (bucket_id = 'documentos' and public.is_admin());

-- ============================================================
-- Pronto. "Documentos" fica disponível para todos os usuários logados;
-- enviar/editar/excluir aparece só para administradores.
-- ============================================================
