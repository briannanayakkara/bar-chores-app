# Admin Auth Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build complete user creation (invite email) and password reset flow for Super Admin and Venue Admin accounts.

**Architecture:** New auth pages handle Supabase email callbacks. The existing `admin-actions` Edge Function gains an `invite-admin` action. A new `status` column on `profiles` tracks invite state. All service-role operations stay server-side in Edge Functions.

**Tech Stack:** React + TypeScript, Supabase Auth (inviteUserByEmail, resetPasswordForEmail, updateUser), Supabase Edge Functions (Deno), Supabase Management API (curl), Tailwind CSS.

---

## Task 1: Configure Supabase Auth URLs via Management API

**Goal:** Set Site URL and redirect URLs for both PROD and DEV Supabase projects.

**Step 1: Guide user to create Supabase personal access token**

1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Name it "CLI access" — copy the token
4. Store it temporarily (it won't be committed anywhere)

**Step 2: Update DEV Supabase auth config**

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/drwflvxdvwtjzuqxfort/config/auth" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://bar-chores-dev.vercel.app",
    "uri_allow_list": "https://bar-chores-dev.vercel.app/auth/callback,https://bar-chores-dev.vercel.app/auth/set-password,http://localhost:5173/auth/callback,http://localhost:5173/auth/set-password"
  }'
```

Expected: `200 OK` with updated config.

**Step 3: Update PROD Supabase auth config**

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/sepcdjmwdfjjieaxqoqn/config/auth" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://bar-chores-app.vercel.app",
    "uri_allow_list": "https://bar-chores-app.vercel.app/auth/callback,https://bar-chores-app.vercel.app/auth/set-password"
  }'
```

Expected: `200 OK` with updated config.

**Step 4: Verify both configs**

```bash
curl "https://api.supabase.com/v1/projects/drwflvxdvwtjzuqxfort/config/auth" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" | jq '{site_url, uri_allow_list}'

curl "https://api.supabase.com/v1/projects/sepcdjmwdfjjieaxqoqn/config/auth" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" | jq '{site_url, uri_allow_list}'
```

**Step 5: Commit** — No code changes for this task. Just config.

---

## Task 2: Add `status` column to `profiles` table

**Files:**
- Create: `supabase/migrations/005_profile_status.sql`
- Modify: `src/types/database.ts:28-41`

**Step 1: Write the migration SQL**

Create `supabase/migrations/005_profile_status.sql`:

```sql
-- Add status column to profiles for invite tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Set all existing profiles to active
UPDATE profiles SET status = 'active' WHERE status IS NULL;

-- Add check constraint for valid values
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending', 'active', 'inactive'));
```

**Step 2: Apply migration to DEV via Management API**

```bash
curl -X POST "https://api.supabase.com/v1/projects/drwflvxdvwtjzuqxfort/database/query" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"query": "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT '\''active'\''; UPDATE profiles SET status = '\''active'\'' WHERE status IS NULL; ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('\''pending'\'', '\''active'\'', '\''inactive'\''));"}'
```

**Step 3: Update the Profile TypeScript type**

Modify `src/types/database.ts`. Add after line 40 (`created_at: string;`):

```typescript
export type ProfileStatus = 'pending' | 'active' | 'inactive';

export interface Profile {
  id: string;
  venue_id: string | null;
  role: UserRole;
  username: string | null;
  display_name: string | null;
  pin_hash: string | null;
  email: string | null;
  avatar_type: AvatarType | null;
  avatar_url: string | null;
  avatar_config: Record<string, unknown> | null;
  points_total: number;
  status: ProfileStatus;
  created_at: string;
}
```

**Step 4: Commit**

```bash
git add supabase/migrations/005_profile_status.sql src/types/database.ts
git commit -m "feat: add status column to profiles for invite tracking"
```

---

## Task 3: Create `AuthCallback` page

**Files:**
- Create: `src/pages/auth/AuthCallback.tsx`

This page handles the redirect from Supabase email links (invite, recovery, signup).

**Step 1: Create the AuthCallback component**

