-- ============================================
-- 003_triggers.sql
-- 1. Auto-update profiles.points_total on points_ledger insert
-- 2. Auto-create venue_settings on new venue insert
-- ============================================

-- ============================================
-- Trigger 1: Update points_total when points_ledger row inserted
-- ============================================
CREATE OR REPLACE FUNCTION update_points_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET points_total = points_total + NEW.delta
  WHERE id = NEW.profile_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_points_ledger_update_total
  AFTER INSERT ON points_ledger
  FOR EACH ROW
  EXECUTE FUNCTION update_points_total();

-- ============================================
-- Trigger 2: Auto-create venue_settings with defaults on new venue
-- ============================================
CREATE OR REPLACE FUNCTION create_default_venue_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO venue_settings (venue_id, primary_color, accent_color, background_color)
  VALUES (NEW.id, '#60A5FA', '#3B82F6', '#0F172A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_venue_create_settings
  AFTER INSERT ON venues
  FOR EACH ROW
  EXECUTE FUNCTION create_default_venue_settings();

-- ============================================
-- Trigger 3: Auto-update venue_settings.updated_at on change
-- ============================================
CREATE OR REPLACE FUNCTION update_venue_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venue_settings_updated_at
  BEFORE UPDATE ON venue_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_venue_settings_timestamp();
