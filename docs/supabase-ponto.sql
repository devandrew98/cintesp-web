-- ============================================================
-- CINTESP WEB — Registro de Ponto por QR Code
-- ------------------------------------------------------------
-- Rode DEPOIS de schema.sql / seed.sql / policies.sql, no SQL Editor
-- do Supabase. É idempotente: pode rodar mais de uma vez sem erro.
--
-- Modelo:
--   • Um notebook fica permanentemente logado numa conta compartilhada
--     ("PONTO"), com a função "Terminal Ponto" (permissão registrar_ponto).
--   • Cada pesquisador tem um QR Code pessoal: um TOKEN opaio e aleatório,
--     gerado pelo admin. O banco guarda só o HASH (sha256) do token — o
--     valor em texto puro só aparece uma vez, na hora de gerar.
--   • O terminal chama a função ponto_registrar(token), que roda no banco
--     (SECURITY DEFINER) e decide ENTRADA/SAÍDA e o horário — o front NUNCA
--     manda tipo nem horário, só o token lido do QR Code.
--   • Todas as escritas (gerar/revogar QR, registrar ponto, corrigir,
--     lançar manual) passam por funções SECURITY DEFINER. As tabelas NÃO
--     recebem grant de insert/update/delete para "authenticated": só dá
--     pra escrever chamando essas funções, que validam permissão por dentro.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Função "Terminal Ponto" (conta compartilhada do kiosk) ----------
insert into public.funcoes (nome, permissoes)
values ('Terminal Ponto', array['registrar_ponto'])
on conflict (nome) do update set permissoes = array['registrar_ponto'];

