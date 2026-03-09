-- ============================================================
-- 010: Update cron function for daily/weekly/monthly frequencies
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
