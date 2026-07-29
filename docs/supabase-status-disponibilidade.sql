-- ============================================================
-- CINTESP WEB — Novos status de disponibilidade + modo automático
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente (pode rodar de novo).
--
-- O que muda:
--   1. "Em atendimento" sai de cena e entram DOIS status:
--        • parcial      → presente, com disponibilidade reduzida
--        • home_office  → trabalhando remotamente
--   2. A tabela `disponibilidade` ganha a coluna `automatico`:
--        • true  (padrão) → a situação é CALCULADA pelo horário cadastrado,
--                           então o quadro se atualiza sozinho ao longo do dia
--        • false          → alguém definiu na mão e aquele valor prevalece
--
-- Os registros antigos com 'em_atendimento' viram 'parcial'.
-- ============================================================

-- ---------- 1) Novos valores no enum ----------
-- No Postgres não dá para remover um valor de enum sem recriar o tipo, então
-- 'em_atendimento' continua existindo, mas deixa de ser usado pelo sistema.
do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'status_disponibilidade' and e.enumlabel = 'parcial'
  ) then
    alter type status_disponibilidade add value 'parcial';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'status_disponibilidade' and e.enumlabel = 'home_office'
  ) then
    alter type status_disponibilidade add value 'home_office';
  end if;
end $$;

-- ---------- 2) Coluna do modo automático ----------
alter table public.disponibilidade
  add column if not exists automatico boolean not null default true;

comment on column public.disponibilidade.automatico is
  'true = situação calculada pelo horário; false = definida manualmente.';

-- ---------- 3) Migra os registros antigos ----------
-- Precisa ser um comando separado dos ALTER TYPE acima (o Postgres não aceita
-- usar um valor de enum recém-criado na mesma transação).
update public.disponibilidade
   set status = 'parcial'
 where status::text = 'em_atendimento';

-- ---------- 4) Conferência ----------
select status::text as situacao,
       count(*) as pessoas,
       count(*) filter (where automatico) as em_modo_automatico
  from public.disponibilidade
 group by status
 order by pessoas desc;

-- ============================================================
-- Observação sobre o modo automático
-- ------------------------------------------------------------
-- Quem estiver com `automatico = true` NÃO precisa fazer nada: o sistema olha
-- o horário da semana e mostra "Disponível" dentro dos turnos ligados e
-- "Ausente" fora deles.
--
-- Para devolver alguém ao modo automático depois de um ajuste manual:
--   update public.disponibilidade set automatico = true where usuario_id = 'ID-AQUI';
--
-- Para devolver TODO MUNDO ao automático:
--   update public.disponibilidade set automatico = true;
-- ============================================================
