import { NextResponse } from 'next/server';

import { deleteAnonymousAuthUserIfPresent } from '../../../../lib/auth/logout-anonymous';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

/**
 * Best-effort cleanup when a trial tab closes (`pagehide` + `fetch(..., { keepalive: true })`).
 * Only deletes **anonymous** auth users (Take a peek); no-op for signed-in email users.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { wasAnonymous } = await deleteAnonymousAuthUserIfPresent(supabase);
  if (wasAnonymous) {
    await supabase.auth.signOut();
  }
  return new NextResponse(null, { status: 204 });
}
