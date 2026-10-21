-- ============================================================
-- CINTESP — Assinatura de documentos (termos de empréstimo)
-- Rode no SQL Editor do Supabase. Idempotente.
--
-- Fluxo:
--   1) o administrador (emprestante) sobe um PDF, escolhe o pesquisador,
--      posiciona e aplica a PRÓPRIA assinatura → fica "aguardando";
--   2) o documento aparece SÓ para aquele pesquisador em "Assinar documentos";
--      ele posiciona/aplica a assinatura dele → fica "assinado";
--   3) o administrador baixa o PDF final e sobe no Google Drive por conta própria.
--
-- Os PDFs ficam num bucket PRIVADO (assinaturas), em <id-do-documento>/:
--   admin.pdf  → PDF já com a assinatura do emprestante;
--   final.pdf  → PDF com as duas assinaturas.
-- ============================================================

-- ---------- Assinatura visual de cada usuário (nome, cargo, logo…) ----------
create table if not exists public.assinatura_perfis (
  usuario_id   uuid primary key references public.usuarios (id) on delete cascade,
  nome         text not null,
  cargo        text not null default '',
  organizacao  text not null default '',
  email        text not null default '',
  logo_url     text,            -- data URI (PNG pequeno) ou caminho público
  atualizado_em timestamptz not null default now()
);

alter table public.assinatura_perfis enable row level security;

drop policy if exists "assinatura_perfis: dono" on public.assinatura_perfis;
create policy "assinatura_perfis: dono" on public.assinatura_perfis
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Admin precisa ler a assinatura do emprestante? Não: cada um aplica a sua no navegador.

-- ---------- Documentos para assinar ----------
create table if not exists public.assinatura_documentos (
  id                   uuid primary key default gen_random_uuid(),
  titulo               text not null,
  pesquisador_id       uuid not null references public.usuarios (id) on delete cascade,
  criado_por           uuid references public.usuarios (id) on delete set null,
  status               text not null default 'aguardando' check (status in ('aguardando', 'assinado')),
  -- Onde a assinatura do pesquisador entra: { pagina (1..n), x, y, largura } em FRAÇÕES da página.
  posicao_pesquisador  jsonb not null,
  protocolo            text,          -- protocolo do empréstimo (consignados.protocolo), opcional
  hash_final           text,          -- SHA-256 do PDF final
  criado_em            timestamptz not null default now(),
  assinado_em          timestamptz
);

create index if not exists idx_assinatura_docs_pesquisador on public.assinatura_documentos (pesquisador_id, criado_em desc);

alter table public.assinatura_documentos enable row level security;

drop policy if exists "assinatura_documentos: leitura" on public.assinatura_documentos;
create policy "assinatura_documentos: leitura" on public.assinatura_documentos
  for select to authenticated
  using (public.is_admin() or pesquisador_id = auth.uid());

drop policy if exists "assinatura_documentos: admin cria" on public.assinatura_documentos;
create policy "assinatura_documentos: admin cria" on public.assinatura_documentos
  for insert to authenticated
  with check (public.is_admin() and criado_por = auth.uid() and status = 'aguardando');

drop policy if exists "assinatura_documentos: admin altera" on public.assinatura_documentos;
create policy "assinatura_documentos: admin altera" on public.assinatura_documentos
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "assinatura_documentos: admin exclui" on public.assinatura_documentos;
create policy "assinatura_documentos: admin exclui" on public.assinatura_documentos
  for delete to authenticated
  using (public.is_admin());

-- ---------- Bucket privado ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('assinaturas', 'assinaturas', false, 20971520)   -- 20 MB
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Leitura: admin, ou o pesquisador dono do documento (pasta = id do documento).
drop policy if exists "assinaturas: leitura" on storage.objects;
create policy "assinaturas: leitura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assinaturas'
    and (
      public.is_admin()
      or exists (
        select 1 from public.assinatura_documentos d
        where d.id::text = (storage.foldername(name))[1]
          and d.pesquisador_id = auth.uid()
      )
    )
  );

-- Envio: admin (admin.pdf) ou o pesquisador dono, SÓ de final.pdf e SÓ enquanto aguardando.
drop policy if exists "assinaturas: envio" on storage.objects;
create policy "assinaturas: envio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assinaturas'
    and (
      public.is_admin()
      or exists (
        select 1 from public.assinatura_documentos d
        where d.id::text = (storage.foldername(name))[1]
          and d.pesquisador_id = auth.uid()
          and d.status = 'aguardando'
          and name = d.id::text || '/final.pdf'
      )
    )
  );

drop policy if exists "assinaturas: admin altera" on storage.objects;
create policy "assinaturas: admin altera" on storage.objects
  for update to authenticated
  using (bucket_id = 'assinaturas' and public.is_admin())
  with check (bucket_id = 'assinaturas' and public.is_admin());

drop policy if exists "assinaturas: admin exclui" on storage.objects;
create policy "assinaturas: admin exclui" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assinaturas' and public.is_admin());

-- ---------- Concluir a assinatura (o pesquisador, depois de enviar final.pdf) ----------
create or replace function public.assinatura_concluir(p_id uuid, p_hash text)
returns void
language plpgsql security definer set search_path = public, storage as $$
declare
  v_doc public.assinatura_documentos;
begin
  select * into v_doc from public.assinatura_documentos where id = p_id;
  if v_doc.id is null then
    raise exception 'Documento não encontrado.';
  end if;
  if v_doc.pesquisador_id is distinct from auth.uid() then
    raise exception 'Este documento não é para você assinar.';
  end if;
  if v_doc.status <> 'aguardando' then
    raise exception 'Este documento já foi assinado.';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'assinaturas' and name = p_id::text || '/final.pdf'
  ) then
    raise exception 'O PDF assinado não foi enviado.';
  end if;

  update public.assinatura_documentos
    set status = 'assinado', assinado_em = now(), hash_final = nullif(trim(p_hash), '')
    where id = p_id;
end;
$$;

grant execute on function public.assinatura_concluir(uuid, text) to authenticated;
