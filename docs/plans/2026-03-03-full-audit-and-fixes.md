# Full Audit & Fix Plan — Bar Chores App
> Date: 2026-03-03 | Status: PENDING APPROVAL

---

## SECTION A: BUGS — Broken Functionality

### BUG-1: CRITICAL — Service Role Key Exposed in Frontend
**Where:** `src/lib/supabase.ts`, `.env` (`VITE_SUPABASE_SERVICE_ROLE_KEY`)
**Problem:** The `VITE_` prefix makes this key part of the client-side JS bundle. Anyone can open DevTools, extract it, and bypass ALL Row Level Security — full database access.
**Used by:** `SuperAdminDashboard.tsx` (create admin users), `AdminUsers.tsx` (create/update staff auth)
**Fix:** Move all `supabaseAdmin` operations to a Supabase Edge Function. Frontend calls the Edge Function; the service role key lives server-side only. Remove `VITE_SUPABASE_SERVICE_ROLE_KEY` from `.env` and Vercel.

### BUG-2: HIGH — Staff Auth Uses Fake Supabase Auth Users (Spec Violation)
**Where:** `AuthContext.tsx` (`staffLogin`), `AdminUsers.tsx` (staff creation)
**Problem:** Spec says "Staff do NOT use Supabase Auth" — they should use a custom Edge Function that verifies PIN and returns a JWT. Instead, the app creates real Supabase Auth users with fake emails like `bribri@staff-{venue_id}.local` and uses `signInWithPassword`. This caused:
- Session-switching bugs when admins create staff
- Auth user pollution in Supabase
- The need for `pauseAuthListener` hacks
**Fix:** Rewrite staff auth to call the deployed `staff-auth` Edge Function. The Edge Function already exists and returns a valid JWT. Store the JWT in localStorage and use `supabase.auth.setSession()` or attach it to a custom Supabase client.

### BUG-3: HIGH — Admin Dashboard Stuck on Loading
**Where:** `AdminDashboard.tsx`
**Problem:** `loadStats()` depends on `profile?.venue_id` but the venue context may not be loaded yet. The `loading` state only becomes `false` after `loadStats()` runs, but if `profile` is null on first render, `loadStats()` returns early without setting `loading = false`. The page shows "Loading stats..." forever.
**Also:** Navigation between admin pages triggers a full re-render but the VenueContext doesn't cache — each page re-fetches venue data.
**Fix:** Add a fallback: if `profile?.venue_id` is falsy for more than 2 seconds, show "No venue configured" instead of infinite loading. Also ensure `setLoading(false)` runs in all paths.

### BUG-4: HIGH — Admin Cannot See Task Photos
**Where:** `AdminAssignments.tsx` line 184
**Problem:** The "View Photo" button sets `reviewPhoto` to the `photo_url`. But:
1. `task-photos` bucket may be private — signed URLs expire
2. Storage upload policy only allows admin/super_admin inserts, but staff need to upload photos
3. The photo modal opens but the image may fail to load (expired URL or 403)
**Fix:**
- Ensure `task-photos` bucket is public-read OR generate signed URLs on load
- Add staff upload policy to storage
- Add error state to photo modal (fallback if image fails)

### BUG-5: MEDIUM — Staff Task Photo Upload Fails Silently
**Where:** `StaffTasks.tsx` line 113
**Problem:** Storage policy `admin_upload_task_photos` only allows admins. Staff users cannot upload to `task-photos` bucket. The upload fails but the code only logs the error and continues, marking the task as "submitted" with `photo_url: null`.
**Fix:** Add a storage policy allowing authenticated users with role='staff' to INSERT into `task-photos`. Also show an error to the user if upload fails.

### BUG-6: MEDIUM — Staff Profile Photo Upload Fails Silently
**Where:** `StaffProfile.tsx` line 74
**Problem:** Same as BUG-5 — `admin_upload_profile_pictures` policy only allows admins. Staff cannot upload their own profile photos.
**Fix:** Add a storage policy for staff to upload to `profile-pictures`.

### BUG-7: MEDIUM — Points Not Deducted Before Reward Request
**Where:** `StaffRewards.tsx` line 41-57
**Problem:** The reward request checks `if (points < cost)` but uses `profile?.points_total` which is stale (loaded once on mount). If staff spam-click, they could submit multiple requests exceeding their actual balance. Points are only deducted when admin approves.
**Fix:** This is by spec design (deduct on approval), but should disable the button after a pending request or refresh points before checking.

### BUG-8: MEDIUM — Venue Admin Invite Flow Missing
**Where:** `SuperAdminDashboard.tsx`
**Problem:** Spec says "Supabase sends an invite email — admin clicks link and sets their password." Current code creates user with `admin.createUser()` and a password set by the super admin. No invite email is sent.
**Fix:** Use `supabase.auth.admin.inviteUserByEmail()` instead, OR keep current approach but document the deviation.

### BUG-9: LOW — Leaderboard Missing Avatar/Photo on Feed
**Where:** `StaffDashboard.tsx` activity feed (line 82-93)
**Problem:** Spec says "Avatar/photo shown beside each feed item." Current feed only shows display_name and points delta — no avatar.
**Fix:** Join `avatar_url` and `avatar_config` in the activity query and render them.

### BUG-10: LOW — StaffDashboard Activity Feed Not Real-Time
**Where:** `StaffDashboard.tsx`
**Problem:** Spec says "Powered by Supabase Realtime subscriptions on points_ledger table." The leaderboard has Realtime but the dashboard activity feed does not.
**Fix:** Add Realtime subscription to StaffDashboard.