Create `src/pages/auth/AuthCallback.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      // Supabase puts tokens in the URL hash after email link click
      // supabase.auth.getSession() will pick up the hash automatically
      // after exchangeCodeForSession is called internally
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const type = params.get('type');
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');

      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      // Also check URL search params (some Supabase versions use query params)
      const searchParams = new URLSearchParams(window.location.search);
      const searchType = searchParams.get('type');
      const searchError = searchParams.get('error');
      const searchErrorDesc = searchParams.get('error_description');

      if (searchError) {
        setError(searchErrorDesc || searchError);
        return;
      }

      const effectiveType = type || searchType;

      // Let Supabase handle the token exchange
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (!session) {
        // Try to exchange the code if present
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError(exchangeError.message);
            return;
          }
        } else {
          setError('No valid session or code found. This link may have expired.');
          return;
        }
      }

      // Route based on type
      if (effectiveType === 'invite' || effectiveType === 'recovery') {
        navigate('/auth/set-password', { replace: true, state: { type: effectiveType } });
      } else if (effectiveType === 'signup') {
        navigate('/login', { replace: true });
      } else {
        // Default: if we have a session, go to set-password (likely an invite)
        navigate('/auth/set-password', { replace: true, state: { type: 'invite' } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Link Error</h1>
          <p className="text-slate-300 mb-6">{error}</p>
          <a
            href="/auth/forgot-password"
            className="inline-block px-6 py-3 bg-primary text-slate-900 font-semibold rounded-lg hover:bg-primary/90 transition-colors min-h-[48px]"
          >
            Request a New Link
          </a>
          <p className="mt-4">
            <a href="/login" className="text-accent hover:underline text-sm">Back to login</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-300">Verifying your link...</p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/auth/AuthCallback.tsx
git commit -m "feat: add AuthCallback page for email link handling"
```

---

## Task 4: Create `SetPassword` page

**Files:**
- Create: `src/pages/auth/SetPassword.tsx`

**Step 1: Create the SetPassword component**

