-- ============================================================
-- CINTESP WEB — Projetos: GRUPOS de tarefas, links do projeto e progresso automático
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase DEPOIS de docs/supabase-projetos.sql,
-- docs/supabase-projetos-colaborativo.sql e docs/supabase-projetos-tarefas.sql.
-- É idempotente.
--
-- Regras:
--   • Plano de trabalho = GRUPOS (frentes do projeto) e, dentro deles, as TAREFAS.
--   • Quem vê um grupo (e as tarefas dele): admin, dono do projeto, responsável/criador do grupo,
--     membros escolhidos e — se o grupo NÃO for restrito — toda a equipe vinculada ao projeto.
--     Quem não é da equipe do projeto não vê grupos nem tarefas.
--   • Criar grupo: admin, dono e vinculados. Editar/excluir grupo: admin, dono, responsável/criador do grupo.
--   • Links do projeto (Drive e grupo de conversa): só a equipe vê; só admin/dono altera.
--   • Progresso do projeto = tarefas concluídas / total de tarefas (calculado aqui, ninguém digita).
-- ============================================================

-- ---------- Links do projeto (só a equipe) ----------
create table if not exists public.projeto_links (
  projeto_id uuid primary key references public.projetos (id) on delete cascade,
  drive_url  text,
  grupo_url  text,
  updated_at timestamptz not null default now()
);
alter table public.projeto_links enable row level security;

drop policy if exists "projeto_links: ler" on public.projeto_links;
create policy "projeto_links: ler" on public.projeto_links
  for select to authenticated
  using (public.is_admin() or public.projeto_membro(projeto_id) or public.projeto_dono(projeto_id));

drop policy if exists "projeto_links: criar" on public.projeto_links;
create policy "projeto_links: criar" on public.projeto_links
  for insert to authenticated
  with check (public.is_admin() or public.projeto_dono(projeto_id));

drop policy if exists "projeto_links: editar" on public.projeto_links;
create policy "projeto_links: editar" on public.projeto_links
  for update to authenticated
  using (public.is_admin() or public.projeto_dono(projeto_id))
  with check (public.is_admin() or public.projeto_dono(projeto_id));

drop policy if exists "projeto_links: apagar" on public.projeto_links;
create policy "projeto_links: apagar" on public.projeto_links
  for delete to authenticated
  using (public.is_admin() or public.projeto_dono(projeto_id));

grant select, insert, update, delete on public.projeto_links to authenticated;

