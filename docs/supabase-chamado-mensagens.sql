-- ============================================================
-- CINTESP WEB — Chat dos chamados (mensagens)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Cria a conversa de cada chamado: o SOLICITANTE e os ADMINISTRADORES
-- trocam mensagens. Ninguém envia depois que o chamado é finalizado/cancelado
-- (regra garantida aqui no banco, além da tela).
-- ============================================================

create table if not exists public.chamado_mensagens (
  id         uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  autor_id   uuid references public.usuarios (id) on delete set null,
  corpo      text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chamado_msg on public.chamado_mensagens (chamado_id, created_at);

alter table public.chamado_mensagens enable row level security;

-- Ler: o solicitante do chamado, ou um admin.
drop policy if exists "msg: leitura" on public.chamado_mensagens;
create policy "msg: leitura" on public.chamado_mensagens
  for select to authenticated
  using (
    exists (
      select 1 from public.chamados c
      where c.id = chamado_id
        and (c.solicitante_id = auth.uid() or public.is_admin())
    )
  );

-- Enviar: o solicitante ou um admin, sempre como autor = ele mesmo, e SÓ
-- enquanto o chamado NÃO estiver finalizado/cancelado.
drop policy if exists "msg: enviar" on public.chamado_mensagens;
create policy "msg: enviar" on public.chamado_mensagens
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.chamados c
      where c.id = chamado_id
        and (c.solicitante_id = auth.uid() or public.is_admin())
        and c.status not in ('finalizado', 'cancelado')
    )
  );

grant select, insert on public.chamado_mensagens to authenticated;

-- (opcional) Chat em tempo real: Database → Replication → adicione a tabela,
-- ou rode:
--   alter publication supabase_realtime add table public.chamado_mensagens;
-- Sem isso, a tela atualiza a conversa a cada poucos segundos (polling).

-- ============================================================
-- Pronto. Abra um chamado na tela e converse por ali.
-- ============================================================
