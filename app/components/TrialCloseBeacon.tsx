'use client';

import { useEffect } from 'react';

import { STORAGE_KEY } from '../../assets/financial-plan/plan-data';
import { clearTrialSession, isTrialSessionActive } from '../../lib/trial/trial-session';

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

      // Also clear browser-cached plan state so the next “Take a peek” starts fresh.
      clearTrialSession();
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    };

    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  return null;
}
