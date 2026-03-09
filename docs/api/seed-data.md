# 🌱 Bar Chores App — Seed Data

Use this file to ask Claude Code to populate the database with realistic test data.
All data is scoped correctly — each venue has its own admin, staff, and tasks.

---

## 🏢 Venues

| # | Name | Address | Slug |
|---|------|---------|------|
| 1 | Little Green Door | Gammel Strand 40, 1202 København | `little-green-door` |
| 2 | KOKO | Studiestræde 7, København | `koko` |

---

## 👔 Venue Admins

| Venue | Name | Email | Password |
|-------|------|-------|----------|
| Little Green Door | Brian | `brian@rekom.dk` | `Admin1234!` |
| KOKO | BN | `bn@rekom.dk` | `Admin1234!` |

---

## 👥 Staff Users

### Little Green Door — 5 Staff

| Display Name | Username | PIN | Role |
|-------------|----------|-----|------|
| Jake Murphy | `jake.lgd` | `1234` | staff |
| Sofia Andersen | `sofia.lgd` | `2345` | staff |
| Marcus Nielsen | `marcus.lgd` | `3456` | staff |
| Ella Christensen | `ella.lgd` | `4567` | staff |
| Liam Jensen | `liam.lgd` | `5678` | staff |

### KOKO — 5 Staff

| Display Name | Username | PIN | Role |
|-------------|----------|-----|------|
| Noah Hansen | `noah.koko` | `1111` | staff |
| Mia Pedersen | `mia.koko` | `2222` | staff |
| Oscar Larsen | `oscar.koko` | `3333` | staff |
| Freya Møller | `freya.koko` | `4444` | staff |
| Emil Thomsen | `emil.koko` | `5555` | staff |

---

## 🎁 Reward Types (per venue)

Each venue gets the same 4 default reward types:

| Name | Emoji | Points Required |
|------|-------|----------------|
| Drink Ticket | 🍺 | 100 |
| Tote Bag | 👜 | 500 |
| Bottle Ticket | 🍾 | 1,000 |
| Hoodie | 👕 | 2,000 |

---

## 📋 Tasks

### Little Green Door — 20 Tasks

| # | Title | Description | Points | Photo | Frequency |
|---|-------|-------------|--------|-------|-----------|
| 1 | Open Bar Setup | Set up all bottles, garnishes and tools before opening | 100 | No | Daily |
| 2 | Polish All Glassware | Polish every glass and ensure no smudges or watermarks | 75 | No | Daily |
| 3 | Clean Coffee Machine | Full clean and descale of the espresso machine | 150 | Yes | Daily |
| 4 | Restock Beer Fridge | Ensure all beers are stocked, rotated and cold | 100 | No | Daily |
| 5 | Wipe Down All Surfaces | Clean and sanitise all bar surfaces and countertops | 80 | No | Daily |
| 6 | Mop Bar Floor | Mop the entire bar floor including behind the bar | 120 | No | Daily |
| 7 | Empty All Bins | Empty all bins and replace liners throughout the venue | 80 | No | Daily |
| 8 | Deep Clean Ice Machine | Full clean and sanitise the ice machine | 500 | Yes | Monthly |
| 9 | Restock Spirits | Check and restock all spirit levels on the back bar | 100 | No | Daily |
| 10 | Clean Fridges | Full clean of all bar fridges inside and out | 600 | Yes | Monthly |
| 11 | Check and Restock Mixers | Ensure all mixers, sodas and juices are stocked | 75 | No | Daily |
| 12 | Organise Stock Room | Organise and label all stock in the back room | 400 | Yes | Weekly |
| 13 | Clean Toilets | Full clean of all customer toilets | 150 | Yes | Daily |
| 14 | Wipe Down Menus | Clean and sanitise all menus and table cards | 50 | No | Daily |
| 15 | End of Night Cash Up | Count the till and prepare the cash up report | 200 | No | Daily |
| 16 | Close Bar Checklist | Complete the full closing checklist for the bar | 150 | No | Daily |
| 17 | Restock Paper Products | Restock napkins, straws, coasters throughout | 60 | No | Daily |
| 18 | Check Expiry Dates | Check all perishables and remove anything expired | 100 | No | Weekly |
| 19 | Deep Clean Drains | Full clean of all bar drains with cleaning solution | 700 | Yes | Monthly |
| 20 | Wash Bar Mats | Remove, wash and dry all rubber bar mats | 200 | Yes | Weekly |

