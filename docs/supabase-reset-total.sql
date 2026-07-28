-- ============================================================
-- CINTESP WEB — RESET TOTAL dos dados (deixa o sistema do zero)
-- ------------------------------------------------------------
-- Apaga TODOS os dados operacionais, mantendo a ESTRUTURA das tabelas,
-- as políticas de segurança (RLS) e as contas de login.
--
-- ⚠️  ATENÇÃO: NÃO TEM DESFAZER. Rode só quando quiser mesmo recomeçar.
--
-- O que é APAGADO:
--   participantes, importacoes, avisos, mudancas_turno,
--   horarios, disponibilidade, historico_alteracoes,
--   e os vínculos usuário↔área
--
-- O que é MANTIDO:
--   • as contas de login (auth.users) e os perfis em `usuarios`
--   • funções, áreas de atuação e instituições (dados de referência)
--
-- ✅ SEGURO DE RODAR A QUALQUER MOMENTO: tabelas que ainda não existem
--    (ex.: `participantes`, se você não rodou o supabase-participantes.sql)
--    são simplesmente ignoradas, sem dar erro.
--
-- Como usar: Supabase → SQL Editor → cole tudo → Run.
-- ============================================================

-- ---------- 1) Situação ANTES ----------
-- Conta as linhas apenas das tabelas que existem de fato.
select 'ANTES' as momento, table_name as tabela,
       (xpath(
          '/row/c/text()',
          query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')
       ))[1]::text::bigint as linhas
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('participantes','importacoes','avisos','mudancas_turno',
                      'horarios','disponibilidade','historico_alteracoes',
                      'usuario_areas','usuarios')
 order by table_name;

-- ---------- 2) Limpeza ----------
-- Percorre a lista na ordem certa (filhos antes dos pais) e só apaga o que existe.
do $$
declare
  t text;
  -- A ORDEM IMPORTA: respeita as chaves estrangeiras.
  tabelas text[] := array[
    'participantes',          -- referencia importacoes
    'importacoes',
    'avisos',
    'mudancas_turno',
    'horarios',
    'disponibilidade',
    'historico_alteracoes',
    'usuario_areas'
  ];
  apagadas int;
begin
  foreach t in array tabelas loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
      get diagnostics apagadas = row_count;
      raise notice 'limpo: %-22s (% linha(s))', t, apagadas;
    else
      raise notice 'ignorado (tabela nao existe): %', t;
    end if;
  end loop;
end $$;

-- ---------- 3) Situação DEPOIS ----------
-- Tudo deve estar zerado, menos `usuarios` (as contas continuam).
select 'DEPOIS' as momento, table_name as tabela,
       (xpath(
          '/row/c/text()',
          query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')
       ))[1]::text::bigint as linhas
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('participantes','importacoes','avisos','mudancas_turno',
                      'horarios','disponibilidade','historico_alteracoes',
                      'usuario_areas','usuarios')
 order by table_name;

-- ============================================================
-- OPCIONAIS — descomente só se for isso mesmo que você quer.
-- ============================================================

-- (A) Apagar também os dados de referência (funções, áreas, instituições).
--     ⚠️  Se apagar as FUNÇÕES, ninguém fica administrador e você perde o
--     acesso à área de Administração. Só faça isso se for recriar tudo
--     rodando o `supabase-seed.sql` logo em seguida.
-- delete from public.areas_atuacao;
-- delete from public.instituicoes;
-- delete from public.funcoes;

-- (B) Apagar os PERFIS de usuário (mantendo as contas de login).
--     Os perfis são recriados no próximo login pelo gatilho handle_new_user.
-- delete from public.usuarios;

-- (C) Conferir quem é administrador hoje (útil depois de limpar).
-- select u.nome, u.email, f.nome as funcao, f.permissoes
--   from public.usuarios u
--   left join public.funcoes f on f.id = u.funcao_id
--  order by u.nome;

-- (D) Tornar um usuário administrador (troque o e-mail):
-- update public.usuarios
--    set funcao_id = (select id from public.funcoes where nome = 'Administrador')
--  where email = 'seu-email@exemplo.com';
