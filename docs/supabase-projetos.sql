-- ============================================================
-- CINTESP WEB — Projetos (equipe, TRL/progresso, chat privado)
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- Regras de acesso:
--   • Leitura: admin vê TODOS os projetos; pesquisador só vê os que está
--     vinculado (responsável ou membro).
--   • Estrutura (responsável, vínculos, campos liberados): só admin.
--   • Conteúdo (título/status/datas): admin OU responsável.
--   • Conteúdo "liberável" (trl/progresso/dados_tecnicos/descricao/
--     observacoes): admin, responsável, OU membro — SE o campo estiver em
--     `campos_editaveis_membros`. Um TRIGGER valida isso linha a linha,
--     porque RLS sozinho só filtra LINHAS, não CAMPOS.
--   • Chat (mensagens + anexos): só admin + vinculados.
-- ============================================================

-- ---------- Tabela principal ----------
create table if not exists public.projetos (
  id                       uuid primary key default gen_random_uuid(),
  titulo                   text not null,
  descricao                text,
  status                   text not null default 'planejamento', -- planejamento | em_andamento | pausado | concluido | cancelado
  trl                      smallint check (trl between 1 and 9),
  progresso                smallint not null default 0 check (progresso between 0 and 100),
  dados_tecnicos           text,
  observacoes              text,
  data_inicio              date,
  data_fim_prevista        date,
  responsavel_id           uuid not null references public.usuarios (id) on delete restrict,
  -- Quais campos de CONTEÚDO os membros (não-responsáveis) podem editar.
  -- Valores válidos: 'trl' | 'progresso' | 'dadosTecnicos' | 'descricao' | 'observacoes'.
  campos_editaveis_membros text[] not null default '{}',
  criado_por               uuid references public.usuarios (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------- Equipe (quem está vinculado a cada projeto) ----------
create table if not exists public.projeto_pesquisadores (
  projeto_id  uuid not null references public.projetos (id) on delete cascade,
  usuario_id  uuid not null references public.usuarios (id) on delete cascade,
  papel       text not null default 'membro', -- 'responsavel' | 'membro'
  created_at  timestamptz not null default now(),
  primary key (projeto_id, usuario_id)
);

-- ---------- Chat do projeto ----------
create table if not exists public.projeto_mensagens (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid not null references public.projetos (id) on delete cascade,
  autor_id      uuid references public.usuarios (id) on delete set null,
  corpo         text,
  anexo_url     text,
  anexo_nome    text,
  anexo_tipo    text,
  anexo_tamanho bigint,
  created_at    timestamptz not null default now(),
  -- Mensagem precisa ter texto OU anexo (não pode ser as duas coisas vazias).
  constraint chk_mensagem_tem_conteudo check (corpo is not null or anexo_url is not null)
);

create index if not exists idx_projetos_responsavel        on public.projetos (responsavel_id);
create index if not exists idx_projeto_pesquisadores_uid   on public.projeto_pesquisadores (usuario_id);
create index if not exists idx_projeto_mensagens_projeto   on public.projeto_mensagens (projeto_id, created_at);

-- updated_at automático (reaproveita a função já usada em outras tabelas do projeto).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_projetos_updated_at on public.projetos;
create trigger trg_projetos_updated_at
  before update on public.projetos
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Trigger: valida QUEM pode mudar QUAL campo em UPDATE de projetos.
-- RLS barra por LINHA; isto barra por COLUNA.
-- ============================================================
create or replace function public.projetos_valida_edicao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  eh_membro       boolean;
  campos_mudados  text[];
  campo           text;
  campos_livres   text[] := array['trl', 'progresso', 'dados_tecnicos', 'descricao', 'observacoes'];
begin
  -- Admin e o responsável (atual OU o que está saindo, para não travar a
  -- própria troca de responsável) podem editar tudo.
  if public.is_admin() or auth.uid() = old.responsavel_id or auth.uid() = new.responsavel_id then
    return new;
  end if;

  eh_membro := exists (
    select 1 from public.projeto_pesquisadores
    where projeto_id = old.id and usuario_id = auth.uid()
  );
  if not eh_membro then
    raise exception 'Você não tem acesso a este projeto.';
  end if;

  -- Descobre quais colunas realmente mudaram nesta atualização.
  select array_agg(k) into campos_mudados
  from jsonb_each(to_jsonb(new)) n(k, v)
  where v is distinct from (to_jsonb(old) -> n.k);

  foreach campo in array coalesce(campos_mudados, array[]::text[]) loop
    if campo in ('updated_at') then
      continue; -- sempre muda sozinho, não é uma "edição" de verdade
    end if;
    -- Campo fora do grupo "liberável" (titulo, status, datas, responsavel_id,
    -- campos_editaveis_membros...) → membro comum nunca pode mexer.
    if not (campo = any(campos_livres)) then
      raise exception 'Campo "%" não pode ser editado por você.', campo;
    end if;
    -- Campo liberável, mas o admin não marcou ele como liberado PARA ESTE projeto.
    if not (
      case campo
        when 'dados_tecnicos' then 'dadosTecnicos' = any(old.campos_editaveis_membros)
        else campo = any(old.campos_editaveis_membros)
      end
    ) then
      raise exception 'Campo "%" não está liberado para membros neste projeto.', campo;
    end if;
  end loop;

  return new;
end; $$;

drop trigger if exists trg_projetos_valida_edicao on public.projetos;
create trigger trg_projetos_valida_edicao
  before update on public.projetos
  for each row execute function public.projetos_valida_edicao();

-- ============================================================
-- RLS
-- ============================================================
alter table public.projetos              enable row level security;
alter table public.projeto_pesquisadores enable row level security;
alter table public.projeto_mensagens     enable row level security;

-- Helper: o usuário atual está vinculado a este projeto (qualquer papel)?
create or replace function public.projeto_membro(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projeto_pesquisadores
    where projeto_id = p_projeto_id and usuario_id = auth.uid()
  );
$$;

-- ---- projetos ----
drop policy if exists "projetos: leitura" on public.projetos;
create policy "projetos: leitura" on public.projetos
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "projetos: admin cria" on public.projetos;
create policy "projetos: admin cria" on public.projetos
  for insert to authenticated with check (public.is_admin());

-- UPDATE: linha precisa ser visível (admin ou vinculado) — o TRIGGER acima
-- é quem decide se o CAMPO específico pode mudar.
drop policy if exists "projetos: atualizar" on public.projetos;
create policy "projetos: atualizar" on public.projetos
  for update to authenticated
  using (public.is_admin() or public.projeto_membro(id))
  with check (public.is_admin() or public.projeto_membro(id));

drop policy if exists "projetos: admin exclui" on public.projetos;
create policy "projetos: admin exclui" on public.projetos
  for delete to authenticated using (public.is_admin());

-- ---- projeto_pesquisadores (equipe) ----
drop policy if exists "projeto_pesquisadores: leitura" on public.projeto_pesquisadores;

create policy "projeto_pesquisadores: leitura" on public.projeto_pesquisadores
  for select to authenticated
  using (
    auth.uid() is not null
  );

drop policy if exists "projeto_pesquisadores: admin gere" on public.projeto_pesquisadores;
create policy "projeto_pesquisadores: admin gere" on public.projeto_pesquisadores
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- projeto_mensagens (chat) ----
drop policy if exists "projeto_mensagens: leitura" on public.projeto_mensagens;
create policy "projeto_mensagens: leitura" on public.projeto_mensagens
  for select to authenticated
  using (public.is_admin() or public.projeto_membro(projeto_id));

drop policy if exists "projeto_mensagens: enviar" on public.projeto_mensagens;
create policy "projeto_mensagens: enviar" on public.projeto_mensagens
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and (public.is_admin() or public.projeto_membro(projeto_id))
  );

-- Exclusão de mensagem: autor ou admin (ajuste/remova se não quiser permitir).
drop policy if exists "projeto_mensagens: excluir" on public.projeto_mensagens;
create policy "projeto_mensagens: excluir" on public.projeto_mensagens
  for delete to authenticated
  using (public.is_admin() or autor_id = auth.uid());

grant select, insert, update, delete on public.projetos              to authenticated;
grant select, insert, update, delete on public.projeto_pesquisadores to authenticated;
grant select, insert, delete         on public.projeto_mensagens     to authenticated;

-- ---------- Anexos do chat (Storage) ----------
-- Bucket PRIVADO (diferente de chamado-anexos/documentos, que são públicos):
-- só admin + vinculados podem ler, e o front usa createSignedUrl() para
-- gerar o link de download em vez de uma URL pública direta.
insert into storage.buckets (id, name, public, file_size_limit)
values ('projeto-anexos', 'projeto-anexos', false, 20971520) -- 20 MB
on conflict (id) do update set public = false, file_size_limit = 20971520;

-- Convenção de caminho usada pelo front: "{projeto_id}/{usuario_id}-{timestamp}-{nome}".
-- A política abaixo usa o primeiro segmento do caminho como o projeto_id.
drop policy if exists "projeto_anexos_leitura" on storage.objects;
create policy "projeto_anexos_leitura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'projeto-anexos'
    and (public.is_admin() or public.projeto_membro((storage.foldername(name))[1]::uuid))
  );

drop policy if exists "projeto_anexos_envio" on storage.objects;
create policy "projeto_anexos_envio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'projeto-anexos'
    and (public.is_admin() or public.projeto_membro((storage.foldername(name))[1]::uuid))
  );

-- ---------- Realtime (opcional, recomendado para o chat) ----------
-- Em Database → Replication, adicione projeto_mensagens à publicação
-- supabase_realtime (ou rode):
--   alter publication supabase_realtime add table public.projeto_mensagens;

-- ============================================================
-- Pronto. "Projetos" fica disponível para todo usuário logado (só os seus,
-- se não for admin); "Novo projeto" e "Gerenciar equipe" aparecem só para
-- administradores no front — mas quem BARRA de verdade é este arquivo.
-- ============================================================
