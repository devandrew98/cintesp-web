-- ============================================================
-- CINTESP WEB — Fotos de perfil (Supabase Storage: bucket "avatares")
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente (pode rodar de novo).
--
-- Cria um bucket PÚBLICO chamado "avatares" (para a foto aparecer via <img>)
-- e as regras de quem pode enviar:
--   • cada usuário pode enviar/trocar a PRÓPRIA foto (pasta com o id dele);
--   • administradores (is_admin) podem enviar a foto de qualquer usuário.
--
-- A troca do campo usuarios.foto_url já é protegida pelas políticas de
-- `usuarios` (só o dono ou admin), então o bucket pode ser mais simples.
-- ============================================================

-- 1) Bucket público
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do update set public = true;

-- 2) Políticas no storage.objects (RLS)
-- Leitura pública (qualquer um vê a imagem pela URL).
drop policy if exists "avatares_leitura_publica" on storage.objects;
create policy "avatares_leitura_publica" on storage.objects
  for select using (bucket_id = 'avatares');

-- Envio: o dono (pasta = seu id) ou um admin.
drop policy if exists "avatares_insert" on storage.objects;
create policy "avatares_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Atualização (upsert) e remoção: mesma regra.
drop policy if exists "avatares_update" on storage.objects;
create policy "avatares_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatares'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "avatares_delete" on storage.objects;
create policy "avatares_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ============================================================
-- Pronto. Agora, em "Meu Horário" cada um envia a própria foto; e em
-- Administração > Usuários > Editar, o admin envia a de qualquer pessoa.
-- A foto aparece automaticamente no topo, no quadro e nas listas.
-- ============================================================
