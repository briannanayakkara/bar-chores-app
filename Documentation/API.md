# Bar Chores App — API Reference

> For auto-generated REST API docs (all 7 tables with code snippets), see the **Supabase Dashboard**:
> https://supabase.com/dashboard/project/sepcdjmwdfjjieaxqoqn/api
>
> This document covers **custom flows** that Supabase doesn't auto-document: Edge Functions, auth patterns, storage conventions, and Realtime subscriptions.

---

## Base URLs

| Service | URL |
|---------|-----|
| REST API | `https://sepcdjmwdfjjieaxqoqn.supabase.co/rest/v1/` |
| Auth | `https://sepcdjmwdfjjieaxqoqn.supabase.co/auth/v1/` |
| Edge Functions | `https://sepcdjmwdfjjieaxqoqn.supabase.co/functions/v1/` |
| Storage | `https://sepcdjmwdfjjieaxqoqn.supabase.co/storage/v1/` |
| Realtime | `wss://sepcdjmwdfjjieaxqoqn.supabase.co/realtime/v1/` |

---

## Authentication

### Admin Login (Email + Password)

Standard Supabase Auth — used by Super Admins and Venue Admins.

```
POST /auth/v1/token?grant_type=password

{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:** `{ access_token, refresh_token, user, ... }`

### Staff Login (PIN → Magic Link Token Exchange)

Two-step process using the `staff-auth` Edge Function:

**Step 1: Verify PIN**

```
POST /functions/v1/staff-auth

Headers:
  Authorization: Bearer <ANON_KEY>
  Content-Type: application/json

Body:
{
  "username": "bribri",
  "pin": "1234",
  "venue_id": "5d2a9597-a194-4d51-9bca-f73299b571eb"
}
```

**Success (200):**
```json
{
  "token_hash": "abc123...",
  "user": {
    "id": "b87523ac-...",
    "venue_id": "5d2a9597-...",
    "username": "bribri",
    "display_name": "BriBri",
    "role": "staff"
  }
}
```

**Error (401):** `{ "error": "Invalid username or PIN" }`

**Step 2: Exchange token for Supabase session**

```typescript
await supabase.auth.verifyOtp({
  token_hash: response.token_hash,
  type: 'magiclink',
});
```

This produces a proper Supabase session with a JWT that works with RLS.

### Logout

```typescript
await supabase.auth.signOut();
```

---

## Edge Functions

### `staff-auth` — Staff PIN Authentication

**URL:** `POST /functions/v1/staff-auth`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | Staff username |
| pin | string | Yes | 4+ digit PIN |
| venue_id | uuid | Yes | Venue to authenticate against |

**How it works:** Looks up the staff profile by username + venue_id, verifies the PIN against a bcrypt hash using `compareSync`, then generates a magic link token via `admin.generateLink()`. The frontend exchanges this token for a real Supabase session.

---

### `admin-actions` — Privileged Admin Operations

**URL:** `POST /functions/v1/admin-actions`

Requires a valid admin JWT in the `Authorization` header. The Edge Function verifies the caller's role from their profile before executing.

#### `create-admin`

Creates a new Venue Admin (Supabase Auth user + profile). **Super Admin only.**

```json
{
  "action": "create-admin",
  "email": "admin@bar.com",
  "password": "SecurePass123!",
  "display_name": "Bar Manager",
  "venue_id": "uuid-here"
}
```

**Response:** `{ success: true, user_id: "uuid", message: "Admin created" }`

#### `create-staff`

Creates a new Staff member (Supabase Auth user + profile with bcrypt PIN). **Admin only.**

```json
{
  "action": "create-staff",
  "username": "jake.lgd",
  "display_name": "Jake Murphy",
  "pin": "1234",
  "venue_id": "uuid-here"
}
```

**Response:** `{ success: true, user_id: "uuid", message: "Staff created" }`

**Notes:**
- Creates a real Supabase Auth user (email: `staff_{random}@{venue_id}.internal`)
- Venue admins can only create staff in their own venue
- Duplicate usernames within a venue are rejected

#### `update-staff`

Updates a staff member's username, display name, or PIN. **Admin only.**

```json
{
  "action": "update-staff",
  "staff_id": "uuid-here",
  "username": "new_username",
  "display_name": "New Name",
  "pin": "5678"
}
```

All fields except `staff_id` are optional — only provided fields are updated.

#### `reset-pin`

Resets a staff member's PIN. **Admin only.**

```json
{
  "action": "reset-pin",
  "staff_id": "uuid-here",
  "new_pin": "9999"
}
```

#### `delete-staff`

Deletes a staff member and all their related data. **Admin only.**

```json
{
  "action": "delete-staff",
  "staff_id": "uuid-here"
}
```

**Cascade order:** reward_redemptions → points_ledger → task_assignments → profile → auth user.

---

## Storage

### Buckets

| Bucket | Access | Purpose |
|--------|--------|---------|
| `task-photos` | Private | Completion photos uploaded by staff |
| `venue-assets` | Public | Venue logos |
| `profile-pictures` | Public | Staff profile photos |

### Upload (task photo example)

```typescript
const filePath = `${venueId}/${assignmentId}/${Date.now()}.jpg`;
const { error } = await supabase.storage
  .from('task-photos')
  .upload(filePath, file, { upsert: true });
// Store filePath (not public URL) in task_assignments.photo_url
```

### View private photos (signed URL)

```typescript
const { data } = await supabase.storage
  .from('task-photos')
  .createSignedUrl(storagePath, 3600); // 1 hour expiry
// Use data.signedUrl for display
```

### View public assets

```typescript
const { data } = supabase.storage
  .from('profile-pictures')
  .getPublicUrl(path);
// Use data.publicUrl for display
```

---

## Realtime

The app subscribes to Realtime changes on `points_ledger` for live activity feeds.

```typescript
const channel = supabase
  .channel('staff-dashboard-activity')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'points_ledger',
    filter: `venue_id=eq.${venueId}`,
  }, (payload) => {
    // Refresh activity feed
  })
  .subscribe();

// Cleanup
supabase.removeChannel(channel);
```

---

## Error Handling

All Edge Functions return consistent JSON:

```json
// Success
{ "success": true, "message": "...", ... }

// Error
{ "error": "Human-readable error message" }
```

HTTP status codes:
- `200` — Success
- `400` — Bad request (missing fields, validation errors)
- `401` — Unauthorized (invalid token, wrong PIN)
- `403` — Forbidden (wrong role)
- `500` — Server error

---

## Deployment

| Component | Platform | Deploy Command |
|-----------|----------|---------------|
| Frontend | Vercel | `npx vercel --prod` |
| Edge Functions | Supabase | `supabase functions deploy <name> --project-ref sepcdjmwdfjjieaxqoqn` |
| Database | Supabase | Managed — changes via Dashboard or SQL Editor |

**Edge Functions deployed:**
- `staff-auth` — Staff PIN authentication
- `admin-actions` — Admin user management (create/update/delete staff and admins)

**Environment variables (Edge Functions get these automatically from Supabase):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Frontend env (Vercel):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
