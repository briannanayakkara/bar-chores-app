# 🍸 Bar Chores App

> Gamified bar staff task management — staff earn points for completing chores and redeem them for drink or bottle tickets. Multi-venue, mobile-first, built with React + Vite + TypeScript + Supabase + Tailwind CSS.

**Version:** 1.8.5
**Live URL:** https://bar-chores-app.vercel.app
**Dev URL:** https://bar-chores-dev.vercel.app

---

## 📋 Project Overview

A multi-venue, mobile-first web app that turns bar staff chores into a points-based competition. Staff complete daily tasks, climb a leaderboard, and redeem points for drink and bottle tickets. Venue admins manage tasks, approve completions, and customise their venue's branding. The app is split into three completely separate sides sharing one Supabase backend.

---

## 🏗️ Three Application Sides

| Side | Route | Who | Purpose |
|------|-------|-----|---------|
| Super Admin | `/superadmin` | Developer only | Create venues, assign/unassign admins, monitor all venues |
| Admin Panel | `/admin` | Venue Admin | Manage staff, tasks, points, rewards, branding |
| Staff App | `/staff` | Bar staff | Complete tasks, earn points, leaderboard, rewards |

> **Key rule:** Super Admin creates venues and assigns the first admin. After that the venue admin owns everything inside their venue completely independently. Venue admins are fully walled off from other venues.

---

## 🛠️ Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS with CSS custom properties for dynamic venue theming
- **Routing:** React Router v6
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions, Realtime, pg_cron)
- **Storage buckets:** `task-photos` (private), `venue-assets` (public), `profile-pictures` (public)
- **Hosting:** Vercel (frontend) + Supabase (backend)

---

## 👥 User Roles

### Super Admin (Developer)
- Seeded directly in Supabase — never created through the app UI
- Logs in at `/superadmin` with email + password
- Can create new venues (name, address, slug)
- Can create the first Venue Admin per venue (triggers Supabase invite email)
- Can unassign admins from venues (admin moves to an "unassigned" pool, not deleted)
- Can reassign unassigned admins to any venue
- Can view all venues and their activity status
- A venue must always have at least one admin — the last admin cannot be unassigned
- **Cannot** manage tasks, staff, points, or rewards inside any venue

### Venue Admin
- Created by Super Admin via email invite
- Logs in at `/login` with email + password
- Fully manages their one assigned venue only — walled off from all others
- Can create additional admins for their own venue
- Manages: staff users, tasks, assignments, photo approvals, reward redemptions, venue theme

### Staff User
- Created by Venue Admin (username + PIN — no email needed)
- Logs in at `/staff-login` with username + PIN
- PIN is bcrypt-hashed — convenience measure to prevent accidental wrong-account logins
- Can change their own PIN from their profile page (must enter current PIN first)
- Admin can reset a forgotten PIN manually from the user management panel

---

## 🗄️ Database Schema

### `venues`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| name | text | Display name |
| address | text | Optional |
| slug | text UNIQUE | URL-safe e.g. `the-anchor-bar` |
| created_at | timestamptz | Auto-set |

### `venue_settings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| venue_id | uuid FK UNIQUE | One row per venue |
| primary_color | text | Hex e.g. `#60A5FA` |
| accent_color | text | Hex e.g. `#3B82F6` |
| background_color | text | Hex e.g. `#0F172A` |
| logo_url | text | Supabase Storage — venue-assets bucket |
| app_name | text | Optional custom name |
| updated_at | timestamptz | Auto-updated |

> Auto-created via Postgres trigger whenever a new venue is inserted. Default colours: primary `#60A5FA`, accent `#3B82F6`, background `#0F172A`.

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | = auth.users.id for all users (admins and staff) |
| venue_id | uuid FK | References venues.id |
| role | text | `super_admin` / `venue_admin` / `staff` |
| username | text | Staff login identifier |
| display_name | text | Shown on leaderboard |
| pin_hash | text | bcrypt hash — staff only |
| email | text | Real email for admins, synthetic email for staff (required for magic link auth) |
| avatar_type | text | `photo` or `builder` |
| avatar_url | text | Supabase Storage — profile-pictures bucket |
| avatar_config | jsonb | Avatar builder selections (renders as SVG) |
| points_total | int | Maintained by Postgres trigger from points_ledger |
| created_at | timestamptz | Auto-set |

### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| venue_id | uuid FK | Scopes task to venue |
| title | text | e.g. `Deep Clean Fridges` |
| description | text | Optional instructions |
| points | int | Points awarded on completion |
| requires_photo | boolean | Auto-true if points >= 500 |
| is_recurring | boolean | Resets daily at midnight via pg_cron |
| is_active | boolean | Default true |
| created_by | uuid FK | Admin profile ID |
| created_at | timestamptz | Auto-set |

