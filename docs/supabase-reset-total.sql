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
-- Como usar: Supabase → SQL Editor → cole tudo → Run.
-- ============================================================

-- ---------- 1) Situação ANTES ----------
select 'ANTES' as momento,
  (select count(*) from public.participantes)        as participantes,
  (select count(*) from public.importacoes)          as importacoes,
  (select count(*) from public.avisos)               as avisos,
  (select count(*) from public.horarios)             as horarios,
  (select count(*) from public.disponibilidade)      as disponibilidade,
  (select count(*) from public.mudancas_turno)       as mudancas,
  (select count(*) from public.usuarios)             as usuarios_mantidos;

-- ---------- 2) Limpeza ----------
-- A ordem respeita as chaves estrangeiras (filhos primeiro).
delete from public.participantes;
delete from public.importacoes;
delete from public.avisos;
delete from public.mudancas_turno;
delete from public.horarios;
delete from public.disponibilidade;
delete from public.historico_alteracoes;
delete from public.usuario_areas;

-- ---------- 3) Situação DEPOIS ----------
-- Tudo deve estar zerado, menos `usuarios` (as contas continuam).
select 'DEPOIS' as momento,
  (select count(*) from public.participantes)        as participantes,
  (select count(*) from public.importacoes)          as importacoes,
  (select count(*) from public.avisos)               as avisos,
  (select count(*) from public.horarios)             as horarios,
  (select count(*) from public.disponibilidade)      as disponibilidade,
  (select count(*) from public.mudancas_turno)       as mudancas,
  (select count(*) from public.usuarios)             as usuarios_mantidos;

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
