import { supabase } from './supabase';

/**
 * Call the admin-actions Edge Function.
 * The caller's JWT is sent automatically via the Authorization header.
 * The Edge Function verifies the caller's role server-side.
 */
export async function adminAction<T = Record<string, unknown>>(
  action: string,
  params: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('admin-actions', {
    body: { action, ...params },
  });

  if (error) {
    return { data: null, error: error.message || 'Edge Function call failed' };
  }

  if (data?.error) {
    return { data: null, error: data.error };
  }

  return { data: data as T, error: null };
}
