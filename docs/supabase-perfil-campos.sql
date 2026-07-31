-- ============================================================
-- CINTESP WEB — Campos extras do perfil do usuário
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Adiciona à tabela `usuarios` os campos que passam a ser editáveis em
-- "Meu Perfil" (e na gestão de Pesquisadores): CPF, WhatsApp, endereço,
-- CEP e curso. O telefone já existia.
-- ============================================================

alter table public.usuarios add column if not exists cpf text;
alter table public.usuarios add column if not exists whatsapp text;
alter table public.usuarios add column if not exists endereco text;
alter table public.usuarios add column if not exists cep text;
alter table public.usuarios add column if not exists curso text;

-- (Opcional) evita dois cadastros com o mesmo CPF. NULLs continuam permitidos.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_cpf_key') then
    alter table public.usuarios add constraint usuarios_cpf_key unique (cpf);
  end if;
exception when others then
  -- se já houver CPFs repetidos, ignora a criação da restrição
  null;
end $$;
