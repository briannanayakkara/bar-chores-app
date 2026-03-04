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

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${String(err)}` }, 500);
  }
});