### `task_assignments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| task_id | uuid FK | References tasks.id |
| venue_id | uuid FK | Denormalised for RLS |
| assigned_to | uuid FK nullable | null = open/claimable |
| assigned_by | uuid FK | Admin profile ID |
| due_date | date | Typically today |
| status | text | `pending` / `submitted` / `approved` / `rejected` |
| completed_at | timestamptz | Set on completion |
| photo_url | text | Supabase Storage — task-photos bucket |
| created_at | timestamptz | Auto-set |

### `points_ledger`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| profile_id | uuid FK | Staff member |
| venue_id | uuid FK | Denormalised for RLS |
| delta | int | Positive = earned, negative = redeemed |
| reason | text | e.g. `Task: Deep Clean Fridges` |
| assignment_id | uuid FK nullable | Links to task_assignments |
| created_by | uuid FK | Admin or system |
| created_at | timestamptz | Auto-set |

> A Postgres trigger fires on insert and updates `profiles.points_total` automatically.

### `reward_redemptions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| profile_id | uuid FK | Staff member redeeming |
| venue_id | uuid FK | Denormalised for RLS |
| reward_type | text | `drink_ticket` / `bottle_ticket` |
| points_spent | int | 100 per drink, 1000 per bottle |
| quantity | int | Number of tickets |
| status | text | `pending` / `approved` / `rejected` |
| redemption_code | text UNIQUE | e.g. `DRK-X7K2` — bartender verifies this |
| used_at | timestamptz | Set when bartender marks as used |
| approved_by | uuid FK nullable | Admin who approved |
| created_at | timestamptz | Auto-set |

---

## 🔐 Authentication

### Admin Auth
- Standard Supabase email + password auth
- Super Admin seeded directly in database
- Venue Admins onboarded via Supabase invite email

### Staff Auth (PIN → Magic Link Flow)
- Staff authenticate via PIN but still get a proper Supabase Auth session
- Each staff member has a Supabase Auth user with a synthetic email (e.g. `staff_jake_lgd@{venueId}.internal`)
- Login flow: staff taps their profile card → enters PIN → Edge Function verifies PIN via bcrypt → generates a magic link token → frontend exchanges token via `supabase.auth.verifyOtp()` for a real session
- This gives staff full Supabase Auth sessions (JWT, RLS, refresh tokens) while only requiring a PIN to log in
- PIN is a convenience measure to prevent accidental wrong-account logins, not a security gate

---

## 📧 Admin Onboarding & Password Reset

### How Super Admin Creates Venue Admins
1. Super Admin logs in at `/superadmin`
2. Clicks "Invite Admin" on a venue → enters name and email
3. Supabase sends an invite email with a link to the app
4. New admin clicks the link → `/auth/callback` → redirected to `/auth/set-password`
5. Sets their password → redirected to `/login`
6. Logs in with email + new password → lands on `/admin/dashboard`
7. Profile status updates from `pending` to `active`

The existing "Add Admin" (instant password) flow is still available as an alternative.

### How Super Admin Unassigns / Reassigns Admins
- **Unassign:** Super Admin clicks "Unassign" on an admin → their `venue_id` is set to `null` → they appear in an "Unassigned Admins" pool. The venue must keep at least one admin.
- **Reassign:** From the unassigned pool, Super Admin selects a venue from a dropdown and clicks "Assign" → the admin's `venue_id` is updated to the selected venue.
- Admins are never deleted — they are only moved between venues or to the unassigned pool.

### How Venue Admins Create Additional Admins
1. Venue Admin goes to `/admin/users`
2. Clicks "Invite Admin" → enters name and email
3. Same email flow as above — invite is scoped to their venue only
4. New admin appears in the admin list with a "Pending" badge
5. Venue Admin can resend or cancel the invite

### Password Reset Flow
1. Admin visits `/login` → clicks "Forgot password?"
2. Enters email → receives reset email with correct link
3. Clicks link → `/auth/callback` → `/auth/set-password`
4. Sets new password → redirected to `/login`

### Auth Callback URL Configuration
Both Supabase projects must have these auth settings:

**PROD** (`sepcdjmwdfjjieaxqoqn`):
- Site URL: `https://bar-chores-app.vercel.app`
- Redirect URLs: `.../auth/callback`, `.../auth/set-password`

**DEV** (`drwflvxdvwtjzuqxfort`):
- Site URL: `https://bar-chores-dev.vercel.app`
- Redirect URLs: `.../auth/callback`, `.../auth/set-password`, plus `http://localhost:5173/auth/callback`, `http://localhost:5173/auth/set-password`

---

## ⚡ Points & Rewards

