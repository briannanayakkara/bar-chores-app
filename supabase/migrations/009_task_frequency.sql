-- ============================================================
-- 009: Replace is_recurring boolean with frequency column
-- ============================================================
-- Supports: 'once', 'daily', 'weekly', 'monthly'
-- Venue-wide enforcement: once any staff completes a task in
-- its frequency window, it's unavailable until the next period.

-- 1. Add frequency column
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'once'
    CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly'));

-- 2. Migrate existing data
UPDATE tasks SET frequency = 'daily' WHERE is_recurring = true;
UPDATE tasks SET frequency = 'once' WHERE is_recurring = false;

-- 3. Drop old column
ALTER TABLE tasks DROP COLUMN IF EXISTS is_recurring;
