-- ============================================================
-- CINTESP WEB — ZERAR os participantes e o histórico de importações
-- ------------------------------------------------------------
-- Use quando quiser recomeçar a importação do zero.
--
-- ⚠️  ATENÇÃO: isto APAGA TODOS os participantes cadastrados.
--     A ação NÃO tem desfazer. Confira que é isso mesmo que você quer.
--
-- ✅ SEGURO: mexe SOMENTE nas tabelas `participantes` e `importacoes`.
--    Usuários da equipe, avisos, horários, funções, áreas e instituições
--    NÃO são tocados.
--
-- Como usar: Supabase → SQL Editor → cole → Run.
-- ============================================================

-- Antes de apagar, veja quanta coisa existe hoje (opcional).
select
  (select count(*) from public.participantes) as participantes_hoje,
  (select count(*) from public.importacoes)   as importacoes_hoje;

-- ---------- Apaga tudo ----------
-- A ordem importa: participantes referenciam importacoes.
delete from public.participantes;
delete from public.importacoes;

-- ---------- Confirmação ----------
-- Deve retornar 0 e 0.
select
  (select count(*) from public.participantes) as participantes_agora,
  (select count(*) from public.importacoes)   as importacoes_agora;

-- ============================================================
-- Dica: se quiser apagar SÓ uma importação específica (e não tudo),
-- descubra o id no histórico da tela e rode:
--
--   delete from public.participantes where importacao_id = 'COLE-O-ID-AQUI';
--   delete from public.importacoes   where id            = 'COLE-O-ID-AQUI';
-- ============================================================
