import type { User } from '@supabase/supabase-js';

/** True for Supabase anonymous sign-in (`signInAnonymously`), including “Take a peek” trial. */
export function isAnonymousAuthUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const withFlag = user as User & { is_anonymous?: boolean };
  if (withFlag.is_anonymous === true) return true;
  const ids = user.identities;
  // Note: [].every(...) is true in JS; require at least one identity.
  if (Array.isArray(ids) && ids.length > 0) {
    return ids.every((i) => i.provider === 'anonymous');
  }
  return false;
}
