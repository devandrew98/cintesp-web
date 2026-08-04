-- ============================================================
-- CINTESP WEB — CONSIGNADOS (controle de patrimônio / empréstimos)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Duas tabelas:
--   • patrimonio_itens → o INVENTÁRIO (todos os itens, com nº de patrimônio).
--   • consignados      → os EMPRÉSTIMOS (quem pegou, datas, local, status).
-- Tudo é gerido pelo administrador (RLS: is_admin).
-- ============================================================

-- ---------- Inventário ----------
create table if not exists public.patrimonio_itens (
  id                uuid primary key default gen_random_uuid(),
  numero_patrimonio text not null unique,
  nome              text not null,
  categoria         text,               -- notebook | monitor | camera | equipamento | outro
  descricao         text,
  local_padrao      text,               -- onde fica quando disponível (estoque)
  status            text not null default 'disponivel', -- disponivel | em_uso | manutencao | baixado
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- Empréstimos ----------
-- Cada linha = 1 item emprestado. Quando o admin consigna vários itens de
-- uma vez, cada item vira uma linha, todas com o mesmo `protocolo` — assim
-- o formulário impresso reúne todos os itens do mesmo protocolo.
create table if not exists public.consignados (
  id                    uuid primary key default gen_random_uuid(),
  protocolo             uuid not null default gen_random_uuid(),
  -- Item (com "fotografia" dos dados, para o histórico sobreviver se o item for apagado)
  item_id               uuid references public.patrimonio_itens (id) on delete set null,
  item_numero           text,
  item_nome             text,
  -- Pesquisador que recebeu (também com snapshot p/ o protocolo impresso)
  pesquisador_id        uuid references public.usuarios (id) on delete set null,
  pesquisador_nome      text,
  pesquisador_cpf       text,
  pesquisador_area      text,
  -- Datas / local / status
  data_retirada         date not null default current_date,
  data_entrega_prevista date,
  data_devolucao        date,
  local                 text,           -- onde o item está durante o empréstimo
  status                text not null default 'em_uso', -- em_uso | devolvido
  observacoes           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Se a tabela já existia (deploy anterior sem múltiplos itens por protocolo).
alter table public.consignados add column if not exists protocolo uuid not null default gen_random_uuid();

create index if not exists idx_consignados_item      on public.consignados (item_id);
create index if not exists idx_consignados_status    on public.consignados (status);
create index if not exists idx_consignados_pesq      on public.consignados (pesquisador_id);
create index if not exists idx_consignados_protocolo on public.consignados (protocolo);

-- updated_at automático (reaproveita a função dos chamados; cria se faltar).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_patrimonio_updated on public.patrimonio_itens;
create trigger trg_patrimonio_updated before update on public.patrimonio_itens
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_consignados_updated on public.consignados;
create trigger trg_consignados_updated before update on public.consignados
  for each row execute function public.touch_updated_at();

-- ---------- Segurança (só admin) ----------
alter table public.patrimonio_itens enable row level security;
alter table public.consignados      enable row level security;

drop policy if exists "patrimonio: admin" on public.patrimonio_itens;
create policy "patrimonio: admin" on public.patrimonio_itens
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "consignados: admin" on public.consignados;
create policy "consignados: admin" on public.consignados
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.patrimonio_itens to authenticated;
grant select, insert, update, delete on public.consignados      to authenticated;

-- ============================================================
-- Pronto. Aba "Consignados" (Administração) fica disponível.
-- ============================================================
