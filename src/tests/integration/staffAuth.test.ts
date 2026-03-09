import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedTestVenue, TestContext } from '../helpers/testSetup';

/**
 * Staff auth Edge Function integration tests
 * Tests the staff-auth function against DEV Supabase.
 */

const DEV_SUPABASE_URL = process.env.DEV_SUPABASE_URL || 'https://drwflvxdvwtjzuqxfort.supabase.co';

async function callStaffAuth(body: { username: string; pin: string; venue_id: string }) {
  const response = await fetch(`${DEV_SUPABASE_URL}/functions/v1/staff-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

describe.skipIf(!process.env.DEV_SUPABASE_SERVICE_ROLE_KEY)('Staff Auth Edge Function', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await seedTestVenue();
  }, 30000);

  afterAll(async () => {
    await ctx?.cleanup();
  }, 30000);

  it('correct username and PIN returns a valid token from the Edge Function', async () => {
    const result = await callStaffAuth({
      username: ctx.staff1.username!,
      pin: '1001', // PIN set in seedTestVenue for staff1
      venue_id: ctx.venue.id,
    });

    expect(result.status).toBe(200);
    expect(result.data.token_hash).toBeTruthy();
    expect(result.data.user).toBeTruthy();
    expect(result.data.user.id).toBe(ctx.staff1.id);
    expect(result.data.user.role).toBe('staff');
    expect(result.data.user.venue_id).toBe(ctx.venue.id);
  }, 15000);

  it('wrong PIN returns 401', async () => {
    const result = await callStaffAuth({
      username: ctx.staff1.username!,
      pin: '9999',
      venue_id: ctx.venue.id,
    });

    expect(result.status).toBe(401);
    expect(result.data.error).toContain('Invalid');
  }, 15000);

  it('non-existent user returns 401', async () => {
    const result = await callStaffAuth({
      username: 'nonexistent-user-xyz',
      pin: '1234',
      venue_id: ctx.venue.id,
    });

    expect(result.status).toBe(401);
    expect(result.data.error).toContain('Invalid');
  }, 15000);

  it('returned response contains correct user info', async () => {
    const result = await callStaffAuth({
      username: ctx.staff2.username!,
      pin: '1002', // PIN set in seedTestVenue for staff2
      venue_id: ctx.venue.id,
    });

    expect(result.status).toBe(200);
    expect(result.data.user.id).toBe(ctx.staff2.id);
    expect(result.data.user.venue_id).toBe(ctx.venue.id);
    expect(result.data.user.username).toBe(ctx.staff2.username);
  }, 15000);
});
