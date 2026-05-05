import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '../../lib/supabase/server';
import LoginClient from './LoginClient';

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect('/dashboard');
  }
  return <LoginClient />;
}
