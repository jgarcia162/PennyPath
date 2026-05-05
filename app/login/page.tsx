import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '../../lib/supabase/server';
import LoginClient from './LoginClient';

type LoginPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect('/dashboard');
  }
  const { reason } = await searchParams;
  return <LoginClient sessionEndReason={reason} />;
}
