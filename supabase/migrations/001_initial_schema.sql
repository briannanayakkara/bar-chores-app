-- ============================================
-- 001_initial_schema.sql
-- Bar Chores App — all 7 tables
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. venues
-- ============================================
CREATE TABLE venues (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  address     text,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venues_slug ON venues (slug);

-- ============================================
-- 2. venue_settings
-- ============================================
CREATE TABLE venue_settings (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id         uuid NOT NULL UNIQUE REFERENCES venues (id) ON DELETE CASCADE,
  primary_color    text NOT NULL DEFAULT '#60A5FA',
  accent_color     text NOT NULL DEFAULT '#3B82F6',
  background_color text NOT NULL DEFAULT '#0F172A',
  logo_url         text,
  app_name         text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 3. profiles
-- ============================================
CREATE TABLE profiles (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      uuid REFERENCES venues (id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('super_admin', 'venue_admin', 'staff')),
  username      text,
  display_name  text,
  pin_hash      text,
  email         text,
  avatar_type   text CHECK (avatar_type IN ('photo', 'builder')),
  avatar_url    text,
  avatar_config jsonb,
  points_total  int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_venue_id ON profiles (venue_id);
CREATE INDEX idx_profiles_role ON profiles (role);
CREATE UNIQUE INDEX idx_profiles_username_venue ON profiles (username, venue_id)
  WHERE username IS NOT NULL;

-- ============================================
-- 4. tasks
-- ============================================
CREATE TABLE tasks (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id       uuid NOT NULL REFERENCES venues (id) ON DELETE CASCADE,
  title          text NOT NULL,
  description    text,
  points         int NOT NULL DEFAULT 0,
  requires_photo boolean NOT NULL DEFAULT false,
  is_recurring   boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  created_by     uuid NOT NULL REFERENCES profiles (id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_venue_id ON tasks (venue_id);

-- ============================================
-- 5. task_assignments
-- ============================================
CREATE TABLE task_assignments (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  venue_id     uuid NOT NULL REFERENCES venues (id) ON DELETE CASCADE,
  assigned_to  uuid REFERENCES profiles (id),
  assigned_by  uuid NOT NULL REFERENCES profiles (id),
  due_date     date NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  completed_at timestamptz,
  photo_url    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_assignments_venue_id ON task_assignments (venue_id);
CREATE INDEX idx_task_assignments_assigned_to ON task_assignments (assigned_to);
CREATE INDEX idx_task_assignments_status ON task_assignments (status);
CREATE INDEX idx_task_assignments_due_date ON task_assignments (due_date);

-- ============================================
-- 6. points_ledger
-- ============================================
CREATE TABLE points_ledger (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  venue_id      uuid NOT NULL REFERENCES venues (id) ON DELETE CASCADE,
  delta         int NOT NULL,
  reason        text,
  assignment_id uuid REFERENCES task_assignments (id) ON DELETE SET NULL,
  created_by    uuid NOT NULL REFERENCES profiles (id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_points_ledger_profile_id ON points_ledger (profile_id);
CREATE INDEX idx_points_ledger_venue_id ON points_ledger (venue_id);

-- ============================================
-- 7. reward_redemptions
-- ============================================
CREATE TABLE reward_redemptions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  venue_id        uuid NOT NULL REFERENCES venues (id) ON DELETE CASCADE,
  reward_type     text NOT NULL CHECK (reward_type IN ('drink_ticket', 'bottle_ticket')),
  points_spent    int NOT NULL,
  quantity        int NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  redemption_code text NOT NULL UNIQUE,
  used_at         timestamptz,
  approved_by     uuid REFERENCES profiles (id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reward_redemptions_profile_id ON reward_redemptions (profile_id);
CREATE INDEX idx_reward_redemptions_venue_id ON reward_redemptions (venue_id);
CREATE INDEX idx_reward_redemptions_code ON reward_redemptions (redemption_code);