---

### KOKO — 20 Tasks

| # | Title | Description | Points | Photo | Frequency |
|---|-------|-------------|--------|-------|-----------|
| 1 | Open Venue Setup | Set up all areas before doors open | 100 | No | Daily |
| 2 | Sound System Check | Test all speakers, mics and sound levels | 150 | No | Daily |
| 3 | Clean DJ Booth | Wipe down DJ booth, controller and equipment | 200 | Yes | Daily |
| 4 | Restock Bar Fridges | Stock all fridges with drinks and check rotation | 100 | No | Daily |
| 5 | Polish Bar Surfaces | Clean and polish all bar surfaces to a shine | 80 | No | Daily |
| 6 | Set Up VIP Area | Arrange VIP seating, bottles and table setup | 150 | No | Daily |
| 7 | Mop Dance Floor | Mop and clean the entire dance floor area | 120 | No | Daily |
| 8 | Empty All Bins | Empty all bins and replace liners | 80 | No | Daily |
| 9 | Restock Spirits and Mixers | Check and restock all spirits and mixers | 100 | No | Daily |
| 10 | Deep Clean Toilets | Full deep clean of all toilets and restrooms | 200 | Yes | Daily |
| 11 | Check Lighting Rig | Test all lights, strobes and effects | 150 | No | Daily |
| 12 | Clean Ice Machines | Full clean and sanitise all ice machines | 500 | Yes | Monthly |
| 13 | Organise Back of House | Clean and organise the entire back of house area | 400 | Yes | Weekly |
| 14 | Wipe Down All Seating | Clean and sanitise all seats, booths and surfaces | 100 | No | Daily |
| 15 | Restock Coat Check | Organise and restock coat check area | 75 | No | Daily |
| 16 | End of Night Sweep | Full sweep and mop of all areas after closing | 150 | No | Daily |
| 17 | Cash Up and Reports | Complete till count and nightly reports | 200 | No | Daily |
| 18 | Deep Clean Bar Fridges | Full internal clean of all bar fridges | 600 | Yes | Monthly |
| 19 | Check Fire Exits | Check all fire exits are clear and signage is correct | 100 | No | Weekly |
| 20 | Restock Paper and Sundries | Restock napkins, straws, coasters, toilet paper | 60 | No | Daily |

---

## 🎯 Points Summary

| Range | Behaviour |
|-------|-----------|
| Under 500 pts | Auto-awarded instantly on completion |
| 500 pts and above | Requires photo upload — admin must approve |

---

## 🛠️ How to Use This File

Run the automated seed script:

```bash
node scripts/seed-reset.mjs
```

Or ask Claude Code to reset and reseed. The script will:

1. Clear all data (respecting foreign keys), keeping the super admin
2. Delete all Supabase Auth users except the super admin
3. Create the 2 venues
4. Create the 2 venue admins via Supabase Auth (email + password) and insert profiles
5. Create all 10 staff — **each staff needs a Supabase Auth user** with a synthetic email (e.g. `staff_jake_lgd@{venueId}.internal`) because the Edge Function uses `auth.admin.generateLink()` which requires an auth user with an email
6. Create all 40 tasks (20 per venue) with correct points, photo flag, and frequency (once/daily/weekly/monthly)
7. Create 1 pending task assignment per staff member
8. Set all staff points to 0 with no points_ledger entries

> **IMPORTANT:** Staff users MUST have Supabase Auth users. The profile `id` must match the auth user `id`, and the profile `email` must be set. Without this, the staff-auth Edge Function will fail with "Staff account not properly configured (missing email)".

---

## ✅ Expected Result After Seeding

| Table | Expected Rows |
|-------|--------------|
| venues | 2 |
| venue_settings | 2 (auto-created by trigger) |
| profiles | 13 (1 super admin + 2 admins + 10 staff) |
| reward_types | 8 (4 per venue) |
| tasks | 40 |
| task_assignments | 10 (1 per staff member) |
| points_ledger | 0 (clean start) |
| reward_redemptions | 0 (none yet) |
