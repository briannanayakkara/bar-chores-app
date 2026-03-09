// supabase/functions/admin-actions/index.ts
// Edge Function: Admin operations requiring service role key
// Keeps the service role key server-side — never exposed to the browser

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, _status = 200) {
  // Always return 200 — supabase.functions.invoke() can't parse body on non-2xx.
  // Errors are indicated via { error: "..." } in the response body.
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Verify the caller is authenticated by checking their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    // Create a client with the caller's JWT to check their role
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !callerUser) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    // Look up the caller's profile to verify their role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('id, role, venue_id')
      .eq('id', callerUser.id)
      .single();

    if (!callerProfile) {
      return jsonResponse({ error: 'Profile not found for caller' }, 403);
    }

    const { action, ...params } = await req.json();

    // Route to the appropriate handler
    switch (action) {
      case 'create-admin': {
        if (callerProfile.role !== 'super_admin') {
          return jsonResponse({ error: 'Only super admins can create venue admins' }, 403);
        }
        const { email, password, display_name, venue_id } = params;
        if (!email || !password || !display_name || !venue_id) {
          return jsonResponse({ error: 'Missing required fields: email, password, display_name, venue_id' }, 400);
        }

        // Create auth user
        const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name },
        });
        if (createErr) {
          return jsonResponse({ error: `Auth user creation failed: ${createErr.message}` }, 400);
        }
        if (!createData.user) {
          return jsonResponse({ error: 'No user returned from createUser' }, 500);
        }

        // Create profile
        const { error: profileErr } = await adminClient.from('profiles').insert({
          id: createData.user.id,
          venue_id,
          role: 'venue_admin',
          email,
          display_name,
        });
        if (profileErr) {
          return jsonResponse({ error: `Profile creation failed: ${profileErr.message}` }, 500);
        }

        return jsonResponse({
          success: true,
          user_id: createData.user.id,
          message: `Admin "${email}" created`,
        });
      }

      case 'create-staff': {
        if (!['super_admin', 'venue_admin'].includes(callerProfile.role)) {
          return jsonResponse({ error: 'Only admins can create staff' }, 403);
        }
        const { username, display_name, pin, venue_id } = params;
        if (!username || !display_name || !pin || !venue_id) {
          return jsonResponse({ error: 'Missing required fields: username, display_name, pin, venue_id' }, 400);
        }
        // Venue admins can only create staff in their own venue
        if (callerProfile.role === 'venue_admin' && callerProfile.venue_id !== venue_id) {
          return jsonResponse({ error: 'Cannot create staff in another venue' }, 403);
        }
        if (pin.length < 4) {
          return jsonResponse({ error: 'PIN must be at least 4 digits' }, 400);
        }

        const pinHash = bcrypt.hashSync(String(pin), 10);

        // Check for duplicate username in this venue
        const { data: existing } = await adminClient
          .from('profiles')
          .select('id')
          .eq('venue_id', venue_id)
          .eq('username', username)
          .eq('role', 'staff')
          .maybeSingle();
        if (existing) {
          return jsonResponse({ error: `Username "${username}" already exists in this venue` }, 400);
        }

        // Create a Supabase Auth user for proper session/RLS support
        const staffEmail = `staff_${crypto.randomUUID().slice(0, 8)}@${venue_id}.internal`;
        const staffPassword = crypto.randomUUID(); // random, never used directly
        const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
          email: staffEmail,
          password: staffPassword,
          email_confirm: true,
        });
        if (authErr || !authData.user) {
          return jsonResponse({ error: `Auth user creation failed: ${authErr?.message || 'No user returned'}` }, 500);
        }

        const { error: profileErr } = await adminClient.from('profiles').insert({
          id: authData.user.id,
          venue_id,
          role: 'staff',
          username,
          display_name,
          pin_hash: pinHash,
          email: staffEmail,
        });
        if (profileErr) {
          // Clean up the auth user if profile creation fails
          await adminClient.auth.admin.deleteUser(authData.user.id);
          return jsonResponse({ error: `Staff creation failed: ${profileErr.message}` }, 500);
        }

        return jsonResponse({
          success: true,
          user_id: authData.user.id,
          message: `Staff "${display_name}" created`,
        });
      }

      case 'update-staff': {
        if (!['super_admin', 'venue_admin'].includes(callerProfile.role)) {
          return jsonResponse({ error: 'Only admins can update staff' }, 403);
        }
        const { staff_id, username, display_name, pin } = params;
        if (!staff_id) {
          return jsonResponse({ error: 'Missing staff_id' }, 400);
        }

        const updates: Record<string, unknown> = {};
        if (username) updates.username = username;
        if (display_name) updates.display_name = display_name;
        if (pin) {
          if (pin.length < 4) {
            return jsonResponse({ error: 'PIN must be at least 4 digits' }, 400);
          }
          updates.pin_hash = bcrypt.hashSync(String(pin), 10);
        }

        const { error: updateErr } = await adminClient
          .from('profiles')
          .update(updates)
          .eq('id', staff_id);
        if (updateErr) {
          return jsonResponse({ error: `Update failed: ${updateErr.message}` }, 500);
        }

        return jsonResponse({ success: true, message: 'Staff updated' });
      }

      case 'reset-pin': {
        if (!['super_admin', 'venue_admin'].includes(callerProfile.role)) {
          return jsonResponse({ error: 'Only admins can reset PINs' }, 403);
        }
        const { staff_id, new_pin } = params;
        if (!staff_id || !new_pin) {
          return jsonResponse({ error: 'Missing staff_id or new_pin' }, 400);
        }
        if (new_pin.length < 4) {
          return jsonResponse({ error: 'PIN must be at least 4 digits' }, 400);
        }

        const pinHash = bcrypt.hashSync(String(new_pin), 10);
        const { error: updateErr } = await adminClient
          .from('profiles')
          .update({ pin_hash: pinHash })
          .eq('id', staff_id);
        if (updateErr) {
          return jsonResponse({ error: `PIN reset failed: ${updateErr.message}` }, 500);
        }

        return jsonResponse({ success: true, message: 'PIN reset' });
      }

      case 'delete-staff': {
        if (!['super_admin', 'venue_admin'].includes(callerProfile.role)) {
          return jsonResponse({ error: 'Only admins can delete staff' }, 403);
        }
        const { staff_id } = params;
        if (!staff_id) {
          return jsonResponse({ error: 'Missing staff_id' }, 400);
        }

        // Delete related records in FK order
        await adminClient.from('reward_redemptions').delete().eq('profile_id', staff_id);
        await adminClient.from('points_ledger').delete().eq('profile_id', staff_id);
        await adminClient.from('task_assignments').delete().eq('assigned_to', staff_id);
        const { error: delErr } = await adminClient.from('profiles').delete().eq('id', staff_id);
        if (delErr) {
          return jsonResponse({ error: `Delete failed: ${delErr.message}` }, 500);
        }
        // Also delete the Supabase Auth user
        await adminClient.auth.admin.deleteUser(staff_id).catch(() => {});

        return jsonResponse({ success: true, message: 'Staff deleted' });
      }

      case 'invite-admin': {
        // Super admins can invite to any venue; venue admins only to their own
        if (callerProfile.role === 'venue_admin' && callerProfile.venue_id !== params.venue_id) {
          return jsonResponse({ error: 'Cannot invite admins to another venue' }, 403);
        }
        if (!['super_admin', 'venue_admin'].includes(callerProfile.role)) {
          return jsonResponse({ error: 'Only admins can invite other admins' }, 403);
        }

        const { email, display_name, venue_id } = params;
        if (!email || !display_name || !venue_id) {
          return jsonResponse({ error: 'Missing required fields: email, display_name, venue_id' }, 400);
        }

        // Determine the redirect URL from the request origin
        const origin = req.headers.get('origin') || 'https://bar-chores-app.vercel.app';
        const redirectTo = `${origin}/auth/callback`;

        // Check if a profile already exists for this email (e.g. from create-admin flow)
        const { data: existingProfile } = await adminClient
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        // Send invite email via Supabase Auth admin API
        const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
          email as string,
          {
            redirectTo,
            data: { display_name, venue_id, role: 'venue_admin' },
          }
        );

        if (inviteErr) {
          return jsonResponse({ error: `Invite failed: ${inviteErr.message}` }, 400);
        }
        if (!inviteData.user) {
          return jsonResponse({ error: 'No user returned from invite' }, 500);
        }

        if (existingProfile && existingProfile.id !== inviteData.user.id) {
          // Profile exists with different ID — migrate FK references and update profile ID
          const oldId = existingProfile.id;
          const newId = inviteData.user.id;
          await adminClient.from('tasks').update({ created_by: newId }).eq('created_by', oldId);
          await adminClient.from('tasks').update({ proposed_by: newId }).eq('proposed_by', oldId);
          await adminClient.from('task_assignments').update({ assigned_by: newId }).eq('assigned_by', oldId);
          await adminClient.from('task_assignments').update({ assigned_to: newId }).eq('assigned_to', oldId);
          await adminClient.from('points_ledger').update({ created_by: newId }).eq('created_by', oldId);
          await adminClient.from('points_ledger').update({ profile_id: newId }).eq('profile_id', oldId);
          await adminClient.from('reward_redemptions').update({ approved_by: newId }).eq('approved_by', oldId);
          await adminClient.from('reward_redemptions').update({ profile_id: newId }).eq('profile_id', oldId);
          // Delete old profile, create new one with correct ID
          await adminClient.from('profiles').delete().eq('id', oldId);
          // Delete orphaned auth user if it exists
          await adminClient.auth.admin.deleteUser(oldId).catch(() => {});
        }

        // Create or upsert profile row with pending status
        const { error: profileErr } = await adminClient.from('profiles').upsert({
          id: inviteData.user.id,
          venue_id,
          role: 'venue_admin',
          email,
          display_name,
          status: 'pending',
        });

        if (profileErr) {
          return jsonResponse({ error: `Profile creation failed: ${profileErr.message}` }, 500);
        }

        return jsonResponse({
          success: true,
          user_id: inviteData.user.id,
          message: `Invite sent to ${email}`,
        });
      }

      case 'resend-invite': {
        if (!['super_admin', 'venue_admin'].includes(callerProfile.role)) {
          return jsonResponse({ error: 'Only admins can resend invites' }, 403);
        }

        const { user_id } = params;
        if (!user_id) {
          return jsonResponse({ error: 'Missing user_id' }, 400);
        }

        // Look up the pending profile
        const { data: pendingProfile } = await adminClient
          .from('profiles')
          .select('id, email, venue_id, status')
          .eq('id', user_id)
          .single();

        if (!pendingProfile) {
          return jsonResponse({ error: 'User not found' }, 404);
        }
        if (pendingProfile.status !== 'pending') {
          return jsonResponse({ error: 'User has already accepted their invite' }, 400);
        }

        // Venue admins can only resend for their own venue
        if (callerProfile.role === 'venue_admin' && callerProfile.venue_id !== pendingProfile.venue_id) {
          return jsonResponse({ error: 'Cannot resend invites for another venue' }, 403);
        }

        const origin = req.headers.get('origin') || 'https://bar-chores-app.vercel.app';
        const redirectTo = `${origin}/auth/callback`;

        // Generate a new invite link
        const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
          pendingProfile.email as string,
          { redirectTo }
        );

        if (inviteErr) {
          return jsonResponse({ error: `Resend failed: ${inviteErr.message}` }, 400);
        }

        return jsonResponse({ success: true, message: `Invite resent to ${pendingProfile.email}` });
      }

      case 'cancel-invite': {
        if (!['super_admin', 'venue_admin'].includes(callerProfile.role)) {
          return jsonResponse({ error: 'Only admins can cancel invites' }, 403);
        }

        const { user_id } = params;
        if (!user_id) {
          return jsonResponse({ error: 'Missing user_id' }, 400);
        }

        // Look up the pending profile
        const { data: pendingProfile } = await adminClient
          .from('profiles')
          .select('id, venue_id, status')
          .eq('id', user_id)
          .single();

        if (!pendingProfile) {
          return jsonResponse({ error: 'User not found' }, 404);
        }
        if (pendingProfile.status !== 'pending') {
          return jsonResponse({ error: 'Cannot cancel — user has already accepted' }, 400);
        }

        // Venue admins can only cancel for their own venue
        if (callerProfile.role === 'venue_admin' && callerProfile.venue_id !== pendingProfile.venue_id) {
          return jsonResponse({ error: 'Cannot cancel invites for another venue' }, 403);
        }

        // Delete profile then auth user
        await adminClient.from('profiles').delete().eq('id', user_id);
        await adminClient.auth.admin.deleteUser(user_id as string).catch(() => {});

        return jsonResponse({ success: true, message: 'Invite cancelled' });
      }

      case 'unassign-admin': {
        if (callerProfile.role !== 'super_admin') {
          return jsonResponse({ error: 'Only super admins can unassign venue admins' }, 403);
        }

        const { admin_id } = params;
        if (!admin_id) {
          return jsonResponse({ error: 'Missing admin_id' }, 400);
        }

        // Verify target is a venue_admin with a venue
        const { data: targetProfile } = await adminClient
          .from('profiles')
          .select('id, role, venue_id, email, display_name')
          .eq('id', admin_id)
          .single();

        if (!targetProfile) {
          return jsonResponse({ error: 'Admin not found' }, 404);
        }
        if (targetProfile.role !== 'venue_admin') {
          return jsonResponse({ error: 'Target is not a venue admin' }, 400);
        }
        if (!targetProfile.venue_id) {
          return jsonResponse({ error: 'Admin is already unassigned' }, 400);
        }

        // Ensure venue keeps at least 1 admin
        const { count } = await adminClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', targetProfile.venue_id)
          .eq('role', 'venue_admin');

        if ((count ?? 0) <= 1) {
          return jsonResponse({ error: 'Cannot unassign — venue must have at least one admin' }, 400);
        }

        // Unassign: set venue_id to null
        const { error: updateErr } = await adminClient
          .from('profiles')
          .update({ venue_id: null })
          .eq('id', admin_id);

        if (updateErr) {
          return jsonResponse({ error: `Unassign failed: ${updateErr.message}` }, 500);
        }

        return jsonResponse({
          success: true,
          message: `Admin "${targetProfile.display_name || targetProfile.email}" unassigned`,
        });
      }

      case 'assign-admin': {
        if (callerProfile.role !== 'super_admin') {
          return jsonResponse({ error: 'Only super admins can assign venue admins' }, 403);
        }

        const { admin_id, venue_id } = params;
        if (!admin_id || !venue_id) {
          return jsonResponse({ error: 'Missing admin_id or venue_id' }, 400);
        }

        // Verify target is a venue_admin
        const { data: targetProfile } = await adminClient
          .from('profiles')
          .select('id, role, display_name, email')
          .eq('id', admin_id)
          .single();

        if (!targetProfile) {
          return jsonResponse({ error: 'Admin not found' }, 404);
        }
        if (targetProfile.role !== 'venue_admin') {
          return jsonResponse({ error: 'Target is not a venue admin' }, 400);
        }

        // Assign to venue
        const { error: updateErr } = await adminClient
          .from('profiles')
          .update({ venue_id })
          .eq('id', admin_id);

        if (updateErr) {
          return jsonResponse({ error: `Assign failed: ${updateErr.message}` }, 500);
        }

        return jsonResponse({
          success: true,
          message: `Admin "${targetProfile.display_name || targetProfile.email}" assigned to venue`,
        });
      }

      case 'reset-database': {
        if (callerProfile.role !== 'super_admin') {
          return jsonResponse({ error: 'Only super admins can reset the database' }, 403);
        }

        const counts: Record<string, number> = {};

        // Step 1: Delete all data in FK order
        await adminClient.from('reward_redemptions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await adminClient.from('points_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await adminClient.from('task_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await adminClient.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await adminClient.from('reward_types').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Delete all non-super-admin profiles and their auth users
        const { data: nonSuperProfiles } = await adminClient
          .from('profiles')
          .select('id')
          .neq('role', 'super_admin');
        if (nonSuperProfiles) {
          for (const p of nonSuperProfiles) {
            await adminClient.from('profiles').delete().eq('id', p.id);
            await adminClient.auth.admin.deleteUser(p.id).catch(() => {});
          }
          counts.deleted_profiles = nonSuperProfiles.length;
        }

        await adminClient.from('venue_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await adminClient.from('venues').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Step 2: Also clean up any orphaned auth users (not super admin)
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        if (authUsers?.users) {
          for (const u of authUsers.users) {
            if (u.id !== callerUser.id) {
              await adminClient.auth.admin.deleteUser(u.id).catch(() => {});
            }
          }
        }

        // Step 3: Seed venues
        const { data: venues } = await adminClient.from('venues').insert([
          { name: 'Little Green Door', address: 'Gammel Strand 40, 1202 København', slug: 'little-green-door' },
          { name: 'KOKO', address: 'Studiestræde 7, København', slug: 'koko' },
        ]).select();
        counts.venues = venues?.length ?? 0;

        if (!venues || venues.length < 2) {
          return jsonResponse({ error: 'Failed to create venues' }, 500);
        }

        const lgdId = venues[0].id;
        const kokoId = venues[1].id;

        // Step 4: Seed admins (create auth users + profiles)
        const adminSeeds = [
          { email: 'brian@rekom.dk', password: 'Admin1234!', display_name: 'Brian', venue_id: lgdId },
          { email: 'bn@rekom.dk', password: 'Admin1234!', display_name: 'BN', venue_id: kokoId },
        ];

        for (const admin of adminSeeds) {
          const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
            email: admin.email,
            password: admin.password,
            email_confirm: true,
            user_metadata: { display_name: admin.display_name },
          });
          if (authErr || !authData.user) continue;
          await adminClient.from('profiles').insert({
            id: authData.user.id,
            venue_id: admin.venue_id,
            role: 'venue_admin',
            email: admin.email,
            display_name: admin.display_name,
          });
        }
        counts.admins = adminSeeds.length;

        // Step 5: Seed staff (create auth users + profiles with bcrypt PINs)
        const staffSeeds = [
          { username: 'jake.lgd', display_name: 'Jake Murphy', pin: '1234', venue_id: lgdId },
          { username: 'sofia.lgd', display_name: 'Sofia Andersen', pin: '2345', venue_id: lgdId },
          { username: 'marcus.lgd', display_name: 'Marcus Nielsen', pin: '3456', venue_id: lgdId },
          { username: 'ella.lgd', display_name: 'Ella Christensen', pin: '4567', venue_id: lgdId },
          { username: 'liam.lgd', display_name: 'Liam Jensen', pin: '5678', venue_id: lgdId },
          { username: 'noah.koko', display_name: 'Noah Hansen', pin: '1111', venue_id: kokoId },
          { username: 'mia.koko', display_name: 'Mia Pedersen', pin: '2222', venue_id: kokoId },
          { username: 'oscar.koko', display_name: 'Oscar Larsen', pin: '3333', venue_id: kokoId },
          { username: 'freya.koko', display_name: 'Freya Møller', pin: '4444', venue_id: kokoId },
          { username: 'emil.koko', display_name: 'Emil Thomsen', pin: '5555', venue_id: kokoId },
        ];

        for (const staff of staffSeeds) {
          const staffEmail = `staff_${staff.username.replace('.', '_')}@${staff.venue_id}.internal`;
          const staffPassword = crypto.randomUUID();
          const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
            email: staffEmail,
            password: staffPassword,
            email_confirm: true,
          });
          if (authErr || !authData.user) continue;

          const pinHash = bcrypt.hashSync(String(staff.pin), 10);
          await adminClient.from('profiles').insert({
            id: authData.user.id,
            venue_id: staff.venue_id,
            role: 'staff',
            username: staff.username,
            display_name: staff.display_name,
            pin_hash: pinHash,
            email: staffEmail,
          });
        }
        counts.staff = staffSeeds.length;

        // Step 6: Seed reward types (4 per venue)
        const rewardTypeSeeds = [lgdId, kokoId].flatMap(venueId => [
          { venue_id: venueId, name: 'Drink Ticket', emoji: '🍺', points_required: 100 },
          { venue_id: venueId, name: 'Tote Bag', emoji: '👜', points_required: 500 },
          { venue_id: venueId, name: 'Bottle Ticket', emoji: '🍾', points_required: 1000 },
          { venue_id: venueId, name: 'Hoodie', emoji: '👕', points_required: 2000 },
        ]);
        await adminClient.from('reward_types').insert(rewardTypeSeeds);
        counts.reward_types = rewardTypeSeeds.length;

        // Step 7: Seed tasks
        const lgdTasks = [
          { title: 'Open Bar Setup', description: 'Set up all bottles, garnishes and tools before opening', points: 100, requires_photo: false, frequency: 'daily' },
          { title: 'Polish All Glassware', description: 'Polish every glass and ensure no smudges or watermarks', points: 75, requires_photo: false, frequency: 'daily' },
          { title: 'Clean Coffee Machine', description: 'Full clean and descale of the espresso machine', points: 150, requires_photo: true, frequency: 'daily' },
          { title: 'Restock Beer Fridge', description: 'Ensure all beers are stocked, rotated and cold', points: 100, requires_photo: false, frequency: 'daily' },
          { title: 'Wipe Down All Surfaces', description: 'Clean and sanitise all bar surfaces and countertops', points: 80, requires_photo: false, frequency: 'daily' },
          { title: 'Mop Bar Floor', description: 'Mop the entire bar floor including behind the bar', points: 120, requires_photo: false, frequency: 'daily' },
          { title: 'Empty All Bins', description: 'Empty all bins and replace liners throughout the venue', points: 80, requires_photo: false, frequency: 'daily' },
          { title: 'Deep Clean Ice Machine', description: 'Full clean and sanitise the ice machine', points: 500, requires_photo: true, frequency: 'monthly' },
          { title: 'Restock Spirits', description: 'Check and restock all spirit levels on the back bar', points: 100, requires_photo: false, frequency: 'daily' },
          { title: 'Clean Fridges', description: 'Full clean of all bar fridges inside and out', points: 600, requires_photo: true, frequency: 'monthly' },
          { title: 'Check and Restock Mixers', description: 'Ensure all mixers, sodas and juices are stocked', points: 75, requires_photo: false, frequency: 'daily' },
          { title: 'Organise Stock Room', description: 'Organise and label all stock in the back room', points: 400, requires_photo: true, frequency: 'weekly' },
          { title: 'Clean Toilets', description: 'Full clean of all customer toilets', points: 150, requires_photo: true, frequency: 'daily' },
          { title: 'Wipe Down Menus', description: 'Clean and sanitise all menus and table cards', points: 50, requires_photo: false, frequency: 'daily' },
          { title: 'End of Night Cash Up', description: 'Count the till and prepare the cash up report', points: 200, requires_photo: false, frequency: 'daily' },
          { title: 'Close Bar Checklist', description: 'Complete the full closing checklist for the bar', points: 150, requires_photo: false, frequency: 'daily' },
          { title: 'Restock Paper Products', description: 'Restock napkins, straws, coasters throughout', points: 60, requires_photo: false, frequency: 'daily' },
          { title: 'Check Expiry Dates', description: 'Check all perishables and remove anything expired', points: 100, requires_photo: false, frequency: 'weekly' },
          { title: 'Deep Clean Drains', description: 'Full clean of all bar drains with cleaning solution', points: 700, requires_photo: true, frequency: 'monthly' },
          { title: 'Wash Bar Mats', description: 'Remove, wash and dry all rubber bar mats', points: 200, requires_photo: true, frequency: 'weekly' },
        ];

        const kokoTasks = [
          { title: 'Open Venue Setup', description: 'Set up all areas before doors open', points: 100, requires_photo: false, frequency: 'daily' },
          { title: 'Sound System Check', description: 'Test all speakers, mics and sound levels', points: 150, requires_photo: false, frequency: 'daily' },
          { title: 'Clean DJ Booth', description: 'Wipe down DJ booth, controller and equipment', points: 200, requires_photo: true, frequency: 'daily' },
          { title: 'Restock Bar Fridges', description: 'Stock all fridges with drinks and check rotation', points: 100, requires_photo: false, frequency: 'daily' },
          { title: 'Polish Bar Surfaces', description: 'Clean and polish all bar surfaces to a shine', points: 80, requires_photo: false, frequency: 'daily' },
          { title: 'Set Up VIP Area', description: 'Arrange VIP seating, bottles and table setup', points: 150, requires_photo: false, frequency: 'daily' },
          { title: 'Mop Dance Floor', description: 'Mop and clean the entire dance floor area', points: 120, requires_photo: false, frequency: 'daily' },
          { title: 'Empty All Bins', description: 'Empty all bins and replace liners', points: 80, requires_photo: false, frequency: 'daily' },
          { title: 'Restock Spirits and Mixers', description: 'Check and restock all spirits and mixers', points: 100, requires_photo: false, frequency: 'daily' },
          { title: 'Deep Clean Toilets', description: 'Full deep clean of all toilets and restrooms', points: 200, requires_photo: true, frequency: 'daily' },
          { title: 'Check Lighting Rig', description: 'Test all lights, strobes and effects', points: 150, requires_photo: false, frequency: 'daily' },
          { title: 'Clean Ice Machines', description: 'Full clean and sanitise all ice machines', points: 500, requires_photo: true, frequency: 'monthly' },
          { title: 'Organise Back of House', description: 'Clean and organise the entire back of house area', points: 400, requires_photo: true, frequency: 'weekly' },
          { title: 'Wipe Down All Seating', description: 'Clean and sanitise all seats, booths and surfaces', points: 100, requires_photo: false, frequency: 'daily' },
          { title: 'Restock Coat Check', description: 'Organise and restock coat check area', points: 75, requires_photo: false, frequency: 'daily' },
          { title: 'End of Night Sweep', description: 'Full sweep and mop of all areas after closing', points: 150, requires_photo: false, frequency: 'daily' },
          { title: 'Cash Up and Reports', description: 'Complete till count and nightly reports', points: 200, requires_photo: false, frequency: 'daily' },
          { title: 'Deep Clean Bar Fridges', description: 'Full internal clean of all bar fridges', points: 600, requires_photo: true, frequency: 'monthly' },
          { title: 'Check Fire Exits', description: 'Check all fire exits are clear and signage is correct', points: 100, requires_photo: false, frequency: 'weekly' },
          { title: 'Restock Paper and Sundries', description: 'Restock napkins, straws, coasters, toilet paper', points: 60, requires_photo: false, frequency: 'daily' },
        ];

        // We need a created_by for tasks — use the first admin profile for each venue
        const { data: lgdAdmin } = await adminClient.from('profiles').select('id').eq('venue_id', lgdId).eq('role', 'venue_admin').limit(1).single();
        const { data: kokoAdmin } = await adminClient.from('profiles').select('id').eq('venue_id', kokoId).eq('role', 'venue_admin').limit(1).single();

        if (lgdAdmin) {
          await adminClient.from('tasks').insert(
            lgdTasks.map(t => ({ ...t, venue_id: lgdId, created_by: lgdAdmin.id, approval_status: 'active' }))
          );
        }
        if (kokoAdmin) {
          await adminClient.from('tasks').insert(
            kokoTasks.map(t => ({ ...t, venue_id: kokoId, created_by: kokoAdmin.id, approval_status: 'active' }))
          );
        }
        counts.tasks = lgdTasks.length + kokoTasks.length;

        // Step 8: Seed task assignments (1 per staff member)
        const { data: allStaff } = await adminClient.from('profiles').select('id, venue_id').eq('role', 'staff');
        if (allStaff) {
          for (const staff of allStaff) {
            // Get the first task for their venue
            const { data: firstTask } = await adminClient.from('tasks')
              .select('id')
              .eq('venue_id', staff.venue_id)
              .limit(1)
              .single();
            if (!firstTask) continue;

            const adminId = staff.venue_id === lgdId ? lgdAdmin?.id : kokoAdmin?.id;
            if (!adminId) continue;

            await adminClient.from('task_assignments').insert({
              task_id: firstTask.id,
              venue_id: staff.venue_id,
              assigned_to: staff.id,
              assigned_by: adminId,
              due_date: new Date().toISOString().split('T')[0],
            });
          }
          counts.task_assignments = allStaff.length;
        }

        return jsonResponse({
          success: true,
          message: `Database reset complete! Seeded: ${counts.venues} venues, ${counts.admins} admins, ${counts.staff} staff, ${counts.reward_types} reward types, ${counts.tasks} tasks, ${counts.task_assignments} assignments.`,
          counts,
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${String(err)}` }, 500);
  }
});
