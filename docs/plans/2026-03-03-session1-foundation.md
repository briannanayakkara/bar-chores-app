# Session 1: Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the complete project foundation — tooling, database schema, auth, types, routing — with zero UI.

**Architecture:** React + Vite + TypeScript frontend with Supabase backend. Three app sides (superadmin, admin, staff) share one Supabase project. Staff auth uses custom Edge Function returning Supabase-compatible JWTs. RLS policies use auth.uid() lookups against profiles table for consistent venue scoping.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v3, React Router v6, Supabase (Postgres, Auth, Edge Functions, pg_cron)

---

### Task 1: Initialize Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`

**Step 1:** Run `npm create vite@latest . -- --template react-ts` in project root (alongside existing Documentation/)
**Step 2:** Install base deps: `npm install`
**Step 3:** Verify: `npm run dev` starts without errors

---

### Task 2: Install all dependencies

**Step 1:** Install runtime deps:
```bash
npm install @supabase/supabase-js react-router-dom
```

**Step 2:** Install dev deps for Tailwind v3:
```bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

**Step 3:** Install bcryptjs (for types only — actual hashing in Edge Function):
```bash
npm install bcryptjs @types/bcryptjs
```

---

### Task 3: Configure Tailwind CSS v3

**Files:**
- Modify: `tailwind.config.js` — set content paths
- Modify: `src/index.css` — add Tailwind directives + CSS custom properties for venue theming

---

### Task 4: Create .env and update .gitignore

**Files:**
- Create: `.env`
- Modify: `.gitignore`

**.env contents:**
```
VITE_SUPABASE_URL=https://sepcdjmwdfjjieaxqoqn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_JWT_SECRET=<jwt_secret_placeholder>
```

---

### Task 5: Create Supabase client

**Files:**
- Create: `src/lib/supabase.ts`

Exports initialized Supabase client using VITE_ env vars.

---

### Task 6: Database schema migration (001)

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

All 7 tables: venues, venue_settings, profiles, tasks, task_assignments, points_ledger, reward_redemptions. UUIDs, FKs, constraints, check constraints on enums.

---

### Task 7: RLS policies migration (002)

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

Enable RLS on all tables. Policies use `auth.uid()` with profile lookups for venue scoping. Super admin bypasses all.

---

### Task 8: Triggers migration (003)

**Files:**
- Create: `supabase/migrations/003_triggers.sql`

1. points_ledger INSERT → update profiles.points_total
2. venues INSERT → auto-create venue_settings with defaults

---

### Task 9: pg_cron migration (004)

**Files:**
- Create: `supabase/migrations/004_cron.sql`

Nightly midnight job: insert fresh pending assignments for all active recurring tasks.

---

### Task 10: Staff auth Edge Function

**Files:**
- Create: `supabase/functions/staff-auth/index.ts`

Receives { username, pin, venue_id } → bcrypt verify → return Supabase-compatible JWT (sub=profile.id, role=authenticated, venue_id + user_role claims).

---

### Task 11: TypeScript types

**Files:**
- Create: `src/types/database.ts`

Types for all 7 tables matching schema exactly.

---

### Task 12: Folder structure + routing

**Files:**
- Create: directory structure for pages/components/hooks/context
- Create: `src/App.tsx` with React Router + placeholder routes
- Modify: `src/main.tsx` with BrowserRouter wrapper

All routes from spec with empty components.

---

### Task 13: Git commit and push

Stage all files (excluding .env), commit, push to GitHub remote.

---
