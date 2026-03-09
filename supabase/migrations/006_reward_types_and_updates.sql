-- ============================================================
-- 006: Reward Types Table + Reward Redemptions Updates
-- ============================================================

-- 1. Create reward_types table (per-venue)
CREATE TABLE reward_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name            text NOT NULL,
  emoji           text DEFAULT '',
  points_required integer NOT NULL CHECK (points_required > 0),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_reward_types_venue_id ON reward_types(venue_id);

-- ============================================================
-- 2. Trigger: auto-update updated_at on reward_types
-- ============================================================

CREATE OR REPLACE FUNCTION update_reward_types_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reward_types_updated_at
  BEFORE UPDATE ON reward_types
  FOR EACH ROW EXECUTE FUNCTION update_reward_types_timestamp();

-- ============================================================
-- 3. RLS on reward_types
-- ============================================================

ALTER TABLE reward_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all_reward_types ON reward_types
  FOR ALL USING (public.user_role() = 'super_admin');

CREATE POLICY admin_manage_venue_reward_types ON reward_types
  FOR ALL USING (venue_id = public.user_venue_id() AND public.user_role() = 'venue_admin');

CREATE POLICY staff_read_venue_reward_types ON reward_types
  FOR SELECT USING (venue_id = public.user_venue_id() AND public.user_role() = 'staff');

CREATE POLICY anon_read_reward_types ON reward_types
  FOR SELECT USING (true);

-- ============================================================
-- 4. Alter reward_redemptions: add new columns
-- ============================================================

ALTER TABLE reward_redemptions
  ADD COLUMN reward_type_id uuid REFERENCES reward_types(id),
  ADD COLUMN points_reserved integer NOT NULL DEFAULT 0,
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolved_by uuid REFERENCES profiles(id);

-- 5. Make reward_type column nullable (was NOT NULL with CHECK)
ALTER TABLE reward_redemptions DROP CONSTRAINT IF EXISTS reward_redemptions_reward_type_check;
ALTER TABLE reward_redemptions ALTER COLUMN reward_type DROP NOT NULL;

-- 6. Index on new FK
CREATE INDEX idx_reward_redemptions_reward_type_id ON reward_redemptions(reward_type_id);
