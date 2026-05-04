'use client';

import { useEffect, useRef, useState } from 'react';

import { AppLoadingOverlay } from './AppLoadingOverlay';
import { clearTrialSession, getTrialEndsAtMs, isTrialSessionActive } from '../../lib/trial/trial-session';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TrialCountdown() {
  const [expired, setExpired] = useState(false);
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const labelRef = useRef<HTMLElement>(null);

  const [active, setActive] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const sync = () => {
      setActive(typeof window !== 'undefined' && isTrialSessionActive());
    };
    sync();
    window.addEventListener('pennypath:trialchange', sync as any);
    return () => {
      window.removeEventListener('pennypath:trialchange', sync as any);
    };
  }, []);

  useEffect(() => {
    if (!active) return;

    const endsAt = getTrialEndsAtMs();
    if (!endsAt) return;

    let interval: number | null = null;

    const tick = () => {
      const next = endsAt - Date.now();
      const el = labelRef.current;
      if (el) el.textContent = next > 0 ? formatRemaining(next) : '0:00';
      if (next <= 0) {
        if (interval != null) {
          window.clearInterval(interval);
          interval = null;
        }
        setExpired(true);
      }
    };

    tick();
    interval = window.setInterval(tick, 250);

    return () => {
      if (interval != null) window.clearInterval(interval);
    };
  }, [active]);

  useEffect(() => {
    if (!expired) return;
    const dlg = dlgRef.current;
    if (!dlg) return;
    try {
      if (typeof dlg.showModal === 'function') dlg.showModal();
    } catch {
      // ignore
    }
  }, [expired]);

  async function logoutAndReset() {
    setSigningOut(true);
    clearTrialSession();
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    window.location.href = '/login';
  }

  if (!active) return null;

  const endsAt = getTrialEndsAtMs();
  if (!endsAt) return null;

  const initialLabel = formatRemaining(endsAt - Date.now());

  return (
    <>
      {signingOut ? <AppLoadingOverlay message="Signing out…" /> : null}
      <div
        className="trial-countdown"
        role="status"
        aria-label="Trial time remaining"
        title="Trial time remaining"
      >
        Trial:{' '}
        <strong ref={labelRef} suppressHydrationWarning>
          {initialLabel}
        </strong>
      </div>

      <dialog
        ref={(n) => {
          dlgRef.current = n;
        }}
        className="trial-expired-dialog"
        aria-labelledby="trial-expired-title"
      >
        <div className="trial-expired-dialog__chrome">
          <header className="trial-expired-dialog__header">
            <h2 id="trial-expired-title" className="trial-expired-dialog__title">
              Trial expired
            </h2>
          </header>
          <div className="trial-expired-dialog__body">
            <p>Your “Take a peek” session has ended. You’ll be logged out and the trial data will reset.</p>
          </div>
          <div className="trial-expired-dialog__actions">
            <button type="button" className="trial-expired-dialog__btn" onClick={logoutAndReset}>
              OK
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
