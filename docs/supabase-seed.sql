-- ============================================================
-- CINTESP WEB — Seed (dados iniciais) — Supabase / PostgreSQL
-- ------------------------------------------------------------
-- Rode DEPOIS do docs/supabase-schema.sql, no mesmo SQL Editor.
-- Popula apenas as tabelas "de referência" (não dependem de login):
-- instituições, funções, áreas e alguns avisos de exemplo.
--
-- Os USUÁRIOS não entram aqui: eles são criados pelo Supabase Auth
-- (cadastro/convite). Um gatilho para criar o perfil automaticamente
-- será adicionado na etapa de integração (com o banco já no ar).
--
-- Rode UMA vez. (Só `funcoes` é idempotente — tem nome único; as demais
-- podem duplicar se você rodar de novo, pois não têm restrição única.)
-- ============================================================

-- ---------- Instituições ----------
insert into instituicoes (nome, sigla) values
  ('Universidade Federal de Uberlândia', 'UFU'),
  ('Instituto Federal do Triângulo Mineiro', 'IFTM'),
  ('Universidade de São Paulo', 'USP')
on conflict do nothing;

-- ---------- Funções / Permissões ----------
insert into funcoes (nome, permissoes) values
  ('Administrador', array['gerenciar_tudo','ver_quadro','editar_horarios','publicar_avisos']),
  ('Coordenador',   array['ver_quadro','editar_horarios','publicar_avisos']),
  ('Pesquisador',   array['ver_quadro','editar_meu_horario'])
on conflict (nome) do nothing;

-- ---------- Áreas de atuação ----------
insert into areas_atuacao (nome, cor) values
  ('Inteligência Artificial', '#6366f1'),
  ('Ciência de Dados',        '#0ea5e9'),
  ('Aprendizado de Máquina',  '#10b981'),
  ('UX / Design de Sistemas', '#ec4899'),
  ('Análise de Sistemas',     '#f59e0b'),
  ('DevOps',                  '#8b5cf6'),
  ('Pesquisa Clínica',        '#14b8a6'),
  ('Educação em Saúde',       '#ef4444')
on conflict do nothing;

-- ---------- Avisos de exemplo (sem autor; opcional) ----------
insert into avisos (titulo, descricao, tipo, status, destaque, publico_alvo, visualizacoes) values
  ('Reunião geral da equipe', 'Reunião mensal para alinhamento de projetos e metas.', 'reuniao', 'ativo', false, 'Todos os pesquisadores', 42),
  ('Atualização no quadro de disponibilidade', 'Mantenha seus horários atualizados para melhor organização da equipe.', 'importante', 'ativo', true, 'Todos os pesquisadores', 88),
  ('Workshop: Inteligência Artificial em TA', 'Inscrições abertas para o workshop.', 'treinamento', 'ativo', false, 'Área de IA e Dados', 31)
on conflict do nothing;
