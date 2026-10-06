-- ============================================================
-- CINTESP — Ponto: FALTA + disponibilidade ligada ao ponto
-- Rode DEPOIS de supabase-ponto.sql e supabase-ponto-autoatendimento.sql.
-- É idempotente (pode rodar mais de uma vez).
--
--  1) ponto_registros.tipo passa a aceitar 'falta' (lançada pelo admin,
--     dia inteiro, sempre com motivo). Falta NÃO conta como entrada/saída:
--     as funções de registro/status ignoram faltas ao decidir o próximo tipo.
--  2) ponto_presentes(): quem está "dentro" agora (última batida de HOJE é
--     entrada). O app usa isso para marcar o pesquisador como disponível
--     apenas depois de bater o ponto.
-- ============================================================

-- ---------- 1) tipo 'falta' ----------
do $$
declare
  v_nome text;
begin
  for v_nome in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.ponto_registros'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%tipo%entrada%'
  loop
    execute format('alter table public.ponto_registros drop constraint %I', v_nome);
  end loop;
end $$;

alter table public.ponto_registros
  add constraint ponto_registros_tipo_check check (tipo in ('entrada', 'saida', 'falta'));

-- ---------- status pelo token (ignora faltas) ----------
create or replace function public.ponto_status_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash        text;
  v_usuario_id  uuid;
  v_nome        text;
  v_status      public.status_usuario;
  v_ultimo_tipo text;
  v_ultimo_em   timestamptz;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'QR Code vazio.';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select usuario_id into v_usuario_id
  from public.pesquisador_qr_tokens
  where token_hash = v_hash and ativo = true;

  if v_usuario_id is null then
    raise exception 'QR Code inválido ou revogado.';
  end if;

  select nome, status into v_nome, v_status from public.usuarios where id = v_usuario_id;
  if v_status is distinct from 'ativo' then
    raise exception 'Pesquisador inativo — ponto não registrado.';
  end if;

  select tipo, registrado_em into v_ultimo_tipo, v_ultimo_em
  from public.ponto_registros
  where usuario_id = v_usuario_id and tipo <> 'falta'
  order by registrado_em desc
  limit 1;

  return jsonb_build_object(
    'nome', v_nome,
    'proximoTipo', case when v_ultimo_tipo = 'entrada' then 'saida' else 'entrada' end,
    'ultimoTipo', v_ultimo_tipo,
    'ultimoRegistradoEm', v_ultimo_em
  );
end;
$$;

-- ---------- registrar ponto (ignora faltas ao alternar entrada/saída) ----------
create or replace function public.ponto_registrar(p_token text, p_terminal_id text default 'AUTOATENDIMENTO')
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash          text;
  v_usuario_id    uuid;
  v_nome          text;
  v_status        public.status_usuario;
  v_ultimo_em     timestamptz;
  v_ultimo_tipo   text;
  v_tipo          text;
  v_ip            text;
  v_registrado_em timestamptz;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'QR Code vazio.';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select usuario_id into v_usuario_id
  from public.pesquisador_qr_tokens
  where token_hash = v_hash and ativo = true;

  if v_usuario_id is null then
    raise exception 'QR Code inválido ou revogado.';
  end if;

  select nome, status into v_nome, v_status from public.usuarios where id = v_usuario_id;
  if v_status is distinct from 'ativo' then
    raise exception 'Pesquisador inativo — ponto não registrado.';
  end if;

  select registrado_em, tipo into v_ultimo_em, v_ultimo_tipo
  from public.ponto_registros
  where usuario_id = v_usuario_id and tipo <> 'falta'
  order by registrado_em desc
  limit 1;

  if v_ultimo_em is not null and now() - v_ultimo_em < interval '60 seconds' then
    raise exception 'Registro muito recente — aguarde um instante e tente novamente.';
  end if;

  v_tipo := case when v_ultimo_tipo = 'entrada' then 'saida' else 'entrada' end;

  begin
    v_ip := nullif(current_setting('request.headers', true)::json ->> 'x-forwarded-for', '');
  exception when others then
    v_ip := null;
  end;

  insert into public.ponto_registros (usuario_id, tipo, terminal_id, ip, origem)
  values (
    v_usuario_id,
    v_tipo,
    coalesce(nullif(trim(p_terminal_id), ''), 'AUTOATENDIMENTO'),
    v_ip,
    'qrcode'
  )
  returning registrado_em into v_registrado_em;

  return jsonb_build_object(
    'usuarioId', v_usuario_id,
    'nome', v_nome,
    'tipo', v_tipo,
    'registradoEm', v_registrado_em
  );
