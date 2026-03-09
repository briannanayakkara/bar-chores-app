# Data Models Reference

## Tables Overview

```
venues (1) ──── (N) profiles
  │                    │
  │                    └── (N) points_ledger
  │                    └── (N) reward_redemptions
  │
  ├──── (1) venue_settings
  │
  └──── (N) tasks
              │
              └── (N) task_assignments ──── profiles (assigned_to)
                         │
                         └── points_ledger (assignment_id)
```

## Table Details

### venues
| Column | Type | Constraints |
|--------|------|------------|
| id | uuid | PK, default gen_random_uuid() |
| name | text | NOT NULL |
| address | text | |
| slug | text | UNIQUE, NOT NULL |
| created_at | timestamptz | default now() |

### venue_settings
| Column | Type | Constraints |
|--------|------|------------|
| id | uuid | PK |
| venue_id | uuid | FK venues(id), UNIQUE |
| primary_color | text | default '#60A5FA' |
| accent_color | text | default '#3B82F6' |
| background_color | text | default '#0F172A' |
| logo_url | text | |
| app_name | text | |
| updated_at | timestamptz | auto-updated |

Auto-created by trigger on venue insert.

### profiles
| Column | Type | Constraints |
|--------|------|------------|
| id | uuid | PK = auth.users.id |
| venue_id | uuid | FK venues(id), nullable (unassigned admins) |
| role | text | CHECK: super_admin/venue_admin/staff |
| username | text | staff login identifier |
| display_name | text | |
| pin_hash | text | bcrypt hash, staff only |
| email | text | real for admins, synthetic for staff |
| avatar_type | text | 'photo' or 'builder' |
| avatar_url | text | |
| avatar_config | jsonb | avatar builder selections |
| points_total | int | maintained by trigger, default 0 |
| created_at | timestamptz | |

### tasks
| Column | Type | Constraints |
|--------|------|------------|
| id | uuid | PK |
| venue_id | uuid | FK venues(id) |
| title | text | NOT NULL |
| description | text | |
| points | int | NOT NULL |
| requires_photo | boolean | auto-true if points >= 500 |
| is_recurring | boolean | resets daily via pg_cron |
| is_active | boolean | default true |
| created_by | uuid | FK profiles(id) |
| created_at | timestamptz | |

### task_assignments
| Column | Type | Constraints |
|--------|------|------------|
| id | uuid | PK |
| task_id | uuid | FK tasks(id) |
| venue_id | uuid | FK venues(id), denormalized for RLS |
| assigned_to | uuid | FK profiles(id), nullable (open/claimable) |
| assigned_by | uuid | FK profiles(id) |
| due_date | date | |
| status | text | CHECK: pending/submitted/approved/rejected |
| completed_at | timestamptz | |
| photo_url | text | |
| created_at | timestamptz | |

### points_ledger
| Column | Type | Constraints |
|--------|------|------------|
| id | uuid | PK |
| profile_id | uuid | FK profiles(id) |
| venue_id | uuid | FK venues(id), denormalized for RLS |
| delta | int | positive = earned, negative = redeemed |
| reason | text | |
| assignment_id | uuid | FK task_assignments(id), nullable |
| created_by | uuid | FK profiles(id) |
| created_at | timestamptz | |

Trigger: on INSERT, updates profiles.points_total (clamped >= 0).

### reward_redemptions
| Column | Type | Constraints |
|--------|------|------------|
| id | uuid | PK |
| profile_id | uuid | FK profiles(id) |
| venue_id | uuid | FK venues(id), denormalized for RLS |
| reward_type | text | CHECK: drink_ticket/bottle_ticket |
| points_spent | int | 100 per drink, 1000 per bottle |
| quantity | int | |
| status | text | CHECK: pending/approved/rejected |
| redemption_code | text | UNIQUE, e.g. DRK-X7K2 |
| used_at | timestamptz | |
| approved_by | uuid | FK profiles(id), nullable |
| created_at | timestamptz | |

## FK Cascade Behavior

- `venues` deletion: CASCADE to venue_settings, tasks, profiles
- `profiles` deletion: requires FK cleanup (points_ledger, task_assignments, reward_redemptions)
- `tasks` deletion: CASCADE to task_assignments
