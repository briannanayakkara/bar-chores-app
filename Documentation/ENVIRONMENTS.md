# 🌍 Bar Chores App — Environment Setup

This document describes the two-environment setup for the Bar Chores App.
Use this file to guide Claude Code when setting up the dev/prod pipeline.

---

## 📐 Architecture Overview

```
develop branch  →  DEV Vercel URL   →  Supabase DEV project  (dummy data)
main branch     →  PROD Vercel URL  →  Supabase PROD project (real live data)
```

- **One codebase** — two environments, controlled by environment variables
- **Super admin** is the same user for both environments
- **All other data** is completely separate — dev has dummy data, prod has real data
- **App title** shows a visible `[DEV]` or `[PROD]` tag so you always know which environment you are on

---

## 🔐 Environment Variables

### Production (.env.production)
```env
VITE_SUPABASE_URL=https://sepcdjmwdfjjieaxqoqn.supabase.co
VITE_SUPABASE_ANON_KEY=<stored in .env.production — never commit>
SUPABASE_SERVICE_ROLE_KEY=<stored in .env.production — never commit>
SUPABASE_JWT_KID=db2a0017-f234-44e4-aed6-389147c1c501
SUPABASE_JWKS_URL=https://sepcdjmwdfjjieaxqoqn.supabase.co/auth/v1/.well-known/jwks.json
VITE_ENV=production
VITE_APP_TITLE=Bar Chores
```

### Development (.env.development)
```env
VITE_SUPABASE_URL=https://drwflvxdvwtjzuqxfort.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_LUrHfqbbHN01DUcvXPheng_TEsRBMQg
SUPABASE_SERVICE_ROLE_KEY=<stored in .env.development — never commit>
SUPABASE_JWT_KID=cb393d12-79a1-4401-8dce-39735a17293f
SUPABASE_JWKS_URL=https://drwflvxdvwtjzuqxfort.supabase.co/auth/v1/.well-known/jwks.json
VITE_ENV=development
VITE_APP_TITLE=Bar Chores [DEV]
```

> ⚠️ Both .env files must be in .gitignore — never commit credentials to GitHub

---

## 🏗️ Vercel Setup

### Production Deployment
- **Branch:** `main`
- **URL:** `https://bar-chores-app.vercel.app`
- **Environment variables:** set to production values in Vercel dashboard

### Development Deployment
- **Branch:** `develop`
- **URL:** `https://bar-chores-dev.vercel.app` (stable alias via GitHub Actions)
- **Environment variables:** set to development values in Vercel dashboard

### How to set per-environment variables in Vercel
1. Go to Vercel → your project → Settings → Environment Variables
2. For each variable select which environment it applies to:
   - Production only → `main` branch deploys
   - Preview only → `develop` branch deploys

---

## 🔄 CI/CD Pipeline

### develop branch pipeline
```
Push code to develop branch
        ↓
GitHub Actions (.github/workflows/deploy-dev.yml)
        ↓
Checkout → npm ci → tsc -b (type check)
        ↓
vercel pull --preview → vercel build → vercel deploy --prebuilt
        ↓
Alias to https://bar-chores-dev.vercel.app
        ↓
App shows DEV badge (yellow banner)
        ↓
Connected to DEV Supabase (dummy data)
```

### main branch pipeline
```
Pull Request: develop → main
        ↓
Merge approved
        ↓
GitHub Actions (.github/workflows/deploy-prod.yml)
        ↓
Checkout → npm ci → tsc -b (type check)
        ↓
vercel pull --production → vercel build --prod → vercel deploy --prebuilt --prod
        ↓
Deploys to https://bar-chores-app.vercel.app
        ↓
App shows no tag — clean title "Bar Chores"
        ↓
Connected to PROD Supabase (real live data)
```

> **Note:** Vercel auto-deploy is disabled. All deployments go through GitHub Actions only. Vercel env vars (set in the dashboard) are pulled at build time via `vercel pull`.

