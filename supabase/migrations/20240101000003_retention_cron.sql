-- ============================================================================
-- JK COPYCENTER — Migration 003: Retenção de Arquivos e Agendamento pg_cron
-- ============================================================================

-- Habilitar extensão pg_cron se disponível
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Função para marcar arquivos expirados (após 30 dias) como deleted no banco
CREATE OR REPLACE FUNCTION public.mark_expired_files_as_deleted()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.order_files
    SET
      status = 'deleted',
      deleted_at = NOW()
    WHERE
      expires_at < NOW()
      AND status != 'deleted'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  IF v_count > 0 THEN
    INSERT INTO public.audit_logs (
      admin_user_id,
      action,
      entity,
      entity_id,
      old_value,
      new_value,
      ip_address,
      created_at
    ) VALUES (
      NULL,
      'retention_auto_mark_deleted',
      'order_files',
      NULL,
      NULL,
      jsonb_build_object('marked_count', v_count),
      '127.0.0.1 (pg_cron)',
      NOW()
    );
  END IF;

  RETURN v_count;
END;
$$;

-- 2. Agendar job diário no pg_cron para executar às 03:00 (UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove agendamento anterior caso exista para idempotência
    PERFORM cron.unschedule('retention-cleanup-db');

    -- Cria o agendamento
    PERFORM cron.schedule(
      'retention-cleanup-db',
      '0 3 * * *',
      'SELECT public.mark_expired_files_as_deleted();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule notice: %', SQLERRM;
END;
$$;