Create `src/pages/auth/SetPassword.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length < 8) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' };
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const score = [hasUpper, hasLower, hasNumber, pw.length >= 12].filter(Boolean).length;
  if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' };
  if (score === 3) return { label: 'Medium', color: 'bg-yellow-500', width: 'w-2/3' };
  return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must include a lowercase letter';
  if (!/\d/.test(pw)) return 'Password must include a number';
  return null;
}

export default function SetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const type = (location.state as { type?: string })?.type || 'invite';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);
  const isInvite = type === 'invite';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validatePassword(password);
    if (validationError) { setError(validationError); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      if (updateError.message.includes('expired') || updateError.message.includes('invalid')) {
        setError('This link has expired. Please request a new one.');
      } else {
        setError(updateError.message);
      }
      return;
    }

    // If this is an invite, update profile status to active
    if (isInvite) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ status: 'active' }).eq('id', user.id);
      }
    }

    // Sign out so user logs in fresh with their new password
    await supabase.auth.signOut();
    setSuccess(true);
    setTimeout(() => navigate('/login', { replace: true }), 3000);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Password Set!</h1>
          <p className="text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-1">Bar Chores</h1>
          <h2 className="text-xl text-white">
            {isInvite ? 'Set Your Password' : 'Reset Your Password'}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {isInvite ? 'Welcome! Create a password for your account.' : 'Enter your new password below.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
              {error.includes('expired') && (
                <a href="/auth/forgot-password" className="block mt-2 text-accent hover:underline">
                  Request a new link
                </a>
              )}
            </div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                placeholder="Min 8 characters"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
            {/* Strength indicator */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300 rounded-full`} />
                </div>
                <p className={`text-xs mt-1 ${strength.color.replace('bg-', 'text-')}`}>{strength.label}</p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                placeholder="Re-enter password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showConfirm ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-slate-900 font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[48px]"
          >
            {loading ? 'Setting password...' : isInvite ? 'Set Password' : 'Reset Password'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-500">
          <a href="/login" className="text-accent hover:underline">Back to login</a>
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/auth/SetPassword.tsx
git commit -m "feat: add SetPassword page with strength indicator and validation"
```

---

## Task 5: Create `ForgotPassword` page

**Files:**
- Create: `src/pages/auth/ForgotPassword.tsx`

**Step 1: Create the ForgotPassword component**

Create `src/pages/auth/ForgotPassword.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Determine redirect URL based on current origin
  const redirectTo = `${window.location.origin}/auth/callback`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
          <p className="text-slate-400 mb-6">
            We sent a password reset link to <span className="text-white font-medium">{email}</span>
          </p>
          <Link to="/login" className="text-accent hover:underline text-sm">Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-1">Bar Chores</h1>
          <h2 className="text-xl text-white">Forgot Password</h2>
          <p className="text-slate-400 text-sm mt-1">Enter your email to receive a reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary"
              placeholder="admin@venue.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-slate-900 font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[48px]"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-500">
          <Link to="/login" className="text-accent hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/auth/ForgotPassword.tsx
git commit -m "feat: add ForgotPassword page for password reset requests"
```

---

## Task 6: Add auth routes to App.tsx

**Files:**
- Modify: `src/App.tsx:1-81`

**Step 1: Add imports and routes**

Add these imports after line 30 (`import NotFound from './pages/NotFound';`):

```typescript
// Auth
import AuthCallback from './pages/auth/AuthCallback';
import SetPassword from './pages/auth/SetPassword';
import ForgotPassword from './pages/auth/ForgotPassword';
```

Add these routes after line 39 (`<Route path="/superadmin/login" element={<SuperAdminLogin />} />`):

```tsx
<Route path="/auth/callback" element={<AuthCallback />} />
<Route path="/auth/set-password" element={<SetPassword />} />
<Route path="/auth/forgot-password" element={<ForgotPassword />} />
```

**Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add auth callback, set-password, and forgot-password routes"
```

---

## Task 7: Update AdminLogin with "Forgot password?" link

**Files:**
- Modify: `src/pages/admin/AdminLogin.tsx:60-74`

**Step 1: Add forgot password link after the password field**

After the password input `</div>` (line 61) and before the submit button (line 63), add:

```tsx
<div className="text-right">
  <Link to="/auth/forgot-password" className="text-sm text-accent hover:underline">
    Forgot password?
  </Link>
</div>
```

**Step 2: Commit**

```bash
git add src/pages/admin/AdminLogin.tsx
git commit -m "feat: add forgot-password link to admin login page"
```

---

## Task 8: Add `invite-admin` and `resend-invite` actions to Edge Function

**Files:**
- Modify: `supabase/functions/admin-actions/index.ts`

**Step 1: Add `invite-admin` case**

Add this case before the `default:` case (after the `delete-staff` case ending at line 248):

```typescript
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
```

**Step 2: Deploy to DEV**

```bash
supabase functions deploy admin-actions --project-ref drwflvxdvwtjzuqxfort --no-verify-jwt
```

**Step 3: Commit**

```bash
git add supabase/functions/admin-actions/index.ts
git commit -m "feat: add invite-admin, resend-invite, cancel-invite Edge Function actions"
```

---

## Task 9: Update Super Admin Dashboard with invite flow

**Files:**
- Modify: `src/pages/superadmin/SuperAdminDashboard.tsx`

**Step 1: Add invite UI alongside existing create flow**

The Super Admin dashboard currently has "Add Admin" per venue using `create-admin` (instant password). Add an "Invite Admin" button that uses the new `invite-admin` action.

Changes:
1. Add `showInvite` state and invite form alongside existing admin form
2. Add "Invite Admin" button next to existing "+ Add Admin" button per venue
3. Show "Pending" badge on admin cards where `status === 'pending'`
4. Add "Resend Invite" and "Cancel Invite" buttons for pending admins
5. Load admin profiles including the `status` field (already selecting `*`)

Key additions to state:

```typescript
const [inviteVenueId, setInviteVenueId] = useState<string | null>(null);
const [inviteEmail, setInviteEmail] = useState('');
const [inviteDisplayName, setInviteDisplayName] = useState('');
const [inviting, setInviting] = useState(false);
```

Invite form handler:

```typescript
async function handleInviteAdmin(e: React.FormEvent) {
  e.preventDefault();
  if (!inviteVenueId) return;
  setInviting(true);
  setError('');
  setMessage('');

  const { error: err } = await adminAction('invite-admin', {
    email: inviteEmail,
    display_name: inviteDisplayName,
    venue_id: inviteVenueId,
  });

  if (err) {
    setError(err);
  } else {
    setMessage(`Invite sent to ${inviteEmail}`);
    setInviteEmail(''); setInviteDisplayName('');
    setInviteVenueId(null);
    loadVenues();
  }
  setInviting(false);
}

async function handleResendInvite(admin: Profile) {
  const { error: err } = await adminAction('resend-invite', { user_id: admin.id });
  if (err) { setError(err); } else { setMessage(`Invite resent to ${admin.email}`); }
}

async function handleCancelInvite(admin: Profile) {
  if (!confirm(`Cancel invite for "${admin.display_name || admin.email}"?`)) return;
  const { error: err } = await adminAction('cancel-invite', { user_id: admin.id });
  if (err) { setError(err); } else { setMessage(`Invite cancelled`); loadVenues(); }
}
```

In the venue card admin list, add a pending badge and action buttons:

```tsx
{/* After admin name/email display */}
{(admin as any).status === 'pending' && (
  <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
    Pending
  </span>
)}

{/* In actions area */}
{(admin as any).status === 'pending' ? (
  <div className="flex gap-2">
    <button onClick={() => handleResendInvite(admin)} className="text-xs text-accent hover:text-primary">
      Resend
    </button>
    <button onClick={() => handleCancelInvite(admin)} className="text-xs text-red-400 hover:text-red-300">
      Cancel
    </button>
  </div>
) : (
  <button onClick={() => handleDeleteAdmin(admin)} className="text-xs text-red-400 hover:text-red-300">
    Remove
  </button>
)}
```

Add "Invite Admin" button next to existing "+ Add Admin" in each venue card header:

```tsx
<button
  onClick={() => { setInviteVenueId(venue.id); setAssignVenueId(null); setShowCreate(false); }}
  className="px-3 py-1.5 text-sm text-green-400 hover:text-green-300 border border-green-400/30 rounded-lg transition-colors"
>
  Invite Admin
</button>
```

Add invite form (similar to existing assign form) when `inviteVenueId` is set — no password field needed since the user sets their own via email.

**Step 2: Commit**

```bash
git add src/pages/superadmin/SuperAdminDashboard.tsx
git commit -m "feat: add invite admin flow to Super Admin dashboard"
```

---

## Task 10: Update Venue Admin Users page with invite flow

**Files:**
- Modify: `src/pages/admin/AdminUsers.tsx`

**Step 1: Add an admin invite section**

Add a new section above the staff list for managing venue admins. This section:
1. Shows a list of admins for this venue (role=venue_admin, same venue_id)
2. Has an "Invite Admin" button that opens a form (email + display name)
3. Shows "Pending" badge for pending invites
4. Has Resend/Cancel buttons for pending invites

Key additions:

```typescript
const [admins, setAdmins] = useState<Profile[]>([]);
const [showInviteForm, setShowInviteForm] = useState(false);
const [inviteEmail, setInviteEmail] = useState('');
const [inviteDisplayName, setInviteDisplayName] = useState('');
const [inviting, setInviting] = useState(false);

async function loadAdmins() {
  if (!venueId) return;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('venue_id', venueId)
    .eq('role', 'venue_admin')
    .order('display_name');
  if (data) setAdmins(data as Profile[]);
}

async function handleInviteAdmin(e: React.FormEvent) {
  e.preventDefault();
  if (!venueId) return;
  setInviting(true); setError('');

  const { error: err } = await adminAction('invite-admin', {
    email: inviteEmail,
    display_name: inviteDisplayName,
    venue_id: venueId,
  });

  if (err) { setError(err); }
  else {
    setMessage(`Invite sent to ${inviteEmail}`);
    setInviteEmail(''); setInviteDisplayName('');
    setShowInviteForm(false);
    loadAdmins();
  }
  setInviting(false);
}

async function handleResendInvite(admin: Profile) {
  const { error: err } = await adminAction('resend-invite', { user_id: admin.id });
  if (err) { setError(err); } else { setMessage(`Invite resent to ${admin.email}`); }
}

async function handleCancelInvite(admin: Profile) {
  if (!confirm(`Cancel invite for "${admin.display_name || admin.email}"?`)) return;
  const { error: err } = await adminAction('cancel-invite', { user_id: admin.id });
  if (err) { setError(err); } else { setMessage('Invite cancelled'); loadAdmins(); }
}
```

Call `loadAdmins()` in the useEffect alongside `loadUsers()`.

Render an "Admins" section above the staff section with invite form, admin list (with pending badges), and resend/cancel buttons.

**Step 2: Commit**

```bash
git add src/pages/admin/AdminUsers.tsx
git commit -m "feat: add admin invite management to venue admin users page"
```

---

## Task 11: Build and type-check

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors. If there are errors, fix them.

**Step 2: Run dev server and verify pages load**

```bash
npm run dev
```

Visit each route and verify no console errors:
- `http://localhost:5173/auth/callback` — should show spinner briefly, then error (no token)
- `http://localhost:5173/auth/set-password` — should show password form
- `http://localhost:5173/auth/forgot-password` — should show email form
- `http://localhost:5173/login` — should have "Forgot password?" link
- `http://localhost:5173/superadmin` — should have "Invite Admin" button per venue

**Step 3: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve type errors and build issues"
```

---

## Task 12: Deploy Edge Function and test invite flow on DEV

**Step 1: Deploy admin-actions to DEV**

```bash
supabase functions deploy admin-actions --project-ref drwflvxdvwtjzuqxfort --no-verify-jwt
```

**Step 2: Test Super Admin invite flow**

1. Login as Super Admin at `/superadmin/login`
2. Click "Invite Admin" on a venue
3. Enter: name "Brian", email "brian@rekom.dk"
4. Submit — should show "Invite sent to brian@rekom.dk"
5. Check DEV Supabase Auth dashboard — new user with pending invite
6. Check profiles table — new row with `status: 'pending'`
7. Check email for invite link
8. Click invite link → should land on `/auth/callback` → redirect to `/auth/set-password`
9. Set password → should redirect to `/login`
10. Login with email + new password → should land on `/admin/dashboard`
11. Check profiles table — `status` should now be `'active'`

**Step 3: Test password reset flow**

1. Go to `/login` → click "Forgot password?"
2. Enter the admin email
3. Check email — reset link should arrive
4. Click link → `/auth/callback` → `/auth/set-password`
5. Set new password → redirect to `/login`
6. Login with new password

**Step 4: Test resend and cancel invite**

1. Login as Super Admin
2. Create another invite
3. Click "Resend" → should show success
4. Click "Cancel" → should remove the pending admin

---

## Task 13: Apply migration and deploy to PROD

**Step 1: Apply status column migration to PROD**

```bash
curl -X POST "https://api.supabase.com/v1/projects/sepcdjmwdfjjieaxqoqn/database/query" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"query": "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT '\''active'\''; UPDATE profiles SET status = '\''active'\'' WHERE status IS NULL; ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('\''pending'\'', '\''active'\'', '\''inactive'\''));"}'
```

**Step 2: Deploy admin-actions to PROD**

```bash
supabase functions deploy admin-actions --project-ref sepcdjmwdfjjieaxqoqn --no-verify-jwt
```

---

## Task 14: Update documentation

**Files:**
- Modify: `Documentation/README.md`

**Step 1: Add auth flow documentation**

Add a new section after the "Authentication" section in README.md:

```markdown
## Admin Onboarding & Password Reset

