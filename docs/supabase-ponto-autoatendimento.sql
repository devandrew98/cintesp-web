-- ============================================================
-- CINTESP WEB — Ponto: autoatendimento por QR (celular) + terminal ao vivo
-- ------------------------------------------------------------
-- Rode DEPOIS de docs/supabase-ponto.sql, no SQL Editor do Supabase.
-- É idempotente.
--
-- MUDANÇA DE MODELO:
--   Antes: um terminal/kiosk (conta "PONTO", permissão registrar_ponto)
--   lia o QR e chamava ponto_registrar. Agora: o PRÓPRIO PESQUISADOR lê o
--   QR com a câmera do celular — o QR contém uma URL (/ponto/:token), não
--   é mais lido por um leitor USB. A página abre no celular (geralmente
--   SEM sessão logada no app) e registra o ponto usando só o token.
--
--   Por isso ponto_registrar deixa de exigir permissão de terminal — a
--   autorização passa a ser 100% o token (256 bits, imprevisível,
--   entregue só ao pesquisador). Vira uma função pública (anon), no
--   mesmo espírito de um link de redefinição de senha: quem tem o
--   segredo, usa; ninguém além disso enxerga nada.
--
--   A lógica de ENTRADA/SAÍDA (alterna com o último registro) e a janela
--   anti-duplicidade de 60s NÃO MUDAM.
--
--   O terminal/notebook (conta "Terminal Ponto") deixa de LER o QR e
--   passa a ser um telão: assina Realtime em ponto_registros e mostra o
--   último registro de QUALQUER pesquisador. Para isso, a policy de
--   leitura de ponto_registros é ampliada para essa conta.
-- ============================================================

-- ---------- Consulta pública (por token) do status antes de registrar ----------
-- Mostra "Último registro: Entrada — 08:02" na tela do celular ANTES de
-- confirmar — não expõe nada além do nome e do próprio histórico da
-- pessoa dona do token.
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
  where usuario_id = v_usuario_id
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

-- ---------- Registrar ponto — agora autorizado só pelo token (anon incluso) ----------
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
  where usuario_id = v_usuario_id
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

-- p_terminal_id existia desde a v1; mantemos o parâmetro (agora só um
-- rótulo informativo — "AUTOATENDIMENTO" no autoatendimento pelo celular,
-- ou o que o front mandar) para não perder de onde veio cada registro.

grant execute on function public.ponto_status_token(text) to anon, authenticated;
grant execute on function public.ponto_registrar(text, text) to anon, authenticated;

-- ---------- Terminal (telão) enxerga TODOS os registros, não só os próprios ----------
-- Necessário para refletir em tempo real o ponto de QUALQUER pesquisador
-- que leu o QR pelo celular. Pesquisador comum continua vendo só os seus
-- (auth.uid() = usuario_id); admin continua vendo tudo.
drop policy if exists "ponto_registros: leitura" on public.ponto_registros;
create policy "ponto_registros: leitura" on public.ponto_registros
  for select to authenticated
  using (public.is_admin() or auth.uid() = usuario_id or public.pode_registrar_ponto());

-- ---------- Realtime: o terminal assina INSERTs em ponto_registros ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ponto_registros'
  ) then
    alter publication supabase_realtime add table public.ponto_registros;
  end if;
end $$;

-- ============================================================
-- Depois de rodar este arquivo:
--   • O terminal (/ponto) vira só um telão — não precisa mais de leitor
--     USB nem de ficar "escutando" teclado.
--   • O pesquisador lê o QR com a câmera do próprio celular (o QR agora
--     contém uma URL: /ponto/<token>) e registra sozinho, sem precisar
--     estar logado no app.
-- ============================================================
