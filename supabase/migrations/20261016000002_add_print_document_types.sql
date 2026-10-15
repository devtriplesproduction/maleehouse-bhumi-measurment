-- ============================================================
-- FILE: 20261016000002_add_print_document_types.sql
-- PURPOSE: Document / file types with customizable base prices for Print Desk
-- ============================================================

CREATE TABLE IF NOT EXISTS public.print_document_types (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  description          TEXT,
  base_price           NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  suggested_paper      TEXT DEFAULT 'A4',
  suggested_print_type TEXT DEFAULT 'bw',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add doc_type column to print_jobs if not already present
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS doc_type TEXT;

-- Seed standard document types
INSERT INTO public.print_document_types (id, name, description, base_price, suggested_paper, suggested_print_type)
VALUES
  ('DOC-CADASTRAL', 'Cadastral Survey Map', 'Village boundary / land parcel map', 50.00, 'A3', 'color'),
  ('DOC-CONTOUR', 'Contour & Topo Survey', 'Elevation contour topographical plot', 100.00, 'A1', 'color'),
  ('DOC-DEMARCATION', 'Site Demarcation Plan', 'Plot boundary demarcation drawing', 40.00, 'A3', 'bw'),
  ('DOC-REVENUE-712', '7/12 Extract / Revenue Record', 'Government revenue extract document', 10.00, 'A4', 'bw'),
  ('DOC-ARCH-BLUEPRINT', 'Architectural Blueprint', 'Floor plan, layout & elevations', 120.00, 'A0', 'color'),
  ('DOC-GENERAL', 'Standard Document / Report', 'General A4 printouts & office reports', 5.00, 'A4', 'bw')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.print_document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for authenticated users on print_document_types" ON public.print_document_types;
CREATE POLICY "Enable read for authenticated users on print_document_types"
  ON public.print_document_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable write for ops roles on print_document_types" ON public.print_document_types;
CREATE POLICY "Enable write for ops roles on print_document_types"
  ON public.print_document_types
  FOR ALL USING (
    get_user_role() IN ('admin', 'accountant', 'engineer', 'developer')
  ) WITH CHECK (
    get_user_role() IN ('admin', 'accountant', 'engineer', 'developer')
  );
