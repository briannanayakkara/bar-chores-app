# Bar Chores App

Gamified bar staff task management — staff earn points for completing chores and redeem them for drink or bottle tickets. Multi-venue, mobile-first, built for real bar operations.

**Live:** https://bar-chores-app.vercel.app

---

## What It Does

Bar Chores turns daily cleaning and prep tasks into a points competition. Staff tap their name, enter a PIN, and see today's tasks. Complete a task, earn points. Climb the leaderboard. Cash in points for drink or bottle tickets with a unique redemption code the bartender can verify.

Three separate interfaces share one backend:

| Side | Who | What They Do |
|------|-----|-------------|
| **Super Admin** | Developer | Create venues, assign first admin per venue |
| **Admin Panel** | Venue manager | Manage staff, tasks, assignments, approve completions, customize branding |
| **Staff App** | Bar staff | Complete tasks, earn points, view leaderboard, redeem rewards |

Each venue is completely isolated — its own staff, tasks, points, theme, and logo.

---

## Tech Stack

- **Frontend:** React 19 + Vite 7 + TypeScript
- **Styling:** Tailwind CSS v3 with dynamic venue theming via CSS custom properties
- **Backend:** Supabase (Postgres, Auth, Edge Functions, Storage, Row Level Security)
- **Hosting:** Vercel (frontend) + Supabase (backend)
- **Auth:** Email/password for admins, PIN-based magic link flow for staff

---

## Key Features

**Staff Side**
- Tap-to-login with profile cards and PIN entry
- Today's tasks with claim, complete, and photo upload
- Auto-awarded points for tasks under 500pts
- Photo required + admin approval for high-value tasks (500pts+)
- Live leaderboard ranked by total points
- Reward redemption: 100pts = drink ticket, 1000pts = bottle ticket
- Unique redemption codes (e.g. `DRK-X7K2`) for bartender verification

**Admin Side**
- Responsive layout: sidebar on desktop, hamburger + bottom tabs on mobile
- Create and manage staff (username + PIN, no email needed)
- Create tasks with points, photo requirements, and recurring flags
- Assign tasks to specific staff or leave open for anyone to claim
- Review submitted photos, approve or reject, re-approve mistakes
- Venue theme editor: colors, logo, app name with live preview and reset to defaults
- Dashboard with today's stats

**Infrastructure**
- Row Level Security on every table — venues are fully isolated
- Postgres triggers: auto-update point totals, auto-create venue settings
- pg_cron: nightly reset of recurring task assignments
- Edge Function: PIN verification via bcrypt + magic link token generation
- Points can never go below zero (database-enforced)
- Timezone-safe date handling throughout

---

## Project Structure

```
bar-chores-app/
├── Documentation/          # Detailed spec + seed data
├── src/
│   ├── components/         # Layouts (admin, staff, shared)
│   ├── context/            # AuthContext, VenueContext
│   ├── pages/              # All route pages (superadmin, admin, staff)
│   ├── lib/                # Supabase client, color utils, date utils, logger
│   └── types/              # TypeScript types for all database tables
├── supabase/
│   ├── functions/          # Edge Functions (staff-auth, admin-actions)
│   └── migrations/         # SQL schema, RLS policies, triggers, cron
├── tailwind.config.js      # Custom colors via CSS variables
├── vercel.json             # SPA rewrites + cache headers
└── package.json
```

---

## Local Development

```bash
# Install dependencies
npm install

# Create .env with your Supabase credentials
cp .env.example .env

# Start dev server
npm run dev
```

Required environment variables:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## Database Seeding

Test data is defined in `Documentation/SEED_DATA.md` — 2 venues, 2 admins, 10 staff, 40 tasks.

```bash
node scripts/seed-reset.mjs
```

---

## License

Private project.
