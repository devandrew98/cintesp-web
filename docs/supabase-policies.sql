-- ============================================================
-- CINTESP WEB — Segurança (grants + RLS) e gatilho de perfil
-- ------------------------------------------------------------
-- Rode DEPOIS de schema.sql e seed.sql, no SQL Editor do Supabase.
-- É idempotente: pode rodar mais de uma vez sem erro.
--
-- Modelo: o app é interno (exige login). Portanto:
--   • role "authenticated" (usuário logado) → acessa os dados via RLS;
--   • role "anon" (não logado)              → NÃO acessa nada.
-- Escrita de administração fica restrita a quem tem 'gerenciar_tudo';
-- cada usuário edita a própria disponibilidade e o próprio horário.
-- ============================================================

-- ---------- Privilégios de tabela para a role autenticada ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- Vale também para tabelas/sequences criadas no futuro:
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- ---------- Função auxiliar: o usuário atual é admin? ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.funcoes f on f.id = u.funcao_id
    where u.id = auth.uid()
      and 'gerenciar_tudo' = any (f.permissoes)
  );
$$;

-- ---------- Ativa RLS em todas as tabelas ----------
alter table public.instituicoes        enable row level security;
alter table public.funcoes             enable row level security;
alter table public.areas_atuacao       enable row level security;
alter table public.usuarios            enable row level security;
alter table public.usuario_areas       enable row level security;
alter table public.disponibilidade     enable row level security;
alter table public.horarios            enable row level security;
alter table public.mudancas_turno      enable row level security;
alter table public.avisos              enable row level security;
alter table public.historico_alteracoes enable row level security;

-- ============================================================
-- Políticas. Padrão: todo autenticado LÊ; admin ESCREVE.
-- (removemos antes as políticas antigas, se existirem, p/ ser idempotente.)
-- ============================================================

-- Remove políticas criadas no schema.sql (nomes antigos), se existirem.
drop policy if exists "leitura autenticada"       on public.usuarios;
drop policy if exists "leitura disponibilidade"   on public.disponibilidade;
drop policy if exists "leitura avisos"            on public.avisos;
drop policy if exists "edita minha disponibilidade" on public.disponibilidade;
drop policy if exists "edita meu horario"         on public.horarios;

-- Macro manual: como o Postgres não tem "for-each-table" simples aqui,
-- declaramos as políticas tabela a tabela.

-- ---- Tabelas de referência: leitura p/ todos autenticados, escrita p/ admin ----
do $$
declare t text;
begin
  foreach t in array array[
    'instituicoes','funcoes','areas_atuacao','usuario_areas',
    'mudancas_turno','avisos','historico_alteracoes'
  ] loop
    execute format('drop policy if exists ler_%1$s on public.%1$s;', t);
    execute format('drop policy if exists admin_escreve_%1$s on public.%1$s;', t);
    execute format(
      'create policy ler_%1$s on public.%1$s for select using (auth.uid() is not null);', t);
    execute format(
      'create policy admin_escreve_%1$s on public.%1$s for all using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- ---- usuarios: todos leem; admin escreve; cada um edita a própria linha ----
drop policy if exists ler_usuarios          on public.usuarios;
drop policy if exists admin_escreve_usuarios on public.usuarios;
drop policy if exists edita_meu_perfil      on public.usuarios;
create policy ler_usuarios on public.usuarios
  for select using (auth.uid() is not null);
create policy admin_escreve_usuarios on public.usuarios
  for all using (public.is_admin()) with check (public.is_admin());
create policy edita_meu_perfil on public.usuarios
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---- disponibilidade: todos leem; cada um edita a sua; admin tudo ----
drop policy if exists ler_disponibilidade   on public.disponibilidade;
drop policy if exists minha_disponibilidade on public.disponibilidade;
drop policy if exists admin_disponibilidade on public.disponibilidade;
create policy ler_disponibilidade on public.disponibilidade
  for select using (auth.uid() is not null);
create policy minha_disponibilidade on public.disponibilidade
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy admin_disponibilidade on public.disponibilidade
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- horarios: todos leem; cada um gerencia o seu; admin tudo ----
drop policy if exists ler_horarios   on public.horarios;
drop policy if exists meu_horario    on public.horarios;
drop policy if exists admin_horarios on public.horarios;
create policy ler_horarios on public.horarios
  for select using (auth.uid() is not null);
create policy meu_horario on public.horarios
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy admin_horarios on public.horarios
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Gatilho: cria o PERFIL (usuarios) + disponibilidade ao cadastrar.
-- O 1º usuário cadastrado vira Administrador; os demais, Pesquisador.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primeiro boolean;
  v_funcao   uuid;
begin
  select count(*) = 0 into v_primeiro from public.usuarios;

  select id into v_funcao
  from public.funcoes
  where nome = case when v_primeiro then 'Administrador' else 'Pesquisador' end
  limit 1;

  insert into public.usuarios (id, nome, email, funcao_id, status)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome',''), split_part(new.email, '@', 1)),
    new.email,
    v_funcao,
    'ativo'
  );

  insert into public.disponibilidade (usuario_id, status)
  values (new.id, 'ausente');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Pronto. Agora crie sua conta no app (o 1º cadastro vira Admin).
-- ============================================================