### Earning Points
- Tasks under 500 points → **auto-awarded instantly** on completion
- Tasks 500+ points → **requires photo upload** → admin approves → points awarded
- Every award = positive `points_ledger` entry
- `profiles.points_total` updated via Postgres trigger (fast leaderboard queries)

### Redeeming Rewards
- Minimum **100 points** = 1 Drink Ticket 🍺
- Minimum **1000 points** = 1 Bottle Ticket 🍾
- Staff requests → admin approves → unique code generated (e.g. `DRK-X7K2`)
- Bartender looks up code and marks as used → prevents double redemption
- Points deducted via negative `points_ledger` entry on approval

---

## 🎨 Venue Theming

- Each venue has a `venue_settings` row with `primary_color`, `accent_color`, `background_color`, `logo_url`, `app_name`
- On app load, hex colours are converted to RGB space-separated format via `hexToRgb()` in `src/lib/color.ts`
- Injected as CSS custom properties: `--color-primary`, `--color-accent`, `--color-background` (RGB format for Tailwind opacity modifier support e.g. `bg-primary/20`)
- Tailwind config uses `rgb(var(--color-primary) / <alpha-value>)` so all classes adapt with full opacity support
- Admin edits theme via colour pickers + logo upload at `/admin/theme`
- Admin can reset theme to defaults (blue/dark) per venue
- Logo stored in Supabase Storage `venue-assets` bucket
- Venue theme is also applied on the staff login page when a venue is selected

---

## 🖼️ Profile Pictures & Avatars

Staff choose one of two options on first login:

**Option A — Upload Photo**
- Upload from camera roll or take new photo
- Stored in Supabase Storage `profile-pictures` bucket
- Saved as `profiles.avatar_url`

**Option B — Build Avatar**
- Pick skin tone, hair style, hair colour, eyes, facial hair, accessories
- Renders as SVG in real time
- Saved as JSON in `profiles.avatar_config`

> ✅ **CONFIRMED:** Avatars and profile photos MUST appear on the leaderboard next to each staff member's name and score. This is a core feature, not optional.

Avatars also appear on: staff dashboard header, live activity feed, admin user management list.

---

## 🏆 Leaderboard & Live Feed

- Leaderboard shows: rank, avatar/photo, display name, total points
- Updates in real time via **Supabase Realtime** subscriptions on `points_ledger`
- Live activity feed: `"Jake completed Deep Clean Fridges +150pts"`
- Feed shows avatar beside each entry

---

## 🗺️ App Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/superadmin` | Super Admin | Venue list, create venue, assign first admin |
| `/login` | Venue Admin | Email + password login |
| `/staff-login` | Staff | Username + PIN login |
| `/admin/dashboard` | Venue Admin | Stats, pending approvals, quick actions |
| `/admin/users` | Venue Admin | Create, edit, delete staff |
| `/admin/tasks` | Venue Admin | Create, edit, delete, assign tasks |
| `/admin/assignments` | Venue Admin | View assignments, approve photos |
| `/admin/rewards` | Venue Admin | Approve redemptions, mark tickets used |
| `/admin/theme` | Venue Admin | Colour pickers, logo upload, app name |
| `/staff/dashboard` | Staff | My tasks today, points, activity feed |
| `/staff/tasks` | Staff | All open + assigned tasks |
| `/staff/leaderboard` | Staff | All venue staff ranked by points |
| `/staff/rewards` | Staff | Request redemptions, view history |
| `/staff/profile` | Staff | Update photo/avatar, change PIN |
| `/auth/callback` | Public | Handles email link redirects (invite, recovery) |
| `/auth/set-password` | Public | Set or reset password form |
| `/auth/forgot-password` | Public | Request password reset email |

---

## 🎨 UI / UX

- **Default theme:** Dark backgrounds (`#0F172A`), electric blue accents (`#60A5FA`)
- **All colours** overridable via venue theme settings using CSS custom properties
- **Mobile-first** — staff use this on their phones during shifts
- **Large tap targets** — minimum 48px height on all interactive elements
- **Admin panel** — responsive: hamburger menu + bottom tab bar on mobile, sidebar on desktop
- **Staff panel** — bottom tab navigation, mobile optimised
- Satisfying animations on point awards (confetti) and leaderboard updates

---

## ☁️ Supabase Setup Checklist

