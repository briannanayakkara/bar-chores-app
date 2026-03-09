import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedTestVenue, TestContext } from '../helpers/testSetup';

/**
 * Points ledger integration tests
 * Tests the Postgres trigger that updates profiles.points_total on insert.
 */

describe.skipIf(!process.env.DEV_SUPABASE_SERVICE_ROLE_KEY)('Points Ledger Trigger', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await seedTestVenue();
  }, 30000);

  afterAll(async () => {
    await ctx?.cleanup();
  }, 30000);

  it('inserting a positive delta updates profiles.points_total via trigger', async () => {
    const { client, staff1, venue } = ctx;

    await client.from('points_ledger').insert({
      profile_id: staff1.id,
      venue_id: venue.id,
      delta: 150,
      reason: 'Test: positive delta',
      created_by: staff1.id,
    });

    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff1.id)
      .single();

    expect(profile?.points_total).toBe(150);
  }, 15000);

  it('inserting a negative delta reduces profiles.points_total immediately', async () => {
    const { client, staff1, venue } = ctx;

    await client.from('points_ledger').insert({
      profile_id: staff1.id,
      venue_id: venue.id,
      delta: -50,
      reason: 'Test: negative delta',
      created_by: staff1.id,
    });

    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff1.id)
      .single();

    expect(profile?.points_total).toBe(100); // 150 - 50
  }, 15000);

  it('sequential inserts accumulate correctly', async () => {
    const { client, staff2, venue } = ctx;

    // Insert 3 entries sequentially
    await client.from('points_ledger').insert({
      profile_id: staff2.id,
      venue_id: venue.id,
      delta: 100,
      reason: 'Test: entry 1',
      created_by: staff2.id,
    });
    await client.from('points_ledger').insert({
      profile_id: staff2.id,
      venue_id: venue.id,
      delta: 200,
      reason: 'Test: entry 2',
      created_by: staff2.id,
    });
    await client.from('points_ledger').insert({
      profile_id: staff2.id,
      venue_id: venue.id,
      delta: 50,
      reason: 'Test: entry 3',
      created_by: staff2.id,
    });

    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff2.id)
      .single();

    expect(profile?.points_total).toBe(350); // 100 + 200 + 50
  }, 15000);
});
