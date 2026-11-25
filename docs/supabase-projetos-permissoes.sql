-- ============================================================
-- CINTESP WEB — Projetos: permissões por projeto, ordem, data de início,
-- conferência de tarefas e gráfico de causa e efeito
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase DEPOIS de docs/supabase-projetos-grupos.sql.
-- É idempotente.
--
-- Regras:
--   • "ADM do projeto" (criador ou responsável) e administrador do sistema: podem tudo.
--     Só eles reordenam grupos e tarefas, concluem tarefas e marcam "Revisada"/"Conferida".
--   • Colaboradores (vinculados): por padrão só consultam. Fazem apenas o que o projeto liberar
--     (projetos.campos_editaveis_membros).
-- ============================================================

-- ---------- Quem pode o quê ----------
create or replace function public.projeto_gestor_geral(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.projeto_dono(p_projeto_id);
$$;

create or replace function public.projeto_permite(p_projeto_id uuid, p_permissao text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.projeto_dono(p_projeto_id)
      or (
        public.projeto_membro(p_projeto_id)
        and exists (select 1 from public.projetos p where p.id = p_projeto_id and p_permissao = any(p.campos_editaveis_membros))
      );
$$;

-- ---------- Dados do projeto (campos liberados) ----------
create or replace function public.projetos_valida_edicao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  campos_mudados text[];
  campo          text;
  permissao      text;
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

  -- Só quem JÁ era dono. (Antes bastava o novo responsável ser a própria pessoa, o que
  -- deixava um colaborador se promover.)
  if public.is_admin() or auth.uid() = old.criado_por or auth.uid() = old.responsavel_id then
    return new;
  end if;

  if not exists (select 1 from public.projeto_pesquisadores where projeto_id = old.id and usuario_id = auth.uid()) then
    raise exception 'Você não pode editar este projeto: só o criador e o responsável podem.';
  end if;

  select array_agg(k) into campos_mudados
  from jsonb_each(to_jsonb(new)) n(k, v)
  where v is distinct from (to_jsonb(old) -> n.k);

  foreach campo in array coalesce(campos_mudados, array[]::text[]) loop
    if campo = 'updated_at' then
      continue;
    end if;
    permissao := case campo
      when 'trl' then 'trl'
      when 'dados_tecnicos' then 'dadosTecnicos'
      when 'descricao' then 'descricao'
      when 'observacoes' then 'observacoes'
      when 'capa_url' then 'capa'
      when 'status' then 'cronograma'
      when 'data_inicio' then 'cronograma'
      when 'data_fim_prevista' then 'cronograma'
    end;
    if permissao is null then
      raise exception 'Campo "%" não pode ser editado por você.', campo;
    end if;
    if not (permissao = any(old.campos_editaveis_membros)) then
      raise exception 'Campo "%" não está liberado para colaboradores neste projeto.', campo;
    end if;
  end loop;

  return new;
end; $$;

-- ---------- Capa ----------
drop policy if exists "projeto_capas: enviar" on storage.objects;
create policy "projeto_capas: enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'projeto-capas' and public.projeto_permite(((storage.foldername(name))[1])::uuid, 'capa'));

drop policy if exists "projeto_capas: trocar" on storage.objects;
create policy "projeto_capas: trocar" on storage.objects
  for update to authenticated
  using (bucket_id = 'projeto-capas' and public.projeto_permite(((storage.foldername(name))[1])::uuid, 'capa'))
  with check (bucket_id = 'projeto-capas' and public.projeto_permite(((storage.foldername(name))[1])::uuid, 'capa'));

drop policy if exists "projeto_capas: apagar" on storage.objects;
create policy "projeto_capas: apagar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'projeto-capas' and public.projeto_permite(((storage.foldername(name))[1])::uuid, 'capa'));

-- ---------- Links (Drive e WhatsApp) ----------
drop policy if exists "projeto_links: criar" on public.projeto_links;
create policy "projeto_links: criar" on public.projeto_links
  for insert to authenticated with check (public.projeto_permite(projeto_id, 'links'));

drop policy if exists "projeto_links: editar" on public.projeto_links;
create policy "projeto_links: editar" on public.projeto_links
  for update to authenticated
  using (public.projeto_permite(projeto_id, 'links'))
  with check (public.projeto_permite(projeto_id, 'links'));

drop policy if exists "projeto_links: apagar" on public.projeto_links;
create policy "projeto_links: apagar" on public.projeto_links
  for delete to authenticated using (public.projeto_permite(projeto_id, 'links'));

-- ---------- Grupos ----------
-- Quem mexe na lista de acesso do grupo.
create or replace function public.grupo_gestor(p_grupo_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projeto_grupos g
    where g.id = p_grupo_id
      and (
        public.projeto_permite(g.projeto_id, 'gruposEditar')
        or (g.criado_por = auth.uid() and public.projeto_permite(g.projeto_id, 'gruposCriar'))
      )
  );
$$;

drop policy if exists "projeto_grupos: criar" on public.projeto_grupos;
create policy "projeto_grupos: criar" on public.projeto_grupos
  for insert to authenticated
  with check (criado_por = auth.uid() and public.projeto_permite(projeto_id, 'gruposCriar'));

drop policy if exists "projeto_grupos: editar" on public.projeto_grupos;
create policy "projeto_grupos: editar" on public.projeto_grupos
  for update to authenticated
  using (public.grupo_acesso(id) and public.projeto_permite(projeto_id, 'gruposEditar'))
  with check (public.projeto_permite(projeto_id, 'gruposEditar'));

drop policy if exists "projeto_grupos: excluir" on public.projeto_grupos;
create policy "projeto_grupos: excluir" on public.projeto_grupos
  for delete to authenticated
  using (public.grupo_acesso(id) and public.projeto_permite(projeto_id, 'gruposExcluir'));

-- Ordem dos grupos: só ADM do projeto / sistema.
create or replace function public.projeto_grupos_valida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (new.ordem is distinct from old.ordem or new.projeto_id is distinct from old.projeto_id)
     and not public.projeto_gestor_geral(old.projeto_id) then
    raise exception 'Só o responsável pelo projeto ou o administrador pode reordenar os grupos.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_projeto_grupos_valida on public.projeto_grupos;
create trigger trg_projeto_grupos_valida
  before update on public.projeto_grupos
  for each row execute function public.projeto_grupos_valida();

-- ---------- Tarefas: início, ordem e conferência ----------
alter table public.projeto_tarefas add column if not exists data_inicio date;
alter table public.projeto_tarefas add column if not exists ordem int not null default 0;
alter table public.projeto_tarefas add column if not exists conferencia text;
alter table public.projeto_tarefas add column if not exists conferida_por uuid references public.usuarios (id) on delete set null;
alter table public.projeto_tarefas add column if not exists conferida_em timestamptz;

alter table public.projeto_tarefas drop constraint if exists projeto_tarefas_conferencia_check;
alter table public.projeto_tarefas add constraint projeto_tarefas_conferencia_check
  check (conferencia is null or conferencia in ('revisada', 'conferida'));

create or replace function public.projeto_tarefas_valida()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  gestor boolean;
begin
  -- Tarefa que não está concluída não tem conferência.
  if new.status <> 'concluido' then
    new.conferencia := null;
    new.conferida_por := null;
    new.conferida_em := null;
  elsif new.conferencia is null then
    new.conferida_por := null;
    new.conferida_em := null;
  elsif tg_op = 'INSERT' or new.conferencia is distinct from old.conferencia then
    new.conferida_por := auth.uid();
    new.conferida_em := now();
  end if;

  -- Nova tarefa entra no fim do grupo.
  if tg_op = 'INSERT' then
    select coalesce(max(ordem), 0) + 1 into new.ordem from public.projeto_tarefas where grupo_id = new.grupo_id;
  end if;

  if auth.uid() is null then
    return new; -- manutenção pelo próprio banco
  end if;

  gestor := public.projeto_gestor_geral(new.projeto_id);

  if tg_op = 'INSERT' then
    if not gestor and (new.status = 'concluido' or new.conferencia is not null) then
      raise exception 'Só o responsável pelo projeto ou o administrador pode concluir tarefas.';
    end if;
    return new;
  end if;

  if gestor and public.projeto_gestor_geral(old.projeto_id) then
    return new;
  end if;

  if new.projeto_id is distinct from old.projeto_id or new.criado_por is distinct from old.criado_por and new.criado_por is not null then
    raise exception 'Esse dado da tarefa não pode ser alterado.';
  end if;
  if new.ordem is distinct from old.ordem then
    raise exception 'Só o responsável pelo projeto ou o administrador pode reordenar as tarefas.';
  end if;
  if new.conferencia is distinct from old.conferencia then
    raise exception 'Só o responsável pelo projeto ou o administrador pode marcar como revisada ou conferida.';
  end if;
  if new.status is distinct from old.status then
    if new.status = 'concluido' or old.status = 'concluido' then
      raise exception 'Só o responsável pelo projeto ou o administrador pode concluir ou reabrir tarefas.';
    end if;
    if not (public.projeto_permite(old.projeto_id, 'tarefasAndamento') or public.projeto_permite(old.projeto_id, 'tarefasEditar')) then
      raise exception 'Você não pode mudar o andamento das tarefas deste projeto.';
    end if;
  end if;
  if (new.titulo, new.descricao, new.prioridade, new.responsavel_id, new.data_inicio, new.data_entrega, new.grupo_id)
       is distinct from
     (old.titulo, old.descricao, old.prioridade, old.responsavel_id, old.data_inicio, old.data_entrega, old.grupo_id)
     and not public.projeto_permite(old.projeto_id, 'tarefasEditar') then
    raise exception 'Você não pode editar as tarefas deste projeto.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_projeto_tarefas_valida on public.projeto_tarefas;
create trigger trg_projeto_tarefas_valida
  before insert or update on public.projeto_tarefas
  for each row execute function public.projeto_tarefas_valida();

drop policy if exists "projeto_tarefas: criar" on public.projeto_tarefas;
create policy "projeto_tarefas: criar" on public.projeto_tarefas
  for insert to authenticated
  with check (
    criado_por = auth.uid()
    and public.grupo_acesso(grupo_id)
    and public.grupo_pertence(grupo_id, projeto_id)
    and public.projeto_permite(projeto_id, 'tarefasCriar')
  );

drop policy if exists "projeto_tarefas: editar" on public.projeto_tarefas;
create policy "projeto_tarefas: editar" on public.projeto_tarefas
  for update to authenticated
  using (
    public.grupo_acesso(grupo_id)
    and (public.projeto_permite(projeto_id, 'tarefasEditar') or public.projeto_permite(projeto_id, 'tarefasAndamento'))
  )
  with check (public.grupo_acesso(grupo_id) and public.grupo_pertence(grupo_id, projeto_id));

drop policy if exists "projeto_tarefas: excluir" on public.projeto_tarefas;
create policy "projeto_tarefas: excluir" on public.projeto_tarefas
  for delete to authenticated
  using (public.grupo_acesso(grupo_id) and public.projeto_permite(projeto_id, 'tarefasExcluir'));

-- ---------- Gráfico de causa e efeito ----------
create table if not exists public.projeto_causa_efeito (
  projeto_id uuid primary key references public.projetos (id) on delete cascade,
  efeito     text not null default '',
  causas     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.projeto_causa_efeito enable row level security;

drop policy if exists "projeto_causa_efeito: ler" on public.projeto_causa_efeito;
create policy "projeto_causa_efeito: ler" on public.projeto_causa_efeito
  for select to authenticated
  using (public.is_admin() or public.projeto_membro(projeto_id) or public.projeto_dono(projeto_id));

drop policy if exists "projeto_causa_efeito: criar" on public.projeto_causa_efeito;
create policy "projeto_causa_efeito: criar" on public.projeto_causa_efeito
  for insert to authenticated with check (public.projeto_permite(projeto_id, 'causaEfeito'));

drop policy if exists "projeto_causa_efeito: editar" on public.projeto_causa_efeito;
create policy "projeto_causa_efeito: editar" on public.projeto_causa_efeito
  for update to authenticated
  using (public.projeto_permite(projeto_id, 'causaEfeito'))
  with check (public.projeto_permite(projeto_id, 'causaEfeito'));

grant select, insert, update, delete on public.projeto_causa_efeito to authenticated;

notify pgrst, 'reload schema';
