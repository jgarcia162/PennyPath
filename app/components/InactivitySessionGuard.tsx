'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { clearTrialSession } from '../../lib/trial/trial-session';
import { AppLoadingOverlay } from './AppLoadingOverlay';

/** Shared across tabs so one active tab resets the idle window everywhere. */
const LAST_ACTIVITY_STORAGE_KEY = 'pennypath:last-activity-at';

const INACTIVITY_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
  'pointerdown',
];

const PROTECTED_PREFIXES = ['/dashboard', '/history', '/real-estate'] as const;

function isProtectedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function InactivitySessionGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggingOutRef = useRef(false);
  const lastCrossTabWriteRef = useRef(0);

  useEffect(() => {
    if (!isProtectedPath(pathname)) {
      setSigningOut(false);
      return;
    }

    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const performIdleLogout = async () => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      clearIdleTimer();
      setSigningOut(true);
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 12_000);
      try {
        await fetch('/auth/logout', {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        });
      } catch {
        // Still navigate; cookies may be cleared partially.
      } finally {
        clearTimeout(abortTimer);
      }
      clearTrialSession();
      try {
        localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      } catch {
        // ignore
      }
      router.replace('/login?reason=inactivity');
      router.refresh();
    };

    const scheduleIdleLogout = () => {
      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        void performIdleLogout();
      }, INACTIVITY_MS);
    };

    const bumpCrossTabActivity = () => {
      const now = Date.now();
      if (now - lastCrossTabWriteRef.current < 1000) return;
      lastCrossTabWriteRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
      } catch {
        // ignore
      }
    };

    const onLocalActivity = () => {
      if (loggingOutRef.current) return;
      scheduleIdleLogout();
      bumpCrossTabActivity();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== LAST_ACTIVITY_STORAGE_KEY || e.newValue == null) return;
      if (loggingOutRef.current) return;
      scheduleIdleLogout();
    };

    scheduleIdleLogout();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onLocalActivity, { passive: true });
    }
    window.addEventListener('storage', onStorage);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onLocalActivity);
      }
      window.removeEventListener('storage', onStorage);
      clearIdleTimer();
    };
  }, [pathname, router]);

  return signingOut ? <AppLoadingOverlay message="Signing out…" ariaLabel="Signing out" /> : null;
}
