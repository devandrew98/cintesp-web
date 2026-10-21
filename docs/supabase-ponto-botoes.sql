-- ============================================================
-- CINTESP — Ponto: o pesquisador ESCOLHE "Entrada" ou "Saída"
-- Rode depois de supabase-ponto-falta-presenca.sql. Idempotente.
--
-- Antes: a leitura do QR alternava sozinha entre entrada e saída (e uma
-- saída esquecida gerava uma "saída" no dia seguinte, com 20h+ de erro).
-- Agora a página /ponto/:token mostra dois botões e o app manda o tipo.
-- O banco VALIDA, para evitar conflito:
--   • Entrada: bloqueada se já existe entrada ABERTA HOJE (sem saída depois).
--     Entrada aberta de um dia anterior (esqueceu a saída) NÃO bloqueia —
--     fica "incompleta" para o administrador corrigir.
--   • Saída: só vale se existe entrada aberta HOJE (mesmo dia). Assim nunca
--     nasce um par entrada→saída atravessando a meia-noite.
--   • Segue o intervalo mínimo de 60s entre registros (clique repetido).
-- ============================================================

drop function if exists public.ponto_registrar(text, text);
drop function if exists public.ponto_registrar(text, text, text);

-- ---------- status pelo token: agora informa se há entrada aberta hoje ----------
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
  v_aberta_hoje boolean;
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

  v_aberta_hoje := v_ultimo_tipo = 'entrada'
    and (v_ultimo_em at time zone 'America/Sao_Paulo')::date
        = (now() at time zone 'America/Sao_Paulo')::date;

  return jsonb_build_object(
    'nome', v_nome,
    'ultimoTipo', v_ultimo_tipo,
    'ultimoRegistradoEm', v_ultimo_em,
    'entradaAbertaHoje', coalesce(v_aberta_hoje, false)
  );
end;
$$;

-- ---------- registrar ponto com o tipo escolhido ----------
create or replace function public.ponto_registrar(
  p_token text,
  p_tipo text,
  p_terminal_id text default 'AUTOATENDIMENTO'
)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash          text;
  v_usuario_id    uuid;
  v_nome          text;
  v_status        public.status_usuario;
  v_ultimo_em     timestamptz;
  v_ultimo_tipo   text;
  v_aberta_hoje   boolean;
  v_ip            text;
  v_registrado_em timestamptz;
begin
  if p_tipo is null or p_tipo not in ('entrada', 'saida') then
    raise exception 'Escolha Entrada ou Saída.';
  end if;
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

  v_aberta_hoje := v_ultimo_tipo = 'entrada'
    and (v_ultimo_em at time zone 'America/Sao_Paulo')::date
        = (now() at time zone 'America/Sao_Paulo')::date;

  if p_tipo = 'entrada' and v_aberta_hoje then
    raise exception 'Você já registrou a entrada de hoje às %. Registre a saída quando for embora.',
      to_char(v_ultimo_em at time zone 'America/Sao_Paulo', 'HH24:MI');
  end if;
  if p_tipo = 'saida' and not v_aberta_hoje then
    raise exception 'Você não tem entrada aberta hoje. Registre a entrada primeiro (se esqueceu, peça a correção a um administrador).';
  end if;

  begin
    v_ip := nullif(current_setting('request.headers', true)::json ->> 'x-forwarded-for', '');
  exception when others then
    v_ip := null;
  end;

  insert into public.ponto_registros (usuario_id, tipo, terminal_id, ip, origem)
  values (
    v_usuario_id,
    p_tipo,
    coalesce(nullif(trim(p_terminal_id), ''), 'AUTOATENDIMENTO'),
    v_ip,
    'qrcode'
  )
  returning registrado_em into v_registrado_em;

  return jsonb_build_object(
    'usuarioId', v_usuario_id,
    'nome', v_nome,
    'tipo', p_tipo,
    'registradoEm', v_registrado_em
  );
end;
$$;

grant execute on function public.ponto_status_token(text) to anon, authenticated;
grant execute on function public.ponto_registrar(text, text, text) to anon, authenticated;
