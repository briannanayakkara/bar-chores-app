import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Integration test helper — connects to DEV Supabase with service role key.
 * Seeds isolated test data before each suite and cleans up after.
 *
 * IMPORTANT: Uses the DEV project only — never production.
 */

// DEV Supabase credentials (safe — this is the dev project with dummy data)
const DEV_SUPABASE_URL = process.env.DEV_SUPABASE_URL || 'https://drwflvxdvwtjzuqxfort.supabase.co';
const DEV_SERVICE_ROLE_KEY = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY || '';

export function getServiceClient(): SupabaseClient {
  if (!DEV_SERVICE_ROLE_KEY) {
    throw new Error(
      'DEV_SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Set it as an environment variable to run integration tests.'
    );
  }
  return createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestVenue {
  id: string;
  name: string;
  slug: string;
}

export interface TestProfile {
  id: string;
  venue_id: string;
  role: string;
  username: string | null;
  display_name: string;
  email: string;
}

export interface TestContext {
  client: SupabaseClient;
  venue: TestVenue;
  admin: TestProfile;
  staff1: TestProfile;
  staff2: TestProfile;
  cleanup: () => Promise<void>;
}

/**
 * Seeds a clean isolated test venue with one admin and two staff members.
 * Returns all created IDs for assertions and a cleanup function.
 */
export async function seedTestVenue(): Promise<TestContext> {
  const client = getServiceClient();
  const testId = crypto.randomUUID().slice(0, 8);
  const venueSlug = `test-venue-${testId}`;

  // 1. Create venue
  const { data: venue, error: venueErr } = await client
    .from('venues')
    .insert({ name: `Test Venue ${testId}`, address: 'Test Address', slug: venueSlug })
    .select()
    .single();

  if (venueErr || !venue) throw new Error(`Failed to create test venue: ${venueErr?.message}`);

  // 2. Create admin auth user + profile
  const adminEmail = `test-admin-${testId}@test.internal`;
  const { data: adminAuth, error: adminAuthErr } = await client.auth.admin.createUser({
    email: adminEmail,
    password: `TestAdmin${testId}!`,
    email_confirm: true,
  });
  if (adminAuthErr || !adminAuth.user) throw new Error(`Failed to create admin auth: ${adminAuthErr?.message}`);

  const { error: adminProfileErr } = await client.from('profiles').insert({
    id: adminAuth.user.id,
    venue_id: venue.id,
    role: 'venue_admin',
    email: adminEmail,
    display_name: `Test Admin ${testId}`,
    status: 'active',
  });
  if (adminProfileErr) throw new Error(`Failed to create admin profile: ${adminProfileErr.message}`);

  // 3. Create two staff auth users + profiles
  async function createStaff(num: number): Promise<TestProfile> {
    const username = `test-staff-${num}-${testId}`;
    const staffEmail = `staff_${username}@${venue.id}.internal`;
    const { data: staffAuth, error: staffAuthErr } = await client.auth.admin.createUser({
      email: staffEmail,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (staffAuthErr || !staffAuth.user) throw new Error(`Failed to create staff auth: ${staffAuthErr?.message}`);

    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;
    const pinHash = bcrypt.hashSync(`${1000 + num}`, 10);

    const { error: staffProfileErr } = await client.from('profiles').insert({
      id: staffAuth.user.id,
      venue_id: venue.id,
      role: 'staff',
      username,
      display_name: `Test Staff ${num} ${testId}`,
      pin_hash: pinHash,
      email: staffEmail,
      status: 'active',
    });
    if (staffProfileErr) throw new Error(`Failed to create staff profile: ${staffProfileErr.message}`);

    return {
      id: staffAuth.user.id,
      venue_id: venue.id,
      role: 'staff',
      username,
      display_name: `Test Staff ${num} ${testId}`,
      email: staffEmail,
    };
  }

  const staff1 = await createStaff(1);
  const staff2 = await createStaff(2);

  const admin: TestProfile = {
    id: adminAuth.user.id,
    venue_id: venue.id,
    role: 'venue_admin',
    username: null,
    display_name: `Test Admin ${testId}`,
    email: adminEmail,
  };

  const testVenue: TestVenue = { id: venue.id, name: venue.name, slug: venueSlug };

  // Cleanup function — deletes everything created in this test run
  async function cleanup() {
    const userIds = [admin.id, staff1.id, staff2.id];

    // Delete related data in FK order
    await client.from('reward_redemptions').delete().eq('venue_id', venue.id);
    await client.from('points_ledger').delete().eq('venue_id', venue.id);
    await client.from('task_assignments').delete().eq('venue_id', venue.id);
    await client.from('tasks').delete().eq('venue_id', venue.id);
    await client.from('reward_types').delete().eq('venue_id', venue.id);

    for (const uid of userIds) {
      await client.from('profiles').delete().eq('id', uid);
      await client.auth.admin.deleteUser(uid).catch(() => {});
    }

    await client.from('venue_settings').delete().eq('venue_id', venue.id);
    await client.from('venues').delete().eq('id', venue.id);
  }

  return { client, venue: testVenue, admin, staff1, staff2, cleanup };
}

/**
 * Helper to create a Supabase client authenticated as a specific user.
 * Uses the anon key with a session token from generateLink.
 */
export async function getAuthenticatedClient(
  serviceClient: SupabaseClient,
  email: string
): Promise<SupabaseClient> {
  const { data: linkData, error } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error || !linkData) throw new Error(`Failed to generate auth link: ${error?.message}`);

  const anonKey = process.env.DEV_SUPABASE_ANON_KEY || 'sb_publishable_LUrHfqbbHN01DUcvXPheng_TEsRBMQg';
  const userClient = createClient(DEV_SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: otpErr } = await userClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (otpErr) throw new Error(`Failed to verify OTP: ${otpErr.message}`);

  return userClient;
}
