# Design: DB Reset, Dynamic Rewards, UI Fixes

**Date:** 2026-03-09
**Branch:** `feature/db-reset-rewards-ui-fixes`
**Status:** Approved

## Task 3: Fix User Creation Bug (salt.charAt)

**Root cause:** `bcrypt.hashSync()` from `deno.land/x/bcrypt@v0.4.1` fails in Deno Deploy because `hashSync` uses Web Workers internally, unavailable in edge runtime. The error `salt.charAt is not a function` occurs when internal salt generation fails.

**Fix:** Replace all 3 `hashSync` calls in `admin-actions/index.ts` with async equivalents:
```ts
const salt = await bcrypt.genSalt(10);
const pinHash = await bcrypt.hash(String(pin), salt);
```
Affected locations: `create-staff` (L127), `update-staff` (L191), `reset-pin` (L217).

Also check `staff-auth/index.ts` for same pattern — uses `compareSync` which may have the same issue.

## Task 2: Fix Mobile UI — AdminTasks

**Root cause:** 6-column table with `px-6` padding overflows on 375px mobile screens. No horizontal scroll wrapper.

**Fix:**
- Wrap table in `overflow-x-auto`
- Reduce padding: `px-3 md:px-6`
- Proposals section: stack action buttons vertically on mobile

## Task 4a: Dynamic Reward Types

### New table: `reward_types`

```sql
CREATE TABLE reward_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        text NOT NULL,
  emoji       text DEFAULT '',
  points_required integer NOT NULL CHECK (points_required > 0),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_reward_types_venue_id ON reward_types(venue_id);
```

### RLS Policies
- `super_admin_all_reward_types` — FOR ALL
- `admin_manage_venue_reward_types` — FOR ALL WHERE venue_id match
- `staff_read_venue_reward_types` — FOR SELECT WHERE venue_id match
- `anon_read_reward_types` — FOR SELECT USING (true) (for public display)

### Admin UI
New "Manage Reward Types" section on AdminRewards page with:
- List of reward types with inline edit
- Create new type form (name, emoji, points_required)
- Toggle active/inactive
- Delete type (only if no pending redemptions reference it)

### Seed Data (per venue)
| Name | Emoji | Points |
|------|-------|--------|
| Drink Ticket | 🍺 | 100 |
| Bottle Ticket | 🍾 | 1000 |
| Hoodie | 👕 | 2000 |
| Tote Bag | 👜 | 500 |

## Task 4b: Reserve & Approve Flow

### Schema changes to `reward_redemptions`

1. Add `reward_type_id uuid REFERENCES reward_types(id)` — nullable initially for migration
2. Add `points_reserved integer NOT NULL DEFAULT 0`
3. Add `resolved_at timestamptz`
4. Add `resolved_by uuid REFERENCES profiles(id)` — the admin who approved/rejected
5. Drop CHECK on `reward_type` column (keep column for legacy, nullable)

### Available Points Calculation

```sql
-- Computed at query time, not stored
available_points = profiles.points_total
  - COALESCE(
      (SELECT SUM(points_reserved)
       FROM reward_redemptions
       WHERE profile_id = <uid> AND status = 'pending'),
      0
    )
```

### New Flow

1. **Staff requests reward:**
   - INSERT reward_redemption: status='pending', reward_type_id=<id>, points_reserved=<cost>
   - No points_ledger entry yet
   - UI optimistically subtracts reserved points from displayed balance
   - All reward buttons remain enabled if available_points >= cost

2. **Admin approves:**
   - UPDATE status='approved', resolved_at=now(), resolved_by=admin_id
   - Generate redemption code (prefix from reward type name)
   - INSERT points_ledger: delta = -points_reserved
   - Trigger updates profiles.points_total

3. **Admin rejects:**
   - UPDATE status='rejected', resolved_at=now(), resolved_by=admin_id
   - No points_ledger entry — reserved points automatically freed

4. **Real-time:**
   - Staff page: Supabase Realtime subscription on reward_redemptions + points_ledger
   - Optimistic UI update on request submission

## Task 1: DB Reset Feature

### Edge Function: `reset-database` action in `admin-actions`

Steps:
1. Verify caller is super_admin
2. Delete all auth users except super admin via admin API
3. Truncate in FK order: reward_redemptions, points_ledger, task_assignments, tasks, profiles (non-super), venue_settings, venues
4. Re-seed: venues, venue_settings (auto via trigger), admin auth users + profiles, staff auth users + profiles (with bcrypt PINs), reward_types, tasks, task_assignments
5. Return summary of seeded counts

### Super Admin UI
- Red "Reset Database" button on SuperAdminDashboard
- 2-step confirmation: click button → type "RESET" in dialog → execute
- Progress display showing each step
- Success summary with seeded counts

## Task 5: Documentation Updates

- Update `app-flowchart.md`: reward flow diagram (reserve → approve/reject)
- Update DB ERD in flowcharts: add reward_types, update reward_redemptions
- Update `seed-data.md`: add reward types section
- Update `technical-reference.md`: reward system section

## TypeScript Type Changes

```ts
// New types
interface RewardType {
  id: string;
  venue_id: string;
  name: string;
  emoji: string;
  points_required: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Updated RewardRedemption
interface RewardRedemption {
  id: string;
  profile_id: string;
  venue_id: string;
  reward_type: RewardType | null;  // legacy
  reward_type_id: string;          // new FK
  points_spent: number;
  points_reserved: number;         // new
  quantity: number;
  status: RewardStatus;
  redemption_code: string;
  used_at: string | null;
  approved_by: string | null;
  resolved_at: string | null;      // new
  resolved_by: string | null;      // new
  created_at: string;
}
```

## Migration File

Single migration `006_reward_types_and_updates.sql` covering:
- CREATE TABLE reward_types
- ALTER TABLE reward_redemptions (add columns, drop constraint)
- RLS policies for reward_types
- Updated trigger for reward_types.updated_at
- Indexes