### How Super Admin Creates Venue Admins
1. Super Admin logs in at `/superadmin`
2. Clicks "Invite Admin" on a venue → enters name and email
3. Supabase sends an invite email with a link to the app
4. New admin clicks the link → lands on `/auth/callback` → redirected to `/auth/set-password`
5. Sets their password → redirected to `/login`
6. Logs in with email + new password → lands on `/admin/dashboard`
7. Profile status updates from `pending` to `active`

The existing "Add Admin" (instant password) flow is still available as an alternative.

### How Venue Admins Create Additional Admins
1. Venue Admin goes to `/admin/users`
2. Clicks "Invite Admin" → enters name and email
3. Same email flow as above — invite is scoped to their venue only
4. New admin appears in the admin list with a "Pending" badge
5. Venue Admin can resend or cancel the invite

### Password Reset Flow
1. Admin visits `/login` → clicks "Forgot password?"
2. Enters email → receives reset email
3. Clicks link → `/auth/callback` → `/auth/set-password`
4. Sets new password → redirected to `/login`

### Auth Callback URL Configuration
Both Supabase projects must have these auth settings:

**PROD** (`sepcdjmwdfjjieaxqoqn`):
- Site URL: `https://bar-chores-app.vercel.app`
- Redirect URLs: `.../auth/callback`, `.../auth/set-password`

