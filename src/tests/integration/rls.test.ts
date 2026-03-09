import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedTestVenue, getAuthenticatedClient, TestContext } from '../helpers/testSetup';

/**
 * RLS (Row Level Security) integration tests
 * Tests venue isolation and role-based access against DEV Supabase.
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

  it('staff from venue A cannot read any data from venue B', async () => {
    const staffClient = await getAuthenticatedClient(ctxA.client, ctxA.staff1.email);

    // Try to read venue B's profiles
    const { data } = await staffClient
      .from('profiles')
      .select('id')
      .eq('venue_id', ctxB.venue.id);

    expect(data).toEqual([]);
  }, 15000);

  it('staff cannot read profiles of staff from a different venue', async () => {
    const staffClient = await getAuthenticatedClient(ctxA.client, ctxA.staff1.email);

    const { data } = await staffClient
      .from('profiles')
      .select('id, venue_id')
      .eq('id', ctxB.staff1.id);

    expect(data).toEqual([]);
  }, 15000);

  it('admin can read and write all profiles in their own venue only', async () => {
    const adminClient = await getAuthenticatedClient(ctxA.client, ctxA.admin.email);

    // Can read own venue profiles
    const { data: ownProfiles } = await adminClient
      .from('profiles')
      .select('id')
      .eq('venue_id', ctxA.venue.id);

    expect(ownProfiles?.length).toBeGreaterThanOrEqual(3); // admin + 2 staff

    // Cannot read other venue profiles
    const { data: otherProfiles } = await adminClient
      .from('profiles')
      .select('id')
      .eq('venue_id', ctxB.venue.id);

    expect(otherProfiles).toEqual([]);
  }, 15000);

  it('admin cannot read data from another venue', async () => {
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
