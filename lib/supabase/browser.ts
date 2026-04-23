import { createBrowserClient } from '@supabase/ssr';

const SAVE_LOGIN_STORAGE_KEY = 'pennypath:save-login';

/** Initial checkbox state; defaults to true (persist) when unset. Safe on the server. */
export function getSaveLoginPreference(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    const raw = window.localStorage.getItem(SAVE_LOGIN_STORAGE_KEY);
    if (raw === null) return true; // default: persist login
    return raw === '1';
  } catch {
    return true;
  }
}

export function setSaveLoginPreference(saveLogin: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVE_LOGIN_STORAGE_KEY, saveLogin ? '1' : '0');
  } catch {
    // ignore write failures (private mode, disabled storage, etc.)
  }
}

export function createSupabaseBrowserClient(options?: { saveLogin?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const saveLogin = options?.saveLogin ?? getSaveLoginPreference();

  return createBrowserClient(url, anon, {
    auth: {
      persistSession: true,
      storage: saveLogin ? window.localStorage : window.sessionStorage,
    },
  });
}

