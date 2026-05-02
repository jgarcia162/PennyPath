import { NextResponse } from 'next/server';

import { deleteAnonymousAuthUserIfPresent } from '../../../lib/auth/logout-anonymous';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await deleteAnonymousAuthUserIfPresent(supabase);
  await supabase.auth.signOut();

  const url = new URL('/login', request.url);
  return NextResponse.redirect(url, { status: 303 });
}