end;
$$;

-- ---------- corrigir (aceita 'falta') ----------
create or replace function public.ponto_corrigir(
  p_id uuid,
  p_tipo text,
  p_registrado_em timestamptz,
  p_motivo text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_usuario_id      uuid;
  v_tipo_antigo     text;
  v_horario_antigo  timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem corrigir registros de ponto.';
  end if;
  if p_tipo not in ('entrada', 'saida', 'falta') then
    raise exception 'Tipo inválido.';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Informe o motivo da correção.';
  end if;

  select usuario_id, tipo, registrado_em into v_usuario_id, v_tipo_antigo, v_horario_antigo
  from public.ponto_registros where id = p_id;
  if v_usuario_id is null then
    raise exception 'Registro não encontrado.';
  end if;

  update public.ponto_registros
    set tipo = p_tipo, registrado_em = p_registrado_em, editado = true, motivo_edicao = p_motivo
    where id = p_id;

  insert into public.historico_alteracoes (usuario_alvo_id, autor, descricao)
  values (
    v_usuario_id,
    coalesce((select nome from public.usuarios where id = auth.uid()), 'Sistema'),
    format('Ponto corrigido: %s às %s → %s às %s. Motivo: %s',
      v_tipo_antigo, to_char(v_horario_antigo, 'DD/MM/YYYY HH24:MI'),
      p_tipo, to_char(p_registrado_em, 'DD/MM/YYYY HH24:MI'), p_motivo)
  );
end;
$$;

-- ---------- lançar manual (aceita 'falta') ----------
create or replace function public.ponto_lancar_manual(
  p_usuario_id uuid,
  p_tipo text,
  p_registrado_em timestamptz,
  p_motivo text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem lançar registros manuais de ponto.';
  end if;
  if p_tipo not in ('entrada', 'saida', 'falta') then
    raise exception 'Tipo inválido.';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Informe o motivo do lançamento manual.';
  end if;

  insert into public.ponto_registros
    (usuario_id, tipo, registrado_em, terminal_id, origem, criado_por, editado, motivo_edicao)
  values
    (p_usuario_id, p_tipo, p_registrado_em, 'ADMIN-MANUAL', 'manual', auth.uid(), true, p_motivo)
  returning id into v_id;

  insert into public.historico_alteracoes (usuario_alvo_id, autor, descricao)
  values (
    p_usuario_id,
    coalesce((select nome from public.usuarios where id = auth.uid()), 'Sistema'),
    format('Ponto lançado manualmente: %s em %s. Motivo: %s',
      p_tipo, to_char(p_registrado_em, 'DD/MM/YYYY HH24:MI'), p_motivo)
  );

  return v_id;
end;
$$;

-- ---------- 2) Quem está "dentro" agora ----------
-- Última batida (entrada/saída) de HOJE (fuso de São Paulo) é uma entrada.
-- Devolve só ids — qualquer usuário logado pode chamar, sem expor horários
-- (a RLS de ponto_registros continua restrita).
create or replace function public.ponto_presentes()
returns table (usuario_id uuid)
language sql stable security definer set search_path = public as $$
  select t.usuario_id
  from (
    select distinct on (r.usuario_id) r.usuario_id, r.tipo
    from public.ponto_registros r
    where r.tipo <> 'falta'
      and (r.registrado_em at time zone 'America/Sao_Paulo')::date
          = (now() at time zone 'America/Sao_Paulo')::date
    order by r.usuario_id, r.registrado_em desc
  ) t
  where t.tipo = 'entrada';
$$;

grant execute on function public.ponto_presentes() to authenticated;
grant execute on function public.ponto_corrigir(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.ponto_lancar_manual(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.ponto_status_token(text) to anon, authenticated;
grant execute on function public.ponto_registrar(text, text) to anon, authenticated;
