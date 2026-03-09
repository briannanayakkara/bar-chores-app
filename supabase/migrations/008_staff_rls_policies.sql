-- ============================================================
-- 008: Staff RLS policies for task claiming, completing, proposing
-- ============================================================
-- Staff need INSERT/UPDATE on task_assignments, INSERT on points_ledger,
-- and INSERT on tasks (for proposals). These were missing from 002.

-- 1. Staff can claim open (unassigned) assignments in their venue
CREATE POLICY staff_claim_open_assignments ON task_assignments
  FOR UPDATE
  USING (venue_id = public.user_venue_id() AND public.user_role() = 'staff' AND assigned_to IS NULL)
  WITH CHECK (assigned_to = auth.uid() AND public.user_role() = 'staff');

-- 2. Staff can self-assign (take) available tasks
CREATE POLICY staff_self_assign_tasks ON task_assignments
  FOR INSERT
  WITH CHECK (
    venue_id = public.user_venue_id()
    AND assigned_to = auth.uid()
    AND assigned_by = auth.uid()
    AND public.user_role() = 'staff'
  );

-- 3. Staff can insert own points on task completion (auto-approve flow)
CREATE POLICY staff_insert_own_points ON points_ledger
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND created_by = auth.uid()
    AND venue_id = public.user_venue_id()
    AND public.user_role() = 'staff'
  );

-- 4. Staff can propose tasks (approval_status must be 'proposed')
CREATE POLICY staff_propose_tasks ON tasks
  FOR INSERT
  WITH CHECK (
    venue_id = public.user_venue_id()
    AND proposed_by = auth.uid()
    AND created_by = auth.uid()
    AND approval_status = 'proposed'
    AND public.user_role() = 'staff'
  );
