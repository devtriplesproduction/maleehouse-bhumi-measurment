-- ============================================================
-- FILE: 20260817000004_performance_data_retention.sql
-- PURPOSE: Implement automatic data retention and cleanup for 
--          performance metrics (> 30 days) safely.
-- ============================================================

-- Ensure the function is updated to clean performance_metrics as well
CREATE OR REPLACE FUNCTION public.cleanup_retention_data() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_eod_deleted INTEGER;
  v_activity_deleted INTEGER;
  v_performance_deleted INTEGER;
BEGIN
  -- Preserve existing: Delete EOD records older than 3 months
  WITH deleted_eods AS (
    DELETE FROM public.eod_reports
    WHERE created_at < now() - interval '3 months'
    RETURNING 1
  )
  SELECT count(*) INTO v_eod_deleted FROM deleted_eods;

  -- Preserve existing: Delete Activity Logs older than 1 month
  WITH deleted_activities AS (
    DELETE FROM public.activity_logs
    WHERE created_at < now() - interval '1 month'
    RETURNING 1
  )
  SELECT count(*) INTO v_activity_deleted FROM deleted_activities;

  -- NOTE: security_audit_logs deletion has been intentionally removed
  -- as audit logs must NEVER be deleted.

  -- New: Delete Performance Metrics older than 30 days
  WITH deleted_performance AS (
    DELETE FROM public.performance_metrics
    WHERE created_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_performance_deleted FROM deleted_performance;

  -- Log the cleanup operation to activity_logs for auditability
  INSERT INTO public.activity_logs (
    action,
    details,
    severity
  ) VALUES (
    'data_retention_cleanup',
    jsonb_build_object(
      'eods_deleted', v_eod_deleted,
      'activity_logs_deleted', v_activity_deleted,
      'performance_metrics_deleted', v_performance_deleted
    ),
    'info'
  );
END;
$$;

-- Secure the function: only allow service_role to execute it
REVOKE ALL ON FUNCTION public.cleanup_retention_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_retention_data() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_retention_data() TO service_role;

-- 3. Schedule the cleanup using pg_cron (if available)
-- Runs at midnight (0 0 * * *) every day
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-retention-data') THEN
      PERFORM cron.unschedule('cleanup-retention-data');
    END IF;
    PERFORM cron.schedule(
      'cleanup-retention-data',
      '0 0 * * *',
      $cron$SELECT public.cleanup_retention_data();$cron$
    );
  END IF;
END;
$$;
