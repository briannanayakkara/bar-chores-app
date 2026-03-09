# Bar Chores App

Gamified bar staff task management — three roles: Super Admin, Venue Admin, Staff.
Staff earn points for completing bar chores, redeem for drink/bottle tickets.
Product spec: docs/specs/bar-chores-spec-v5.docx — always consult for business logic.

## Tech Stack

- React 19 + Vite 7 + TypeScript (strict mode)
- Tailwind CSS v3 (CSS custom properties for venue theming)
- React Router v7 (react-router-dom)
- Supabase: Postgres, Auth, Edge Functions (Deno), Storage, pg_cron
- Package manager: npm
- Deployment: Vercel (manual `npx vercel --prod`)
- No test framework configured yet

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — tsc -b && vite build
- `npm run lint` — ESLint (flat config v9)
- `npm run preview` — Preview built output
- `npx vercel --prod` — Deploy to production

## Coding Conventions

- Components: PascalCase .tsx files, function declarations with Props interface
- Utilities: camelCase .ts files (supabase.ts, logger.ts, date.ts, color.ts)
- Default exports for all page/component files
- Tailwind-only styling — no CSS modules, no styled-components
- React Context for global state (AuthContext, VenueContext) + local useState
- No lazy loading — all imports at top of App.tsx
- Direct Supabase queries in components (no service layer abstraction)
- Import order: react > react-router > third-party > local contexts > local libs > types
- Interfaces preferred over type aliases
- `{ data, error }` destructuring for all Supabase calls
- Loading states via useState boolean
- logger.ts for colored console output (categories: AUTH, API, RLS, ERROR, NAV, INFO)
- Min touch target: min-h-[48px] on interactive elements

## Environment

- **PROD:** sepcdjmwdfjjieaxqoqn.supabase.co / bar-chores-app.vercel.app (branch: main)
- **DEV:** drwflvxdvwtjzuqxfort.supabase.co / bar-chores-dev.vercel.app (branch: develop)
- Full setup: docs/architecture/environments.md

## Git Workflow

- NEVER commit directly to main or develop
- Always use feature branches: `feature/`, `fix/`, `chore/`
- PR into develop, then develop -> main for production
- Bump version in package.json before every deploy

## Folder Structure

```
docs/
  specs/              # Product spec (.docx)
  api/                # API reference, seed data definitions
  architecture/       # Technical reference, environments, flowcharts
  plans/              # Implementation plans (YYYY-MM-DD-description.md)
src/
  components/         # Layouts (admin, staff, shared), UI components
  context/            # AuthContext, VenueContext
  pages/              # All route pages (superadmin, admin, staff)
  lib/                # Supabase client, color utils, date utils, logger
  config/             # Environment config (ENV, IS_DEV, IS_PROD)
  types/              # TypeScript types for all database tables
supabase/
  functions/          # Edge Functions (staff-auth, admin-actions)
  migrations/         # SQL schema, RLS policies, triggers, cron
scripts/              # Database seed/reset scripts (gitignored)
```

## Documentation Map

| Document | Path |
|----------|------|
| Product spec | docs/specs/bar-chores-spec-v5.docx |
| Technical reference | docs/architecture/technical-reference.md |
| API reference | docs/api/api.md |
| Seed data | docs/api/seed-data.md |
| Environments | docs/architecture/environments.md |
| App flowcharts | docs/architecture/app-flowchart.md |
| Implementation plans | docs/plans/ |
