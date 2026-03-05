-- Add status column to profiles for invite tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Set all existing profiles to active
UPDATE profiles SET status = 'active' WHERE status IS NULL;

-- Add check constraint for valid values
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'active', 'inactive'));
