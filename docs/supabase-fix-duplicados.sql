-- ============================================================
-- CINTESP WEB — Correção: remove duplicatas do seed e evita repetição
-- ------------------------------------------------------------
-- Rode UMA vez no SQL Editor caso tenha executado o seed mais de uma vez.
-- (Áreas, instituições e avisos não tinham restrição única, então duplicaram.)
-- Mantém a linha mais antiga de cada e apaga as repetidas (via ctid).
-- ============================================================

-- ---------- Remove duplicatas ----------
delete from public.areas_atuacao a using public.areas_atuacao b
where a.nome = b.nome and a.ctid > b.ctid;

delete from public.instituicoes a using public.instituicoes b
where a.sigla = b.sigla and a.ctid > b.ctid;

delete from public.avisos a using public.avisos b
where a.titulo = b.titulo and a.descricao = b.descricao and a.ctid > b.ctid;

-- ---------- Evita duplicar de novo (restrições únicas) ----------
-- (Se já existir a constraint, o Postgres avisa; pode ignorar o erro.)
alter table public.areas_atuacao add constraint areas_atuacao_nome_key unique (nome);
alter table public.instituicoes  add constraint instituicoes_sigla_key  unique (sigla);

-- Pronto. Agora o seed pode ser rodado de novo sem duplicar
-- (por causa do "on conflict do nothing").
