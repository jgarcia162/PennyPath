import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function POST(request: Request) {
  const email = process.env.TRIAL_ACCOUNT_EMAIL;
  const password = process.env.TRIAL_ACCOUNT_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      {
        error:
          'Missing TRIAL_ACCOUNT_EMAIL / TRIAL_ACCOUNT_PASSWORD environment variables. Create a Supabase user for the trial account and set these env vars.',
      },
      { status: 500 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const url = new URL('/dashboard', request.url);
  url.searchParams.set('trial', '1');
  return NextResponse.redirect(url, { status: 303 });
}