-- ---------- Grupos ----------
create table if not exists public.projeto_grupos (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos (id) on delete cascade,
  titulo         text not null check (length(btrim(titulo)) > 0),
  descricao      text,
  drive_url      text,
  responsavel_id uuid references public.usuarios (id) on delete set null,
  restrito       boolean not null default false,
  ordem          int not null default 0,
  criado_por     uuid references public.usuarios (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_projeto_grupos_projeto on public.projeto_grupos (projeto_id, ordem);

create table if not exists public.projeto_grupo_membros (
  grupo_id   uuid not null references public.projeto_grupos (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  primary key (grupo_id, usuario_id)
);

drop trigger if exists trg_projeto_grupos_updated_at on public.projeto_grupos;
create trigger trg_projeto_grupos_updated_at
  before update on public.projeto_grupos
  for each row execute function public.touch_updated_at();

-- Quem enxerga o grupo.
create or replace function public.grupo_acesso(p_grupo_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projeto_grupos g
    where g.id = p_grupo_id
      and (
        public.is_admin()
        or public.projeto_dono(g.projeto_id)
        or g.responsavel_id = auth.uid()
        or g.criado_por = auth.uid()
        or exists (select 1 from public.projeto_grupo_membros m where m.grupo_id = g.id and m.usuario_id = auth.uid())
        or (not g.restrito and public.projeto_membro(g.projeto_id))
      )
  );
$$;

-- Quem edita/exclui o grupo.
create or replace function public.grupo_gestor(p_grupo_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projeto_grupos g
    where g.id = p_grupo_id
      and (public.is_admin() or public.projeto_dono(g.projeto_id) or g.responsavel_id = auth.uid() or g.criado_por = auth.uid())
  );
$$;

-- O grupo pertence mesmo àquele projeto (evita tarefa "solta" em grupo de outro projeto).
create or replace function public.grupo_pertence(p_grupo_id uuid, p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projeto_grupos where id = p_grupo_id and projeto_id = p_projeto_id);
$$;

alter table public.projeto_grupos enable row level security;
alter table public.projeto_grupo_membros enable row level security;

drop policy if exists "projeto_grupos: ler" on public.projeto_grupos;
create policy "projeto_grupos: ler" on public.projeto_grupos
  for select to authenticated using (public.grupo_acesso(id));

drop policy if exists "projeto_grupos: criar" on public.projeto_grupos;
create policy "projeto_grupos: criar" on public.projeto_grupos
  for insert to authenticated
  with check (
    criado_por = auth.uid()
    and (public.is_admin() or public.projeto_membro(projeto_id) or public.projeto_dono(projeto_id))
  );

drop policy if exists "projeto_grupos: editar" on public.projeto_grupos;
create policy "projeto_grupos: editar" on public.projeto_grupos
  for update to authenticated
  using (public.grupo_gestor(id)) with check (public.grupo_gestor(id));

drop policy if exists "projeto_grupos: excluir" on public.projeto_grupos;
create policy "projeto_grupos: excluir" on public.projeto_grupos
  for delete to authenticated using (public.grupo_gestor(id));

drop policy if exists "projeto_grupo_membros: ler" on public.projeto_grupo_membros;
create policy "projeto_grupo_membros: ler" on public.projeto_grupo_membros
  for select to authenticated using (public.grupo_acesso(grupo_id));

drop policy if exists "projeto_grupo_membros: gerir" on public.projeto_grupo_membros;
create policy "projeto_grupo_membros: gerir" on public.projeto_grupo_membros
  for all to authenticated
  using (public.grupo_gestor(grupo_id)) with check (public.grupo_gestor(grupo_id));

grant select, insert, update, delete on public.projeto_grupos to authenticated;
grant select, insert, update, delete on public.projeto_grupo_membros to authenticated;

-- ---------- Tarefas passam a morar dentro de um grupo ----------
alter table public.projeto_tarefas add column if not exists grupo_id uuid references public.projeto_grupos (id) on delete cascade;

-- Tarefas que já existiam ganham um grupo "Geral" por projeto.
do $$
declare r record; gid uuid;
begin
  for r in select distinct projeto_id from public.projeto_tarefas where grupo_id is null loop
    insert into public.projeto_grupos (projeto_id, titulo, responsavel_id, criado_por, ordem)
    select p.id, 'Grupo 1: Geral', p.responsavel_id, p.criado_por, 1 from public.projetos p where p.id = r.projeto_id
    returning id into gid;
    update public.projeto_tarefas set grupo_id = gid where projeto_id = r.projeto_id and grupo_id is null;
  end loop;
end $$;

alter table public.projeto_tarefas alter column grupo_id set not null;
create index if not exists idx_projeto_tarefas_grupo on public.projeto_tarefas (grupo_id);

-- Antes todos liam todas as tarefas; agora só quem tem acesso ao grupo.
drop policy if exists "projeto_tarefas: leitura" on public.projeto_tarefas;
create policy "projeto_tarefas: leitura" on public.projeto_tarefas
  for select to authenticated using (public.grupo_acesso(grupo_id));

drop policy if exists "projeto_tarefas: criar" on public.projeto_tarefas;
create policy "projeto_tarefas: criar" on public.projeto_tarefas
  for insert to authenticated
  with check (criado_por = auth.uid() and public.grupo_acesso(grupo_id) and public.grupo_pertence(grupo_id, projeto_id));

drop policy if exists "projeto_tarefas: editar" on public.projeto_tarefas;
create policy "projeto_tarefas: editar" on public.projeto_tarefas
  for update to authenticated
  using (public.grupo_acesso(grupo_id))
  with check (public.grupo_acesso(grupo_id) and public.grupo_pertence(grupo_id, projeto_id));

drop policy if exists "projeto_tarefas: excluir" on public.projeto_tarefas;
create policy "projeto_tarefas: excluir" on public.projeto_tarefas
  for delete to authenticated
  using (public.is_admin() or public.projeto_dono(projeto_id) or criado_por = auth.uid() or public.grupo_gestor(grupo_id));

-- ---------- Progresso automático do projeto ----------
-- O trigger de edição de projetos barra quem não é dono; o recálculo automático passa por ele marcando a sessão.
create or replace function public.projetos_valida_edicao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  eh_membro       boolean;
  campos_mudados  text[];
  campo           text;
  campos_livres   text[] := array['trl', 'dados_tecnicos', 'descricao', 'observacoes'];
begin
  -- Recalculo automático do progresso (feito pelo banco, não por uma pessoa).
  if current_setting('cintesp.recalculo', true) = '1' then
    return new;
  end if;

  if new.criado_por is distinct from old.criado_por and not public.is_admin() then
    raise exception 'Apenas o administrador pode trocar o criador do projeto.';
  end if;

  if new.progresso is distinct from old.progresso then
    raise exception 'O progresso é calculado pelas tarefas concluídas e não pode ser editado à mão.';
  end if;

  if public.is_admin()
     or auth.uid() = old.criado_por
     or auth.uid() = old.responsavel_id
     or auth.uid() = new.responsavel_id then
    return new;
  end if;

  eh_membro := exists (
    select 1 from public.projeto_pesquisadores
    where projeto_id = old.id and usuario_id = auth.uid()
  );
  if not eh_membro then
    raise exception 'Você não pode editar este projeto: só o criador e o responsável podem.';
  end if;

  select array_agg(k) into campos_mudados
  from jsonb_each(to_jsonb(new)) n(k, v)
  where v is distinct from (to_jsonb(old) -> n.k);

  foreach campo in array coalesce(campos_mudados, array[]::text[]) loop
    if campo in ('updated_at') then
      continue;
    end if;
    if not (campo = any(campos_livres)) then
      raise exception 'Campo "%" não pode ser editado por você.', campo;
    end if;
    if not (
      case campo
        when 'dados_tecnicos' then 'dadosTecnicos' = any(old.campos_editaveis_membros)
        else campo = any(old.campos_editaveis_membros)
      end
    ) then
      raise exception 'Campo "%" não está liberado para membros neste projeto.', campo;
    end if;
  end loop;

  return new;
end; $$;

create or replace function public.recalcular_progresso_projeto(p_projeto_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  total int;
  feitas int;
  pct int;
begin
  select count(*), count(*) filter (where status = 'concluido') into total, feitas
  from public.projeto_tarefas where projeto_id = p_projeto_id;
  pct := case when total = 0 then 0 else round(100.0 * feitas / total)::int end;

  perform set_config('cintesp.recalculo', '1', true);
  update public.projetos set progresso = pct where id = p_projeto_id and progresso is distinct from pct;
  perform set_config('cintesp.recalculo', '', true);
end; $$;

create or replace function public.trg_tarefas_progresso()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalcular_progresso_projeto(new.projeto_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    perform public.recalcular_progresso_projeto(old.projeto_id);
  end if;
  return null;
end; $$;

drop trigger if exists trg_projeto_tarefas_progresso on public.projeto_tarefas;
create trigger trg_projeto_tarefas_progresso
  after insert or update of status, projeto_id or delete on public.projeto_tarefas
  for each row execute function public.trg_tarefas_progresso();

-- Acerta o progresso de todos os projetos agora.
do $$
declare r record;
begin
  for r in select id from public.projetos loop
    perform public.recalcular_progresso_projeto(r.id);
  end loop;
end $$;

-- Atualização em tempo real (se a publicação existir).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'projeto_grupos') then
    alter publication supabase_realtime add table public.projeto_grupos;
  end if;
end $$;

notify pgrst, 'reload schema';
