// supabase/functions/admin-actions/index.ts
// Edge Function: Admin operations requiring service role key
// Keeps the service role key server-side — never exposed to the browser

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
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

        const pinHash = bcrypt.hashSync(pin, 10);

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
          updates.pin_hash = bcrypt.hashSync(pin, 10);
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

        const pinHash = bcrypt.hashSync(new_pin, 10);
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

        // Create profile row with pending status
        const { error: profileErr } = await adminClient.from('profiles').insert({
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

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${String(err)}` }, 500);
  }
});
