-- ============================================================
-- CINTESP WEB — ATUALIZAÇÕES DO BANCO (rode este arquivo INTEIRO)
-- ------------------------------------------------------------
-- SQL Editor do Supabase → cole tudo → Run. É idempotente (pode rodar
-- quantas vezes quiser). NADA é apagado. Reúne todas as pendências:
--
--   1) Colunas de perfil em `usuarios`  → conserta o acesso de ADMIN.
--   2) Coluna `disponibilidade.automatico`.
--   3) Chamados: coluna `anexo_url` + tabela/RLS + bucket de anexos
--      → conserta o erro "Could not find the 'anexo_url' column".
--   4) Funções essenciais + garante que exista pelo menos 1 admin.
--   5) Gatilho: perfil manual (aluno/IC) vira conta no 1º login, com o
--      papel pretendido.
-- ============================================================


-- 1) COLUNAS DE PERFIL (conserta o acesso de admin) ----------
alter table public.usuarios add column if not exists cpf             text;
alter table public.usuarios add column if not exists whatsapp        text;
alter table public.usuarios add column if not exists endereco        text;
alter table public.usuarios add column if not exists cep             text;
alter table public.usuarios add column if not exists curso           text;
alter table public.usuarios add column if not exists data_nascimento date;  -- aniversariantes


-- 2) DISPONIBILIDADE.AUTOMATICO ------------------------------
alter table public.disponibilidade
  add column if not exists automatico boolean not null default true;


-- 3) CHAMADOS (conserta "anexo_url ... not found") -----------
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

create table if not exists public.chamados (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  descricao      text not null,
  setor          text not null default 'ti',
  categoria      text,
  prioridade     prioridade_chamado not null default 'media',
  status         status_chamado not null default 'aberto',
  solicitante_id uuid not null references public.usuarios (id) on delete cascade,
  responsavel_id uuid references public.usuarios (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  finalizado_em  timestamptz
);

-- A coluna do erro: adiciona se faltar (o anexo é OPCIONAL).
alter table public.chamados add column if not exists anexo_url text;

create index if not exists idx_chamados_status on public.chamados (status);
create index if not exists idx_chamados_setor on public.chamados (setor);
create index if not exists idx_chamados_solicitante on public.chamados (solicitante_id);
create index if not exists idx_chamados_criado on public.chamados (created_at desc);

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

alter table public.chamados enable row level security;

drop policy if exists "chamados: leitura" on public.chamados;
create policy "chamados: leitura" on public.chamados
  for select to authenticated
  using (solicitante_id = auth.uid() or public.is_admin());

drop policy if exists "chamados: abrir" on public.chamados;
create policy "chamados: abrir" on public.chamados
  for insert to authenticated
  with check (solicitante_id = auth.uid());

drop policy if exists "chamados: admin gere" on public.chamados;
create policy "chamados: admin gere" on public.chamados
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "chamados: admin exclui" on public.chamados;
create policy "chamados: admin exclui" on public.chamados
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.chamados to authenticated;

-- Bucket público para os anexos.
insert into storage.buckets (id, name, public)
values ('chamado-anexos', 'chamado-anexos', true)
on conflict (id) do update set public = true;

drop policy if exists "chamado_anexos_leitura" on storage.objects;
create policy "chamado_anexos_leitura" on storage.objects
  for select using (bucket_id = 'chamado-anexos');

drop policy if exists "chamado_anexos_envio" on storage.objects;
create policy "chamado_anexos_envio" on storage.objects
  for insert to authenticated with check (bucket_id = 'chamado-anexos');


-- 4) FUNÇÕES + ADMIN -----------------------------------------
insert into public.funcoes (nome, permissoes) values
  ('Administrador',    array['gerenciar_tudo']),
  ('Coordenador',      array['ver_quadro','publicar_avisos','editar_horarios']),
  ('Vice-coordenador', array['ver_quadro','publicar_avisos']),
  ('Pesquisador',      array['ver_quadro']),
  ('Participante',     array['abrir_chamado'])
on conflict (nome) do nothing;

-- Administrador SEMPRE precisa ter 'gerenciar_tudo' (sem remover o resto).
update public.funcoes
set permissoes = (select array(select distinct unnest(permissoes || array['gerenciar_tudo'])))
where nome = 'Administrador';

-- (a) Promove explicitamente o e-mail principal (troque se o seu for outro).
update public.usuarios
set funcao_id = (select id from public.funcoes where nome = 'Administrador' limit 1),
    status    = 'ativo'
where lower(email) = lower('andre.rodrigues1022@gmail.com');

-- (b) Se ainda ninguém for admin, promove o usuário mais antigo.
do $$
declare v_admin uuid; v_alvo uuid;
begin
  select id into v_admin from public.funcoes where nome = 'Administrador' limit 1;
  if not exists (
    select 1 from public.usuarios u join public.funcoes f on f.id = u.funcao_id
    where 'gerenciar_tudo' = any (f.permissoes)
  ) then
    select id into v_alvo from public.usuarios order by created_at nulls last limit 1;
    if v_alvo is not null then
      update public.usuarios set funcao_id = v_admin, status = 'ativo' where id = v_alvo;
    end if;
  end if;
end $$;


-- 5) GATILHO: perfil manual -> conta real no 1º login --------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primeiro  boolean;
  v_func_nome text;
  v_funcao    uuid;
  v_part      public.participantes%rowtype;
  v_tem_part  boolean := false;
begin
  select count(*) = 0 into v_primeiro from public.usuarios;

  begin
    select * into v_part
    from public.participantes
    where email is not null and lower(email) = lower(new.email)
    order by created_at nulls last
    limit 1;
    if found then v_tem_part := true; end if;
  exception when undefined_table then
    v_tem_part := false;
  end;

  if v_primeiro then
    v_func_nome := 'Administrador';
  elsif v_tem_part and coalesce(v_part.dados_extras->>'funcaoPretendida','') <> '' then
    v_func_nome := v_part.dados_extras->>'funcaoPretendida';
  else
    v_func_nome := 'Participante';
  end if;

  select id into v_funcao from public.funcoes where nome = v_func_nome limit 1;
  if v_funcao is null then
    select id into v_funcao from public.funcoes where nome = 'Participante' limit 1;
  end if;

  insert into public.usuarios (id, nome, email, funcao_id, status)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nome',''),
      nullif(v_part.nome,''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    v_funcao,
    'ativo'
  );

  insert into public.disponibilidade (usuario_id, status)
  values (new.id, 'ausente');

  if v_tem_part then
    begin
      update public.usuarios set
        telefone = coalesce(telefone, v_part.telefone),
        curso    = coalesce(curso,    v_part.curso),
        endereco = coalesce(endereco, v_part.endereco),
        cep      = coalesce(cep,      v_part.cep),
        whatsapp = coalesce(whatsapp, v_part.dados_extras->>'whatsapp')
      where id = new.id;
    exception when others then
      null;
    end;
    -- Perfil da planilha/manual "promovido" é REMOVIDO (não vira duplicata).
    delete from public.participantes where id = v_part.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 6) CONFERÊNCIA (opcional) ----------------------------------
--   select u.email, f.nome as funcao, u.status
--   from public.usuarios u left join public.funcoes f on f.id = u.funcao_id
--   order by u.created_at;

-- ============================================================
-- Pronto. Recarregue o app (Ctrl+Shift+R). Não há rollback necessário.
-- ============================================================
