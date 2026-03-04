-- ============================================
-- 004_cron.sql
-- Nightly midnight job: reset recurring task assignments
-- ============================================
-- Requires pg_cron extension (enabled in Supabase dashboard under Database > Extensions)

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: insert fresh pending assignments for all active recurring tasks
CREATE OR REPLACE FUNCTION reset_recurring_assignments()
RETURNS void AS $$
BEGIN
  INSERT INTO task_assignments (task_id, venue_id, assigned_to, assigned_by, due_date, status)
  SELECT
    t.id,
    t.venue_id,
    NULL,           -- unassigned / open for claiming
    t.created_by,   -- original task creator as assigned_by
    CURRENT_DATE,
    'pending'
  FROM tasks t
  WHERE t.is_active = true
    AND t.is_recurring = true
    -- Only create if there isn't already an assignment for today
    AND NOT EXISTS (
      SELECT 1 FROM task_assignments ta
      WHERE ta.task_id = t.id
        AND ta.due_date = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule: every day at midnight UTC
SELECT cron.schedule(
  'reset-recurring-tasks',
  '0 0 * * *',
  'SELECT reset_recurring_assignments()'
);
