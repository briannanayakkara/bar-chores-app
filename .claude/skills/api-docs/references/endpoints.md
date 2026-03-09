# API Endpoint Reference

## Edge Functions

### staff-auth
`POST /functions/v1/staff-auth`

| Action | Input | Output |
|--------|-------|--------|
| login | `{ username, pin, venue_id }` | `{ token_hash, email }` — use with `supabase.auth.verifyOtp()` |

Deployed with `--no-verify-jwt` (handles its own auth via bcrypt).

### admin-actions
`POST /functions/v1/admin-actions`

Requires Authorization header with admin session token.

| Action | Input | Output |
|--------|-------|--------|
| `create-staff` | `{ action, venue_id, username, display_name, pin }` | `{ profile, auth_user }` |
| `update-staff` | `{ action, profile_id, username?, display_name?, pin? }` | `{ profile }` |
| `delete-staff` | `{ action, profile_id }` | `{ success: true }` |
| `reset-pin` | `{ action, profile_id, new_pin }` | `{ success: true }` |
| `create-admin` | `{ action, venue_id, email, display_name }` | `{ profile, invite }` |
| `invite-admin` | `{ action, venue_id, email, display_name }` | `{ profile, invite }` |
| `unassign-admin` | `{ action, profile_id }` | `{ profile }` — sets venue_id to null |
| `assign-admin` | `{ action, profile_id, venue_id }` | `{ profile }` — sets venue_id |
| `delete-admin` | `{ action, profile_id }` | `{ success: true }` — with FK cleanup |

## Direct Supabase Client Queries

All queries go through `supabase.from(table)` with RLS enforced.

| Table | Common Operations |
|-------|------------------|
| venues | select (all roles), insert (super_admin) |
| venue_settings | select (all), upsert (admin) |
| profiles | select (all), update (own profile) |
| tasks | select (venue), insert/update/delete (admin) |
| task_assignments | select (venue), insert (admin), update (staff own) |
| points_ledger | select (venue), insert (admin/system) |
| reward_redemptions | select (venue), insert (staff), update (admin) |

## Storage Buckets

| Bucket | Access | Used For |
|--------|--------|----------|
| task-photos | Private (signed URLs) | Task completion photos |
| venue-assets | Public | Venue logos |
| profile-pictures | Public | Staff profile photos |