**DEV** (`drwflvxdvwtjzuqxfort`):
- Site URL: `https://bar-chores-dev.vercel.app`
- Redirect URLs: `.../auth/callback`, `.../auth/set-password`, plus `http://localhost:5173/auth/callback`, `http://localhost:5173/auth/set-password`
```

Also add the new routes to the routes table:

```markdown
| `/auth/callback` | Public | Handles email link redirects |
| `/auth/set-password` | Public | Set/reset password form |
| `/auth/forgot-password` | Public | Request password reset |
```

**Step 2: Commit**

```bash
git add Documentation/README.md
git commit -m "docs: add admin onboarding and password reset documentation"
```

---

## Summary of all files

| Action | File |
|--------|------|
| Create | `supabase/migrations/005_profile_status.sql` |
| Create | `src/pages/auth/AuthCallback.tsx` |
| Create | `src/pages/auth/SetPassword.tsx` |
| Create | `src/pages/auth/ForgotPassword.tsx` |
| Modify | `src/types/database.ts` (add `status` field + `ProfileStatus` type) |
| Modify | `src/App.tsx` (add 3 routes + 3 imports) |
| Modify | `src/pages/admin/AdminLogin.tsx` (add forgot-password link) |
| Modify | `supabase/functions/admin-actions/index.ts` (add 3 action cases) |
| Modify | `src/pages/superadmin/SuperAdminDashboard.tsx` (add invite flow) |
| Modify | `src/pages/admin/AdminUsers.tsx` (add admin invite section) |
| Modify | `Documentation/README.md` (add auth flow docs) |
