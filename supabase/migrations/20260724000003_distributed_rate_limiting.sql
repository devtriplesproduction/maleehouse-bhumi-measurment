-- ============================================================
-- FILE: 20260724000003_distributed_rate_limiting.sql
-- PURPOSE: Replace the in-memory (per-isolate) rate limiter in
--          middleware.ts with a shared, DB-backed one so counts are
--          consistent across serverless instances / cold starts.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

-- No RLS needed for consumers other than service_role (called only from middleware
-- via the service-role client), but enable it defensively and deny all by default.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomically check-and-increment a rate limit bucket.
-- Returns TRUE if the request is allowed, FALSE if the limit has been hit.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limits (key, count, reset_at)
  VALUES (p_key, 1, v_now + (p_window_seconds || ' seconds')::interval)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limits.reset_at < v_now THEN 1
      ELSE public.rate_limits.count + 1
    END,
    reset_at = CASE
      WHEN public.rate_limits.reset_at < v_now THEN v_now + (p_window_seconds || ' seconds')::interval
      ELSE public.rate_limits.reset_at
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

-- Periodic cleanup so the table doesn't grow unbounded; safe to call from a cron job.
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits() RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.rate_limits WHERE reset_at < now() - interval '1 hour';
$$;

-- SECURITY: check_rate_limit must NOT be callable with the anon key. The key format
-- (action:${userId}:${actionName}, ${ip}-login, etc.) is predictable, so any client
-- holding the (public-by-design) anon key could hammer another user's or IP's bucket
-- directly via POST /rest/v1/rpc/check_rate_limit - a targeted denial-of-service that
-- bypasses the app entirely - or spam junk keys to grow the table.
--
-- Both call sites (middleware.ts and src/lib/rate-limit.ts) now call this RPC using
-- the SUPABASE_SERVICE_ROLE_KEY from a trusted server context (never shipped to the
-- client), the same pattern already used by src/lib/supabase/admin.ts. Explicitly
-- revoke the default PUBLIC grant and anon/authenticated, and only allow service_role.
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limits() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limits() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO service_role;

-- Scheduled cleanup: use pg_cron when it's enabled on the project, so the table is
-- reaped hourly without depending on an external cron hitting an API route.
-- Wrapped in a DO block so the migration doesn't fail on projects/environments
-- (e.g. local dev, some self-hosted setups) where pg_cron isn't available - in that
-- case, fall back to the /api/cron/cleanup-rate-limits route wired up in vercel.json.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-rate-limits') THEN
      PERFORM cron.unschedule('cleanup-rate-limits');
    END IF;
    PERFORM cron.schedule(
      'cleanup-rate-limits',
      '0 * * * *',
      $cron$SELECT public.cleanup_expired_rate_limits();$cron$
    );
  END IF;
END;
$$;
