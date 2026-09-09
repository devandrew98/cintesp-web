-- ============================================================
-- CINTESP WEB — Corrige: novo usuário deve entrar como Participante
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Bug: as duas últimas versões do gatilho `handle_new_user`
-- (docs/supabase-atualizacoes.sql e docs/supabase-remover-inativos.sql)
-- aplicavam automaticamente o "papel pretendido" (dados_extras->>
-- 'funcaoPretendida', vindo de cadastro manual ou planilha de
-- participantes) já no primeiro login — ou seja, alguém marcado como
-- "Pesquisador" na planilha entrava DIRETO como Pesquisador, sem passar
-- pelo Participante nem pela liberação do admin.
--
-- Correção: todo mundo que faz login pela primeira vez entra como
-- "Participante" (só pode abrir chamado) — EXCETO o primeiro usuário do
-- sistema, que continua virando Administrador. O admin decide manualmente,
-- em Administração > Pesquisadores, quando promover alguém.
--
-- O campo `funcaoPretendida` continua sendo salvo (é só um indício pro
-- admin saber o que a pessoa pediu) — só não é mais aplicado sozinho.
-- ============================================================

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

  -- Sempre Participante, exceto o 1º usuário do sistema (vira Administrador).
  -- NÃO aplica mais `funcaoPretendida` automaticamente — isso fica a
  -- critério do admin, depois do primeiro login.
  v_func_nome := case when v_primeiro then 'Administrador' else 'Participante' end;

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

-- ============================================================
-- Contas que JÁ entraram erradas (viraram Pesquisador/Coordenador/Admin
-- sem passar pelo admin): rode a consulta abaixo pra ver quem foi afetado
-- e decida se rebaixa manualmente pra Participante.
--
--   select u.id, u.nome, u.email, f.nome as funcao_atual, u.created_at
--   from public.usuarios u
--   join public.funcoes f on f.id = u.funcao_id
--   where f.nome <> 'Participante'
--   order by u.created_at desc;
--
-- Pra rebaixar um usuário específico pra Participante:
--   update public.usuarios set funcao_id =
--     (select id from public.funcoes where nome = 'Participante')
--   where email = 'fulano@exemplo.com';
-- ============================================================
