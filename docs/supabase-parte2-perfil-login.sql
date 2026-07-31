-- ============================================================
-- CINTESP WEB — PARTE 2: perfil manual vira conta no 1º login
--                        + RECONSERTO do acesso de administrador
-- ------------------------------------------------------------
-- Rode este arquivo INTEIRO no SQL Editor do Supabase.
-- É idempotente (pode rodar mais de uma vez sem erro).
--
-- O que ele faz, em ordem:
--   1) Adiciona as colunas de perfil que faltavam em `usuarios`
--      (cpf, whatsapp, endereço, cep, curso). ⚠️ É isto que estava
--      TRAVANDO o carregamento do perfil e derrubando o acesso de admin.
--   2) Garante que as funções essenciais existam (sem apagar as suas).
--   3) Reconserta o administrador (garante que exista pelo menos 1).
--   4) Ajusta o gatilho de cadastro: quando alguém entra com um e-mail que
--      já tem um PERFIL MANUAL (aluno/cadastro sem login), a conta nasce com
--      o PAPEL PRETENDIDO e os dados básicos, e o perfil manual é absorvido.
-- ============================================================


-- 1) COLUNAS DE PERFIL (conserta o acesso) -------------------
alter table public.usuarios add column if not exists cpf      text;
alter table public.usuarios add column if not exists whatsapp text;
alter table public.usuarios add column if not exists endereco text;
alter table public.usuarios add column if not exists cep      text;
alter table public.usuarios add column if not exists curso    text;

-- Coluna usada pela disponibilidade automática (por garantia).
alter table public.disponibilidade
  add column if not exists automatico boolean not null default true;


-- 2) FUNÇÕES ESSENCIAIS (não sobrescreve as que você já tem) --
insert into public.funcoes (nome, permissoes) values
  ('Administrador', array['gerenciar_tudo']),
  ('Coordenador',   array['ver_quadro','publicar_avisos','editar_horarios']),
  ('Pesquisador',   array['ver_quadro']),
  ('Participante',  array['abrir_chamado'])
on conflict (nome) do nothing;

-- Administrador SEMPRE precisa ter 'gerenciar_tudo' (sem remover o resto).
update public.funcoes
set permissoes = (select array(select distinct unnest(permissoes || array['gerenciar_tudo'])))
where nome = 'Administrador';


-- 3) RECONSERTA O ADMINISTRADOR ------------------------------
-- (a) Promove explicitamente o e-mail principal, SE ele existir em usuarios.
--     >> Se o seu e-mail de login for outro, troque abaixo. <<
update public.usuarios
set funcao_id = (select id from public.funcoes where nome = 'Administrador' limit 1),
    status    = 'ativo'
where lower(email) = lower('andre.rodrigues1022@gmail.com');

-- (b) Se AINDA assim ninguém for admin, promove o usuário mais antigo.
do $$
declare
  v_admin uuid;
  v_alvo  uuid;
begin
  select id into v_admin from public.funcoes where nome = 'Administrador' limit 1;
  if not exists (
    select 1 from public.usuarios u
    join public.funcoes f on f.id = u.funcao_id
    where 'gerenciar_tudo' = any (f.permissoes)
  ) then
    select id into v_alvo from public.usuarios order by created_at nulls last limit 1;
    if v_alvo is not null then
      update public.usuarios set funcao_id = v_admin, status = 'ativo' where id = v_alvo;
    end if;
  end if;
end $$;


-- 4) GATILHO: perfil manual -> conta real no 1º login --------
-- Procura um `participantes` com o mesmo e-mail; se achar, usa o
-- `funcaoPretendida` como função e copia os dados básicos (menos o CPF, que
-- fica para a pessoa preencher). Depois remove o perfil manual, para não
-- duplicar na lista de Pesquisadores.
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

  -- Perfil manual com o mesmo e-mail? (protegido caso a tabela não exista)
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

  -- Decide a função da nova conta.
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

  -- Inserção base (só colunas garantidas — nunca quebra o cadastro).
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

  -- Enriquecimento "best-effort": copia os dados básicos do perfil manual.
  -- Se alguma coluna não existir, ignora e segue (não derruba o cadastro).
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
    -- Perfil manual "promovido" vira INATIVO (nada é apagado).
    update public.participantes set status = 'inativo' where id = v_part.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 5) CONFERÊNCIA (opcional) ----------------------------------
-- Rode o SELECT abaixo e confirme que você aparece como 'Administrador':
--   select u.email, f.nome as funcao, u.status
--   from public.usuarios u
--   left join public.funcoes f on f.id = u.funcao_id
--   order by u.created_at;

-- ============================================================
-- Pronto. Recarregue o app (Ctrl+Shift+R) e o acesso de admin volta.
-- Não há ROLLBACK necessário: nada foi apagado; só adicionamos colunas e
-- ajustamos o gatilho de cadastro.
-- ============================================================
