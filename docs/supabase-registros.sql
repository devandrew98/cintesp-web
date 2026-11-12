-- ============================================================
-- CINTESP WEB — Registros institucionais (visitas, eventos, oficinas…)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Regras:
--   • Qualquer usuário logado VÊ todos os registros e CRIA registros.
--   • Qualquer usuário logado ANEXA fotos, documentos e atas a qualquer registro.
--   • Editar/excluir o REGISTRO: quem criou ou o administrador.
--   • Remover um ANEXO: quem enviou, o criador do registro ou o administrador.
--   • Arquivos: bucket PRIVADO `registros` (URLs assinadas), até 25 MB,
--     no caminho <registro-id>/<anexo-id>.<ext>.
-- ============================================================

create table if not exists public.registros_institucionais (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null default 'visita'
               check (tipo in ('visita','evento','oficina','reuniao','palestra','outro')),
  titulo       text not null check (length(btrim(titulo)) > 0),
  data         date not null,
  hora_inicio  time,
  hora_fim     time,
  local        text,
  instituicao  text,                                   -- instituição/grupo visitante ou parceira
  responsavel  text,                                   -- quem conduziu pelo CINTESP
  participantes integer check (participantes is null or participantes >= 0),
  descricao    text,
  ata          text,                                   -- ata/resumo em texto (vai no relatório)
  criado_por   uuid references public.usuarios (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint registros_horas_ok check (hora_inicio is null or hora_fim is null or hora_fim >= hora_inicio)
);

create index if not exists idx_registros_data on public.registros_institucionais (data desc);

create table if not exists public.registro_anexos (
  id           uuid primary key default gen_random_uuid(),
  registro_id  uuid not null references public.registros_institucionais (id) on delete cascade,
  categoria    text not null check (categoria in ('foto','ata','documento')),
  caminho      text not null unique,                   -- <registro-id>/<anexo-id>.<ext> no bucket `registros`
  nome         text not null,
  mime         text,
  tamanho      bigint,
  enviado_por  uuid references public.usuarios (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_registro_anexos_registro on public.registro_anexos (registro_id);

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_registros_updated_at on public.registros_institucionais;
create trigger trg_registros_updated_at
  before update on public.registros_institucionais
  for each row execute function public.touch_updated_at();

-- Dono do registro (para a regra de remover anexos).
create or replace function public.registro_dono(p_registro_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.registros_institucionais
    where id = p_registro_id and criado_por = auth.uid()
  );
$$;

-- ---------- RLS ----------
alter table public.registros_institucionais enable row level security;
alter table public.registro_anexos          enable row level security;

drop policy if exists "registros: leitura" on public.registros_institucionais;
create policy "registros: leitura" on public.registros_institucionais
  for select to authenticated using (true);

drop policy if exists "registros: criar" on public.registros_institucionais;
create policy "registros: criar" on public.registros_institucionais
  for insert to authenticated
  with check (criado_por = auth.uid());

drop policy if exists "registros: editar" on public.registros_institucionais;
create policy "registros: editar" on public.registros_institucionais
  for update to authenticated
  using (public.is_admin() or criado_por = auth.uid())
  with check (public.is_admin() or criado_por = auth.uid());

drop policy if exists "registros: excluir" on public.registros_institucionais;
create policy "registros: excluir" on public.registros_institucionais
  for delete to authenticated
  using (public.is_admin() or criado_por = auth.uid());

drop policy if exists "registro_anexos: leitura" on public.registro_anexos;
create policy "registro_anexos: leitura" on public.registro_anexos
  for select to authenticated using (true);

drop policy if exists "registro_anexos: enviar" on public.registro_anexos;
create policy "registro_anexos: enviar" on public.registro_anexos
  for insert to authenticated
  with check (enviado_por = auth.uid());

drop policy if exists "registro_anexos: remover" on public.registro_anexos;
create policy "registro_anexos: remover" on public.registro_anexos
  for delete to authenticated
  using (public.is_admin() or enviado_por = auth.uid() or public.registro_dono(registro_id));

grant select, insert, update, delete on public.registros_institucionais to authenticated;
grant select, insert, delete         on public.registro_anexos          to authenticated;

-- ---------- Arquivos (Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'registros', 'registros', false, 26214400,   -- 25 MB
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'text/plain', 'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = false, file_size_limit = 26214400, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "registros_storage: ler" on storage.objects;
create policy "registros_storage: ler" on storage.objects
  for select to authenticated
  using (bucket_id = 'registros');

-- Só entra arquivo no padrão <uuid>/<uuid>.<ext>.
drop policy if exists "registros_storage: enviar" on storage.objects;
create policy "registros_storage: enviar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'registros'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$'
  );

-- Apagar o arquivo: quem enviou (owner) ou o administrador.
drop policy if exists "registros_storage: apagar" on storage.objects;
create policy "registros_storage: apagar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'registros' and (public.is_admin() or owner = auth.uid()));

-- Atualização em tempo real (se a publicação existir).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'registros_institucionais') then
    alter publication supabase_realtime add table public.registros_institucionais;
  end if;
end $$;

notify pgrst, 'reload schema';
