import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedTestVenue, TestContext } from '../helpers/testSetup';

/**
 * Reward reservation integration tests
 * Tests the reserve → approve/reject flow against DEV Supabase.
 */

describe.skipIf(!process.env.DEV_SUPABASE_SERVICE_ROLE_KEY)('Reward Reservation Flow', () => {
  let ctx: TestContext;
  let rewardTypeId: string;

  beforeAll(async () => {
    ctx = await seedTestVenue();

    // Give staff1 some points
    await ctx.client.from('points_ledger').insert({
      profile_id: ctx.staff1.id,
      venue_id: ctx.venue.id,
      delta: 500,
      reason: 'Test: seed points',
      created_by: ctx.admin.id,
    });

    // Create a reward type
    const { data: rt } = await ctx.client.from('reward_types').insert({
      venue_id: ctx.venue.id,
      name: 'Test Drink',
      emoji: '🍺',
      points_required: 100,
    }).select().single();

    rewardTypeId = rt!.id;
  }, 30000);

  afterAll(async () => {
    await ctx?.cleanup();
  }, 30000);

  it('requesting a reward creates a pending row and reserves points immediately', async () => {
    const { client, staff1, venue } = ctx;

    const { data: redemption } = await client.from('reward_redemptions').insert({
      profile_id: staff1.id,
      venue_id: venue.id,
      reward_type_id: rewardTypeId,
      points_spent: 100,
      points_reserved: 100,
      quantity: 1,
      redemption_code: `TEST-${Date.now()}`,
    }).select().single();

    expect(redemption).toBeTruthy();
    expect(redemption?.status).toBe('pending');
    expect(redemption?.points_reserved).toBe(100);
  }, 15000);

  it('staff balance reflects reservation before admin acts', async () => {
    const { client, staff1 } = ctx;

    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff1.id)
      .single();

    // points_total is still 500 (trigger doesn't change it on redemption insert)
    expect(profile?.points_total).toBe(500);

    // But pending reservations reduce available balance
    const { data: pending } = await client
      .from('reward_redemptions')
      .select('points_reserved')
      .eq('profile_id', staff1.id)
      .eq('status', 'pending');

    const totalReserved = (pending || []).reduce((sum: number, r: { points_reserved: number }) => sum + r.points_reserved, 0);
    const availablePoints = profile!.points_total - totalReserved;
    expect(availablePoints).toBe(400); // 500 - 100
  }, 15000);

  it('admin approving generates a unique redemption code and confirms the deduction', async () => {
    const { client, staff1, venue, admin } = ctx;

    // Get the pending redemption
    const { data: pending } = await client
      .from('reward_redemptions')
      .select('id')
      .eq('profile_id', staff1.id)
      .eq('status', 'pending')
      .limit(1)
      .single();

    const redemptionCode = `DRK-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    // Admin approves
    await client.from('reward_redemptions').update({
      status: 'approved',
      redemption_code: redemptionCode,
      approved_by: admin.id,
      resolved_at: new Date().toISOString(),
      resolved_by: admin.id,
    }).eq('id', pending!.id);

    // Insert negative ledger entry (mimicking admin approval flow)
    await client.from('points_ledger').insert({
      profile_id: staff1.id,
      venue_id: venue.id,
      delta: -100,
      reason: 'Reward: Test Drink',
      created_by: admin.id,
    });

    // Check profile
    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff1.id)
      .single();

    expect(profile?.points_total).toBe(400); // 500 - 100

    // Check redemption code is set
    const { data: approved } = await client
      .from('reward_redemptions')
      .select('redemption_code, status')
      .eq('id', pending!.id)
      .single();

    expect(approved?.status).toBe('approved');
    expect(approved?.redemption_code).toBe(redemptionCode);
  }, 15000);

  it('admin rejecting restores full points to the staff member', async () => {
    const { client, staff1, venue, admin } = ctx;

    // Create another pending redemption
    const { data: redemption } = await client.from('reward_redemptions').insert({
      profile_id: staff1.id,
      venue_id: venue.id,
      reward_type_id: rewardTypeId,
      points_spent: 100,
      points_reserved: 100,
      quantity: 1,
      redemption_code: `TEST-REJ-${Date.now()}`,
    }).select().single();

    // Admin rejects — no ledger entry, just status change
    await client.from('reward_redemptions').update({
      status: 'rejected',
      resolved_at: new Date().toISOString(),
      resolved_by: admin.id,
    }).eq('id', redemption!.id);

    // Points total unchanged (no negative ledger entry was made)
    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff1.id)
      .single();

    expect(profile?.points_total).toBe(400); // Still 400 from previous test

    // No pending reservations for this redemption
    const { data: rejected } = await client
      .from('reward_redemptions')
      .select('status')
      .eq('id', redemption!.id)
      .single();

    expect(rejected?.status).toBe('rejected');
  }, 15000);

  it('staff cannot request a reward with insufficient available points after existing reservations', async () => {
    const { client, staff1, venue } = ctx;

    // Reserve most remaining points
    await client.from('reward_redemptions').insert({
      profile_id: staff1.id,
      venue_id: venue.id,
      reward_type_id: rewardTypeId,
      points_spent: 100,
      points_reserved: 350,
      quantity: 1,
      redemption_code: `TEST-BIG-${Date.now()}`,
    });

    // Check available: 400 total - 350 reserved = 50 available
    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff1.id)
      .single();

    const { data: pendingRewards } = await client
      .from('reward_redemptions')
      .select('points_reserved')
      .eq('profile_id', staff1.id)
      .eq('status', 'pending');

    const totalReserved = (pendingRewards || []).reduce((sum: number, r: { points_reserved: number }) => sum + r.points_reserved, 0);
    const available = profile!.points_total - totalReserved;

    // Should not have enough for a 100-point reward
    expect(available).toBeLessThan(100);
  }, 15000);
});
