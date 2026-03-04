# Bar Chores App — Full Build Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete Bar Chores App — auth, admin panel, staff panel, leaderboard, rewards, theme editor — ready for deployment.

**Architecture:** React SPA with three app sides sharing one Supabase backend. AuthContext handles dual auth (Supabase Auth for admins, custom JWT for staff). VenueContext injects CSS custom properties for per-venue theming. Admin uses sidebar layout, Staff uses bottom-tab mobile layout. All data access goes through Supabase client with RLS.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, React Router v6, Supabase (Auth, Postgres, Storage, Realtime, Edge Functions)

---

## Phase 1: Auth & Shared Infrastructure

### Task 1: Supabase Storage Buckets
Create storage buckets via Management API: task-photos (private), venue-assets (public), profile-pictures (public).

### Task 2: AuthContext
Create `src/context/AuthContext.tsx` — provides current user (profile), session, login/logout functions for both admin (Supabase Auth) and staff (custom JWT).

### Task 3: VenueContext
Create `src/context/VenueContext.tsx` — loads venue_settings, injects CSS custom properties on document root.

### Task 4: Route Guards
Create `src/components/shared/RequireAuth.tsx` — redirects unauthenticated users. Accepts allowed roles prop.

### Task 5: Admin Layout
Create `src/components/admin/AdminLayout.tsx` — sidebar navigation with links to all admin pages, header with venue name, logout button.

### Task 6: Staff Layout
Create `src/components/staff/StaffLayout.tsx` — bottom tab bar (Dashboard, Tasks, Leaderboard, Rewards, Profile), header with points balance.

### Task 7: Super Admin Login
Build `/superadmin` — email + password login via Supabase Auth, redirect to super admin dashboard.

### Task 8: Admin Login
Build `/login` — email + password login via Supabase Auth, redirect to admin dashboard.

### Task 9: Staff Login
Build `/staff-login` — grid of staff profile cards for the venue, tap card → PIN modal, auth via Edge Function, redirect to staff dashboard.

### Task 10: Wire Up Routing with Layouts and Guards
Update App.tsx — wrap admin routes in AdminLayout + RequireAuth, staff routes in StaffLayout + RequireAuth.

## Phase 2: Super Admin Panel

### Task 11: Super Admin Dashboard
Build venue list (all venues with stats), create venue form (name, address, slug), assign first admin form (email → Supabase invite).

## Phase 3: Admin Panel

### Task 12: Admin Dashboard
Stats cards: active staff count, pending approvals, tasks today, points awarded today. Quick action buttons.

### Task 13: Admin User Management
CRUD staff: create (username, display_name, PIN), edit, delete. Table with search. PIN reset functionality.

### Task 14: Admin Task Management
CRUD tasks: create (title, description, points, requires_photo auto-set at 500+, is_recurring), edit, toggle active/inactive. Table view.

### Task 15: Admin Assignment Management
Assign tasks to staff or leave open. View all assignments with status filters. Photo review: view submitted photo, approve/reject. Points auto-awarded on approval.

### Task 16: Admin Rewards Management
View pending redemption requests. Approve (generates unique code, deducts points) or reject. Mark tickets as used by bartender.

### Task 17: Admin Theme Editor
Colour pickers for primary/accent/background. Logo upload to venue-assets bucket. App name field. Live preview.

## Phase 4: Staff Panel

### Task 18: Staff Dashboard
Today's assigned tasks summary. Points balance card. Live activity feed (recent completions across venue).

### Task 19: Staff Task View
List open (unassigned) and my assigned tasks. Claim open tasks. Complete task button. Photo upload for high-value tasks. Auto-award points for tasks under 500.

### Task 20: Staff Leaderboard
Ranked list of all venue staff: position, avatar, display_name, points_total. Real-time updates via Supabase Realtime subscription on points_ledger.

### Task 21: Staff Rewards
Request drink ticket (100pts) or bottle ticket (1000pts) with quantity selector. View redemption history with status and codes.

### Task 22: Staff Profile
Display current avatar/photo. Upload new photo or build avatar (skin, hair, eyes, accessories → saved as JSON, rendered as SVG). Change PIN (enter current PIN first).

## Phase 5: Polish & Deploy

### Task 23: Vercel Deployment Config
Create vercel.json with SPA rewrites. Environment variables setup.

---
