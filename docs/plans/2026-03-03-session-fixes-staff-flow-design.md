# Session Fixes & Staff Flow Design

**Date**: 2026-03-03
**Status**: Approved

## Problems

1. **Session persistence**: App hangs on reload — stale auth tokens in localStorage cause profile load to hang, requiring manual storage clearing.
2. **Staff login broken**: The staff-auth Edge Function is not deployed (404). The UI exists but has no backend.
3. **Staff task self-assignment**: Staff can only see admin-assigned tasks, not browse and pick from available tasks.

## Design

### Fix 1: Session Persistence

- On logout, clear all Supabase localStorage keys (`sb-*-auth-token`) and staff session
- If `fetchProfile` times out (8s) or fails, auto-sign-out instead of hanging forever
- StaffLogin page works without auth (public route, no RequireAuth)
- Add RLS policies for anonymous venue/staff listing (needed by login page)

### Fix 2: Staff Login (Deploy Edge Function)

- Deploy the existing `supabase/functions/staff-auth/index.ts` via Supabase CLI
- Set JWT secret as Edge Function environment secret
- Add RLS policies so the login page can list venues and staff without auth:
  - `anyone_can_read_venues` on venues: `FOR SELECT USING (true)`
  - `anyone_can_read_staff_basic_info` on profiles: `FOR SELECT USING (role = 'staff')`
- Flow: venue picker → staff card grid (initials avatar fallback) → PIN → JWT → dashboard

### Fix 3: Staff Task Self-Assignment

- Add "Available Tasks" section to StaffTasks page showing all active tasks for the venue
- Staff taps "Take Task" → creates `task_assignment` row with `assigned_to = self`, `due_date = today`
- Add RLS policy: `staff_insert_own_assignments` on task_assignments: `FOR INSERT WITH CHECK (assigned_to = auth.uid() AND venue_id = user_venue_id() AND user_role() = 'staff')`
- Prevent duplicates: check if staff already has an assignment for that task today before inserting
