// TypeScript types matching the database schema

export type UserRole = 'super_admin' | 'venue_admin' | 'staff';
export type AvatarType = 'photo' | 'builder';
export type AssignmentStatus = 'pending' | 'submitted' | 'approved' | 'rejected';
export type RewardType = 'drink_ticket' | 'bottle_ticket';
export type RewardStatus = 'pending' | 'approved' | 'rejected';

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  slug: string;
  created_at: string;
}

export interface VenueSettings {
  id: string;
  venue_id: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  logo_url: string | null;
  app_name: string | null;
  updated_at: string;
}

export type ProfileStatus = 'pending' | 'active' | 'inactive';

export interface Profile {
  id: string;
  venue_id: string | null;
  role: UserRole;
  username: string | null;
  display_name: string | null;
  pin_hash: string | null;
  email: string | null;
  avatar_type: AvatarType | null;
  avatar_url: string | null;
  avatar_config: Record<string, unknown> | null;
  points_total: number;
  status: ProfileStatus;
  created_at: string;
}

export type TaskApprovalStatus = 'proposed' | 'active' | 'rejected';

export interface Task {
  id: string;
  venue_id: string;
  title: string;
  description: string | null;
  points: number;
  requires_photo: boolean;
  is_recurring: boolean;
  is_active: boolean;
  created_by: string;
  proposed_by: string | null;
  approval_status: TaskApprovalStatus;
  created_at: string;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  venue_id: string;
  assigned_to: string | null;
  assigned_by: string;
  due_date: string;
  status: AssignmentStatus;
  completed_at: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface PointsLedgerEntry {
  id: string;
  profile_id: string;
  venue_id: string;
  delta: number;
  reason: string | null;
  assignment_id: string | null;
  created_by: string;
  created_at: string;
}

export interface RewardRedemption {
  id: string;
  profile_id: string;
  venue_id: string;
  reward_type: RewardType;
  points_spent: number;
  quantity: number;
  status: RewardStatus;
  redemption_code: string;
  used_at: string | null;
  approved_by: string | null;
  created_at: string;
}
