-- ============================================================
-- CINTESP WEB — Protege colunas sensíveis de "usuarios" contra auto-edição
-- ------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente.
--
-- BUG ENCONTRADO: a policy "edita_meu_perfil" (docs/supabase-policies.sql)
-- libera UPDATE na própria linha em QUALQUER COLUNA — RLS só filtra LINHA,
-- nunca COLUNA. Como a tabela "funcoes" é de leitura livre para qualquer
-- autenticado, hoje um usuário comum consegue, direto pelo supabase-js
-- (sem precisar do app, só abrindo o console do navegador), fazer:
--
--   supabase.from('usuarios')
--     .update({ funcao_id: '<id da função Administrador>' })
--     .eq('id', meuProprioId)
--
-- ...e se autopromover a admin. Isso é independente de qual versão do
-- gatilho de cadastro (handle_new_user) está rodando — mesmo com o
-- gatilho certo, uma conta já existente pode se autopromover sozinha.
--
-- CORREÇÃO: um gatilho (mesmo padrão de docs/supabase-projetos.sql,
-- função projetos_valida_edicao) barra por COLUNA o que um usuário comum
-- pode mudar na própria linha de "usuarios". Administrador continua
-- podendo mudar qualquer coisa, em qualquer linha, normalmente.
-- ============================================================

create or replace function public.usuarios_valida_edicao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  campos_mudados text[];
  campo          text;
  -- Campos de PERFIL que o próprio usuário pode editar (ver
  -- src/data/api.ts → atualizarMeuPerfil). Tudo fora disso — em especial
  -- funcao_id, status, instituicao_id, email — só admin muda.
  campos_livres  text[] := array[
    'nome', 'telefone', 'whatsapp', 'cpf', 'endereco', 'cep', 'curso',
    'data_nascimento', 'foto_url', 'updated_at'
  ];
begin
  -- Admin muda qualquer coisa, em qualquer linha.
  if public.is_admin() then
    return new;
  end if;

  select array_agg(k) into campos_mudados
  from jsonb_each(to_jsonb(new)) n(k, v)
  where v is distinct from (to_jsonb(old) -> n.k);

  foreach campo in array coalesce(campos_mudados, array[]::text[]) loop
    if not (campo = any(campos_livres)) then
      raise exception 'Campo "%" só pode ser alterado por um administrador.', campo;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_usuarios_valida_edicao on public.usuarios;
create trigger trg_usuarios_valida_edicao
  before update on public.usuarios
  for each row execute function public.usuarios_valida_edicao();

-- ============================================================
-- DIAGNÓSTICO — rode isto para ver qual versão do gatilho de cadastro
-- está ativa em produção hoje (o fix definitivo é
-- docs/supabase-fix-novo-usuario-participante.sql — se o texto abaixo
-- não contiver "NÃO aplica mais `funcaoPretendida`", esse arquivo ainda
-- não foi rodado neste projeto e precisa ser):
--
--   select prosrc from pg_proc where proname = 'handle_new_user';
--
-- Contas que podem ter entrado com função errada (auto-promovidas antes
-- desta correção, ou por causa do gatilho antigo) — confira e rebaixe
-- manualmente quem não deveria ter acesso:
--
--   select u.id, u.nome, u.email, f.nome as funcao_atual, u.created_at
--   from public.usuarios u
--   join public.funcoes f on f.id = u.funcao_id
--   where f.nome <> 'Participante'
--   order by u.created_at desc;
-- ============================================================