---

## 🗄️ Supabase Projects

### Production Project
- **Project name:** bar-chores (existing)
- **URL:** `https://sepcdjmwdfjjieaxqoqn.supabase.co`
- **Data:** Real venues, real staff, real data
- **Super admin:** same account as dev

### Development Project
- **Project name:** bar-chores-dev
- **URL:** `https://drwflvxdvwtjzuqxfort.supabase.co`
- **Publishable key:** `sb_publishable_LUrHfqbbHN01DUcvXPheng_TEsRBMQg`
- **Secret key:** *(stored in .env.development — never commit)*
- **JWT Key ID (ECC P-256):** `cb393d12-79a1-4401-8dce-39735a17293f`
- **JWKS URL:** `https://drwflvxdvwtjzuqxfort.supabase.co/auth/v1/.well-known/jwks.json`
- **Direct connection:** *(see Supabase dashboard — contains password, never commit)*
- **Data:** Dummy data from SEED_DATA.md
- **Super admin:** same account as prod

---

## 📋 DEV Database Setup Checklist

When the DEV Supabase project is created run these in order:

- [ ] Run `supabase/migrations/001_initial_schema.sql`
- [ ] Run `supabase/migrations/002_rls_policies.sql`
- [ ] Run `supabase/migrations/003_triggers.sql`
- [ ] Run `supabase/migrations/004_cron.sql`
- [ ] Deploy Edge Function: `staff-auth`
- [ ] Create storage buckets: `task-photos`, `venue-assets`, `profile-pictures`
- [ ] Seed dummy data from `Documentation/SEED_DATA.md`
- [ ] Set super admin user in Auth
- [ ] Turn off email confirmations in Auth settings
- [ ] Set Site URL to dev Vercel URL in Auth → URL Configuration

---

## 🏷️ Environment Tag in App

The app title and a visible tag in the UI must always show which environment is active:

| Environment | App Title | Header Tag |
|-------------|-----------|------------|
| Production | `Bar Chores` | No tag — clean |
| Development | `Bar Chores` | Visible `DEV` badge in header |

Implementation:
```typescript
// src/config/environment.ts
export const ENV = import.meta.env.VITE_ENV || 'development'
export const IS_DEV = ENV === 'development'
export const IS_PROD = ENV === 'production'
export const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'Bar Chores [DEV]'
```

The DEV badge should be:
- Visible in the top header on every page
- Bright colour — orange or yellow so it is impossible to miss
- Shows the text `DEV` clearly
- Not shown at all in production

---

## 🔀 Git Branch Strategy

```
main          ← production only, protected branch
  └── develop ← active development branch
        └── feature/xxx ← individual feature branches (optional)
```

### Rules
- Never push directly to `main`
- All development happens on `develop` or feature branches
- Merge `develop` → `main` only when ready to go live
- `main` should be protected in GitHub — require pull request to merge

---

## 🚀 Edge Function Deployments

Edge Functions are deployed separately to each Supabase project:

```bash
# Deploy to DEV
supabase functions deploy staff-auth --project-ref [DEV PROJECT REF]

# Deploy to PROD
supabase functions deploy staff-auth --project-ref sepcdjmwdfjjieaxqoqn
```

When an Edge Function changes:
1. Test on DEV first
2. Confirm it works
3. Deploy to PROD only after confirmed working on DEV

---

## 📁 Files Related to This Setup

```
bar-chores-app/
├── .env.production          ← prod credentials (gitignored)
├── .env.development         ← dev credentials (gitignored)
├── .env.example             ← template showing required variables (committed)
├── vite.config.ts           ← loads correct .env based on build mode
├── src/
│   └── config/
│       └── environment.ts   ← exports ENV, IS_DEV, IS_PROD, APP_TITLE
└── .github/
    └── workflows/
        ├── deploy-prod.yml  ← triggers on merge to main
        └── deploy-dev.yml   ← triggers on push to develop
```
