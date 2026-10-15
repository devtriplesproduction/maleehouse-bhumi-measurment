-- ============================================================
-- FILE: 20261016000001_add_print_jobs.sql
-- PURPOSE: Walk-in / Print Desk jobs tracking & billing
-- ============================================================

-- Ensure the walk-in print project exists
INSERT INTO public.projects (id, name, client_name, status, created_by)
SELECT 'PRJ-PRINT-DESK', 'Walk-in Print Jobs (Generic)', 'Walk-in Print Jobs (Generic)', 'archived', (SELECT id FROM profiles LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects WHERE id = 'PRJ-PRINT-DESK'
);

CREATE TABLE IF NOT EXISTS public.print_jobs (
  id              TEXT PRIMARY KEY,
  client_name     TEXT NOT NULL,
  client_phone    TEXT,
  project_id      TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  file_id         TEXT,
  file_name       TEXT,
  file_url        TEXT,
  copies          INT NOT NULL DEFAULT 1 CHECK (copies > 0),
  paper_size      TEXT NOT NULL DEFAULT 'A4',
  print_type      TEXT NOT NULL DEFAULT 'bw',
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  payment_id      TEXT REFERENCES public.payments(id) ON DELETE SET NULL,
  receipt_number  TEXT,
  created_by      UUID REFERENCES public.profiles(id),
  printed_by      UUID REFERENCES public.profiles(id),
  printed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_print_jobs_project_id ON public.print_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at_desc ON public.print_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_client_phone ON public.print_jobs(client_phone);
CREATE INDEX IF NOT EXISTS idx_print_jobs_payment_id ON public.print_jobs(payment_id);

-- RLS
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for ops roles" ON public.print_jobs;
CREATE POLICY "Enable read for ops roles" ON public.print_jobs
  FOR SELECT USING (
    get_user_role() IN ('admin', 'accountant', 'engineer', 'developer')
  );

DROP POLICY IF EXISTS "Enable insert for ops roles" ON public.print_jobs;
CREATE POLICY "Enable insert for ops roles" ON public.print_jobs
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin', 'accountant', 'engineer', 'developer')
  );

DROP POLICY IF EXISTS "Enable update for ops roles" ON public.print_jobs;
CREATE POLICY "Enable update for ops roles" ON public.print_jobs
  FOR UPDATE USING (
    get_user_role() IN ('admin', 'accountant', 'engineer', 'developer')
  );

DROP POLICY IF EXISTS "Enable delete for ops roles" ON public.print_jobs;
CREATE POLICY "Enable delete for ops roles" ON public.print_jobs
  FOR DELETE USING (
    get_user_role() IN ('admin', 'accountant', 'engineer', 'developer')
  );

-- Allow ops roles to insert payments for PRJ-PRINT-DESK
DROP POLICY IF EXISTS "print_desk_insert_payments" ON public.payments;
CREATE POLICY "print_desk_insert_payments"
ON public.payments
FOR INSERT
WITH CHECK (
    get_user_role() IN ('admin', 'accountant', 'engineer', 'developer')
    AND project_id = 'PRJ-PRINT-DESK'
);

-- Allow ops roles to insert project for PRJ-PRINT-DESK
DROP POLICY IF EXISTS "print_desk_insert_project" ON public.projects;
CREATE POLICY "print_desk_insert_project"
ON public.projects
FOR INSERT
WITH CHECK (
    get_user_role() IN ('admin', 'accountant', 'engineer', 'developer')
    AND id = 'PRJ-PRINT-DESK'
);
