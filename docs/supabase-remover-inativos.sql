-- ============================================================
-- CINTESP WEB — Remover os perfis SEM LOGIN inativos (planilha)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase.
--
-- Contexto: os "Aluno · sem acesso / Inativo" são perfis importados da
-- planilha. Alguns viraram duplicata quando a pessoa criou login (aí o
-- perfil sem login ficou inativo). Este arquivo:
--   1) APAGA todos os participantes inativos (perfis sem login);
--   2) ajusta o gatilho para, daqui pra frente, APAGAR o perfil da planilha
--      quando a pessoa cria a conta (em vez de deixá-lo inativo).
--
-- ✅ SEGURO: mexe só na tabela `participantes` e no gatilho de cadastro.
--    Usuários com login (com acesso) NÃO são tocados.
-- ============================================================

-- (opcional) Veja quantos serão removidos:
select count(*) as inativos_a_remover
from public.participantes
where status = 'inativo';

-- 1) Remove os perfis sem login inativos.
delete from public.participantes where status = 'inativo';

-- 2) Gatilho: ao criar login, APAGA o perfil da planilha (sem deixar inativo).
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
    -- Perfil da planilha "promovido" é REMOVIDO (não vira duplicata).
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
-- Pronto. Recarregue a tela de Pesquisadores (Ctrl+Shift+R).
-- ============================================================
