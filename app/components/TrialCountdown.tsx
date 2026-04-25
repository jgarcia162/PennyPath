'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { clearTrialSession, getTrialEndsAtMs, isTrialSessionActive } from '../../lib/trial/trial-session';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TrialCountdown() {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const dlgRef = useRef<HTMLDialogElement | null>(null);

  const active = useMemo(() => (typeof window === 'undefined' ? false : isTrialSessionActive()), []);

  useEffect(() => {
    if (!active) return;

    const endsAt = getTrialEndsAtMs();
    if (!endsAt) return;

    let raf = 0;
    let interval: number | null = null;

    const tick = () => {
      const next = endsAt - Date.now();
      setRemainingMs(next);
      if (next <= 0) {
        setExpired(true);
        if (interval) window.clearInterval(interval);
      }
    };

    tick();
    interval = window.setInterval(tick, 250);

    return () => {
      if (interval) window.clearInterval(interval);
      if (raf) window.cancelAnimationFrame(raf);
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
    clearTrialSession();
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    window.location.href = '/login';
  }

  if (!active || remainingMs == null) return null;

  const remainingLabel = remainingMs > 0 ? formatRemaining(remainingMs) : '0:00';

  return (
    <>
      <div
        className="trial-countdown"
        role="status"
        aria-label="Trial time remaining"
        title="Trial time remaining"
      >
        Trial: <strong>{remainingLabel}</strong>
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

