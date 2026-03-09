-- ============================================================
-- 007: Add approval_status and proposed_by columns to tasks
-- ============================================================
-- These columns support the staff task proposal workflow:
--   - Staff can propose tasks (approval_status = 'proposed')
--   - Admin reviews and approves/rejects
--   - Admin-created tasks default to 'active'

-- 1. Add proposed_by column (nullable FK to profiles)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS proposed_by uuid REFERENCES profiles (id);

-- 2. Add approval_status column with CHECK constraint
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'active'
    CHECK (approval_status IN ('proposed', 'active', 'rejected'));
