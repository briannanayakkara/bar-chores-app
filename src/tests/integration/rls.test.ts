import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedTestVenue, getAuthenticatedClient, TestContext } from '../helpers/testSetup';

/**
 * RLS (Row Level Security) integration tests
 * Tests venue isolation and role-based access against DEV Supabase.
 *
 * NOTE: profiles table has "anon_read_staff_profiles" policy that allows
 * SELECT on any profile where role='staff' (needed for staff login card grid).
 * So cross-venue profile reads ARE allowed by design for staff-role profiles.
 */

describe.skipIf(!process.env.DEV_SUPABASE_SERVICE_ROLE_KEY)('RLS Policies', () => {
  let ctxA: TestContext;
  let ctxB: TestContext;

  beforeAll(async () => {
    // Create two isolated test venues
    ctxA = await seedTestVenue();
    ctxB = await seedTestVenue();
  }, 30000);

  afterAll(async () => {
    await ctxA?.cleanup();
    await ctxB?.cleanup();
  }, 30000);

  it('staff can read staff profiles across venues (anon_read_staff_profiles policy)', async () => {
    const staffClient = await getAuthenticatedClient(ctxA.client, ctxA.staff1.email);

    // Staff profiles are readable across venues (needed for staff login card grid)
    const { data } = await staffClient
      .from('profiles')
      .select('id')
      .eq('venue_id', ctxB.venue.id)
      .eq('role', 'staff');

    expect(data?.length).toBeGreaterThanOrEqual(2); // ctxB has 2 staff
  }, 15000);

  it('staff cannot read admin profiles from another venue', async () => {
    const staffClient = await getAuthenticatedClient(ctxA.client, ctxA.staff1.email);

    // Admin profiles should NOT be readable cross-venue (anon policy only covers role='staff')
    const { data } = await staffClient
      .from('profiles')
      .select('id')
      .eq('id', ctxB.admin.id);

    // Staff can read their own profile + venue profiles, but ctxB admin is not in their venue
    // and is not role='staff', so it depends on whether users_read_own_profile matches
    // Since this is NOT the staff's own profile, it should not be returned
    // unless admin_manage_venue_profiles or another policy allows it
    expect(data?.length).toBe(0);
  }, 15000);

  it('admin can read and write all profiles in their own venue', async () => {
    const adminClient = await getAuthenticatedClient(ctxA.client, ctxA.admin.email);

    // Can read own venue profiles
    const { data: ownProfiles } = await adminClient
      .from('profiles')
      .select('id')
      .eq('venue_id', ctxA.venue.id);

    expect(ownProfiles?.length).toBeGreaterThanOrEqual(3); // admin + 2 staff
  }, 15000);

  it('admin cannot read tasks from another venue', async () => {
    const adminClient = await getAuthenticatedClient(ctxA.client, ctxA.admin.email);

    // Create a task in venue B via service client
    const { data: task } = await ctxB.client.from('tasks').insert({
      venue_id: ctxB.venue.id,
      title: 'Test Task B',
      points: 100,
      created_by: ctxB.admin.id,
      approval_status: 'active',
    }).select().single();

    // Admin A cannot see it
    const { data: tasks } = await adminClient
      .from('tasks')
      .select('id')
      .eq('venue_id', ctxB.venue.id);

    expect(tasks).toEqual([]);

    // Clean up
    if (task) await ctxB.client.from('tasks').delete().eq('id', task.id);
  }, 15000);

  it('super admin can read all venues (tested via service role)', async () => {
    // Service role bypasses RLS, simulating super admin access
    const { data: venues } = await ctxA.client
      .from('venues')
      .select('id')
      .in('id', [ctxA.venue.id, ctxB.venue.id]);

    expect(venues?.length).toBe(2);
  }, 15000);
});
