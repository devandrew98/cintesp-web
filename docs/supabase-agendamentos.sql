-- ============================================================
-- CINTESP — Agendamento de avaliações (formulário público + área do
-- "Pesquisador Avaliador")
-- Rode no SQL Editor do Supabase. Idempotente.
--
-- QUEM É O AVALIADOR: quem tem a função "Pesquisador Avaliador" (o nome começa
-- assim) OU a permissão `avaliar_agendamentos` na função. Administrador NÃO entra
-- automaticamente: são dados de saúde — para ver, dê a função a quem precisa.
--
-- O QUE É PÚBLICO (anon, sem login): ver a configuração (local, períodos,
-- WhatsApp), ver quais blocos estão ocupados (só data+hora, nunca de quem) e
-- ENVIAR uma solicitação. Nada é lido de volta: a anamnese e os dados pessoais
-- só o avaliador enxerga (RLS).
--
-- Tabelas:
--   agendamento_config       (1 linha)  local, WhatsApp, períodos das fases, abre/fecha
--   agendamento_solicitacoes            dados pessoais + triagem (jsonb) + status
--   agendamento_itens                   as 5 avaliações (data + bloco de 1h) de cada solicitação
--   agendamento_eventos                 compromissos e bloqueios da agenda do avaliador
--   agendamento_anotacoes               anotações / prontuário / relatório por solicitante
-- ============================================================

-- ---------- permissão ----------
create or replace function public.pode_avaliar()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.usuarios u
    join public.funcoes f on f.id = u.funcao_id
    where u.id = auth.uid()
      and u.status = 'ativo'
      and (f.nome ilike 'Pesquisador Avaliador%' or 'avaliar_agendamentos' = any (f.permissoes))
  );
$$;
grant execute on function public.pode_avaliar() to authenticated;

