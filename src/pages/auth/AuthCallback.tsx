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
