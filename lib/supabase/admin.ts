import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../types/supabase';

/**
 * Service-role client for server-only admin operations (e.g. deleting anonymous trial users).
 * Never import this from client components.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
