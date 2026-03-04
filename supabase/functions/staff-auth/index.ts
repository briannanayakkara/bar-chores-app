// supabase/functions/staff-auth/index.ts
// Edge Function: Staff PIN authentication
// Receives { username, pin, venue_id } → bcrypt verify → returns magic link token
// Frontend exchanges the token via supabase.auth.verifyOtp() for a proper session

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { username, pin, venue_id } = await req.json();

    if (!username || !pin || !venue_id) {
      return jsonResponse({ error: 'Missing required fields: username, pin, venue_id' }, 400);
    }

    // Use service role to bypass RLS for auth lookup
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up staff profile by username scoped to venue
    const { data: profile, error } = await adminClient
      .from('profiles')
      .select('id, pin_hash, role, venue_id, display_name, username, email')
      .eq('username', username)
      .eq('venue_id', venue_id)
      .eq('role', 'staff')
      .single();

    if (error || !profile) {
      return jsonResponse({ error: 'Invalid username or PIN' }, 401);
    }

    if (!profile.pin_hash) {
      return jsonResponse({ error: 'PIN not set for this account' }, 401);
    }

    // Verify PIN against bcrypt hash (use Sync — async uses Workers which crash on Deno Deploy)
    const pinValid = bcrypt.compareSync(pin, profile.pin_hash);

    if (!pinValid) {
      return jsonResponse({ error: 'Invalid username or PIN' }, 401);
    }

    if (!profile.email) {
      return jsonResponse({ error: 'Staff account not properly configured (missing email)' }, 500);
    }

    // Generate a magic link token for this staff member's auth user
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    });

    if (linkErr || !linkData) {
      return jsonResponse({ error: `Session generation failed: ${linkErr?.message || 'No link returned'}` }, 500);
    }

    return jsonResponse({
      token_hash: linkData.properties.hashed_token,
      user: {
        id: profile.id,
        venue_id: profile.venue_id,
        username: profile.username,
        display_name: profile.display_name,
        role: 'staff',
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Internal server error: ${String(err)}` }, 500);
  }
});