### BUG-11: LOW — Staff PIN Change Doesn't Update Auth Password
**Where:** `StaffProfile.tsx` `changePin()` line 95-96
**Problem:** When staff changes their PIN, only the `profiles.pin_hash` is updated. The Supabase Auth password (`staffpin_{pin}`) is NOT updated, so next login with new PIN would fail.
**Fix:** If using Supabase Auth for staff (current), update via Edge Function. If switching to Edge Function auth (BUG-2 fix), this becomes a non-issue since auth checks `pin_hash` directly.

### BUG-12: LOW — No First-Login Profile Setup Prompt
**Where:** StaffLayout / StaffDashboard
**Problem:** Spec says "On first login, staff is taken to Profile Setup before the dashboard." No such redirect exists.
**Fix:** In StaffLayout, check if `profile.avatar_type` is null — if so, redirect to `/staff/profile` with a banner.

---

## SECTION B: NEW FEATURES — User Requested

### FEAT-1: Staff Can Create Their Own Tasks
**Description:** Staff should be able to propose tasks (title, description, photo). These go to the admin who decides the point value. Admin then approves the task with points assigned.
**Implementation:**
- Add `proposed_by` column to `tasks` table (nullable uuid FK to profiles)
- Add `status` column to `tasks`: `proposed` / `active` (current tasks are all `active`)
- Staff side: "Propose Task" form on StaffTasks page — creates task with `status: 'proposed'`, `points: 0`
- Admin side: New "Proposed Tasks" section on AdminTasks — admin sets points and approves → status becomes `active`
- RLS: Staff can INSERT tasks where `proposed_by = auth.uid()` and `status = 'proposed'`

### FEAT-2: Daily Calendar View for Admin Dashboard
**Description:** Admin needs a calendar view showing which tasks were completed each day, by whom, and how many points.
**Implementation:**
- Replace/enhance AdminDashboard with a weekly calendar grid
- Each day cell shows: tasks completed, total points awarded, who did what
- Click a day to expand details
- Date navigation (prev/next week, today button)
- Data source: `task_assignments` joined with `tasks` and `profiles`, grouped by `due_date`

### FEAT-3: Who Did the Most Work — Daily & Weekly Stats
**Description:** Admin wants to see staff performance rankings by day and by week.
**Implementation:**
- New section on AdminDashboard: "Top Performers"
- Toggle: Today / This Week / This Month
- Shows: staff name, avatar, tasks completed count, total points earned
- Data source: `points_ledger` grouped by `profile_id`, filtered by date range
- Sort by total delta descending

### FEAT-4: Richer Admin Dashboard Stats
**Description:** Current dashboard only shows 4 stat cards. Needs more data at a glance.
**Implementation:**
- Keep the 4 stat cards
- Add: "Today's Completions" timeline (who did what, when)
- Add: "Pending Photo Reviews" quick list with thumbnails
- Add: "This Week vs Last Week" comparison
- Add: Staff activity heatmap (which hours are busiest)

---

## SECTION C: IMPLEMENTATION PRIORITY ORDER

### Phase 1 — Security (must fix first)
1. **BUG-1**: Move service role operations to Edge Function
2. **BUG-2**: Rewrite staff auth to use Edge Function JWT (eliminates BUG-11 too)

### Phase 2 — Core Broken Functionality
3. **BUG-3**: Fix dashboard loading state
4. **BUG-4**: Fix photo viewing in admin assignments
5. **BUG-5**: Fix staff task photo upload (storage policy)
6. **BUG-6**: Fix staff profile photo upload (storage policy)

### Phase 3 — New Features
7. **FEAT-1**: Staff-proposed tasks
8. **FEAT-2**: Daily calendar view
9. **FEAT-3**: Performance rankings (daily/weekly)
10. **FEAT-4**: Enhanced admin dashboard

### Phase 4 — Polish
11. **BUG-7**: Prevent duplicate reward requests
12. **BUG-8**: Admin invite email flow (or document deviation)
13. **BUG-9**: Avatars on activity feed
14. **BUG-10**: Realtime activity feed
15. **BUG-12**: First-login profile setup redirect

---

## SECTION D: FILES THAT NEED CHANGES

| File | Changes Needed |
|------|---------------|
| `supabase/functions/staff-auth/index.ts` | Already deployed, may need updates for new auth flow |
| `supabase/functions/admin-actions/index.ts` | **NEW** — Edge Function for admin user creation (replaces client-side service role) |
| `src/lib/supabase.ts` | Remove `supabaseAdmin` client entirely |
| `src/context/AuthContext.tsx` | Rewrite `staffLogin` to call Edge Function, remove `pauseAuthListener` |
| `src/pages/admin/AdminDashboard.tsx` | Fix loading, add calendar, add performance stats |
| `src/pages/admin/AdminAssignments.tsx` | Fix photo viewing, add thumbnails |
| `src/pages/admin/AdminUsers.tsx` | Call Edge Function instead of `supabaseAdmin` |
| `src/pages/admin/AdminTasks.tsx` | Add "Proposed Tasks" approval section |
| `src/pages/superadmin/SuperAdminDashboard.tsx` | Call Edge Function instead of `supabaseAdmin` |
| `src/pages/staff/StaffTasks.tsx` | Add "Propose Task" form |
| `src/pages/staff/StaffDashboard.tsx` | Add Realtime, add avatars to feed |
| `src/pages/staff/StaffProfile.tsx` | Fix PIN change auth update |
| `src/pages/staff/StaffLogin.tsx` | Update to call Edge Function |
| `src/components/staff/StaffLayout.tsx` | Add first-login redirect |
| Supabase DB | Add storage policies for staff uploads, add task columns for proposals |
| `.env` / Vercel | Remove `VITE_SUPABASE_SERVICE_ROLE_KEY` |