-- ---------- tabelas ----------
create table if not exists public.agendamento_config (
  id              int primary key default 1 check (id = 1),
  whatsapp        text,
  local           text not null default 'Arena Sabiazinho',
  fase1_inicio    date not null default '2026-11-23',
  fase1_fim       date not null default '2026-12-06',
  fase2_inicio    date not null default '2026-12-07',
  fase2_fim       date not null default '2026-12-20',
  triagem_limite  date default '2026-11-22',
  ativo           boolean not null default true
);
insert into public.agendamento_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.agendamento_solicitacoes (
  id            uuid primary key default gen_random_uuid(),
  protocolo     text not null unique
                default ('AG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  nome          text not null,
  cpf           text not null check (cpf ~ '^[0-9]{11}$'),
  endereco      text not null,
  telefone      text not null,
  email         text not null,
  perfil        text not null check (perfil in ('Atleta', 'Não atleta')),
  deficiencia   text not null,
  triagem       jsonb not null,
  status        text not null default 'pendente' check (status in ('pendente', 'confirmado', 'cancelado')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists agendamento_solicitacoes_cpf_idx on public.agendamento_solicitacoes (cpf);

create table if not exists public.agendamento_itens (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.agendamento_solicitacoes (id) on delete cascade,
  avaliacao_id   text not null check (avaliacao_id in
                   ('antropometrica', 'dinamometria', 'ergoespirometria', 'potencia_anaerobia', 'capacidade_aerobia')),
  avaliacao_nome text not null,
  fase           int  not null check (fase in (1, 2)),
  data           date not null,
  hora_inicio    time not null check (hora_inicio in
                   ('08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00')),
  status         text not null default 'pendente' check (status in ('pendente', 'confirmado', 'cancelado'))
);
-- Trava final contra duplicidade: dois agendamentos no mesmo dia/horário NUNCA coexistem.
create unique index if not exists agendamento_itens_slot_unico
  on public.agendamento_itens (data, hora_inicio) where status <> 'cancelado';
create index if not exists agendamento_itens_solicitacao_idx on public.agendamento_itens (solicitacao_id);

create table if not exists public.agendamento_eventos (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('compromisso', 'bloqueio')),
  titulo      text not null,
  data        date not null,
  hora_inicio time,
  hora_fim    time,
  dia_inteiro boolean not null default false,
  notas       text,
  criado_por  uuid references public.usuarios (id) on delete set null,
  criado_em   timestamptz not null default now(),
  check (dia_inteiro or (hora_inicio is not null and hora_fim is not null and hora_fim > hora_inicio))
);
create index if not exists agendamento_eventos_data_idx on public.agendamento_eventos (data);

create table if not exists public.agendamento_anotacoes (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.agendamento_solicitacoes (id) on delete cascade,
  tipo           text not null check (tipo in ('anotacao', 'prontuario', 'relatorio')),
  texto          text not null check (length(btrim(texto)) > 0),
  autor_id       uuid references public.usuarios (id) on delete set null,
  autor_nome     text,
  criado_em      timestamptz not null default now()
);
create index if not exists agendamento_anotacoes_solicitacao_idx on public.agendamento_anotacoes (solicitacao_id);

-- ---------- RLS: só o avaliador lê/escreve direto nas tabelas ----------
alter table public.agendamento_config       enable row level security;
alter table public.agendamento_solicitacoes enable row level security;
alter table public.agendamento_itens        enable row level security;
alter table public.agendamento_eventos      enable row level security;
alter table public.agendamento_anotacoes    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['agendamento_config', 'agendamento_solicitacoes', 'agendamento_itens',
                           'agendamento_eventos', 'agendamento_anotacoes']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_avaliador', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.pode_avaliar()) with check (public.pode_avaliar())',
      t || '_avaliador', t);
  end loop;
end $$;

-- ---------- funções PÚBLICAS (anon) ----------

-- Configuração que o formulário precisa (sem nada pessoal).
create or replace function public.agendamento_config_publica()
returns table (whatsapp text, local text, fase1_inicio date, fase1_fim date,
               fase2_inicio date, fase2_fim date, triagem_limite date, ativo boolean)
language sql stable security definer set search_path = public as $$
  select c.whatsapp, c.local, c.fase1_inicio, c.fase1_fim, c.fase2_inicio, c.fase2_fim, c.triagem_limite, c.ativo
  from public.agendamento_config c where c.id = 1;
$$;

-- Blocos ocupados (data + hora), por avaliações pedidas e por compromissos/bloqueios do avaliador.
create or replace function public.agendamento_ocupados(p_de date, p_ate date)
returns table (data date, hora text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 180 then
    raise exception 'Período inválido.';
  end if;
  return query
    select i.data, to_char(i.hora_inicio, 'HH24:MI')
    from public.agendamento_itens i
    where i.status <> 'cancelado' and i.data between p_de and p_ate
    union
    select e.data, to_char(h.hora, 'HH24:MI')
    from public.agendamento_eventos e
    join (values ('08:00'::time), ('09:00'::time), ('10:00'::time), ('11:00'::time),
                 ('13:00'::time), ('14:00'::time), ('15:00'::time), ('16:00'::time)) as h(hora)
      on e.dia_inteiro or (e.hora_inicio < h.hora + interval '1 hour' and e.hora_fim > h.hora)
    where e.data between p_de and p_ate;
end;
$$;

create or replace function public.agendamento_cpf_valido(p_cpf text)
returns boolean
language plpgsql immutable as $$
declare
  c text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  soma int; resto int; d1 int; d2 int; i int;
begin
  if length(c) <> 11 or c ~ '^(\d)\1{10}$' then return false; end if;
  soma := 0;
  for i in 1..9 loop soma := soma + substr(c, i, 1)::int * (11 - i); end loop;
  resto := (soma * 10) % 11; d1 := case when resto = 10 then 0 else resto end;
  soma := 0;
  for i in 1..10 loop soma := soma + substr(c, i, 1)::int * (12 - i); end loop;
  resto := (soma * 10) % 11; d2 := case when resto = 10 then 0 else resto end;
  return d1 = substr(c, 10, 1)::int and d2 = substr(c, 11, 1)::int;
end;
$$;

-- Recebe a solicitação inteira e valida TUDO de novo no servidor (as regras do front são só conforto).
create or replace function public.agendamento_solicitar(p_pessoa jsonb, p_triagem jsonb, p_itens jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg         public.agendamento_config;
  v_cpf       text;
  v_id        uuid;
  v_proto     text;
  v_hoje      date := (now() at time zone 'America/Sao_Paulo')::date;
  it          jsonb;
  v_av        text;
  v_nome      text;
  v_fase      int;
  v_data      date;
  v_hora      time;
  v_total     int := 0;
  v_ids       text[] := '{}';
  v_chaves    text[] := '{}';
  v_dias1     date[] := '{}';
  v_dias2     date[] := '{}';
  v_ini       date;
  v_fim       date;
begin
  -- Uma solicitação por vez: evita que duas pessoas peguem o mesmo bloco ao mesmo tempo.
  perform pg_advisory_xact_lock(hashtext('agendamento_solicitar'));

  select * into cfg from public.agendamento_config where id = 1;
  if not found or not cfg.ativo then
    raise exception 'Os agendamentos estão fechados no momento.';
  end if;

  -- Freio contra abuso do formulário público.
  if (select count(*) from public.agendamento_solicitacoes where criado_em > now() - interval '1 hour') >= 40 then
    raise exception 'Muitas solicitações em pouco tempo. Tente novamente mais tarde.';
  end if;

  -- Dados pessoais
  v_cpf := regexp_replace(coalesce(p_pessoa ->> 'cpf', ''), '\D', '', 'g');
  if length(btrim(coalesce(p_pessoa ->> 'nome', ''))) < 3 then raise exception 'Informe o nome completo.'; end if;
  if not public.agendamento_cpf_valido(v_cpf) then raise exception 'CPF inválido.'; end if;
  if length(btrim(coalesce(p_pessoa ->> 'endereco', ''))) < 5 then raise exception 'Informe o endereço.'; end if;
  if length(regexp_replace(coalesce(p_pessoa ->> 'telefone', ''), '\D', '', 'g')) not in (10, 11) then
    raise exception 'Informe o telefone com DDD.';
  end if;
  if coalesce(p_pessoa ->> 'email', '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'E-mail inválido.'; end if;
  if coalesce(p_pessoa ->> 'perfil', '') not in ('Atleta', 'Não atleta') then raise exception 'Informe o perfil.'; end if;
  if length(btrim(coalesce(p_pessoa ->> 'deficiencia', ''))) < 2 then
    raise exception 'Informe o tipo de deficiência / patologia.';
  end if;

  -- Triagem concluída e autorizada
  if p_triagem is null or jsonb_typeof(p_triagem) <> 'object' or coalesce(p_triagem ->> 'autorizacao', '') <> 'Sim' then
    raise exception 'A triagem precisa estar concluída e autorizada.';
  end if;

  -- Uma solicitação ativa por CPF (evita agendamento duplicado da mesma pessoa).
  if exists (select 1 from public.agendamento_solicitacoes where cpf = v_cpf and status <> 'cancelado') then
    raise exception 'Já existe uma solicitação ativa para este CPF. Fale com o pesquisador para alterá-la.';
  end if;

  -- Itens
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) <> 5 then
    raise exception 'Escolha data e horário para todas as 5 avaliações.';
  end if;

  for it in select * from jsonb_array_elements(p_itens) loop
    v_av := it ->> 'avaliacao_id';
    select n, f into v_nome, v_fase from (values
      ('antropometrica',     'Avaliação antropométrica',            1),
      ('dinamometria',       'Dinamometria isocinética',            1),
      ('ergoespirometria',   'Ergoespirometria',                    2),
      ('potencia_anaerobia', 'Avaliação da potência anaeróbia',     2),
      ('capacidade_aerobia', 'Avaliação da capacidade aeróbia',     2)
    ) as a(id, n, f) where a.id = v_av;
    if v_nome is null then raise exception 'Avaliação desconhecida.'; end if;
    if v_av = any (v_ids) then raise exception 'Avaliação repetida.'; end if;
    v_ids := v_ids || v_av;

    begin
      v_data := (it ->> 'data')::date;
      v_hora := (it ->> 'hora')::time;
    exception when others then
      raise exception 'Data ou horário inválido para %.', v_nome;
    end;

    if extract(isodow from v_data) not between 1 and 5 then
      raise exception '%: só são aceitos dias úteis.', v_nome;
    end if;
    if v_fase = 1 then v_ini := cfg.fase1_inicio; v_fim := cfg.fase1_fim;
    else v_ini := cfg.fase2_inicio; v_fim := cfg.fase2_fim; end if;
    if v_data < v_ini or v_data > v_fim then
      raise exception '%: a data precisa estar dentro do período da Fase %.', v_nome, v_fase;
    end if;
    if v_data < v_hoje then raise exception '%: a data já passou.', v_nome; end if;
    if v_hora not in ('08:00'::time, '09:00'::time, '10:00'::time, '11:00'::time,
                      '13:00'::time, '14:00'::time, '15:00'::time, '16:00'::time) then
      raise exception '%: horário inválido.', v_nome;
    end if;

    -- bloco já pedido por outra pessoa, ou coberto por compromisso/bloqueio do avaliador
    if exists (select 1 from public.agendamento_itens
               where data = v_data and hora_inicio = v_hora and status <> 'cancelado')
       or exists (select 1 from public.agendamento_eventos e
                  where e.data = v_data
                    and (e.dia_inteiro or (e.hora_inicio < v_hora + interval '1 hour' and e.hora_fim > v_hora))) then
      raise exception '%: o horário de % às % não está mais disponível. Escolha outro.',
        v_nome, to_char(v_data, 'DD/MM/YYYY'), to_char(v_hora, 'HH24:MI');
    end if;

    if (v_data::text || '|' || v_hora::text) = any (v_chaves) then
      raise exception 'Não é permitido agendar duas avaliações no mesmo dia e horário.';
    end if;
    v_chaves := v_chaves || (v_data::text || '|' || v_hora::text);

    if v_fase = 1 then
      if v_data = any (v_dias1) then raise exception 'Na Fase 1, cada avaliação deve ser em um dia diferente.'; end if;
      v_dias1 := v_dias1 || v_data;
    else
      if v_data = any (v_dias2) then raise exception 'Na Fase 2, cada avaliação deve ser em um dia diferente.'; end if;
      v_dias2 := v_dias2 || v_data;
    end if;
    v_total := v_total + 1;
  end loop;

  if (select max(d) from unnest(v_dias1) d) >= (select min(d) from unnest(v_dias2) d) then
    raise exception 'Todas as avaliações da Fase 1 devem acontecer antes de qualquer avaliação da Fase 2.';
  end if;

  insert into public.agendamento_solicitacoes (nome, cpf, endereco, telefone, email, perfil, deficiencia, triagem)
  values (btrim(p_pessoa ->> 'nome'), v_cpf, btrim(p_pessoa ->> 'endereco'), btrim(p_pessoa ->> 'telefone'),
          btrim(p_pessoa ->> 'email'), p_pessoa ->> 'perfil', btrim(p_pessoa ->> 'deficiencia'), p_triagem)
  returning id, protocolo into v_id, v_proto;

  begin
    insert into public.agendamento_itens (solicitacao_id, avaliacao_id, avaliacao_nome, fase, data, hora_inicio)
    select v_id, e ->> 'avaliacao_id',
           case e ->> 'avaliacao_id'
             when 'antropometrica'     then 'Avaliação antropométrica'
             when 'dinamometria'       then 'Dinamometria isocinética'
             when 'ergoespirometria'   then 'Ergoespirometria'
             when 'potencia_anaerobia' then 'Avaliação da potência anaeróbia'
             else 'Avaliação da capacidade aeróbia' end,
           case when e ->> 'avaliacao_id' in ('antropometrica', 'dinamometria') then 1 else 2 end,
           (e ->> 'data')::date, (e ->> 'hora')::time
    from jsonb_array_elements(p_itens) e;
  exception when unique_violation then
    raise exception 'Um dos horários acabou de ser ocupado. Escolha outro.';
  end;

  return jsonb_build_object('id', v_id, 'protocolo', v_proto);
end;
$$;

grant execute on function public.agendamento_config_publica() to anon, authenticated;
grant execute on function public.agendamento_ocupados(date, date) to anon, authenticated;
grant execute on function public.agendamento_solicitar(jsonb, jsonb, jsonb) to anon, authenticated;

-- ---------- funções do AVALIADOR ----------

-- Confirma ou cancela a solicitação inteira (e as avaliações dela, de forma atômica).
create or replace function public.agendamento_definir_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.pode_avaliar() then raise exception 'Sem permissão.'; end if;
  if p_status not in ('confirmado', 'cancelado') then raise exception 'Status inválido.'; end if;
  update public.agendamento_solicitacoes set status = p_status, atualizado_em = now() where id = p_id;
  if p_status = 'cancelado' then
    update public.agendamento_itens set status = 'cancelado' where solicitacao_id = p_id;
  else
    -- avaliações já desmarcadas continuam desmarcadas
    update public.agendamento_itens set status = 'confirmado' where solicitacao_id = p_id and status <> 'cancelado';
  end if;
end;
$$;

-- Desmarca UMA avaliação (libera o horário). Se era a última, a solicitação inteira é cancelada.
create or replace function public.agendamento_cancelar_item(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_sol uuid;
begin
  if not public.pode_avaliar() then raise exception 'Sem permissão.'; end if;
  update public.agendamento_itens set status = 'cancelado' where id = p_id returning solicitacao_id into v_sol;
  if v_sol is not null and not exists (
    select 1 from public.agendamento_itens where solicitacao_id = v_sol and status <> 'cancelado'
  ) then
    update public.agendamento_solicitacoes set status = 'cancelado', atualizado_em = now() where id = v_sol;
  end if;
end;
$$;

grant execute on function public.agendamento_definir_status(uuid, text) to authenticated;
grant execute on function public.agendamento_cancelar_item(uuid) to authenticated;
