-- ============================================
-- 002_rls_policies.sql
-- Row Level Security for all 7 tables
-- ============================================
-- Strategy:
--   auth.uid() returns profile.id for both admin (via Supabase Auth) and staff (via custom JWT).
--   Venue scoping is done by looking up the user's venue_id from profiles.
--   Super admins bypass all policies.
-- ============================================

-- Helper: get current user's role from profiles
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's venue_id from profiles
CREATE OR REPLACE FUNCTION public.user_venue_id()
RETURNS uuid AS $$
  SELECT venue_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- VENUES
-- ============================================
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_venues" ON venues
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "users_read_own_venue" ON venues
  FOR SELECT USING (id = public.user_venue_id());

-- ============================================
-- VENUE_SETTINGS
-- ============================================
ALTER TABLE venue_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_venue_settings" ON venue_settings
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "admin_manage_own_venue_settings" ON venue_settings
  FOR ALL USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'venue_admin'
  );

CREATE POLICY "staff_read_own_venue_settings" ON venue_settings
  FOR SELECT USING (venue_id = public.user_venue_id());

-- ============================================
-- PROFILES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_profiles" ON profiles
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "admin_manage_venue_profiles" ON profiles
  FOR ALL USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'venue_admin'
  );

CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "staff_read_venue_profiles" ON profiles
  FOR SELECT USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'staff'
  );

-- ============================================
-- TASKS
-- ============================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_tasks" ON tasks
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "admin_manage_venue_tasks" ON tasks
  FOR ALL USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'venue_admin'
  );

CREATE POLICY "staff_read_venue_tasks" ON tasks
  FOR SELECT USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'staff'
  );

-- ============================================
-- TASK_ASSIGNMENTS
-- ============================================
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_assignments" ON task_assignments
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "admin_manage_venue_assignments" ON task_assignments
  FOR ALL USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'venue_admin'
  );

CREATE POLICY "staff_read_venue_assignments" ON task_assignments
  FOR SELECT USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'staff'
  );

CREATE POLICY "staff_update_own_assignments" ON task_assignments
  FOR UPDATE USING (
    assigned_to = auth.uid()
    AND public.user_role() = 'staff'
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND public.user_role() = 'staff'
  );

-- ============================================
-- POINTS_LEDGER
-- ============================================
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_points" ON points_ledger
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "admin_manage_venue_points" ON points_ledger
  FOR ALL USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'venue_admin'
  );

CREATE POLICY "staff_read_venue_points" ON points_ledger
  FOR SELECT USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'staff'
  );

-- ============================================
-- REWARD_REDEMPTIONS
-- ============================================
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_rewards" ON reward_redemptions
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY "admin_manage_venue_rewards" ON reward_redemptions
  FOR ALL USING (
    venue_id = public.user_venue_id()
    AND public.user_role() = 'venue_admin'
  );

CREATE POLICY "staff_read_own_rewards" ON reward_redemptions
  FOR SELECT USING (
    profile_id = auth.uid()
    AND public.user_role() = 'staff'
  );

CREATE POLICY "staff_insert_own_rewards" ON reward_redemptions
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND venue_id = public.user_venue_id()
    AND public.user_role() = 'staff'
  );

-- ============================================
-- PUBLIC / ANONYMOUS POLICIES
-- Needed for login pages before authentication
-- ============================================

-- Staff login page needs to list venues
CREATE POLICY "anon_read_venues" ON venues
  FOR SELECT USING (true);

-- Staff login page needs venue theme colours
CREATE POLICY "anon_read_venue_settings" ON venue_settings
  FOR SELECT USING (true);

-- Staff login page shows staff profile cards
CREATE POLICY "anon_read_staff_profiles" ON profiles
  FOR SELECT USING (role = 'staff');
