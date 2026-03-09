-- ============================================================
-- PROD SYNC SCRIPT: Migrations 005 through 010
-- ============================================================
-- This script consolidates migrations 005-010 into a single
-- idempotent script safe to run in the Supabase SQL Editor.
--
-- Migrations included:
--   005 - Profile status column
--   006 - Reward types table + reward redemptions updates
--   007 - Task approval columns (proposed_by, approval_status)
--   008 - Staff RLS policies (claim, assign, points, propose)
--   009 - Task frequency column (replaces is_recurring)
--   010 - Updated cron function for frequency-based resets
--
-- Safe to run multiple times — all statements use IF NOT EXISTS
-- or existence checks to prevent duplicate errors.
-- ============================================================


-- ============================================================
-- 005: Profile status column
-- ============================================================

-- Add status column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Set all existing profiles to active
UPDATE profiles SET status = 'active' WHERE status IS NULL;

-- Add check constraint (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
      CHECK (status IN ('pending', 'active', 'inactive'));
  END IF;
END $$;


-- ============================================================
-- 006: Reward Types Table + Reward Redemptions Updates
-- ============================================================

-- 1. Create reward_types table
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reward_types') THEN
    CREATE TABLE reward_types (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      venue_id        uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      name            text NOT NULL,
      emoji           text DEFAULT '',
      points_required integer NOT NULL CHECK (points_required > 0),
      is_active       boolean DEFAULT true,
      created_at      timestamptz DEFAULT now(),
      updated_at      timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Index on venue_id
CREATE INDEX IF NOT EXISTS idx_reward_types_venue_id ON reward_types(venue_id);

-- 2. Trigger: auto-update updated_at on reward_types
CREATE OR REPLACE FUNCTION update_reward_types_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reward_types_updated_at'
  ) THEN
    CREATE TRIGGER trg_reward_types_updated_at
      BEFORE UPDATE ON reward_types
      FOR EACH ROW EXECUTE FUNCTION update_reward_types_timestamp();
  END IF;
END $$;

-- 3. RLS on reward_types
ALTER TABLE reward_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reward_types' AND policyname = 'super_admin_all_reward_types'
  ) THEN
    CREATE POLICY super_admin_all_reward_types ON reward_types
      FOR ALL USING (public.user_role() = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reward_types' AND policyname = 'admin_manage_venue_reward_types'
  ) THEN
    CREATE POLICY admin_manage_venue_reward_types ON reward_types
      FOR ALL USING (venue_id = public.user_venue_id() AND public.user_role() = 'venue_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reward_types' AND policyname = 'staff_read_venue_reward_types'
  ) THEN
    CREATE POLICY staff_read_venue_reward_types ON reward_types
      FOR SELECT USING (venue_id = public.user_venue_id() AND public.user_role() = 'staff');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reward_types' AND policyname = 'anon_read_reward_types'
  ) THEN
    CREATE POLICY anon_read_reward_types ON reward_types
      FOR SELECT USING (true);
  END IF;
END $$;

-- 4. Alter reward_redemptions: add new columns
ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS reward_type_id uuid REFERENCES reward_types(id);
ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS points_reserved integer NOT NULL DEFAULT 0;
ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES profiles(id);

-- 5. Make reward_type column nullable (drop old CHECK if it exists)
ALTER TABLE reward_redemptions DROP CONSTRAINT IF EXISTS reward_redemptions_reward_type_check;
DO $$ BEGIN
  -- Only alter if the column currently has NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_redemptions'
      AND column_name = 'reward_type' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE reward_redemptions ALTER COLUMN reward_type DROP NOT NULL;
  END IF;
END $$;

-- 6. Index on new FK
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward_type_id ON reward_redemptions(reward_type_id);


-- ============================================================
-- 007: Task approval columns (proposed_by, approval_status)
-- ============================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS proposed_by uuid REFERENCES profiles(id);

-- Add approval_status with CHECK constraint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'active';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_approval_status_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_approval_status_check
      CHECK (approval_status IN ('proposed', 'active', 'rejected'));
  END IF;
END $$;


-- ============================================================
-- 008: Staff RLS policies
-- ============================================================

-- 1. Staff can claim open (unassigned) assignments in their venue
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_assignments' AND policyname = 'staff_claim_open_assignments'
  ) THEN
    CREATE POLICY staff_claim_open_assignments ON task_assignments
      FOR UPDATE
      USING (venue_id = public.user_venue_id() AND public.user_role() = 'staff' AND assigned_to IS NULL)
      WITH CHECK (assigned_to = auth.uid() AND public.user_role() = 'staff');
  END IF;
END $$;

-- 2. Staff can self-assign (take) available tasks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_assignments' AND policyname = 'staff_self_assign_tasks'
  ) THEN
    CREATE POLICY staff_self_assign_tasks ON task_assignments
      FOR INSERT
      WITH CHECK (
        venue_id = public.user_venue_id()
        AND assigned_to = auth.uid()
        AND assigned_by = auth.uid()
        AND public.user_role() = 'staff'
      );
  END IF;
END $$;

-- 3. Staff can insert own points on task completion
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'points_ledger' AND policyname = 'staff_insert_own_points'
  ) THEN
    CREATE POLICY staff_insert_own_points ON points_ledger
      FOR INSERT
      WITH CHECK (
        profile_id = auth.uid()
        AND created_by = auth.uid()
        AND venue_id = public.user_venue_id()
        AND public.user_role() = 'staff'
      );
  END IF;
END $$;

-- 4. Staff can propose tasks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'staff_propose_tasks'
  ) THEN
    CREATE POLICY staff_propose_tasks ON tasks
      FOR INSERT
      WITH CHECK (
        venue_id = public.user_venue_id()
        AND proposed_by = auth.uid()
        AND created_by = auth.uid()
        AND approval_status = 'proposed'
        AND public.user_role() = 'staff'
      );
  END IF;
END $$;


-- ============================================================
-- 009: Task frequency column (replaces is_recurring)
-- ============================================================

-- Add frequency column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'once';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_frequency_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_frequency_check
      CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly'));
  END IF;
END $$;

-- Migrate existing data (safe even if is_recurring is already gone)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'is_recurring'
  ) THEN
    UPDATE tasks SET frequency = 'daily' WHERE is_recurring = true;
    UPDATE tasks SET frequency = 'once' WHERE is_recurring = false;
  END IF;
END $$;

-- Drop old column
ALTER TABLE tasks DROP COLUMN IF EXISTS is_recurring;


-- ============================================================
-- 010: Updated cron function for frequency-based resets
-- ============================================================

CREATE OR REPLACE FUNCTION reset_recurring_assignments()
RETURNS void AS $$
BEGIN
  INSERT INTO task_assignments (task_id, venue_id, assigned_to, assigned_by, due_date, status)
  SELECT t.id, t.venue_id, NULL, t.created_by, CURRENT_DATE, 'pending'
  FROM tasks t
  WHERE t.is_active = true
    AND t.frequency IN ('daily', 'weekly', 'monthly')
    AND (
      (t.frequency = 'daily')
      OR (t.frequency = 'weekly' AND EXTRACT(ISODOW FROM CURRENT_DATE) = 1)
      OR (t.frequency = 'monthly' AND EXTRACT(DAY FROM CURRENT_DATE) = 1)
    )
    -- Idempotent: skip if assignment already exists for today
    AND NOT EXISTS (
      SELECT 1 FROM task_assignments ta
      WHERE ta.task_id = t.id AND ta.due_date = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- DONE: Migrations 005-010 applied successfully
-- ============================================================
