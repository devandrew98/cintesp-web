-- ============================================================
-- CINTESP WEB — Participantes (alunos) + Importação de planilha
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase, DEPOIS de schema.sql / seed.sql / policies.sql.
-- É idempotente: pode rodar mais de uma vez sem erro.
--
-- O que este arquivo cria:
--   • participantes  → cadastro de pessoas vindas da planilha (nome, CPF,
--                      data de nascimento, curso, etc.). NÃO exige login:
--                      é diferente de "usuarios", que é a equipe do sistema.
--   • importacoes    → histórico de cada importação de planilha (auditoria),
--                      guardando quantos registros foram criados/atualizados.
--
-- Regra de duplicados: o CPF é a chave. Reimportar a planilha ATUALIZA quem
-- já existe e cria quem é novo (upsert por cpf).
-- ============================================================

-- ---------- Tipos (enums) ----------
-- Criados com guarda para o script poder rodar novamente sem erro.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_participante') then
    create type status_participante as enum ('ativo', 'inativo', 'concluido', 'trancado');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_importacao') then
    create type status_importacao as enum ('concluida', 'parcial', 'falhou');
  end if;
end $$;

-- ============================================================
-- Tabela: importacoes (histórico/auditoria das planilhas enviadas)
-- ============================================================
create table if not exists public.importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo text not null,                      -- nome do arquivo enviado
  total_linhas int not null default 0,        -- linhas lidas da planilha
  criados int not null default 0,             -- registros novos inseridos
  atualizados int not null default 0,         -- registros existentes atualizados
  ignorados int not null default 0,           -- linhas puladas (ex.: sem CPF)
  erros int not null default 0,               -- linhas com erro de validação
  status status_importacao not null default 'concluida',
  detalhes jsonb default '{}'::jsonb,         -- relatório detalhado (erros por linha)
  autor_id uuid references public.usuarios (id) on delete set null,
  created_at timestamptz default now()
);

comment on table public.importacoes is
  'Histórico de importações de planilha (quem importou, quando e o resultado).';

-- ============================================================
-- Tabela: participantes (dados vindos da planilha)
-- ============================================================
create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),

  -- ----- Identificação -----
  nome text not null,
  cpf text,                                   -- somente dígitos (11). Chave de deduplicação.
  data_nascimento date,

  -- ----- Acadêmico -----
  curso text,
  turma text,
  matricula text,
  instituicao_id uuid references public.instituicoes (id) on delete set null,

  -- ----- Contato -----
  email text,
  telefone text,

  -- ----- Endereço (opcional, comum em planilhas) -----
  endereco text,
  cep text,
  cidade text,
  estado text,

  -- ----- Controle -----
  status status_participante not null default 'ativo',
  observacoes text,

  -- Guarda QUALQUER coluna da planilha que não tenha campo próprio.
  -- Assim nenhuma informação é perdida na importação.
  dados_extras jsonb not null default '{}'::jsonb,

  -- Rastreia de qual importação o registro veio (auditoria).
  importacao_id uuid references public.importacoes (id) on delete set null,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.participantes is
  'Alunos/participantes importados de planilha. Não exige conta de acesso.';
comment on column public.participantes.cpf is
  'Somente dígitos (11 caracteres). Usado como chave para evitar duplicatas.';
comment on column public.participantes.dados_extras is
  'Colunas da planilha sem campo próprio, preservadas como JSON.';

-- ---------- Colunas adicionadas depois (para quem já rodou o script antes) ----------
-- Seguro rodar sempre: só cria se ainda não existir.
alter table public.participantes add column if not exists endereco text;
alter table public.participantes add column if not exists cep text;

-- ---------- Índices e restrições ----------
-- CPF único. Precisa ser uma CONSTRAINT (e não um índice parcial) para que o
-- upsert "ON CONFLICT (cpf)" da importação funcione.
-- No Postgres, valores NULL são considerados distintos entre si — ou seja,
-- vários participantes SEM CPF continuam sendo permitidos.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'participantes_cpf_key'
  ) then
    alter table public.participantes
      add constraint participantes_cpf_key unique (cpf);
  end if;
end $$;

create index if not exists idx_participantes_nome on public.participantes (nome);
create index if not exists idx_participantes_curso on public.participantes (curso);
create index if not exists idx_participantes_status on public.participantes (status);
create index if not exists idx_importacoes_data on public.importacoes (created_at desc);

-- ---------- Gatilho: mantém updated_at sempre atual ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_participantes_updated_at on public.participantes;
create trigger trg_participantes_updated_at
  before update on public.participantes
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Segurança (RLS) — mesmo padrão do resto do sistema:
--   • todo usuário logado LÊ;
--   • apenas admin (permissão 'gerenciar_tudo') ESCREVE.
-- ============================================================
alter table public.participantes enable row level security;
alter table public.importacoes   enable row level security;

-- Remove antes para o script ser idempotente.
drop policy if exists "participantes: leitura autenticada" on public.participantes;
drop policy if exists "participantes: escrita admin"       on public.participantes;
drop policy if exists "importacoes: leitura autenticada"   on public.importacoes;
drop policy if exists "importacoes: escrita admin"         on public.importacoes;

create policy "participantes: leitura autenticada" on public.participantes
  for select to authenticated using (true);

create policy "participantes: escrita admin" on public.participantes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "importacoes: leitura autenticada" on public.importacoes
  for select to authenticated using (true);

create policy "importacoes: escrita admin" on public.importacoes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- Privilégios (as tabelas são novas) ----------
grant select, insert, update, delete on public.participantes to authenticated;
grant select, insert, update, delete on public.importacoes   to authenticated;

-- ============================================================
-- Pronto. Depois de rodar:
--   1) Vá em Administração > Participantes > Importar planilha
--   2) Envie o .xlsx/.csv, confira o mapeamento das colunas e confirme.
-- ============================================================
