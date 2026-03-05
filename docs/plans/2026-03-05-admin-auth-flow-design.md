# Admin Auth Flow — User Creation & Password Reset

**Date:** 2026-03-05
**Status:** Approved
**Scope:** Super Admin + Venue Admin accounts only. Staff (username + PIN) unaffected.

---

## Problem

When a Super Admin or Venue Admin is created via Supabase Auth, the confirmation/invite email links point to the wrong URL. Users need to land on our app to set their password.

## Solution Overview

1. Configure Supabase Auth redirect URLs for both PROD and DEV
2. Create three new auth pages: callback handler, set password, forgot password
3. Add `invite-admin` action to the existing `admin-actions` Edge Function
4. Add `status` column to `profiles` table
5. Update Super Admin dashboard and Venue Admin user management with invite flow
6. Update login page with "Forgot password?" link

---

## Auth URL Configuration

### PROD Supabase (`sepcdjmwdfjjieaxqoqn`)
- **Site URL:** `https://bar-chores-app.vercel.app`
- **Redirect URLs:**
  - `https://bar-chores-app.vercel.app/auth/callback`
  - `https://bar-chores-app.vercel.app/auth/set-password`

### DEV Supabase (`drwflvxdvwtjzuqxfort`)
- **Site URL:** `https://bar-chores-dev.vercel.app`
- **Redirect URLs:**
  - `https://bar-chores-dev.vercel.app/auth/callback`
  - `https://bar-chores-dev.vercel.app/auth/set-password`
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173/auth/set-password`

Applied via Supabase Management API (user provides personal access token).

---

## Auth Page Flow

```
Email link clicked → /auth/callback
    ├─ type=invite or recovery → /auth/set-password (session established)
    ├─ type=signup → /login
    └─ error → error message + "Request new link" button

/auth/set-password
    ├─ Detects type: invite → "Set Your Password", recovery → "Reset Your Password"
    ├─ Password form: 8+ chars, uppercase, lowercase, number
    ├─ Calls supabase.auth.updateUser({ password })
    ├─ On invite: updates profile status pending → active
    └─ Success → redirect to /login after 3s

/auth/forgot-password
    ├─ Email input → supabase.auth.resetPasswordForEmail(email, { redirectTo })
    └─ Shows "Check your email" message (no user enumeration)

/login (updated)
    └─ "Forgot password?" link → /auth/forgot-password
```

---

## New Pages

### AuthCallback (`src/pages/auth/AuthCallback.tsx`)
- Reads token and type from URL hash/params
- type=invite or recovery → redirect to /auth/set-password
- type=signup → redirect to /login
- Loading spinner while processing
- Error message with "Request new link" on failure

### SetPassword (`src/pages/auth/SetPassword.tsx`)
- Dark blue themed, centered card layout
- Bar Chores logo + app name at top
- Dynamic heading based on invite vs recovery
- Password fields with show/hide toggle
- Strength indicator (weak/medium/strong)
- Validation: min 8 chars, uppercase, lowercase, number
- Calls `supabase.auth.updateUser({ password })`
- On invite success: updates profile status to active
- Success → redirect to /login after 3s
- Expired token → "Link expired" + request new link button

### ForgotPassword (`src/pages/auth/ForgotPassword.tsx`)
- Email input field
- Calls `supabase.auth.resetPasswordForEmail` with correct redirectTo
- Success: "Check your email for a password reset link"
- "Back to login" link
- Accessible from login page via "Forgot password?" link

---

## Edge Function Changes

### Add `invite-admin` action to `admin-actions`
- Input: `{ action: 'invite-admin', email, name, venue_id, role }`
- Verifies caller is super_admin OR venue_admin for that venue
- Venue admins can only invite for their own venue
- Calls `supabase.auth.admin.inviteUserByEmail(email, { redirectTo, data: { name, venue_id, role } })`
- Creates profile row with status=pending
- Returns success/error

### Add `resend-invite` action
- Resends invite email for a pending user
- Only callable by super_admin or venue_admin of that venue

### Keep existing `create-admin` action unchanged
Both instant-create and invite flows coexist.

---

## Database Changes

```sql
ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active';
```

Values: `pending` (invited, hasn't set password), `active` (normal), `inactive` (disabled).

Existing profiles get `active` via the default.

---

## Super Admin Dashboard Updates
- "Invite Admin" button using invite flow (sends email)
- Pending admin list with "Pending" badge
- "Resend Invite" button on pending admins
- "Cancel Invite" button (deletes auth user + profile)

## Venue Admin User Management Updates (`/admin/users`)
- "Invite Admin" button (own venue only)
- Pending admins with badges
- Resend/cancel invite capabilities
- All via `admin-actions` Edge Function

---

## Routes (added to App.tsx)

| Route | Component | Auth Required |
|-------|-----------|---------------|
| `/auth/callback` | AuthCallback | No |
| `/auth/set-password` | SetPassword | No |
| `/auth/forgot-password` | ForgotPassword | No |

---

## UI/Theme

All auth pages use default dark blue theme (#0F172A background, #60A5FA accents):
- Bar Chores logo/app name at top
- Centered card layout
- Consistent with existing login pages
- Password strength indicator (color bar: red/yellow/green)
- Show/hide password toggle (eye icon)

---

## Constraints

- Staff users completely unaffected
- Service role key never used from frontend — always via Edge Functions
- Both DEV and PROD must work
- Test on DEV first before touching PROD
