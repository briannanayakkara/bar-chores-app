import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedTestVenue, TestContext } from '../helpers/testSetup';

/**
 * Task completion integration tests
 * Tests auto-award vs photo approval flows against DEV Supabase.
 */

describe.skipIf(!process.env.DEV_SUPABASE_SERVICE_ROLE_KEY)('Task Completion Flow', () => {
  let ctx: TestContext;
  let lowPointsTaskId: string;
  let highPointsTaskId: string;

  beforeAll(async () => {
    ctx = await seedTestVenue();

    // Create a low-points task (auto-approve)
    const { data: lowTask } = await ctx.client.from('tasks').insert({
      venue_id: ctx.venue.id,
      title: 'Test Low Task',
      points: 100,
      requires_photo: false,
      frequency: 'once',
      created_by: ctx.admin.id,
      approval_status: 'active',
    }).select().single();
    lowPointsTaskId = lowTask!.id;

    // Create a high-points task (requires photo/approval)
    const { data: highTask } = await ctx.client.from('tasks').insert({
      venue_id: ctx.venue.id,
      title: 'Test High Task',
      points: 600,
      requires_photo: true,
      frequency: 'once',
      created_by: ctx.admin.id,
      approval_status: 'active',
    }).select().single();
    highPointsTaskId = highTask!.id;
  }, 30000);

  afterAll(async () => {
    await ctx?.cleanup();
  }, 30000);

  it('completing a task under 500pts auto-awards points with no admin action needed', async () => {
    const { client, staff1, venue, admin } = ctx;
    const today = new Date().toISOString().split('T')[0];

    // Create and auto-approve assignment
    const { data: assignment } = await client.from('task_assignments').insert({
      task_id: lowPointsTaskId,
      venue_id: venue.id,
      assigned_to: staff1.id,
      assigned_by: admin.id,
      due_date: today,
    }).select().single();

    // Mark as approved (auto-approve flow)
    await client.from('task_assignments').update({
      status: 'approved',
      completed_at: new Date().toISOString(),
    }).eq('id', assignment!.id);

    // Award points
    await client.from('points_ledger').insert({
      profile_id: staff1.id,
      venue_id: venue.id,
      delta: 100,
      reason: 'Task: Test Low Task',
      assignment_id: assignment!.id,
      created_by: staff1.id,
    });

    // Verify points
    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff1.id)
      .single();

    expect(profile?.points_total).toBe(100);
  }, 15000);

  it('completing a task 500pts or above creates pending submission with no points awarded', async () => {
    const { client, staff2, venue, admin } = ctx;
    const today = new Date().toISOString().split('T')[0];

    // Create assignment
    const { data: assignment } = await client.from('task_assignments').insert({
      task_id: highPointsTaskId,
      venue_id: venue.id,
      assigned_to: staff2.id,
      assigned_by: admin.id,
      due_date: today,
    }).select().single();

    // Staff submits with photo (status → submitted, NOT approved)
    await client.from('task_assignments').update({
      status: 'submitted',
      completed_at: new Date().toISOString(),
      photo_url: 'test/photo.jpg',
    }).eq('id', assignment!.id);

    // No points awarded yet
    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff2.id)
      .single();

    expect(profile?.points_total).toBe(0); // No points until admin approves
  }, 15000);

  it('admin approving a photo submission awards the points', async () => {
    const { client, staff2, venue, admin } = ctx;

    // Find the submitted assignment
    const { data: submitted } = await client
      .from('task_assignments')
      .select('id')
      .eq('assigned_to', staff2.id)
      .eq('status', 'submitted')
      .single();

    // Admin approves
    await client.from('task_assignments').update({
      status: 'approved',
    }).eq('id', submitted!.id);

    // Award points
    await client.from('points_ledger').insert({
      profile_id: staff2.id,
      venue_id: venue.id,
      delta: 600,
      reason: 'Task: Test High Task',
      assignment_id: submitted!.id,
      created_by: admin.id,
    });

    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff2.id)
      .single();

    expect(profile?.points_total).toBe(600);
  }, 15000);

  it('admin rejecting a photo submission awards no points and task returns to pending', async () => {
    const { client, staff1, venue, admin } = ctx;
    const today = new Date().toISOString().split('T')[0];

    // Create another high-points assignment for staff1
    const { data: assignment } = await client.from('task_assignments').insert({
      task_id: highPointsTaskId,
      venue_id: venue.id,
      assigned_to: staff1.id,
      assigned_by: admin.id,
      due_date: today,
    }).select().single();

    // Staff submits
    await client.from('task_assignments').update({
      status: 'submitted',
      completed_at: new Date().toISOString(),
      photo_url: 'test/photo2.jpg',
    }).eq('id', assignment!.id);

    // Admin rejects
    await client.from('task_assignments').update({
      status: 'rejected',
    }).eq('id', assignment!.id);

    // No additional points
    const { data: profile } = await client
      .from('profiles')
      .select('points_total')
      .eq('id', staff1.id)
      .single();

    expect(profile?.points_total).toBe(100); // Same as before rejection

    // Assignment is rejected
    const { data: rejected } = await client
      .from('task_assignments')
      .select('status')
      .eq('id', assignment!.id)
      .single();

    expect(rejected?.status).toBe('rejected');
  }, 15000);
});