-- ---------- Tabela: QR Code (token) de cada pesquisador ----------
create table if not exists public.pesquisador_qr_tokens (
  usuario_id     uuid primary key references public.usuarios (id) on delete cascade,
  token_hash     text not null,
  ativo          boolean not null default true,
  criado_por     uuid references public.usuarios (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists idx_qr_tokens_hash on public.pesquisador_qr_tokens (token_hash);

-- ---------- Tabela: registros de ponto (auditoria) ----------
create table if not exists public.ponto_registros (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.usuarios (id) on delete cascade,
  tipo           text not null check (tipo in ('entrada', 'saida')),
  registrado_em  timestamptz not null default now(),
  terminal_id    text not null default 'CINTESP-PONTO-001',
  ip             text,
  origem         text not null default 'qrcode' check (origem in ('qrcode', 'manual')),
  criado_por     uuid references public.usuarios (id) on delete set null, -- admin, só quando origem = 'manual'
  editado        boolean not null default false,
  motivo_edicao  text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_ponto_registros_usuario on public.ponto_registros (usuario_id, registrado_em desc);
create index if not exists idx_ponto_registros_data on public.ponto_registros (registrado_em desc);

-- ============================================================
-- Funções auxiliares
-- ============================================================

-- O usuário atual pode operar o terminal de ponto? (admin OU função com a permissão)
create or replace function public.pode_registrar_ponto()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from public.usuarios u
    join public.funcoes f on f.id = u.funcao_id
    where u.id = auth.uid()
      and 'registrar_ponto' = any (f.permissoes)
  );
$$;

-- ---------- Gerar (ou renovar) o QR Code de um pesquisador — admin only ----------
-- Devolve o TOKEN em texto puro. É a ÚNICA vez que ele fica visível — o
-- banco só guarda o hash. Gerar de novo automaticamente invalida o anterior.
create or replace function public.ponto_gerar_qr(p_usuario_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_hash  text;
  v_nome  text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem gerar QR Codes de ponto.';
  end if;

  select nome into v_nome from public.usuarios where id = p_usuario_id;
  if v_nome is null then
    raise exception 'Pesquisador não encontrado.';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash  := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.pesquisador_qr_tokens (usuario_id, token_hash, ativo, criado_por, atualizado_em)
  values (p_usuario_id, v_hash, true, auth.uid(), now())
  on conflict (usuario_id) do update
    set token_hash    = excluded.token_hash,
        ativo         = true,
        criado_por    = excluded.criado_por,
        atualizado_em = now();

  insert into public.historico_alteracoes (usuario_alvo_id, autor, descricao)
  values (
    p_usuario_id,
    coalesce((select nome from public.usuarios where id = auth.uid()), 'Sistema'),
    'QR Code de ponto gerado/renovado (o anterior deixou de funcionar)'
  );

  return v_token;
end;
$$;

-- ---------- Revogar o QR Code de um pesquisador — admin only ----------
create or replace function public.ponto_revogar_qr(p_usuario_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem revogar QR Codes de ponto.';
  end if;

  update public.pesquisador_qr_tokens
    set ativo = false, atualizado_em = now()
    where usuario_id = p_usuario_id;

  insert into public.historico_alteracoes (usuario_alvo_id, autor, descricao)
  values (
    p_usuario_id,
    coalesce((select nome from public.usuarios where id = auth.uid()), 'Sistema'),
    'QR Code de ponto revogado'
  );
end;
$$;

-- ---------- Registrar ponto a partir do token lido no QR Code ----------
-- Chamada pelo terminal (conta "Terminal Ponto" ou admin). Todo o
-- necessário para confiar no registro acontece AQUI, no banco:
--   • valida o token (hash) e se está ativo;
--   • confere se o pesquisador está ativo;
--   • decide ENTRADA/SAÍDA (alterna com base no último registro);
--   • usa now() do servidor — nunca um horário vindo do front;
--   • evita duplicidade por leituras/cliques repetidos em menos de 60s.
create or replace function public.ponto_registrar(p_token text, p_terminal_id text default 'CINTESP-PONTO-001')
returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if not public.pode_registrar_ponto() then
    raise exception 'Este terminal não tem permissão para registrar ponto.';
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
  where usuario_id = v_usuario_id
  order by registrado_em desc
  limit 1;

  if v_ultimo_em is not null and now() - v_ultimo_em < interval '60 seconds' then
    raise exception 'Registro muito recente — aguarde um instante e tente novamente.';
  end if;

  v_tipo := case when v_ultimo_tipo = 'entrada' then 'saida' else 'entrada' end;

  -- Best-effort: o PostgREST expõe os headers da requisição nesta GUC.
  begin
    v_ip := nullif(current_setting('request.headers', true)::json ->> 'x-forwarded-for', '');
  exception when others then
    v_ip := null;
  end;

  insert into public.ponto_registros (usuario_id, tipo, terminal_id, ip, origem)
  values (
    v_usuario_id,
    v_tipo,
    coalesce(nullif(trim(p_terminal_id), ''), 'CINTESP-PONTO-001'),
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

-- ---------- Corrigir um registro existente — admin only ----------
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
  if p_tipo not in ('entrada', 'saida') then
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

-- ---------- Lançar um registro manual (esquecimento) — admin only ----------
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
  if p_tipo not in ('entrada', 'saida') then
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
    format('Ponto lançado manualmente: %s às %s. Motivo: %s',
      p_tipo, to_char(p_registrado_em, 'DD/MM/YYYY HH24:MI'), p_motivo)
  );

  return v_id;
end;
$$;

-- ============================================================
-- RLS — só LEITURA direta é permitida; toda ESCRITA passa pelas funções
-- acima (que rodam como o dono das tabelas e por isso não dependem de
-- política de insert/update/delete para "authenticated").
-- ============================================================
alter table public.pesquisador_qr_tokens enable row level security;
alter table public.ponto_registros       enable row level security;

drop policy if exists "qr_tokens: leitura admin" on public.pesquisador_qr_tokens;
create policy "qr_tokens: leitura admin" on public.pesquisador_qr_tokens
  for select to authenticated
  using (public.is_admin());

drop policy if exists "ponto_registros: leitura" on public.ponto_registros;
create policy "ponto_registros: leitura" on public.ponto_registros
  for select to authenticated
  using (public.is_admin() or auth.uid() = usuario_id);

-- Garante que "authenticated" só tem SELECT (o grant geral de insert/update/
-- delete em "policies.sql" vale por padrão para tabelas novas — revogamos
-- explicitamente aqui para forçar todo mundo a passar pelas funções).
revoke insert, update, delete on public.pesquisador_qr_tokens from authenticated;
revoke insert, update, delete on public.ponto_registros       from authenticated;
grant select on public.pesquisador_qr_tokens to authenticated;
grant select on public.ponto_registros       to authenticated;

grant execute on function public.pode_registrar_ponto()                                   to authenticated;
grant execute on function public.ponto_gerar_qr(uuid)                                      to authenticated;
grant execute on function public.ponto_revogar_qr(uuid)                                    to authenticated;
grant execute on function public.ponto_registrar(text, text)                               to authenticated;
grant execute on function public.ponto_corrigir(uuid, text, timestamptz, text)             to authenticated;
grant execute on function public.ponto_lancar_manual(uuid, text, timestamptz, text)         to authenticated;

-- ============================================================
-- Depois de rodar este arquivo:
--   1. Crie a conta do terminal em Administração > Pesquisadores (ou pelo
--      cadastro normal) e, em Administração > Funções (ou direto no banco),
--      atribua a função "Terminal Ponto" a essa conta. Deixe-a logada no
--      notebook oficial ("PONTO").
--   2. Gere o QR Code de cada pesquisador em Administração > Pesquisadores
--      (botão "QR de Ponto"). Imprima/entregue o código — ele só aparece
--      naquele momento.
--   3. Acesse /ponto no notebook do terminal para abrir a tela de leitura.
-- ============================================================