- [x] 7 tables created with schema above
- [x] RLS enabled on all tables with 27 venue-scoped policies (including 3 anonymous read policies for login pages)
- [x] Storage buckets: `task-photos` (private), `venue-assets` (public), `profile-pictures` (public)
- [x] Edge Function: `staff-auth` for staff PIN → magic link authentication
- [x] Edge Function: `admin-actions` for staff CRUD, admin invite/unassign/assign, PIN reset
- [x] pg_cron: nightly midnight reset of recurring task assignments
- [x] Postgres trigger: update `profiles.points_total` on `points_ledger` insert (clamped to minimum 0)
- [x] Postgres trigger: create default `venue_settings` on new venue insert
- [ ] Supabase Realtime enabled on `points_ledger` table
- [x] Super admin user seeded directly in Supabase dashboard
- [x] Email confirmations turned OFF in Supabase Auth settings
- [x] RLS helper functions: `public.user_role()` and `public.user_venue_id()` (SECURITY DEFINER)
- [x] Public SELECT policies: `anon_read_venues`, `anon_read_venue_settings`, `anon_read_staff_profiles` (for unauthenticated login pages)

---

## 🚀 Recommended Build Order

1. Supabase schema, RLS, triggers, pg_cron, Edge Function
2. Admin email auth + Super Admin panel
3. Staff PIN auth flow
4. Admin panel: users, tasks, assignments
5. Staff panel: dashboard, task completion, auto-award points
6. Photo upload + admin approval queue
7. Leaderboard with Supabase Realtime
8. Profile setup: photo upload + avatar builder
9. Rewards: requests, admin approval, redemption codes, bartender mark-used
10. Venue theme editor: colour pickers, logo upload, CSS variable injection
11. Admin dashboard stats + live activity feed
12. Polish, mobile testing, deploy to Vercel

---

## 📁 Project Structure

```
bar-chores-app/
├── Documentation/
│   ├── README.md               ← this file
│   ├── SEED_DATA.md            ← test data for seeding
│   └── bar_chores_spec_v5.docx ← full detailed spec
├── scripts/
│   └── seed-reset.mjs          ← database reset & seed script
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   └── AdminLayout.tsx  ← responsive sidebar/hamburger/tabs
│   │   ├── staff/
│   │   │   └── StaffLayout.tsx  ← bottom tab navigation
│   │   └── shared/
│   │       └── RequireAuth.tsx  ← role-based route guard
│   ├── context/
│   │   ├── AuthContext.tsx      ← auth state, login/logout, profile
│   │   └── VenueContext.tsx     ← venue data, settings, theme injection
│   ├── pages/
│   │   ├── superadmin/
│   │   ├── admin/
│   │   └── staff/
│   ├── config/
│   │   └── environment.ts      ← ENV, IS_DEV, IS_PROD, APP_TITLE
│   ├── lib/
│   │   ├── supabase.ts         ← Supabase client
│   │   ├── color.ts            ← hexToRgb(), DEFAULT_COLORS/RGB
│   │   ├── date.ts             ← getLocalDate() (timezone-safe)
│   │   └── logger.ts           ← console logger with categories
│   ├── types/
│   │   └── database.ts         ← TypeScript types for all tables
│   └── main.tsx
├── supabase/
│   └── functions/
│       ├── staff-auth/
│       │   └── index.ts        ← PIN → magic link Edge Function
│       └── admin-actions/
│           └── index.ts        ← staff CRUD, admin invite/unassign/assign
├── .env.production              ← prod credentials (gitignored)
├── .env.development             ← dev credentials (gitignored)
├── .env.example                 ← template with empty values (committed)
├── .gitignore
├── vercel.json                 ← SPA rewrites + cache headers
├── tailwind.config.js          ← custom colours via CSS variables
└── package.json
```

---

## Environments

The app runs in two separate environments — **Production** and **Development** — each with its own Supabase project, Vercel deployment, and data.

| | Production | Development |
|---|---|---|
| **Branch** | `main` | `develop` |
| **Supabase** | `sepcdjmwdfjjieaxqoqn` (real data) | `drwflvxdvwtjzuqxfort` (dummy data) |
| **Vercel URL** | `bar-chores-app.vercel.app` | `bar-chores-dev.vercel.app` |
| **App title** | Bar Chores | Bar Chores [DEV] |
| **DEV badge** | Hidden | Visible orange badge |

- Environment is controlled by `VITE_ENV` and `.env.production` / `.env.development` files
- Vite auto-loads the correct `.env` file based on build mode
- `.env.example` is committed as a safe template — actual env files are gitignored

See **[Documentation/ENVIRONMENTS.md](ENVIRONMENTS.md)** for full credentials, Vercel setup, CI/CD pipelines, and the DEV database setup checklist.

---

## 🔑 Environment Variables

```env
VITE_SUPABASE_URL=https://sepcdjmwdfjjieaxqoqn.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

> ⚠️ Never commit `.env` to GitHub. The `service_role` key has full database access.

---

*Full detailed specification available in `Documentation/bar_chores_spec_v5.docx`*
