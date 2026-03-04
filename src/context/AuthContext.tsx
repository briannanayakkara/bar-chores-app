import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import { logger } from '../lib/logger';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isStaffAuth: boolean;
}

interface AuthContextType extends AuthState {
  adminLogin: (email: string, password: string) => Promise<{ error: string | null }>;
  staffLogin: (username: string, pin: string, venueId: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CLEAR_STATE: AuthState = { session: null, user: null, profile: null, loading: false, isStaffAuth: false };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Fetch profile using raw fetch() — bypasses the Supabase JS client pipeline
 * which hangs on some corporate networks.
 */
async function fetchProfileDirect(userId: string, accessToken: string): Promise<Profile | null> {
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`;
  logger.auth(`Direct-fetching profile for ${userId}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.error(`Profile fetch HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      logger.auth('Profile loaded OK', { role: data[0].role, venue_id: data[0].venue_id });
      return data[0] as Profile;
    }

    logger.error('Profile query returned empty');
    return null;
  } catch (err: unknown) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Profile fetch failed', msg);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    isStaffAuth: false,
  });

  useEffect(() => {
    let mounted = true;
    logger.auth('AuthProvider init');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.auth(`onAuthStateChange: ${event}`, { hasSession: !!session });
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session) {
          setState(CLEAR_STATE);
          return;
        }

        // We have a session — fetch profile using direct fetch
        setState(prev => ({ ...prev, loading: true }));

        const profile = await fetchProfileDirect(session.user.id, session.access_token);
        if (!mounted) return;

        if (!profile) {
          logger.error('Profile fetch failed — redirecting to login');
          setState(CLEAR_STATE);
          return;
        }

        const isStaff = profile.role === 'staff';
        setState({ session, user: session.user, profile, loading: false, isStaffAuth: isStaff });
      }
    );

    // Safety net: if nothing happens within 20s, stop the spinner
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setState(prev => {
          if (!prev.loading) return prev;
          logger.error('Auth safety timeout — stopping spinner');
          return { ...prev, loading: false };
        });
      }
    }, 20000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  async function adminLogin(email: string, password: string) {
    logger.auth(`Admin login: ${email}`);
    setState(prev => ({ ...prev, loading: true }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logger.error('Admin login failed', error.message);
      setState(prev => ({ ...prev, loading: false }));
      return { error: error.message };
    }
    logger.auth('Admin login OK — waiting for onAuthStateChange');
    return { error: null };
  }

  async function staffLogin(username: string, pin: string, venueId: string) {
    logger.auth(`Staff login: ${username} @ ${venueId}`);

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('staff-auth', {
        body: { username, pin, venue_id: venueId },
      });

      if (invokeErr) {
        logger.error('Staff auth Edge Function failed', invokeErr.message);
        const msg = (invokeErr as any)?.context?.json
          ? (await (invokeErr as any).context.json().catch(() => null))?.error
          : null;
        return { error: msg || 'Login failed — please try again' };
      }
      if (data?.error) {
        logger.error('Staff auth rejected', data.error);
        return { error: data.error };
      }

      const { token_hash } = data;
      if (!token_hash) {
        logger.error('No token_hash in staff-auth response');
        return { error: 'Login failed — no token received' };
      }

      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'magiclink',
      });

      if (verifyErr) {
        logger.error('verifyOtp failed', verifyErr.message);
        return { error: 'Session setup failed — please try again' };
      }

      logger.auth('Staff login OK');
      return { error: null };
    } catch (err) {
      logger.error('Staff login unexpected error', String(err));
      return { error: 'Connection error — please try again' };
    }
  }

  async function refreshProfile() {
    if (!state.session) return;
    const profile = await fetchProfileDirect(state.session.user.id, state.session.access_token);
    if (profile) {
      setState(s => ({ ...s, profile }));
    }
  }

  async function logout() {
    logger.auth('Logout');
    await supabase.auth.signOut().catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ ...state, adminLogin, staffLogin, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
