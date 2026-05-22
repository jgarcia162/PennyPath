'use client';

import { useEffect } from 'react';

import { isTrialSessionActive } from '../../lib/trial/trial-session';

/**
 * When the user closes the tab/window during an active trial, `beforeunload` is unreliable for
 * async work. `pagehide` + `keepalive` fetch lets the server delete the anonymous Supabase user
 * (and cascade `profiles`) using the session cookie.
 */
export function TrialCloseBeacon() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPageHide = () => {
      if (!isTrialSessionActive()) return;
      try {
        fetch('/api/auth/trial-cleanup', {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
        });
      } catch {
        // ignore
      }

    };

    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  return null;
}
