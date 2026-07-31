-- ============================================================
-- CINTESP WEB — Papel "Participante" (conta em espera de liberação)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- O que muda:
--   • Cria a função "Participante": quem acabou de se cadastrar entra nela e
--     NÃO tem acesso à plataforma (quadro, avisos, etc.) — só pode ABRIR
--     CHAMADO. O administrador depois define se a pessoa vira Pesquisador,
--     Coordenador ou Administrador em Administração > Usuários.
--   • Ajusta o gatilho de cadastro: novo usuário = Participante
--     (o PRIMEIRO usuário do sistema continua virando Administrador).
--
-- Requer que 'funcoes.nome' seja único (já é, pelo schema).
-- ============================================================

-- 1) Função Participante (só a permissão de abrir chamado).
insert into public.funcoes (nome, permissoes)
values ('Participante', array['abrir_chamado'])
on conflict (nome) do update set permissoes = excluded.permissoes;

-- 2) Gatilho de cadastro: novo usuário vira Participante (1º vira Administrador).
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
  where nome = case when v_primeiro then 'Administrador' else 'Participante' end
  limit 1;

  insert into public.usuarios (id, nome, email, funcao_id, status)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)),
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
-- Observações
-- ------------------------------------------------------------
-- • Contas Participante JÁ existentes: mude o papel em Administração > Usuários
--   ou direto no banco, ex.:
--     update public.usuarios set funcao_id =
--       (select id from public.funcoes where nome = 'Pesquisador')
--     where email = 'fulano@exemplo.com';
-- • O acesso é barrado também no app (quem não tem 'ver_quadro' nem
--   'gerenciar_tudo' só enxerga "Abrir Chamado").
-- ============================================================
