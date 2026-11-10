-- ============================================================
-- CINTESP WEB — Projetos: todos veem, todos criam, só o dono edita
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase DEPOIS de docs/supabase-projetos.sql.
-- É idempotente.
--
-- Regras:
--   • Leitura: qualquer usuário logado vê TODOS os projetos.
--   • Criar: qualquer usuário logado cria (vira o "criador").
--   • Editar conteúdo, equipe e excluir: administrador, CRIADOR do projeto
--     (e o responsável indicado por ele, no conteúdo e na equipe).
--     Os demais só consultam — salvo os campos que o dono liberar aos membros.
--   • Chat/anexos: admin, criador e vinculados (continua privado da equipe).
-- ============================================================

-- Dono = criador ou responsável do projeto.
create or replace function public.projeto_dono(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projetos
    where id = p_projeto_id
      and (criado_por = auth.uid() or responsavel_id = auth.uid())
  );
$$;

-- "Membro" passa a incluir o criador (para chat, anexos e a linha ficar editável).
create or replace function public.projeto_membro(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projeto_pesquisadores
    where projeto_id = p_projeto_id and usuario_id = auth.uid()
  ) or exists (
    select 1 from public.projetos
    where id = p_projeto_id and criado_por = auth.uid()
  );
$$;

-- ---- projetos ----
drop policy if exists "projetos: admin cria" on public.projetos;
drop policy if exists "projetos: criar" on public.projetos;
create policy "projetos: criar" on public.projetos
  for insert to authenticated
  with check (public.is_admin() or criado_por = auth.uid());

drop policy if exists "projetos: admin exclui" on public.projetos;
drop policy if exists "projetos: excluir" on public.projetos;
create policy "projetos: excluir" on public.projetos
  for delete to authenticated
  using (public.is_admin() or criado_por = auth.uid());

-- ---- projeto_pesquisadores (equipe) ----
drop policy if exists "projeto_pesquisadores: admin gere" on public.projeto_pesquisadores;
drop policy if exists "projeto_pesquisadores: dono gere" on public.projeto_pesquisadores;
create policy "projeto_pesquisadores: dono gere" on public.projeto_pesquisadores
  for all to authenticated
  using (public.is_admin() or public.projeto_dono(projeto_id))
  with check (public.is_admin() or public.projeto_dono(projeto_id));

-- ---- Trigger de edição: o criador também edita tudo; ninguém além do admin troca o criador ----
create or replace function public.projetos_valida_edicao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  eh_membro       boolean;
  campos_mudados  text[];
  campo           text;
  campos_livres   text[] := array['trl', 'progresso', 'dados_tecnicos', 'descricao', 'observacoes'];
begin
  if new.criado_por is distinct from old.criado_por and not public.is_admin() then
    raise exception 'Apenas o administrador pode trocar o criador do projeto.';
  end if;

  -- Admin, criador e responsável (atual ou o que está saindo) editam tudo.
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

notify pgrst, 'reload schema';
