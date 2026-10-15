-- ============================================================
-- FILE: 20260817000007_lost_materials_tracking.sql
-- PURPOSE: Support marking project materials/equipment as lost/missing
--          with responsible member tracking so projects can complete
--          while lost equipment is reported to the admin.
-- ============================================================

-- 1. Update check constraint to allow 'lost' and 'missing'
ALTER TABLE public.material_requests DROP CONSTRAINT IF EXISTS material_requests_status_check;

ALTER TABLE public.material_requests 
  ADD CONSTRAINT material_requests_status_check 
  CHECK (status IN ('assigned', 'submitted', 'returned', 'requested', 'approved', 'delivered', 'rejected', 'lost', 'missing'));

-- 2. Add columns for lost/missing equipment accountability
ALTER TABLE public.material_requests
  ADD COLUMN IF NOT EXISTS responsible_person UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsible_person_name TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS lost_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolution_status TEXT DEFAULT 'unresolved';

-- 3. Indexes for fast admin queries
CREATE INDEX IF NOT EXISTS idx_material_requests_lost_status ON public.material_requests(status) WHERE status IN ('lost', 'missing');
CREATE INDEX IF NOT EXISTS idx_material_requests_responsible ON public.material_requests(responsible_person);
