-- ============================================================
-- CINTESP WEB — Schema do banco (Supabase / PostgreSQL)
-- ------------------------------------------------------------
-- Como aplicar:
--   1) Crie um projeto em https://app.supabase.com
--   2) Abra "SQL Editor" e cole este arquivo inteiro
--   3) Rode. Depois habilite Realtime nas tabelas indicadas.
--   4) Preencha o .env do front (VITE_SUPABASE_URL / ANON_KEY)
--      e defina VITE_USE_MOCK=false.
-- Status: previsto para a FASE 4 (integração). Ainda não aplicado.
-- ============================================================

-- ---------- Tipos (enums) ----------
create type status_usuario as enum ('ativo', 'inativo');
create type status_disponibilidade as enum ('disponivel', 'parcial', 'home_office', 'ausente');
create type tipo_aviso as enum ('importante', 'reuniao', 'treinamento', 'geral');
create type status_aviso as enum ('ativo', 'programado', 'arquivado');
create type dia_semana as enum ('segunda','terca','quarta','quinta','sexta','sabado','domingo');

-- ---------- Instituições ----------
create table instituicoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sigla text not null,
  created_at timestamptz default now()
);

-- ---------- Funções / Permissões ----------
create table funcoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  permissoes text[] not null default '{}',
  created_at timestamptz default now()
);

-- ---------- Áreas de atuação ----------
create table areas_atuacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text not null default '#6366f1',
  created_at timestamptz default now()
);

-- ---------- Usuários (perfil) ----------
-- Ligado a auth.users (login gerenciado pelo Supabase Auth).
create table usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  telefone text,
  foto_url text,
  funcao_id uuid references funcoes (id),
  instituicao_id uuid references instituicoes (id),
  status status_usuario not null default 'ativo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Usuário <-> Áreas (N:N) ----------
create table usuario_areas (
  usuario_id uuid references usuarios (id) on delete cascade,
  area_id uuid references areas_atuacao (id) on delete cascade,
  primary key (usuario_id, area_id)
);

-- ---------- Disponibilidade "ao vivo" (REALTIME) ----------
create table disponibilidade (
  usuario_id uuid primary key references usuarios (id) on delete cascade,
  status status_disponibilidade not null default 'ausente',
  -- true = situação calculada pelo horário; false = definida manualmente.
  automatico boolean not null default true,
  livre_ate time,               -- null = dia todo
  atualizado_em timestamptz default now()
);

-- ---------- Horários semanais (disponibilidade planejada) ----------
create table horarios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios (id) on delete cascade,
  dia dia_semana not null,
  manha_ativo boolean default false,
  manha_inicio time,
  manha_fim time,
  tarde_ativo boolean default false,
  tarde_inicio time,
  tarde_fim time,
  observacao text,
  unique (usuario_id, dia)
);

-- ---------- Mudanças de turno ----------
create table mudancas_turno (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios (id) on delete cascade,
  descricao text not null,
  quando text not null,         -- ex.: "Hoje, 12:00"
  tag text,                     -- ex.: "Manhã → Tarde"
  data date default current_date,
  created_at timestamptz default now()
);

-- ---------- Avisos ----------
create table avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null,
  tipo tipo_aviso not null default 'geral',
  status status_aviso not null default 'ativo',
  destaque boolean default false,
  data timestamptz not null default now(),
  hora time,
  publico_alvo text,
  autor_id uuid references usuarios (id),
  visualizacoes int default 0,
  created_at timestamptz default now()
);

-- ---------- Histórico de alterações (auditoria) ----------
create table historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  usuario_alvo_id uuid references usuarios (id) on delete cascade,
  autor text not null,
  descricao text not null,
  created_at timestamptz default now()
);

-- ---------- Índices úteis ----------
create index idx_usuarios_funcao on usuarios (funcao_id);
create index idx_usuarios_status on usuarios (status);
create index idx_avisos_status on avisos (status);
create index idx_mudancas_data on mudancas_turno (data);

-- ============================================================
-- Realtime: habilite estas tabelas em
-- Database > Replication > supabase_realtime
--   • disponibilidade   (quadro "ao vivo")
--   • avisos            (novos comunicados)
--   • mudancas_turno    (mudanças do dia)
-- ============================================================

-- ============================================================
-- RLS (Row Level Security) — habilitar e criar políticas.
-- Exemplo mínimo; refine conforme as permissões por função.
-- ============================================================
alter table usuarios enable row level security;
alter table disponibilidade enable row level security;
alter table horarios enable row level security;
alter table avisos enable row level security;

-- Todos os autenticados podem LER o quadro.
create policy "leitura autenticada" on usuarios
  for select using (auth.role() = 'authenticated');
create policy "leitura disponibilidade" on disponibilidade
  for select using (auth.role() = 'authenticated');
create policy "leitura avisos" on avisos
  for select using (auth.role() = 'authenticated');

-- Cada um edita a PRÓPRIA disponibilidade e o próprio horário.
create policy "edita minha disponibilidade" on disponibilidade
  for update using (auth.uid() = usuario_id);
create policy "edita meu horario" on horarios
  for all using (auth.uid() = usuario_id);
