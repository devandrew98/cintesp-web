-- ============================================================
-- CINTESP — Ponto: EXCLUIR registro (admin)
-- Rode depois de supabase-ponto.sql. Idempotente.
--
-- Exclui um registro de ponto (duplicado, lançado por engano). Só
-- administrador, motivo obrigatório, e o registro apagado fica descrito em
-- historico_alteracoes. A escrita direta na tabela continua bloqueada
-- (só funções SECURITY DEFINER escrevem em ponto_registros).
-- ============================================================

create or replace function public.ponto_excluir(p_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_usuario_id uuid;
  v_tipo       text;
  v_horario    timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem excluir registros de ponto.';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Informe o motivo da exclusão.';
  end if;

  select usuario_id, tipo, registrado_em into v_usuario_id, v_tipo, v_horario
  from public.ponto_registros where id = p_id;
  if v_usuario_id is null then
    raise exception 'Registro não encontrado.';
  end if;

  delete from public.ponto_registros where id = p_id;

  insert into public.historico_alteracoes (usuario_alvo_id, autor, descricao)
  values (
    v_usuario_id,
    coalesce((select nome from public.usuarios where id = auth.uid()), 'Sistema'),
    format('Ponto excluído: %s de %s. Motivo: %s',
      v_tipo, to_char(v_horario, 'DD/MM/YYYY HH24:MI'), p_motivo)
  );
end;
$$;

grant execute on function public.ponto_excluir(uuid, text) to authenticated;
