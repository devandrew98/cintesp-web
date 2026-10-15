-- ============================================================
-- CINTESP — Ranking mensal de horas (página /ranking)
-- Rode depois de supabase-ponto.sql e supabase-ponto-falta-presenca.sql.
-- Idempotente.
--
-- Por que uma função e não ler ponto_registros direto: a RLS deixa cada
-- pesquisador ver só o PRÓPRIO ponto. O ranking precisa comparar todo mundo,
-- mas SEM expor horas nem horários — então a conta é feita aqui, no banco,
-- e só devolve: posição, id, nome e foto. Horas nunca saem daqui.
--
-- Devolve o TOP 10 + a linha de quem está chamando (se estiver fora do top 10,
-- só para ele saber a própria posição).
--
-- Horas do mês (fuso de São Paulo): soma de cada ENTRADA até a SAÍDA seguinte.
-- Entrada de hoje ainda aberta conta até agora; entrada antiga sem saída vale 0.
-- Faltas são ignoradas. Só pesquisadores ativos.
-- ============================================================

create or replace function public.ponto_ranking_mensal()
returns table (posicao int, usuario_id uuid, nome text, foto_url text)
language sql stable security definer set search_path = public as $$
  with mes as (
    select
      date_trunc('month', now() at time zone 'America/Sao_Paulo') as inicio,
      date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month' as fim
  ),
  regs as (
    select
      r.usuario_id,
      r.tipo,
      r.registrado_em,
      lead(r.tipo) over w as prox_tipo,
      lead(r.registrado_em) over w as prox_em
    from public.ponto_registros r
    where r.tipo <> 'falta'
    window w as (partition by r.usuario_id order by r.registrado_em)
  ),
  horas as (
    select
      g.usuario_id,
      sum(
        case
          when g.prox_tipo = 'saida' then extract(epoch from (g.prox_em - g.registrado_em))
          when g.prox_tipo is null
               and (g.registrado_em at time zone 'America/Sao_Paulo')::date
                   = (now() at time zone 'America/Sao_Paulo')::date
            then extract(epoch from (now() - g.registrado_em))
          else 0
        end
      ) as segundos
    from regs g, mes
    where g.tipo = 'entrada'
      and (g.registrado_em at time zone 'America/Sao_Paulo') >= mes.inicio
      and (g.registrado_em at time zone 'America/Sao_Paulo') < mes.fim
    group by g.usuario_id
  ),
  ordenado as (
    select
      row_number() over (order by h.segundos desc, u.nome)::int as posicao,
      u.id as usuario_id,
      u.nome,
      u.foto_url
    from horas h
    join public.usuarios u on u.id = h.usuario_id
    where u.status = 'ativo' and h.segundos > 0
  )
  select o.posicao, o.usuario_id, o.nome, o.foto_url
  from ordenado o
  where o.posicao <= 10 or o.usuario_id = auth.uid()
  order by o.posicao;
$$;

grant execute on function public.ponto_ranking_mensal() to authenticated;
