# Task Frequency Limits — Design & Implementation Plan

**Date:** 2026-03-09
**Branch:** `feature/task-frequency-limits`
**Status:** Design approved, implementation pending

---

## Problem

Currently all recurring tasks are simple booleans (`is_recurring = true/false`). There is no enforcement that prevents multiple staff from completing the same task within a period. A daily task can be done by every staff member every day, and there's no concept of weekly or monthly tasks.

## Requirements

1. Replace `is_recurring` boolean with a `frequency` field: `once`, `daily`, `weekly`, `monthly`
2. **Venue-wide enforcement:** Once ANY staff at a venue completes a task, it disappears from the available list for ALL staff at that venue until the next period
3. Week starts on **Monday** (ISO standard)
4. Admin UI: Replace "Daily Recurring" checkbox with a frequency dropdown

---

## Design

### 1. Database Migration (migration 009)

```sql
-- Add frequency column
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'once'
    CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly'));

-- Migrate existing data
UPDATE tasks SET frequency = 'daily' WHERE is_recurring = true;
UPDATE tasks SET frequency = 'once' WHERE is_recurring = false;

-- Drop old column
ALTER TABLE tasks DROP COLUMN IF EXISTS is_recurring;
```

### 2. Cron Job Update (migration 010 or update existing)

The existing `reset_recurring_assignments()` function only handles daily. Update to:

- **Daily tasks:** Create assignment every day at midnight UTC (same as now)
- **Weekly tasks:** Create assignment on Monday at midnight UTC
- **Monthly tasks:** Create assignment on 1st of month at midnight UTC

```sql
CREATE OR REPLACE FUNCTION reset_recurring_assignments()
RETURNS void AS $$
BEGIN
  INSERT INTO task_assignments (task_id, venue_id, assigned_to, assigned_by, due_date, status)
  SELECT t.id, t.venue_id, NULL, t.created_by, CURRENT_DATE, 'pending'
  FROM tasks t
  WHERE t.is_active = true
    AND t.frequency IN ('daily', 'weekly', 'monthly')
    -- Daily: every day
    AND (
      (t.frequency = 'daily')
      -- Weekly: only on Monday (ISO DOW 1)
      OR (t.frequency = 'weekly' AND EXTRACT(ISODOW FROM CURRENT_DATE) = 1)
      -- Monthly: only on 1st
      OR (t.frequency = 'monthly' AND EXTRACT(DAY FROM CURRENT_DATE) = 1)
    )
    -- Idempotent: skip if assignment already exists for today
    AND NOT EXISTS (
      SELECT 1 FROM task_assignments ta
      WHERE ta.task_id = t.id AND ta.due_date = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Frontend — StaffTasks.tsx

**Key change in `loadData()`:** When loading available tasks, also check if any assignment for this task has been completed/approved in the current period (venue-wide). If so, exclude it.

Current flow:
```
1. Load today's assignments (mine + open)
2. Load all active tasks
3. Filter out tasks I already have an assignment for
4. Show remaining as "Available Tasks"
```

New flow:
```
1. Load today's assignments (mine + open)
2. Load all active tasks
3. For each task, determine the current period window:
   - once: no window (always available if no assignment exists)
   - daily: today
   - weekly: Monday..Sunday of current week
   - monthly: 1st..last of current month
4. Load all assignments in the venue for the relevant period windows
5. Filter out tasks that have ANY completed/approved assignment in their window
6. Show remaining as "Available Tasks"
```

**Implementation approach — query all venue assignments for the current week (covers daily and weekly). For monthly tasks, also query the current month. Then filter in JS:**

```typescript
// Helper: get period start date for a task's frequency
function getPeriodStart(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      return getLocalDate(); // today
    case 'weekly': {
      const day = now.getDay(); // 0=Sun, 1=Mon...
      const diff = day === 0 ? 6 : day - 1; // Monday = start
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      return monday.toISOString().split('T')[0];
    }
    case 'monthly':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    default:
      return '1970-01-01'; // 'once' — check all time
  }
}

// In loadData: query completed assignments from start of month (covers all periods)
const monthStart = getPeriodStart('monthly');
const { data: completedAssignments } = await supabase
  .from('task_assignments')
  .select('task_id, status, due_date')
  .eq('venue_id', venueId)
  .gte('due_date', monthStart)
  .in('status', ['approved', 'submitted']);

// Build a set of task IDs completed within their frequency window
const completedTaskIds = new Set<string>();
for (const a of completedAssignments || []) {
  const task = tasksMap.get(a.task_id);
  if (!task) continue;
  const periodStart = getPeriodStart(task.frequency);
  if (a.due_date >= periodStart) {
    completedTaskIds.add(a.task_id);
  }
}

// Filter available tasks
const available = (tasks || []).filter(t =>
  !myTaskIds.has(t.id) && !completedTaskIds.has(t.id)
);
```

### 4. Frontend — AdminTasks.tsx

Replace the "Daily Recurring" checkbox with a dropdown:

```tsx
<label className="...">Frequency</label>
<select value={frequency} onChange={e => setFrequency(e.target.value)} className="...">
  <option value="once">One-time</option>
  <option value="daily">Daily</option>
  <option value="weekly">Weekly</option>
  <option value="monthly">Monthly</option>
</select>
```

- Replace state: `isRecurring` boolean → `frequency` string (default `'once'`)
- Update submit handler: send `frequency` instead of `is_recurring`
- Update task list display: show frequency badge instead of "Recurring" tag

### 5. TypeScript Types — database.ts

```typescript
export type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly';

export interface Task {
  // ... existing fields ...
  frequency: TaskFrequency;  // replaces is_recurring
  // REMOVE: is_recurring: boolean;
}
```

### 6. Seed Data — admin-actions Edge Function

Update the `reset-database` action seed data:
- Replace `is_recurring: true` → `frequency: 'daily'` (or `'weekly'` for some tasks)
- Replace `is_recurring: false` → `frequency: 'once'`

---

## Implementation Order

1. **Migration 009:** Add `frequency` column, migrate data, drop `is_recurring`
2. **Migration 010:** Update cron function for weekly/monthly
3. **TypeScript types:** Update `Task` interface
4. **AdminTasks.tsx:** Replace checkbox with dropdown, update submit/display
5. **StaffTasks.tsx:** Add venue-wide period filtering in `loadData()`
6. **Edge Function:** Update seed data in `reset-database` action
7. **Deploy:** Run migrations on DEV, deploy edge function, deploy frontend

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/009_task_frequency.sql` | NEW — add frequency column, migrate, drop is_recurring |
| `supabase/migrations/010_update_cron_frequency.sql` | NEW — update cron function |
| `src/types/database.ts` | Replace `is_recurring` with `frequency: TaskFrequency` |
| `src/pages/admin/AdminTasks.tsx` | Dropdown instead of checkbox, update submit |
| `src/pages/staff/StaffTasks.tsx` | Venue-wide period filtering |
| `supabase/functions/admin-actions/index.ts` | Update seed data |
| `supabase/CLAUDE.md` | Bump migration counter to 011 |

---

## Edge Cases

- **Existing tasks in DB:** Migration converts `is_recurring=true` → `frequency='daily'`, `false` → `'once'`
- **Race condition (two staff claim simultaneously):** Accepted as negligible for a small bar team. Frontend filtering is sufficient.
- **Timezone:** Cron runs at midnight UTC. Period boundaries use UTC dates. This is consistent with existing behavior.
- **Weekly reset day:** Monday (ISO standard, `EXTRACT(ISODOW FROM date) = 1`)
- **Admin can still manually assign tasks:** Manual assignments bypass frequency limits (admin override)
