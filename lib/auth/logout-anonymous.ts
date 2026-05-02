import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseAdminClient } from '../supabase/admin';
import { isAnonymousAuthUser } from './anonymous-user';

/**
 * If the current session is an anonymous user, delete their `auth.users` row (cascades to
 * `profiles` and app tables). Always call `signOut()` after this in the route handler.
 *
 * Returns whether the user was anonymous (whether delete was attempted).
 */
export async function deleteAnonymousAuthUserIfPresent(
  supabase: SupabaseClient
): Promise<{ wasAnonymous: boolean; userId: string | null }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { wasAnonymous: false, userId: null };
  }
  if (!isAnonymousAuthUser(user)) {
    return { wasAnonymous: false, userId: null };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[auth] SUPABASE_SERVICE_ROLE_KEY is not set; cannot remove anonymous trial user from Supabase.'
      );
    }
    return { wasAnonymous: true, userId: user.id };
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr && typeof console !== 'undefined' && console.error) {
    console.error('[auth] admin.deleteUser failed', delErr);
  }
  return { wasAnonymous: true, userId: user.id };
}
