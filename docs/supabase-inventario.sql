-- ============================================================
-- CINTESP — Inventário Patrimonial (levantamento de bens + fotos + dados
-- fiscais para o ofício de tombamento). Rode no SQL Editor. Idempotente.
--
-- Quem acessa: SÓ o administrador (Administração > Inventário).
--
-- Fotos: bucket PRIVADO `inventario` (URLs assinadas, nunca públicas),
-- só jpeg/png/webp, até 5 MB, no caminho <item-id>/<foto-id>.<ext>.
-- ============================================================

-- ---------- Permissão: SÓ ADMINISTRADOR ----------
-- (a tela fica em Administração > Inventário). Mantida como função para
-- as políticas abaixo continuarem lendo `pode_inventario()`.
create or replace function public.pode_inventario()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin();
$$;

grant execute on function public.pode_inventario() to authenticated;

-- ---------- CNPJ válido (dígitos verificadores) — a mesma regra do front ----------
create or replace function public.cnpj_valido(p text)
returns boolean
language plpgsql immutable as $$
declare
  pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int;
  r int;
  i int;
begin
  if p is null or p !~ '^[0-9]{14}$' or p ~ '^([0-9])\1{13}$' then
    return false;
  end if;

  s := 0;
  for i in 1..12 loop
    s := s + substr(p, i, 1)::int * pesos1[i];
  end loop;
  r := s % 11;
  r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(p, 13, 1)::int then return false; end if;

  s := 0;
  for i in 1..13 loop
    s := s + substr(p, i, 1)::int * pesos2[i];
  end loop;
  r := s % 11;
  r := case when r < 2 then 0 else 11 - r end;
  return r = substr(p, 14, 1)::int;
end;
$$;

-- ---------- Itens ----------
create table if not exists public.inventario_itens (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null check (length(trim(nome)) > 0),
  numero_nota_fiscal text,
  data_emissao_nf   date,
  data_compra       date,
  numero_serie      text,
  quantidade        int not null default 1 check (quantidade between 1 and 9999),  -- unidades do item (1 foto por unidade)
  fornecedor        text,
  cnpj              text check (cnpj is null or public.cnpj_valido(cnpj)),  -- só dígitos
  projeto_id        uuid references public.projetos (id) on delete set null,
  projeto_numero    text,           -- nº/identificação do projeto (CNPq) — vai no ofício
  localizacao       text,
  observacoes       text,
  status_vistoria   text not null default 'pendente'
                    check (status_vistoria in ('pendente', 'localizado', 'nao_localizado')),
  criado_por        uuid references public.usuarios (id) on delete set null,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

-- Bancos criados antes de existir a coluna `quantidade`:
alter table public.inventario_itens
  add column if not exists quantidade int not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inventario_itens_quantidade_check') then
    alter table public.inventario_itens
      add constraint inventario_itens_quantidade_check check (quantidade between 1 and 9999);
  end if;
end $$;

create index if not exists idx_inventario_status on public.inventario_itens (status_vistoria);
create index if not exists idx_inventario_nf on public.inventario_itens (numero_nota_fiscal);
create index if not exists idx_inventario_serie on public.inventario_itens (lower(numero_serie));

create or replace function public.inventario_toca()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_inventario_toca on public.inventario_itens;
create trigger trg_inventario_toca
  before update on public.inventario_itens
  for each row execute function public.inventario_toca();

-- ---------- Fotos (várias por item, uma principal) ----------
create table if not exists public.inventario_fotos (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.inventario_itens (id) on delete cascade,
  caminho    text not null unique,      -- caminho no bucket: <item-id>/<foto-id>.<ext>
  principal  boolean not null default false,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_inventario_fotos_item on public.inventario_fotos (item_id);
create unique index if not exists uq_inventario_foto_principal
  on public.inventario_fotos (item_id) where principal;

-- ---------- RLS ----------
alter table public.inventario_itens enable row level security;
alter table public.inventario_fotos enable row level security;

drop policy if exists "inventario_itens: ler" on public.inventario_itens;
create policy "inventario_itens: ler" on public.inventario_itens
  for select to authenticated using (public.pode_inventario());

drop policy if exists "inventario_itens: criar" on public.inventario_itens;
create policy "inventario_itens: criar" on public.inventario_itens
  for insert to authenticated with check (public.pode_inventario());

drop policy if exists "inventario_itens: alterar" on public.inventario_itens;
create policy "inventario_itens: alterar" on public.inventario_itens
  for update to authenticated using (public.pode_inventario()) with check (public.pode_inventario());

drop policy if exists "inventario_itens: excluir" on public.inventario_itens;
create policy "inventario_itens: excluir" on public.inventario_itens
  for delete to authenticated using (public.is_admin());

drop policy if exists "inventario_fotos: tudo" on public.inventario_fotos;
create policy "inventario_fotos: tudo" on public.inventario_fotos
  for all to authenticated using (public.pode_inventario()) with check (public.pode_inventario());

-- ---------- Bucket privado ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventario', 'inventario', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "inventario_storage: ler" on storage.objects;
create policy "inventario_storage: ler" on storage.objects
  for select to authenticated
  using (bucket_id = 'inventario' and public.pode_inventario());

-- Só entra arquivo no padrão <uuid>/<uuid>.(jpg|jpeg|png|webp).
drop policy if exists "inventario_storage: enviar" on storage.objects;
create policy "inventario_storage: enviar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'inventario'
    and public.pode_inventario()
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  );

drop policy if exists "inventario_storage: apagar" on storage.objects;
create policy "inventario_storage: apagar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inventario' and public.pode_inventario());
