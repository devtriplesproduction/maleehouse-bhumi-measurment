-- ============================================================
-- FILE: 43_rls_policies.sql
-- PURPOSE: Add missing RLS policies for EOD Reports and Leaves
-- ============================================================

-- EOD Reports Policies
CREATE POLICY "Users can read own EOD reports" ON eod_reports
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can read all EOD reports" ON eod_reports
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY "Users can insert own EOD reports" ON eod_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update EOD reports" ON eod_reports
  FOR UPDATE USING (get_user_role() = 'admin');

-- Leaves Policies
CREATE POLICY "Users can read own leaves" ON leaves
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can read all leaves" ON leaves
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY "Users can insert own leaves" ON leaves
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update leaves" ON leaves
  FOR UPDATE USING (get_user_role() = 'admin');

-- Also, just in case, allow users to update their own leaves if pending
CREATE POLICY "Users can update own pending leaves" ON leaves
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');
